import { streamSSE } from 'hono/streaming';
import { and, desc, eq, ilike, or } from 'drizzle-orm';
import { articles, rotes, type User } from '../../drizzle/schema';
import { authenticateJWT } from '../../middleware/jwtAuth';
import type { HonoContext, HonoVariables } from '../../types/hono';
import type { AiProviderConfig } from '../../types/config';
import {
  createChatCompletion,
  createChatCompletionStreamParts,
  probeChatProviderToolCalling,
} from '../../utils/ai/client';
import { runRoteAgentStream, type RoteAgentStreamEvent } from '../../utils/ai/agent/runtime';
import { getOwnerAiMemoryStats, getStoredAiConfig } from '../../utils/dbMethods';
import db from '../../utils/drizzle';
import { bodyTypeCheck, createResponse } from '../../utils/main';
import type { Hono } from 'hono';

const LOCAL_CONTEXT_LIMIT = 8;

function normalizeLocalContextQuery(value: unknown): string {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120);
}

function getLocalContextTerms(query: string): string[] {
  const terms = query.match(/[\p{L}\p{N}_]{2,}/gu) || [];
  return Array.from(new Set(terms.map((term) => term.trim()).filter(Boolean))).slice(0, 5);
}

function truncateLocalContext(value: string, limit = 1600): string {
  const text = String(value || '')
    .replace(/\s+/g, ' ')
    .trim();
  return text.length > limit ? `${text.slice(0, limit)}...` : text;
}

function localSourcePreview(text: string): string {
  return truncateLocalContext(text, 180);
}

async function buildPersonalAiContext(user: User, body: any) {
  const query = normalizeLocalContextQuery(body?.message);
  const terms = getLocalContextTerms(query);
  const limit = Math.max(1, Math.min(Number(body?.limit) || LOCAL_CONTEXT_LIMIT, 20));

  const roteSearch =
    terms.length > 0
      ? or(
          ...terms.flatMap((term) => [
            ilike(rotes.title, `%${term}%`),
            ilike(rotes.content, `%${term}%`),
          ])
        )
      : undefined;
  const articleSearch =
    terms.length > 0 ? or(...terms.map((term) => ilike(articles.content, `%${term}%`))) : undefined;

  const [initialRoteRows, initialArticleRows, memoryStats] = await Promise.all([
    db
      .select({
        id: rotes.id,
        title: rotes.title,
        content: rotes.content,
        tags: rotes.tags,
        state: rotes.state,
        archived: rotes.archived,
        createdAt: rotes.createdAt,
        updatedAt: rotes.updatedAt,
      })
      .from(rotes)
      .where(
        roteSearch
          ? and(eq(rotes.authorid, user.id), roteSearch)
          : and(eq(rotes.authorid, user.id), eq(rotes.archived, false))
      )
      .orderBy(desc(rotes.updatedAt))
      .limit(limit),
    db
      .select({
        id: articles.id,
        content: articles.content,
        createdAt: articles.createdAt,
        updatedAt: articles.updatedAt,
      })
      .from(articles)
      .where(
        articleSearch
          ? and(eq(articles.authorId, user.id), articleSearch)
          : eq(articles.authorId, user.id)
      )
      .orderBy(desc(articles.updatedAt))
      .limit(Math.max(1, Math.floor(limit / 2))),
    getOwnerAiMemoryStats(user.id),
  ]);
  let roteRows = initialRoteRows;
  let articleRows = initialArticleRows;

  if (terms.length > 0 && roteRows.length === 0 && articleRows.length === 0) {
    const [recentRoteRows, recentArticleRows] = await Promise.all([
      db
        .select({
          id: rotes.id,
          title: rotes.title,
          content: rotes.content,
          tags: rotes.tags,
          state: rotes.state,
          archived: rotes.archived,
          createdAt: rotes.createdAt,
          updatedAt: rotes.updatedAt,
        })
        .from(rotes)
        .where(and(eq(rotes.authorid, user.id), eq(rotes.archived, false)))
        .orderBy(desc(rotes.updatedAt))
        .limit(limit),
      db
        .select({
          id: articles.id,
          content: articles.content,
          createdAt: articles.createdAt,
          updatedAt: articles.updatedAt,
        })
        .from(articles)
        .where(eq(articles.authorId, user.id))
        .orderBy(desc(articles.updatedAt))
        .limit(Math.max(1, Math.floor(limit / 2))),
    ]);
    roteRows = recentRoteRows;
    articleRows = recentArticleRows;
  }

  const sources = [
    ...roteRows.map((rote) => {
      const text = `Title: ${rote.title || ''}\nTags: ${(rote.tags || []).join(', ')}\n${truncateLocalContext(
        rote.content
      )}`;
      return {
        sourceType: 'rote' as const,
        sourceId: rote.id,
        similarity: 0,
        text,
        preview: localSourcePreview(text),
        metadata: {
          title: rote.title || '',
          tags: rote.tags || [],
          state: rote.state,
          archived: rote.archived,
          createdAt: rote.createdAt,
          updatedAt: rote.updatedAt,
        },
      };
    }),
    ...articleRows.map((article) => {
      const title = truncateLocalContext(article.content, 80);
      const text = truncateLocalContext(article.content);
      return {
        sourceType: 'article' as const,
        sourceId: article.id,
        similarity: 0,
        text,
        preview: localSourcePreview(text),
        metadata: {
          title,
          tags: [],
          createdAt: article.createdAt,
          updatedAt: article.updatedAt,
        },
      };
    }),
  ].slice(0, limit);

  const evidence = sources
    .map(
      (source, index) => `[${index + 1}] ${source.sourceType}:${source.sourceId}\n${source.text}`
    )
    .join('\n\n');
  const messages = [
    {
      role: 'system' as const,
      content:
        'You are Rote AI Memory. Answer using the user provided Rote context when it is relevant. If the context is insufficient, say so briefly. Do not invent notes. Cite useful sources with [1], [2], etc.',
    },
    {
      role: 'user' as const,
      content: `Rote context:\n${evidence || 'No matching local context was found.'}\n\nQuestion:\n${query}`,
    },
  ];

  return { messages, sources, memoryStats };
}

function normalizeSourcePreview(text: unknown): string {
  return String(text || '')
    .replace(/^(Title:[^\n]*\n)?(Tags:[^\n]*\n)?/i, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 180);
}

function toClientSource(source: any) {
  const metadata = source?.metadata || {};
  const tags = Array.isArray(metadata.tags)
    ? metadata.tags.filter((tag: unknown) => typeof tag === 'string').slice(0, 8)
    : [];

  return {
    sourceType: source.sourceType,
    sourceId: source.sourceId,
    similarity: Number(source.similarity) || 0,
    preview: normalizeSourcePreview(source.text),
    metadata: {
      title: typeof metadata.title === 'string' ? metadata.title : '',
      tags,
      state: typeof metadata.state === 'string' ? metadata.state : undefined,
      archived: typeof metadata.archived === 'boolean' ? metadata.archived : undefined,
      createdAt: metadata.createdAt,
    },
  };
}

async function writeSseEvent(
  stream: Parameters<Parameters<typeof streamSSE>[1]>[0],
  event: string,
  data: unknown
): Promise<void> {
  await stream.writeSSE({
    event,
    data: JSON.stringify(data),
  });
}

async function writeAgentSseEvent(
  stream: Parameters<Parameters<typeof streamSSE>[1]>[0],
  event: RoteAgentStreamEvent
): Promise<void> {
  const data = { ...(event as any) };
  delete data.type;
  if (event.type === 'sources') {
    data.sources = Array.isArray(event.sources) ? event.sources.map(toClientSource) : [];
  }
  await writeSseEvent(stream, event.type, data);
}

function personalProviderConfig(provider: any, providerId: string): AiProviderConfig {
  return {
    providerId,
    apiFormat: 'openai_compatible',
    baseUrl: String(provider.baseUrl || ''),
    model: String(provider.model || ''),
    apiKey: String(provider.apiKey || ''),
  };
}

export function registerPersonalAiRoutes(router: Hono<{ Variables: HonoVariables }>) {
  router.post('/local-context', authenticateJWT, bodyTypeCheck, async (c: HonoContext) => {
    const user = c.get('user') as User;
    const body = await c.req.json();
    return c.json(createResponse(await buildPersonalAiContext(user, body)), 200);
  });

  router.post('/personal-remote/stream', authenticateJWT, bodyTypeCheck, async (c: HonoContext) => {
    const user = c.get('user') as User;
    const body = await c.req.json();
    const provider = body?.provider || {};
    const config = personalProviderConfig(provider, 'personal-remote');
    const temperature = Number(provider.temperature);

    return streamSSE(c, async (stream) => {
      try {
        await stream.write(': connected\n\n');
        if (!config.baseUrl.trim()) throw new Error('Personal remote AI base URL is required');
        if (!config.model.trim()) throw new Error('Personal remote AI model is required');

        const context = await buildPersonalAiContext(user, body);
        await writeSseEvent(stream, 'sources', { sources: context.sources.map(toClientSource) });

        let lastUsage: any = null;
        for await (const part of createChatCompletionStreamParts(config, context.messages, {
          temperature: Number.isFinite(temperature) ? temperature : 0.2,
        })) {
          if (part.type === 'reasoning') {
            await writeSseEvent(stream, 'thinking', { phase: 'answer', text: part.text });
          } else if (part.type === 'usage') {
            lastUsage = part.usage;
          } else if (part.text) {
            await writeSseEvent(stream, 'delta', { text: part.text });
          }
        }

        if (lastUsage) await writeSseEvent(stream, 'usage', { phase: 'answer', usage: lastUsage });
        await writeSseEvent(stream, 'done', {});
      } catch (error: any) {
        await writeSseEvent(stream, 'error', {
          message: error?.message || 'Personal remote AI stream failed',
        });
      }
    });
  });

  router.post('/personal-remote/test', authenticateJWT, bodyTypeCheck, async (c: HonoContext) => {
    const body = await c.req.json();
    const config = personalProviderConfig(body?.provider || {}, 'personal-remote');
    const startedAt = Date.now();
    const result = await createChatCompletion(
      config,
      [
        { role: 'system', content: 'You are a connectivity test endpoint.' },
        { role: 'user', content: 'Reply with OK.' },
      ],
      { temperature: 0 }
    );
    const toolCalling = await probeChatProviderToolCalling(config);

    return c.json(
      createResponse(
        {
          success: true,
          model: config.model,
          latencyMs: Date.now() - startedAt,
          sample: result.content.slice(0, 120),
          usage: result.usage,
          toolCalling,
        },
        toolCalling.supported
          ? 'Personal remote AI test successful'
          : 'Personal remote AI chat works, but tool calling was not detected'
      ),
      200
    );
  });

  router.post('/personal-agent/stream', authenticateJWT, bodyTypeCheck, async (c: HonoContext) => {
    const user = c.get('user') as User;
    const body = await c.req.json();
    const message = String(body?.message || '').trim();
    const personalChatConfig = personalProviderConfig(body?.provider || {}, 'personal-agent');

    if (!message) return c.json(createResponse(null, 'Message is required'), 400);

    return streamSSE(c, async (stream) => {
      try {
        await stream.write(': connected\n\n');
        if (!personalChatConfig.baseUrl.trim()) throw new Error('Personal AI base URL is required');
        if (!personalChatConfig.model.trim()) throw new Error('Personal AI model is required');

        const storedConfig = await getStoredAiConfig();
        await runRoteAgentStream({
          userId: user.id,
          request: {
            message,
            mode: body?.mode,
            history: body?.history,
            state: body?.state,
            selectedContext: body?.selectedContext,
            debug: body?.debug,
            limit: body?.limit,
            previousPlan: body?.previousPlan,
            excludeIds: body?.excludeIds,
            pendingPlan: body?.pendingPlan,
            clarificationAnswer: body?.clarificationAnswer,
          },
          config: {
            ...storedConfig,
            enabled: true,
            chat: personalChatConfig,
          },
          policy: {
            maxSources: 4,
            maxSourceChars: 800,
            maxToolCalls: 5,
          },
          emit: (event) => writeAgentSseEvent(stream, event),
        });
      } catch (error: any) {
        await writeSseEvent(stream, 'error', {
          message: error?.message || 'Personal AI agent stream failed',
        });
      }
    });
  });
}
