import { useEffect, useRef, useState } from 'react';
import { X, Send, Loader2 } from 'lucide-react';
import { streamAnthropicMessage, stripMarkdown, type ChatMessage } from '../services/anthropic';

const BEN_BOOKING_URL =
  'https://api.leadconnectorhq.com/widget/booking/Ms28gTzPwpR5BbzeU0Dc';

/** Appended to every chat context passed into this panel. */
export const NOVO_CONVERSATION_RULES =
  'Ask only ONE question at a time. Wait for the user to respond before asking anything else. Keep responses short, warm, and conversational - like a knowledgeable friend, not a financial advisor reading from a checklist.';

export const CHAT_CONTEXT = {
  helocStrategy:
    'You are NOVO, a friendly debt payoff and financial coaching assistant built by Ben Hulshof, a mortgage broker with 27 years experience. The user wants to understand their HELOC strategy. Ask them about their current home equity, their debts, and help them understand how a HELOC can accelerate debt payoff.',
  learnMore:
    'You are NOVO, a friendly debt payoff and financial coaching assistant. The user wants to learn more about their debt payoff plan. Answer their questions helpfully and encourage them.',
  updateBudget:
    'You are NOVO, a friendly debt payoff and financial coaching assistant. The user wants to update their budget. Ask them about their monthly income and expenses and help them think through improvements.',
  reduceExpenses:
    'You are NOVO, a friendly debt payoff and financial coaching assistant. The user wants to find ways to reduce expenses. Ask them about their current spending and suggest practical ways to cut costs and free up cash flow.',
  addIncome:
    'You are NOVO, a friendly debt payoff and financial coaching assistant. The user wants to explore adding an income source. Ask them about their skills, available time, and help them brainstorm realistic options to increase monthly income.',
} as const;

function buildSystemPrompt(context: string): string {
  const base = context.trim();
  return `${base}\n\n${NOVO_CONVERSATION_RULES}`;
}

interface NovoChatProps {
  open: boolean;
  onClose: () => void;
  context: string;
}

export default function NovoChat({ open, onClose, context }: NovoChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const threadRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const systemPrompt = buildSystemPrompt(context);

  useEffect(() => {
    if (open) {
      setMessages([]);
      setInput('');
      setError(null);
      setIsStreaming(false);
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [open, context]);

  useEffect(() => {
    if (threadRef.current) {
      threadRef.current.scrollTop = threadRef.current.scrollHeight;
    }
  }, [messages, isStreaming]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const lastMessage = messages[messages.length - 1];
  const showTypingDots =
    isStreaming && !(lastMessage?.role === 'assistant' && lastMessage.content.length > 0);

  const handleSend = async () => {
    const trimmed = input.trim();
    if (!trimmed || isStreaming) return;

    const userMessage: ChatMessage = { role: 'user', content: trimmed };
    const historyForApi = [...messages, userMessage];
    setMessages([...historyForApi, { role: 'assistant', content: '' }]);
    setInput('');
    setError(null);
    setIsStreaming(true);

    let accumulated = '';

    try {
      await streamAnthropicMessage(systemPrompt, historyForApi, token => {
        accumulated += token;
        const display = stripMarkdown(accumulated);
        setMessages(prev => {
          const next = [...prev];
          const last = next[next.length - 1];
          if (last?.role === 'assistant') {
            next[next.length - 1] = { role: 'assistant', content: display };
          }
          return next;
        });
      });

      if (!accumulated.trim()) {
        throw new Error('No response text received.');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Something went wrong.';
      setError(message);
      setMessages(prev => {
        const last = prev[prev.length - 1];
        if (last?.role === 'assistant' && !last.content) {
          return prev.slice(0, -1);
        }
        return prev;
      });
    } finally {
      setIsStreaming(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <>
      <div
        className={`fixed inset-0 z-40 bg-black/40 transition-opacity duration-300 ${
          open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
        aria-hidden={!open}
      />

      <aside
        role="dialog"
        aria-modal="true"
        aria-label="NOVO chat"
        className={`fixed top-0 right-0 z-50 h-full w-full max-w-md bg-white shadow-2xl flex flex-col transition-transform duration-300 ease-out ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <header className="flex items-center justify-between px-4 py-4 bg-[#1E3A5F] text-white flex-shrink-0">
          <div className="flex items-center gap-3">
            <img src="/novo_primary.png" alt="NOVO" className="h-8 w-auto" />
            <div>
              <p className="font-bold text-sm">Ask NOVO</p>
              <p className="text-xs text-blue-200">AI coaching assistant</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-white/10 transition-colors"
            aria-label="Close chat"
          >
            <X className="w-5 h-5" />
          </button>
        </header>

        <div ref={threadRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3 bg-gray-50">
          {messages.length === 0 && !isStreaming && (
            <div className="text-center text-sm text-gray-500 py-8 px-4">
              <p className="font-medium text-gray-700 mb-1">Hi — I&apos;m NOVO.</p>
              <p>Ask a question or tell me what you&apos;d like help with.</p>
            </div>
          )}

          {messages.map((msg, i) => {
            if (msg.role === 'assistant' && !msg.content) return null;
            return (
              <div
                key={`${msg.role}-${i}`}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
                    msg.role === 'user'
                      ? 'bg-[#FF6B35] text-white rounded-br-md'
                      : 'bg-white text-gray-800 border border-gray-200 shadow-sm rounded-bl-md'
                  }`}
                >
                  {msg.content}
                </div>
              </div>
            );
          })}

          {showTypingDots && (
            <div className="flex justify-start">
              <div className="bg-white border border-gray-200 rounded-2xl rounded-bl-md px-4 py-3 shadow-sm flex items-center gap-1.5">
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:0ms]" />
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:150ms]" />
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:300ms]" />
              </div>
            </div>
          )}

          {error && (
            <div className="rounded-lg bg-red-50 text-red-800 text-sm px-3 py-2 border border-red-100">
              {error}
            </div>
          )}
        </div>

        <div className="flex-shrink-0 border-t border-gray-200 bg-white px-4 py-3">
          <div className="bg-[#1E3A5F]/5 border border-[#1E3A5F]/15 rounded-xl px-3 py-3 mb-3 text-center">
            <p className="text-sm text-gray-700 mb-2">Ready to talk to Ben?</p>
            <a
              href={BEN_BOOKING_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block text-sm font-semibold bg-[#FF6B35] hover:bg-[#e85a28] text-white px-4 py-2 rounded-lg transition-colors"
            >
              Schedule a Strategy Call
            </a>
          </div>

          <div className="flex gap-2 items-end">
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type your message…"
              rows={2}
              disabled={isStreaming}
              className="flex-1 resize-none rounded-xl border border-gray-300 px-3 py-2.5 text-sm text-gray-900 focus:ring-2 focus:ring-[#FF6B35] focus:border-[#FF6B35] outline-none disabled:opacity-60"
            />
            <button
              type="button"
              onClick={handleSend}
              disabled={!input.trim() || isStreaming}
              className="flex-shrink-0 w-11 h-11 flex items-center justify-center rounded-xl bg-[#2D9CDB] hover:bg-[#1E8BBD] text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              aria-label="Send message"
            >
              {isStreaming ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Send className="w-5 h-5" />
              )}
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
