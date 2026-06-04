const PROXY_URL = '/.netlify/functions/anthropic-proxy';
const STREAM_PROXY_URL = '/.netlify/functions/anthropic-stream-proxy';

export type ChatMessage = {
  role: 'user' | 'assistant';
  content: string;
};

/** Strip markdown symbols so chat displays as plain text. */
export function stripMarkdown(text: string): string {
  return text
    .replace(/\*\*/g, '')
    .replace(/\*/g, '')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/#/g, '');
}

export async function callAnthropic(
  systemPrompt: string,
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
  systemPrompt: string,
  messages: { role: 'user' | 'assistant'; content: string }[],
  onToken: (token: string) => void,
  options: { model?: string; maxTokens?: number } = {}
): Promise<void> {
  const response = await fetch(STREAM_PROXY_URL, {
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
    throw new Error(`API request failed: ${response.status}`);
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
