import { useState, useEffect } from 'react';
import { X, Calendar, MessageCircle } from 'lucide-react';
import { getProactiveMessages, saveProactiveMessages, runMilestoneDetection, MILESTONE_CELEBRATIONS_DISABLED } from '../utils/milestoneEngine';
import type { NovoChatMessage } from '../utils/milestoneEngine';

interface ProactiveNOVOMessagesProps {
  onOpenChat: (context: string) => void;
}

export default function ProactiveNOVOMessages({ onOpenChat: _onOpenChat }: ProactiveNOVOMessagesProps) {
  const [messages, setMessages] = useState<NovoChatMessage[]>([]);

  useEffect(() => {
    if (MILESTONE_CELEBRATIONS_DISABLED) return;
    runMilestoneDetection();
    // Filter out any stale DTI messages that may exist in localStorage
    // from before the DTI milestone was removed
    const filtered = getProactiveMessages().filter(m =>
      !m.seen &&
      !m.message?.toLowerCase().includes('dti') &&
      !m.message?.toLowerCase().includes('debt-to-income') &&
      !m.triggeredBy?.includes('dti')
    );
    // Clean up stale DTI messages from storage permanently
    const cleaned = getProactiveMessages().filter(m =>
      !m.message?.toLowerCase().includes('dti') &&
      !m.message?.toLowerCase().includes('debt-to-income') &&
      !m.triggeredBy?.includes('dti')
    );
    saveProactiveMessages(cleaned);
    setMessages(filtered);
  }, []);

  const dismiss = (id: string) => {
    const all = getProactiveMessages();
    const updated = all.map(m => m.id === id ? { ...m, seen: true } : m);
    saveProactiveMessages(updated);
    setMessages(prev => prev.filter(m => m.id !== id));
  };

  if (MILESTONE_CELEBRATIONS_DISABLED || messages.length === 0) return null;

  return (
    <div className="fixed bottom-24 right-4 z-40 space-y-3 max-w-sm w-full">
      {messages.slice(0, 2).map(msg => (
        <div
          key={msg.id}
          className={`rounded-xl shadow-lg border p-4 ${
            msg.type === 'ben'
              ? 'bg-[#1E3A5F] border-[#1E3A5F] text-white'
              : 'bg-white border-gray-200 text-gray-900'
          }`}
        >
          <div className="flex items-start justify-between gap-3 mb-2">
            <div className="flex items-center gap-2">
              {msg.type === 'ben' ? (
                <div className="w-7 h-7 rounded-full bg-[#FF6B35] flex items-center justify-center text-white text-xs font-bold flex-shrink-0">B</div>
              ) : (
                <div className="w-7 h-7 rounded-full bg-[#FF6B35] flex items-center justify-center flex-shrink-0">
                  <MessageCircle className="w-4 h-4 text-white" />
                </div>
              )}
              <span className={`text-xs font-bold ${msg.type === 'ben' ? 'text-orange-300' : 'text-[#FF6B35]'}`}>
                {msg.type === 'ben' ? 'Message from Ben' : 'NOVO'}
              </span>
            </div>
            <button
              onClick={() => dismiss(msg.id)}
              className={`p-1 rounded hover:opacity-70 transition-opacity ${msg.type === 'ben' ? 'text-white/60' : 'text-gray-400'}`}
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <p className={`text-sm leading-relaxed ${msg.type === 'ben' ? 'text-white/90' : 'text-gray-700'}`}>
            {msg.message}
          </p>

          {msg.ctaLabel && msg.ctaUrl && (
            <a
              href={msg.ctaUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={`mt-3 flex items-center gap-2 text-xs font-bold py-2 px-3 rounded-lg transition-colors w-fit ${
                msg.type === 'ben'
                  ? 'bg-[#FF6B35] hover:bg-[#e55a25] text-white'
                  : 'bg-[#FF6B35] hover:bg-[#e55a25] text-white'
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              {msg.ctaLabel}
            </a>
          )}
        </div>
      ))}
    </div>
  );
}
