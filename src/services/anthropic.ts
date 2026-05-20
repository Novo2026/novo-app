export type ChatMessage = {
  role: 'user' | 'assistant';
  content: string;
};

const MODEL = 'claude-haiku-4-5-20251001';

function getMessagesUrl(): string {
  return import.meta.env.DEV
    ? '/anthropic-api/v1/messages'
    : 'https://api.anthropic.com/v1/messages';
}

function getApiHeaders(apiKey: string): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'x-api-key': apiKey,
    'anthropic-version': '2023-06-01',
    'anthropic-dangerous-direct-browser-access': 'true',
  };
}

/** Strip markdown symbols so chat displays as plain text. */
export function stripMarkdown(text: string): string {
  return text
    .replace(/\*\*/g, '')
    .replace(/\*/g, '')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/#/g, '');
}

function parseSseEvents(buffer: string): { events: string[]; remainder: string } {
  const parts = buffer.split('\n\n');
  const remainder = parts.pop() ?? '';
  return { events: parts, remainder };
}

function extractTextDelta(eventBlock: string): string | null {
  for (const line of eventBlock.split('\n')) {
    if (!line.startsWith('data: ')) continue;
    const payload = line.slice(6).trim();
    if (!payload || payload === '[DONE]') continue;
    try {
      const parsed = JSON.parse(payload) as {
        type?: string;
        delta?: { type?: string; text?: string };
        error?: { message?: string };
      };
      if (parsed.type === 'error' && parsed.error?.message) {
        throw new Error(parsed.error.message);
      }
      if (parsed.type === 'content_block_delta' && parsed.delta?.type === 'text_delta' && parsed.delta.text) {
        return parsed.delta.text;
      }
    } catch (err) {
      if (err instanceof Error && err.message !== payload) throw err;
    }
  }
  return null;
}

export async function streamAnthropicMessage(
  systemPrompt: string,
  messages: ChatMessage[],
  onToken: (text: string) => void
): Promise<void> {
  const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('Anthropic API key is not configured. Add VITE_ANTHROPIC_API_KEY to your environment.');
  }

  const response = await fetch(getMessagesUrl(), {
    method: 'POST',
    headers: getApiHeaders(apiKey),
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1024,
      stream: true,
      system: systemPrompt,
      messages: messages.map(m => ({ role: m.role, content: m.content })),
    }),
  });

  if (!response.ok) {
    let detail = response.statusText;
    try {
      const errBody = await response.json();
      detail = errBody?.error?.message ?? JSON.stringify(errBody);
    } catch {
      /* use statusText */
    }
    throw new Error(detail || 'Failed to get a response from NOVO.');
  }

  if (!response.body) {
    throw new Error('No response stream received.');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const { events, remainder } = parseSseEvents(buffer);
    buffer = remainder;

    for (const eventBlock of events) {
      const text = extractTextDelta(eventBlock);
      if (text) onToken(text);
    }
  }

  if (buffer.trim()) {
    const text = extractTextDelta(buffer);
    if (text) onToken(text);
  }
}
