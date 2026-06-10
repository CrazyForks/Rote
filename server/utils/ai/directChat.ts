import {
  createChatCompletion,
  createChatCompletionStreamParts,
  type ChatMessage,
  type ChatCompletionUsage,
} from './client';
import { getStoredAiConfig } from '../dbMethods/ai';
import { logAiTokenUsage } from '../dbMethods/aiToken';

function buildMessages(
  message: string,
  history?: Array<{ role: 'user' | 'assistant'; content: string }>
): ChatMessage[] {
  return [...(Array.isArray(history) ? history.slice(-8) : []), { role: 'user', content: message }];
}

async function logUsage(userId: string, model: string, usage: ChatCompletionUsage) {
  await logAiTokenUsage({
    userid: userId,
    model,
    type: 'chat',
    promptTokens: usage.prompt_tokens,
    completionTokens: usage.completion_tokens,
    totalTokens: usage.total_tokens,
  });
}

export async function createDirectSiteChat(params: {
  userId: string;
  message: string;
  history?: Array<{ role: 'user' | 'assistant'; content: string }>;
  enableThinking?: boolean;
}) {
  const config = await getStoredAiConfig();
  const result = await createChatCompletion(
    config.chat,
    buildMessages(params.message, params.history),
    {
      enableThinking: params.enableThinking,
    }
  );
  if (result.usage) await logUsage(params.userId, config.chat.model, result.usage);
  return result.content;
}

export async function streamDirectSiteChat(params: {
  userId: string;
  message: string;
  history?: Array<{ role: 'user' | 'assistant'; content: string }>;
  enableThinking?: boolean;
  onReasoning: (text: string) => Promise<void>;
  onContent: (text: string) => Promise<void>;
  onUsage: (usage: ChatCompletionUsage) => Promise<void>;
}) {
  const config = await getStoredAiConfig();
  let usage: ChatCompletionUsage | undefined;
  for await (const part of createChatCompletionStreamParts(
    config.chat,
    buildMessages(params.message, params.history),
    { enableThinking: params.enableThinking }
  )) {
    if (part.type === 'reasoning') await params.onReasoning(part.text);
    if (part.type === 'content') await params.onContent(part.text);
    if (part.type === 'usage') usage = part.usage;
  }
  if (usage) {
    await logUsage(params.userId, config.chat.model, usage);
    await params.onUsage(usage);
  }
}
