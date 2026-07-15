import { supabase } from '../lib/supabase';

const PROXY_URL = '/.netlify/functions/anthropic-proxy';
const STREAM_PROXY_URL = '/.netlify/functions/anthropic-stream-proxy';

/** Max prior+current messages sent to the API (keeps system prompt intact). */
export const CHAT_HISTORY_MESSAGE_CAP = 14;

export type ChatMessage = {
  role: 'user' | 'assistant';
  content: string;
};

/** Anthropic Messages API system content block (supports prompt caching). */
export type SystemPromptBlock = {
  type: 'text';
  text: string;
  cache_control?: { type: 'ephemeral' };
};

export type SystemPromptInput = string | SystemPromptBlock[];

/** Strip markdown symbols so chat displays as plain text. */
export function stripMarkdown(text: string): string {
  return text
    .replace(/\*\*/g, '')
    .replace(/\*/g, '')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/#/g, '');
}

/**
 * Keep only the latest N messages, and ensure the payload starts with a user turn
 * (Anthropic rejects histories that begin with assistant).
 */
export function trimChatHistoryForApi(
  messages: ChatMessage[],
  maxMessages: number = CHAT_HISTORY_MESSAGE_CAP
): ChatMessage[] {
  let trimmed = messages.slice(-maxMessages);
  while (trimmed.length > 0 && trimmed[0].role !== 'user') {
    trimmed = trimmed.slice(1);
  }
  return trimmed;
}

async function getAccessToken(): Promise<string | null> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session?.access_token ?? null;
}

export async function callAnthropic(
  systemPrompt: SystemPromptInput,
  messages: { role: 'user' | 'assistant'; content: string }[],
  options: { model?: string; maxTokens?: number } = {}
): Promise<string> {
  const response = await fetch(PROXY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: options.model || 'claude-haiku-4-5-20251001',
      max_tokens: options.maxTokens || 1000,
      system: systemPrompt,
      messages,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(`API request failed: ${response.status} ${error.message || ''}`);
  }

  const data = await response.json();
  return data.content?.[0]?.text || '';
}

export async function streamAnthropicMessage(
  systemPrompt: SystemPromptInput,
  messages: { role: 'user' | 'assistant'; content: string }[],
  onToken: (token: string) => void,
  options: { model?: string; maxTokens?: number } = {}
): Promise<void> {
  const accessToken = await getAccessToken();
  if (!accessToken) {
    throw new Error('Please sign in to use Ask NOVO.');
  }

  const response = await fetch(STREAM_PROXY_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      model: options.model || 'claude-haiku-4-5-20251001',
      max_tokens: options.maxTokens || 1000,
      system: systemPrompt,
      messages: trimChatHistoryForApi(messages),
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({} as { error?: string; message?: string }));
    if (response.status === 429 || error.error === 'rate_limit') {
      throw new Error(
        error.message ||
          "You've reached today's chat limit — it resets tomorrow. For urgent questions, contact your loan officer directly."
      );
    }
    if (response.status === 401 || error.error === 'unauthorized') {
      throw new Error(error.message || 'Please sign in to use Ask NOVO.');
    }
    throw new Error(error.message || `API request failed: ${response.status}`);
  }

  const data = await response.json();
  const text = data.content?.[0]?.text || '';

  // Simulate streaming by delivering text in chunks
  const words = text.split(' ');
  for (const word of words) {
    onToken(word + ' ');
    await new Promise(resolve => setTimeout(resolve, 20));
  }
}

// Keep backward compatibility — any direct fetch calls to Anthropic API
// in other components (StatementUploadModal, NovoChat) need to be updated
// to use these functions instead of calling the API directly.
export const ANTHROPIC_PROXY_URL = PROXY_URL;
