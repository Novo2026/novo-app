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

export async function sendAnthropicMessage(
  systemPrompt: string,
  messages: ChatMessage[]
): Promise<string> {
  const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('Anthropic API key is not configured. Add VITE_ANTHROPIC_API_KEY to your environment.');
  }

  const response = await fetch(getMessagesUrl(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      // Required for direct browser calls to the Anthropic API
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1024,
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

  const data = await response.json();
  const text = data?.content?.find((block: { type: string }) => block.type === 'text')?.text;
  if (!text) {
    throw new Error('No response text received.');
  }
  return text;
}
