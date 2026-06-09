import { authService } from './auth';
import { get, getApiUrl, post, refreshAccessToken } from './api';
import { isLocalPersonalAiProvider, type PersonalAiProviderConfig } from '@/state/localAi';

export type AiSourceType = 'rote' | 'article';

export interface AiStatus {
  enabled: boolean;
  vectorEnabled: boolean;
  publicExploreVectorEnabled: boolean;
  eligible: boolean;
  available: boolean;
  chatAvailable?: boolean;
  chatProviderId?: string;
  chatModel?: string;
  chatMode?: 'disabled' | 'site' | 'local';
  memoryStats?: {
    roteCount: number;
    indexedRoteCount: number;
  };
}

export interface AiSemanticResult {
  id?: string;
  ownerId?: string;
  sourceType: AiSourceType;
  sourceId: string;
  chunkIndex?: number;
  text?: string;
  preview?: string;
  similarity: number;
  metadata: {
    title?: string;
    tags?: string[];
    state?: string;
    archived?: boolean;
    createdAt?: string;
    updatedAt?: string;
    [key: string]: unknown;
  };
}

export interface AiChatResponse {
  answer: string;
  sources: AiSemanticResult[];
  plan?: PlannerAgentDto;
  clarification?: AiClarification;
}

export interface AiLocalContextResponse {
  messages: { role: 'system' | 'user' | 'assistant'; content: string }[];
  sources: AiSemanticResult[];
  memoryStats?: {
    roteCount: number;
    indexedRoteCount: number;
  };
}

export type AiToolCallingProbeResult = {
  supported: boolean;
  message: string;
  toolName?: string;
  arguments?: Record<string, unknown>;
  rawContent?: string;
  error?: string;
};

export interface AiProviderTestResult {
  success: boolean;
  eligible?: boolean;
  chatAvailable?: boolean;
  vectorAvailable?: boolean;
  model?: string;
  latencyMs?: number;
  sample?: string;
  usage?: AiTokenUsage;
  toolCalling?: AiToolCallingProbeResult;
}

export type AiProviderTestProgressStep = 'site' | 'personal_remote' | 'local_chat' | 'tool_calling';

export type AiProviderTestProgressHandler = (step: AiProviderTestProgressStep) => void;

export type LifecycleScope = 'active' | 'archived' | 'all' | 'unspecified';
export type TaskStatusScope = 'open' | 'closed' | 'all' | 'unspecified';

export interface NormalizedTimeRange {
  from: string;
  to: string;
  label: string;
}

export interface RetrievalScope {
  ownerId: string;
  query: string;
  tags: string[];
  excludeTags: string[];
  semanticScope: string[];
  sourceTypes: AiSourceType[];
  timeRange: NormalizedTimeRange | null;
  lifecycleScope: LifecycleScope;
  taskStatusScope: TaskStatusScope;
  limit: number;
  cursor: string | null;
  excludeIds: string[];
}

export interface RetrievalSnippet {
  id: string;
  sourceType: AiSourceType;
  sourceId: string;
  title?: string;
  tags?: string[];
  createdAt?: string;
  similarity: number;
  text: string;
}

export interface RetrievalToolResult {
  canonicalizedArgs: RetrievalScope;
  resultCount: number;
  topSnippets: RetrievalSnippet[];
  cursor: string | null;
  warnings: string[];
}

export interface PlannerDebugTrace {
  toolCalls: Array<{ step: number; name: string; args: unknown }>;
  canonicalizedArgs: RetrievalScope[];
  warnings: string[];
  probeCounts: number[];
  finishReason?: string;
  fallbackReason?: string;
  providerError?: string;
  toolError?: string;
}

export interface PlannerAgentDto {
  originalMessage: string;
  retrievalNeeded: boolean;
  scope: RetrievalScope | null;
  toolResult: RetrievalToolResult | null;
  clarification: { question: string; reason?: string } | null;
  debugTrace: PlannerDebugTrace;
}

export interface AiClarification {
  question: string;
  pendingPlan?: PlannerAgentDto | null;
}

export type AiAgentPhase =
  | 'understanding'
  | 'planning'
  | 'tool_calling'
  | 'retrieving'
  | 'reading'
  | 'answering';

export type AiAgentToolProgressStatus =
  | 'determining_scope'
  | 'retrieving_sources'
  | 'reading_source'
  | 'finding_related'
  | 'loading_tags';

export type AiUsagePhase = 'planning' | 'tool_decision' | 'answer';
export type AiThinkingPhase =
  | 'route_decision'
  | 'evidence_decision'
  | 'retrieval_planning'
  | 'answer';

export type AiTokenUsage = {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
};

export interface AiAgentClientState {
  conversationId?: string;
  previousPlan?: PlannerAgentDto | null;
  seenSourceIds?: string[];
  selectedContext?: {
    currentRoteId?: string;
    currentArticleId?: string;
    selectedSourceIds?: string[];
    selectedTags?: string[];
  } | null;
  stateVersion?: number;
}

export type AiChatStreamHandlers = {
  onRunStarted?: (runId: string) => void;
  onProgress?: (phase: AiAgentPhase) => void;
  onHeartbeat?: (heartbeat: { phase: AiAgentPhase; seq: number; timestamp: string }) => void;
  onToolStarted?: (toolName: string, args?: unknown) => void;
  onToolProgress?: (toolName: string, status: AiAgentToolProgressStatus) => void;
  onToolFinished?: (toolName: string, summary?: string) => void;
  onPlan?: (plan: PlannerAgentDto) => void;
  onClarification?: (clarification: AiClarification) => void;
  onSources?: (sources: AiSemanticResult[]) => void;
  onThinking?: (phase: AiThinkingPhase, text: string) => void;
  onDelta?: (text: string) => void;
  onStatePatch?: (state: Partial<AiAgentClientState>) => void;
  onUsage?: (usage: AiTokenUsage, phase: AiUsagePhase) => void;
  onDone?: () => void;
  onError?: (message: string) => void;
};

export type ClientAgentBootstrap = {
  systemPrompt: string;
  finalAnswerInstruction: string;
  tools: Array<{
    type: 'function';
    function: {
      name: string;
      description: string;
      parameters: Record<string, unknown>;
    };
  }>;
  policy: {
    maxIterations: number;
    maxToolCalls: number;
    maxSources: number;
  };
};

export type ClientAgentToolResult = {
  observations: string[];
  displaySummary?: unknown;
  modelContent: string;
  sources: AiSemanticResult[];
  plan?: PlannerAgentDto;
  statePatch?: Partial<AiAgentClientState>;
  state: AiAgentClientState;
  sourceKeys: string[];
  clarification?: AiClarification;
};

export const getAiStatus = () => get('/ai/status').then((res) => res.data as AiStatus);

export const getAiLocalContext = (payload: {
  message: string;
  limit?: number;
  history?: { role: 'user' | 'assistant'; content: string }[];
}) => post('/ai/local-context', payload).then((res) => res.data as AiLocalContextResponse);

export const testSiteAiProvider = (onProgress?: AiProviderTestProgressHandler) => {
  onProgress?.('site');
  return post('/ai/site/test', {}).then((res) => ({
    data: res.data as AiProviderTestResult,
    message: res.message,
  }));
};

export const testPersonalRemoteAiProvider = (
  provider: PersonalAiProviderConfig,
  onProgress?: AiProviderTestProgressHandler
) => {
  onProgress?.('personal_remote');
  return post('/ai/personal-remote/test', { provider }).then((res) => ({
    data: res.data as AiProviderTestResult,
    message: res.message,
  }));
};

export const testPersonalAiProvider = (
  provider: PersonalAiProviderConfig,
  onProgress?: AiProviderTestProgressHandler
) =>
  isLocalPersonalAiProvider(provider)
    ? testPersonalLocalAiProvider(provider, onProgress)
    : testPersonalRemoteAiProvider(provider, onProgress);

export type AiChatPayload = {
  message: string;
  mode?: 'chat' | 'review' | 'organize';
  limit?: number;
  pendingPlan?: PlannerAgentDto | null;
  clarificationAnswer?: string;
  previousPlan?: PlannerAgentDto | null;
  excludeIds?: string[];
  history?: { role: 'user' | 'assistant'; content: string }[];
  state?: AiAgentClientState | null;
  debug?: boolean;
};

export const aiChat = (payload: AiChatPayload) =>
  post('/ai/chat', payload).then((res) => res.data as AiChatResponse);

export const getClientAgentBootstrap = () =>
  get('/ai/client-agent/bootstrap').then((res) => res.data as ClientAgentBootstrap);

export const executeClientAgentTool = (payload: {
  toolName: string;
  arguments: unknown;
  request: AiChatPayload;
  state?: AiAgentClientState | null;
  sourceKeys?: string[];
}) =>
  post('/ai/client-agent/tools/execute', payload).then((res) => res.data as ClientAgentToolResult);

async function createAiStreamRequest(
  endpoint:
    | '/ai/chat/stream'
    | '/ai/agent/stream'
    | '/ai/personal-remote/stream'
    | '/ai/personal-agent/stream',
  payload: AiChatPayload | (AiChatPayload & { provider: PersonalAiProviderConfig }),
  signal?: AbortSignal
) {
  let token = authService.getAccessToken();
  const request = () =>
    fetch(`${getApiUrl()}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(payload),
      signal,
    });

  let response = await request();
  if (response.status === 401 && authService.hasValidRefreshToken()) {
    token = await refreshAccessToken();
    response = await request();
  }

  return response;
}

async function readResponseError(response: Response): Promise<string> {
  const text = await response.text();
  try {
    const body = JSON.parse(text);
    return body?.message || body?.error?.message || `Request failed with ${response.status}`;
  } catch {
    const plainText = text
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (/Connection Closed|SGErrorDomain|Policy:/i.test(plainText)) {
      return `Local AI request was intercepted or closed by a proxy client. Add 127.0.0.1/localhost to the proxy bypass list, or try switching Base URL between http://127.0.0.1:8080/v1 and http://localhost:8080/v1. ${plainText.slice(0, 240)}`;
    }
    return plainText || text || `Request failed with ${response.status}`;
  }
}

function parseSseEvent(block: string): { event: string; data: unknown } | null {
  let event = 'message';
  const dataLines: string[] = [];

  block.split('\n').forEach((line) => {
    if (line.startsWith('event:')) {
      event = line.slice(6).trim();
    } else if (line.startsWith('data:')) {
      dataLines.push(line.slice(5).trimStart());
    }
  });

  if (dataLines.length === 0) return null;

  const dataText = dataLines.join('\n');
  try {
    return { event, data: JSON.parse(dataText) };
  } catch {
    return { event, data: dataText };
  }
}

export async function aiChatStream(
  payload: AiChatPayload,
  handlers: AiChatStreamHandlers,
  signal?: AbortSignal
): Promise<void> {
  const response = await createAiStreamRequest('/ai/chat/stream', payload, signal);
  await readAiStreamResponse(response, handlers);
}

export async function aiAgentStream(
  payload: AiChatPayload,
  handlers: AiChatStreamHandlers,
  signal?: AbortSignal
): Promise<void> {
  const response = await createAiStreamRequest('/ai/agent/stream', payload, signal);
  await readAiStreamResponse(response, handlers);
}

export async function personalRemoteAiStream(
  payload: AiChatPayload & { provider: PersonalAiProviderConfig },
  handlers: AiChatStreamHandlers,
  signal?: AbortSignal
): Promise<void> {
  const response = await createAiStreamRequest('/ai/personal-remote/stream', payload, signal);
  await readAiStreamResponse(response, handlers);
}

export async function personalAgentStream(
  payload: AiChatPayload & { provider: PersonalAiProviderConfig },
  handlers: AiChatStreamHandlers,
  signal?: AbortSignal
): Promise<void> {
  const response = await createAiStreamRequest('/ai/personal-agent/stream', payload, signal);
  await readAiStreamResponse(response, handlers);
}

function normalizeLocalBaseUrl(baseUrl: string): string {
  return baseUrl.trim().replace(/\/+$/, '');
}

function getLocalBaseUrlCandidates(baseUrl: string): string[] {
  const normalized = normalizeLocalBaseUrl(baseUrl);
  if (!normalized) return [];

  const candidates = [normalized];
  try {
    const url = new URL(normalized);
    const alternate =
      url.hostname === '127.0.0.1' ? 'localhost' : url.hostname === 'localhost' ? '127.0.0.1' : '';
    if (alternate) {
      url.hostname = alternate;
      candidates.push(url.toString().replace(/\/+$/, ''));
    }
  } catch {
    // Keep the original value; validation errors will surface from fetch.
  }

  return Array.from(new Set(candidates));
}

async function fetchLocalChatCompletion(
  config: PersonalAiProviderConfig,
  payload: Record<string, unknown>,
  signal?: AbortSignal
): Promise<Response> {
  let lastError: unknown;

  for (const baseUrl of getLocalBaseUrlCandidates(config.baseUrl)) {
    try {
      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : {}),
        },
        body: JSON.stringify(payload),
        signal,
      });
      const contentType = response.headers.get('content-type') || '';
      if (!response.ok || contentType.includes('text/html')) {
        throw new Error(await readResponseError(response));
      }
      return response;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Local AI request failed');
}

export async function localAiChatStream(
  config: PersonalAiProviderConfig,
  messages: { role: 'system' | 'user' | 'assistant'; content: string }[],
  handlers: Pick<AiChatStreamHandlers, 'onDelta' | 'onThinking' | 'onUsage' | 'onDone' | 'onError'>,
  signal?: AbortSignal
): Promise<void> {
  const response = await fetchLocalChatCompletion(
    config,
    {
      model: config.model,
      messages,
      temperature: config.temperature,
      stream: true,
      stream_options: { include_usage: true },
    },
    signal
  );
  if (!response.body) {
    throw new Error('Streaming response is not supported in this browser');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  const dispatch = (block: string) => {
    const dataLines = block
      .split('\n')
      .filter((line) => line.startsWith('data:'))
      .map((line) => line.slice(5).trimStart());
    if (!dataLines.length) return;

    dataLines.forEach((dataText) => {
      if (!dataText || dataText === '[DONE]') return;
      try {
        const payload = JSON.parse(dataText);
        const choice = payload?.choices?.[0];
        const delta = choice?.delta || choice?.message || {};
        const reasoning = delta.reasoning_content || delta.reasoning || '';
        const content = delta.content || '';
        if (typeof reasoning === 'string' && reasoning) {
          handlers.onThinking?.('answer', reasoning);
        }
        if (typeof content === 'string' && content) {
          handlers.onDelta?.(content);
        }
        const usage = payload?.usage;
        if (
          usage &&
          typeof usage.prompt_tokens === 'number' &&
          typeof usage.completion_tokens === 'number' &&
          typeof usage.total_tokens === 'number'
        ) {
          handlers.onUsage?.(
            {
              prompt_tokens: usage.prompt_tokens,
              completion_tokens: usage.completion_tokens,
              total_tokens: usage.total_tokens,
            },
            'answer'
          );
        }
      } catch (error: any) {
        handlers.onError?.(error?.message || 'Failed to parse local AI response');
      }
    });
  };

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, '\n');
      let boundary = buffer.indexOf('\n\n');
      while (boundary !== -1) {
        const block = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);
        dispatch(block);
        boundary = buffer.indexOf('\n\n');
      }
    }

    const tail = buffer.trim();
    if (tail) dispatch(tail);
    handlers.onDone?.();
  } finally {
    reader.releaseLock();
  }
}

export async function testPersonalLocalAiProvider(
  config: PersonalAiProviderConfig,
  onProgress?: AiProviderTestProgressHandler
): Promise<{ data: AiProviderTestResult; message: string }> {
  const startedAt = Date.now();
  onProgress?.('local_chat');
  const response = await fetchLocalChatCompletion(config, {
    model: config.model,
    messages: [
      { role: 'system', content: 'You are a connectivity test endpoint.' },
      { role: 'user', content: 'Reply with OK.' },
    ],
    temperature: 0,
    stream: false,
  });

  const body = await response.json();
  const content = body?.choices?.[0]?.message?.content;
  if (typeof content !== 'string') {
    throw new Error('Local AI returned an invalid chat completion response');
  }
  onProgress?.('tool_calling');
  const toolCalling = await probeLocalAiToolCalling(config);

  return {
    data: {
      success: true,
      model: config.model,
      latencyMs: Date.now() - startedAt,
      sample: content.slice(0, 120),
      usage: body?.usage,
      toolCalling,
    },
    message: toolCalling.supported
      ? 'Personal local AI test successful'
      : 'Personal local AI chat works, but tool calling was not detected',
  };
}

async function probeLocalAiToolCalling(
  config: PersonalAiProviderConfig
): Promise<AiToolCallingProbeResult> {
  const toolName = 'rote_tool_calling_probe';
  try {
    const response = await fetchLocalChatCompletion(config, {
      model: config.model,
      messages: [
        {
          role: 'system',
          content:
            'You are testing OpenAI-compatible tool calling. Call the provided tool exactly once. Do not answer with normal text.',
        },
        {
          role: 'user',
          content: 'Call rote_tool_calling_probe with token set to rote-tool-probe.',
        },
      ],
      temperature: 0,
      stream: false,
      tools: [
        {
          type: 'function',
          function: {
            name: toolName,
            description: 'Records that the model can emit a tool call.',
            parameters: {
              type: 'object',
              additionalProperties: false,
              properties: {
                token: {
                  type: 'string',
                  description: 'Must be rote-tool-probe.',
                },
              },
              required: ['token'],
            },
          },
        },
      ],
      tool_choice: {
        type: 'function',
        function: { name: toolName },
      },
    });

    const body = await response.json();
    const message = body?.choices?.[0]?.message;
    const toolCalls = Array.isArray(message?.tool_calls) ? message.tool_calls : [];
    const toolCall = toolCalls.find((call: any) => call?.function?.name === toolName);
    if (!toolCall) {
      return {
        supported: false,
        message: 'Chat works, but no tool call was returned by the model.',
        rawContent: typeof message?.content === 'string' ? message.content : undefined,
      };
    }

    let parsedArgs: Record<string, unknown> = {};
    try {
      const args = JSON.parse(toolCall.function?.arguments || '{}');
      if (args && typeof args === 'object' && !Array.isArray(args)) {
        parsedArgs = args;
      }
    } catch {
      return {
        supported: false,
        message: 'A tool call was returned, but its arguments were not valid JSON.',
        toolName,
        rawContent: typeof message?.content === 'string' ? message.content : undefined,
      };
    }

    return {
      supported: true,
      message: 'Tool calling detected.',
      toolName,
      arguments: parsedArgs,
      rawContent: typeof message?.content === 'string' ? message.content : undefined,
    };
  } catch (error: any) {
    return {
      supported: false,
      message: 'Tool calling probe failed.',
      error: error?.message || String(error),
    };
  }
}

async function readAiStreamResponse(
  response: Response,
  handlers: AiChatStreamHandlers
): Promise<void> {
  if (!response.ok) {
    throw new Error(await readResponseError(response));
  }
  if (!response.body) {
    throw new Error('Streaming response is not supported in this browser');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let doneReceived = false;

  const dispatch = (block: string) => {
    const parsed = parseSseEvent(block);
    if (!parsed) return;

    if (parsed.event === 'run_started') {
      const runId = (parsed.data as { runId?: string })?.runId;
      if (runId) handlers.onRunStarted?.(runId);
    } else if (parsed.event === 'progress') {
      const data = parsed.data as { phase?: AiAgentPhase; message?: string };
      if (data.phase) handlers.onProgress?.(data.phase);
    } else if (parsed.event === 'heartbeat') {
      const data = parsed.data as { phase?: AiAgentPhase; seq?: number; timestamp?: string };
      if (data.phase && typeof data.seq === 'number' && typeof data.timestamp === 'string') {
        handlers.onHeartbeat?.({ phase: data.phase, seq: data.seq, timestamp: data.timestamp });
      }
    } else if (parsed.event === 'tool_started') {
      const data = parsed.data as { toolName?: string; args?: unknown };
      if (data.toolName) handlers.onToolStarted?.(data.toolName, data.args);
    } else if (parsed.event === 'tool_progress') {
      const data = parsed.data as {
        toolName?: string;
        status?: AiAgentToolProgressStatus;
        message?: string;
      };
      if (data.toolName && data.status) {
        handlers.onToolProgress?.(data.toolName, data.status);
      }
    } else if (parsed.event === 'tool_finished') {
      const data = parsed.data as { toolName?: string; summary?: string };
      if (data.toolName) handlers.onToolFinished?.(data.toolName, data.summary);
    } else if (parsed.event === 'plan') {
      const plan = (parsed.data as { plan?: PlannerAgentDto })?.plan;
      if (plan) handlers.onPlan?.(plan);
    } else if (parsed.event === 'clarification') {
      const clarification = parsed.data as AiClarification;
      if (clarification?.question) {
        handlers.onClarification?.(clarification);
      }
    } else if (parsed.event === 'sources') {
      const sources = (parsed.data as { sources?: AiSemanticResult[] })?.sources;
      handlers.onSources?.(Array.isArray(sources) ? sources : []);
    } else if (parsed.event === 'thinking') {
      const data = parsed.data as { phase?: AiThinkingPhase; text?: string };
      if (
        (data.phase === 'route_decision' ||
          data.phase === 'evidence_decision' ||
          data.phase === 'retrieval_planning' ||
          data.phase === 'answer') &&
        typeof data.text === 'string'
      ) {
        handlers.onThinking?.(data.phase, data.text);
      }
    } else if (parsed.event === 'delta') {
      const text = (parsed.data as { text?: string })?.text;
      if (typeof text === 'string') handlers.onDelta?.(text);
    } else if (parsed.event === 'state_patch') {
      const state = (parsed.data as { state?: Partial<AiAgentClientState> })?.state;
      if (state) handlers.onStatePatch?.(state);
    } else if (parsed.event === 'usage') {
      const data = parsed.data as {
        phase?: AiUsagePhase;
        usage?: Partial<AiTokenUsage>;
      };
      const rawUsage = data.usage;
      const phase = data.phase;
      if (
        phase &&
        rawUsage &&
        typeof rawUsage.prompt_tokens === 'number' &&
        typeof rawUsage.completion_tokens === 'number' &&
        typeof rawUsage.total_tokens === 'number'
      ) {
        handlers.onUsage?.(
          {
            prompt_tokens: rawUsage.prompt_tokens,
            completion_tokens: rawUsage.completion_tokens,
            total_tokens: rawUsage.total_tokens,
          },
          phase
        );
      }
    } else if (parsed.event === 'done') {
      doneReceived = true;
      handlers.onDone?.();
    } else if (parsed.event === 'error') {
      const message = (parsed.data as { message?: string })?.message || 'AI stream failed';
      handlers.onError?.(message);
      throw new Error(message);
    }
  };

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, '\n');

      let boundary = buffer.indexOf('\n\n');
      while (boundary !== -1) {
        const block = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);
        dispatch(block);
        boundary = buffer.indexOf('\n\n');
      }
    }

    const tail = buffer.trim();
    if (tail) dispatch(tail);
    if (!doneReceived) handlers.onDone?.();
  } finally {
    reader.releaseLock();
  }
}

export const aiSearch = (payload: {
  query: string;
  scope?: 'mine' | 'public';
  sourceTypes?: AiSourceType[];
  timeRange?: { from: string; to: string; label?: string } | null;
  tags?: { include?: string[]; exclude?: string[]; match?: 'any' | 'all' };
  semanticScope?: string[];
  state?: 'private' | 'public' | 'all';
  archived?: boolean | null;
  limit?: number;
}) => post('/ai/search', payload).then((res) => res.data as AiSemanticResult[]);

export const getRelatedNotes = (payload: {
  sourceType: AiSourceType;
  sourceId: string;
  sourceTypes?: AiSourceType[];
  limit?: number;
}) => post('/ai/related-notes', payload).then((res) => res.data as AiSemanticResult[]);
