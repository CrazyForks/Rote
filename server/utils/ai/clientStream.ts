import type { AiProviderConfig } from '../../types/config';
import {
  buildChatRequestBody,
  buildHeaders,
  ensureProviderConfig,
  ensureProviderStreamResponse,
  normalizeBaseUrl,
  normalizeToolCalls,
  normalizeUsage,
  type ChatCompletionOptions,
  type ChatCompletionStreamPart,
  type ChatCompletionUsage,
  type ChatMessage,
  type ChatToolCall,
  type ChatToolDefinition,
} from './clientShared';

export async function createChatCompletionWithToolsStreaming(
  config: AiProviderConfig,
  messages: ChatMessage[],
  tools: ChatToolDefinition[],
  options: ChatCompletionOptions & {
    onReasoning?: (text: string) => Promise<void> | void;
    onContent?: (text: string) => Promise<void> | void;
  } = {}
): Promise<{
  message: ChatMessage;
  usage?: ChatCompletionUsage;
}> {
  ensureProviderConfig(config);

  const response = await fetch(`${normalizeBaseUrl(config.baseUrl)}/chat/completions`, {
    method: 'POST',
    headers: buildHeaders(config),
    body: JSON.stringify(
      buildChatRequestBody(config, {
        messages,
        tools,
        toolChoice: 'auto',
        temperature: options.temperature ?? 0.2,
        stream: true,
        enableThinking: options.enableThinking,
      })
    ),
  });

  await ensureProviderStreamResponse(response);

  if (!response.body) {
    throw new Error('Chat provider returned an empty tool stream response');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const toolCallsByIndex = new Map<number, ChatToolCall>();
  let buffer = '';
  let content = '';
  let usage: ChatCompletionUsage | undefined;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith(':') || !trimmed.startsWith('data:')) continue;

        const data = trimmed.slice(5).trim();
        if (data === '[DONE]') {
          return {
            message: {
              role: 'assistant',
              content: content || null,
              tool_calls: normalizeToolCalls(Array.from(toolCallsByIndex.values())),
            },
            usage,
          };
        }

        let chunk: any;
        try {
          chunk = JSON.parse(data);
        } catch {
          continue;
        }

        const delta = chunk?.choices?.[0]?.delta || {};
        const reasoning = delta.reasoning_content || delta.reasoning;
        if (typeof reasoning === 'string' && reasoning.length > 0) {
          await options.onReasoning?.(reasoning);
        }

        if (typeof delta.content === 'string' && delta.content.length > 0) {
          content += delta.content;
          await options.onContent?.(delta.content);
        }

        if (Array.isArray(delta.tool_calls)) {
          for (const deltaCall of delta.tool_calls) {
            const index = Number.isInteger(deltaCall?.index)
              ? deltaCall.index
              : toolCallsByIndex.size;
            const existing =
              toolCallsByIndex.get(index) ||
              ({
                id: typeof deltaCall?.id === 'string' ? deltaCall.id : `call_${index}`,
                type: 'function',
                function: { name: '', arguments: '' },
              } satisfies ChatToolCall);

            if (typeof deltaCall?.id === 'string') existing.id = deltaCall.id;
            if (typeof deltaCall?.function?.name === 'string') {
              existing.function.name += deltaCall.function.name;
            }
            if (typeof deltaCall?.function?.arguments === 'string') {
              existing.function.arguments += deltaCall.function.arguments;
            }
            toolCallsByIndex.set(index, existing);
          }
        }

        const chunkUsage = normalizeUsage(chunk?.usage);
        if (chunkUsage) usage = chunkUsage;
      }
    }
  } finally {
    reader.releaseLock();
  }

  return {
    message: {
      role: 'assistant',
      content: content || null,
      tool_calls: normalizeToolCalls(Array.from(toolCallsByIndex.values())),
    },
    usage,
  };
}

export async function* createChatCompletionStreamParts(
  config: AiProviderConfig,
  messages: ChatMessage[],
  options: ChatCompletionOptions = {}
): AsyncGenerator<ChatCompletionStreamPart> {
  ensureProviderConfig(config);

  const response = await fetch(`${normalizeBaseUrl(config.baseUrl)}/chat/completions`, {
    method: 'POST',
    headers: buildHeaders(config),
    body: JSON.stringify(
      buildChatRequestBody(config, {
        messages,
        temperature: options.temperature ?? 0.2,
        stream: true,
        enableThinking: options.enableThinking,
      })
    ),
  });

  await ensureProviderStreamResponse(response);

  if (!response.body) {
    throw new Error('Chat provider returned an empty stream response');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith(':') || !trimmed.startsWith('data:')) continue;

        const data = trimmed.slice(5).trim();
        if (data === '[DONE]') return;

        let chunk: any;
        try {
          chunk = JSON.parse(data);
        } catch {
          continue;
        }

        const delta = chunk?.choices?.[0]?.delta || {};
        const reasoning = delta.reasoning_content || delta.reasoning;
        if (typeof reasoning === 'string' && reasoning.length > 0) {
          yield { type: 'reasoning', text: reasoning };
        }

        const content = delta.content;
        if (typeof content === 'string' && content.length > 0) {
          yield { type: 'content', text: content };
        }

        const usage = normalizeUsage(chunk?.usage);
        if (usage) {
          yield {
            type: 'usage',
            usage,
          };
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

export async function* createChatCompletionStream(
  config: AiProviderConfig,
  messages: ChatMessage[],
  options: ChatCompletionOptions = {}
): AsyncGenerator<string> {
  for await (const part of createChatCompletionStreamParts(config, messages, options)) {
    if (part.type === 'content') {
      yield part.text;
    }
  }
}
