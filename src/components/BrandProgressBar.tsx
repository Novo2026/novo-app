import { useEffect, useState } from 'react';

type ProgressTone = 'orange' | 'green' | 'blue' | 'navy' | 'purple' | 'gold' | 'emerald';

const TRACK: Record<ProgressTone, string> = {
  orange: 'bg-brand-gray-border',
  green: 'bg-brand-gray-border',
  blue: 'bg-brand-gray-border',
  navy: 'bg-brand-gray-border',
  purple: 'bg-brand-gray-border',
  gold: 'bg-white/20',
  emerald: 'bg-brand-gray-border',
};

const FILL: Record<ProgressTone, string> = {
  orange: 'bg-gradient-to-r from-brand-orange to-[#FF8F5C]',
  green: 'bg-gradient-to-r from-brand-green to-[#4ECD8A]',
  blue: 'bg-gradient-to-r from-brand-blue to-[#5BB8E8]',
  navy: 'bg-gradient-to-r from-brand-navy to-brand-navy-light',
  purple: 'bg-gradient-to-r from-brand-purple to-[#7B74D4]',
  gold: 'bg-gradient-to-r from-[#F2C94C] to-[#F2994A]',
  emerald: 'bg-gradient-to-r from-emerald-500 to-teal-500',
};

type BrandProgressBarProps = {
  /** 0–100 (values outside range are clamped). */
  percent: number;
  tone?: ProgressTone;
  /** Track height: thin (h-1), default (h-1.5), medium (h-2), thick (h-3), xl (h-4). */
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  /** When true, animates from 0 → percent on mount / percent change. */
  animateOnMount?: boolean;
};

const SIZE_CLASS = {
  xs: 'h-1',
  sm: 'h-1.5',
  md: 'h-2',
  lg: 'h-3',
  xl: 'h-4',
} as const;

/**
 * Shared brand progress bar — gradient fill + width transition.
 * Display-only; does not change any calculation logic.
 */
export default function BrandProgressBar({
  percent,
  tone = 'orange',
  size = 'sm',
  className = '',
  animateOnMount = true,
}: BrandProgressBarProps) {
  const clamped = Math.min(100, Math.max(0, Number.isFinite(percent) ? percent : 0));
  const [displayPercent, setDisplayPercent] = useState(animateOnMount ? 0 : clamped);

  useEffect(() => {
    if (!animateOnMount) {
      setDisplayPercent(clamped);
      return;
    }
    setDisplayPercent(0);
    const id = requestAnimationFrame(() => {
      requestAnimationFrame(() => setDisplayPercent(clamped));
    });
    return () => cancelAnimationFrame(id);
  }, [clamped, animateOnMount]);

  return (
    <div
      className={`w-full ${TRACK[tone]} rounded-full ${SIZE_CLASS[size]} overflow-hidden ${className}`}
      role="progressbar"
      aria-valuenow={Math.round(clamped)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className={`h-full rounded-full ${FILL[tone]} transition-[width] duration-700 ease-out`}
        style={{ width: `${displayPercent}%` }}
      />
    </div>
  );
}
