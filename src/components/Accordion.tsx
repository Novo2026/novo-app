import { useState, ReactNode, useRef, useEffect } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

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
    <div className="bg-white rounded-lg shadow-md overflow-hidden border border-gray-200">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-4 md:p-6 text-left hover:bg-gray-50 active:bg-gray-100 transition-colors min-h-[44px]"
      >
        <div className="flex items-center space-x-3 flex-1">
          {emoji && <span className="text-2xl flex-shrink-0">{emoji}</span>}
          {icon && <div className="flex-shrink-0">{icon}</div>}
          <h3 className="text-lg md:text-xl font-bold text-gray-800">{title}</h3>
          {badge && (
            <span className="bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full">
              {badge}
            </span>
          )}
        </div>
        <div className="flex-shrink-0 ml-4">
          {isOpen ? (
            <ChevronUp className="w-5 h-5 md:w-6 md:h-6 text-gray-600 transition-transform" />
          ) : (
            <ChevronDown className="w-5 h-5 md:w-6 md:h-6 text-gray-600 transition-transform" />
          )}
        </div>
      </button>
      <div
        style={{ height }}
        className="transition-all duration-300 ease-in-out overflow-hidden"
      >
        <div ref={contentRef} className="px-4 md:px-6 pb-4 md:pb-6 border-t border-gray-200">
          {children}
        </div>
      </div>
    </div>
  );
}
