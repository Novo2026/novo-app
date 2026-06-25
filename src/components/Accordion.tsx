import { useState, ReactNode, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';

interface AccordionProps {
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
  icon?: ReactNode;
  badge?: string;
  emoji?: string;
}

export default function Accordion({ title, children, defaultOpen = false, icon, badge, emoji }: AccordionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [height, setHeight] = useState<number | undefined>(defaultOpen ? undefined : 0);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      const contentEl = contentRef.current;
      if (contentEl) {
        setHeight(contentEl.scrollHeight);
      }
    } else {
      setHeight(0);
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && contentRef.current) {
      setHeight(contentRef.current.scrollHeight);
    }
  }, [children, isOpen]);

  return (
    <div className="bg-white rounded-lg overflow-hidden border border-brand-gray-border">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between py-4 px-5 text-left hover:bg-brand-gray-light transition-colors min-h-[44px]"
      >
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {emoji && <span className="text-xl flex-shrink-0">{emoji}</span>}
          {icon && <div className="flex-shrink-0">{icon}</div>}
          <h3 className="text-sm font-medium text-brand-navy truncate">{title}</h3>
          {badge && (
            <span className="bg-brand-red text-white text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0">
              {badge}
            </span>
          )}
        </div>
        <ChevronDown
          className={`w-5 h-5 text-brand-gray shrink-0 ml-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>
      <div
        style={{ height }}
        className="transition-all duration-300 ease-in-out overflow-hidden"
      >
        <div ref={contentRef} className="px-5 pb-5 border-t border-brand-gray-border">
          {children}
        </div>
      </div>
    </div>
  );
}
