import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { Debt } from '../types';

interface Tip {
  id: number;
  text: string;
  category: 'general' | 'mortgage' | 'credit_card' | 'auto' | 'student' | 'behavioral' | 'heloc';
}

const ALL_TIPS: Tip[] = [
  { id: 1, category: 'general', text: 'Pay more than the minimum whenever possible — even an extra $25 per month can save hundreds in interest and shave months off your timeline.' },
  { id: 2, category: 'general', text: 'The debt avalanche method (highest interest first) is mathematically optimal and saves the most money. Your Payment Strategy shows you exactly which debt to attack.' },
  { id: 3, category: 'general', text: "As each debt pays off, apply that freed-up minimum to your next debt. This 'snowball effect' accelerates your progress dramatically." },
  { id: 4, category: 'general', text: 'Cutting just $10/day in discretionary spending adds up to $300/month — enough to eliminate an average credit card 2–3 years faster.' },
  { id: 5, category: 'general', text: "Your debt-free date isn't set in stone. Every extra dollar you pay moves that date closer. Small wins add up!" },
  { id: 6, category: 'general', text: 'Track every payment in NOVO — seeing your progress builds momentum and keeps you accountable on tough days.' },
  { id: 7, category: 'general', text: 'Celebrate small wins! Every $1,000 paid off is real progress. Acknowledge your discipline and stay motivated.' },
  { id: 8, category: 'general', text: 'Bi-weekly payments (paying half your monthly amount every 2 weeks) equals 13 monthly payments per year instead of 12 — a painless way to pay ahead.' },
  { id: 9, category: 'general', text: 'Freed-up minimums are your secret weapon. A $200 credit card minimum becomes $200/month extra firepower when that card is paid off.' },
  { id: 10, category: 'general', text: 'Debt elimination is a marathon, not a sprint. Consistency beats perfection — keep making progress even when it feels slow.' },
  { id: 11, category: 'mortgage', text: 'Mortgage interest is front-loaded — extra principal payments in the first 10 years have the biggest impact on total interest paid.' },
  { id: 12, category: 'mortgage', text: 'One extra mortgage payment per year (applied to principal) can cut 4–7 years off a 30-year mortgage and save tens of thousands in interest.' },
  { id: 13, category: 'mortgage', text: 'Refinancing makes sense when you can lower your rate by at least 0.75–1% and plan to stay in the home long enough to recoup closing costs.' },
  { id: 14, category: 'mortgage', text: "If you're paying PMI and have 20%+ equity, request a PMI removal evaluation — that's instant monthly savings you can redirect to other debts." },
  { id: 15, category: 'mortgage', text: 'Round up your mortgage payment to the nearest $100 — it\'s painless budgeting that cuts years off your loan without feeling the squeeze.' },
  { id: 16, category: 'credit_card', text: '0% balance transfer offers can be powerful tools, but only if you pay off the balance before the promotional rate ends. Set a calendar reminder!' },
  { id: 17, category: 'credit_card', text: 'Credit card interest compounds daily. Every day you carry a balance costs you money — prioritize these debts in your avalanche strategy.' },
  { id: 18, category: 'credit_card', text: 'After paying off a credit card, consider keeping it open with a $0 balance. Closing it can hurt your credit utilization ratio.' },
  { id: 19, category: 'credit_card', text: 'The minimum payment on credit cards is designed to keep you in debt. Even $20 extra per month makes a dramatic difference in your timeline.' },
  { id: 20, category: 'credit_card', text: 'Tempted to use a paid-off credit card? Remove it from your wallet and stored payment accounts. Out of sight, out of mind.' },
  { id: 21, category: 'auto', text: 'Auto loans can often be refinanced when your credit improves. Check your rate every 12–18 months — even a 1% drop saves real money.' },
  { id: 22, category: 'auto', text: 'Making one extra auto payment per year can save thousands in interest and help you own your vehicle 8–12 months sooner.' },
  { id: 23, category: 'auto', text: "Gap insurance becomes unnecessary once you owe less than the car's value. Review annually and drop it when appropriate." },
  { id: 24, category: 'student', text: 'Federal student loans have income-driven repayment plans and forgiveness options. Explore all options before refinancing to private loans.' },
  { id: 25, category: 'student', text: 'Student loan consolidation can simplify payments but may cost you federal benefits. Evaluate carefully before consolidating.' },
  { id: 26, category: 'student', text: 'Employer student loan assistance programs are becoming common. Check if your employer offers this benefit — it\'s tax-free up to $5,250/year.' },
  { id: 27, category: 'behavioral', text: "Debt payoff is 80% behavior, 20% math. The best strategy only works if you stick with it. Find your 'why' and revisit it often." },
  { id: 28, category: 'behavioral', text: 'Avoid debt payoff fatigue by setting mini-goals: celebrate every $5,000 paid off, every debt eliminated, every percentage point of progress.' },
  { id: 29, category: 'behavioral', text: 'Tell someone about your debt-free goal. Accountability partners make you 65% more likely to achieve financial goals.' },
  { id: 30, category: 'behavioral', text: 'Visualize your debt-free life in detail. What will you do with the freed-up cash? Where will you travel? What stress will disappear?' },
  { id: 31, category: 'behavioral', text: "Setbacks happen — car repairs, medical bills, job changes. Don't let one setback derail your entire journey. Adjust and keep going." },
  { id: 32, category: 'behavioral', text: 'Compare your progress to YOUR past self, not to others. Your journey is unique — celebrate your wins regardless of how they compare.' },
  { id: 33, category: 'behavioral', text: 'Building an emergency fund ($1,000 minimum) prevents debt setbacks. Once you hit $1,000 saved, attack debt aggressively.' },
  { id: 34, category: 'behavioral', text: 'The first debt payoff is the hardest. After that first victory, momentum builds and each subsequent debt falls faster.' },
  { id: 35, category: 'heloc', text: 'A HELOC used for velocity banking works by letting your income temporarily reduce your balance before expenses draw it back. Every day your balance is lower, you save on interest.' },
  { id: 36, category: 'heloc', text: 'When using a HELOC to accelerate payoff, track your draws carefully. The strategy works best with disciplined spending and consistent income deposits.' },
];

const ROTATE_MS = 5000;
const FADE_MS = 400;

function getPersonalizedTips(debts: Debt[]): Tip[] {
  const categories = new Set(debts.map((d) => d.category));
  const hasHELOC = categories.has('HELOC');
  const hasMortgage = categories.has('Mortgage');
  const hasCreditCard = categories.has('Credit Card');
  const hasAuto = categories.has('Auto Loan');
  const hasStudent = categories.has('Student Loan');

  const priority: Tip['category'][] = ['general', 'behavioral'];
  if (hasMortgage) priority.unshift('mortgage');
  if (hasCreditCard) priority.unshift('credit_card');
  if (hasAuto) priority.push('auto');
  if (hasStudent) priority.push('student');
  if (hasHELOC) priority.push('heloc');

  return [...ALL_TIPS].sort((a, b) => {
    const ai = priority.indexOf(a.category);
    const bi = priority.indexOf(b.category);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });
}

function getDayOfYear(): number {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 0);
  return Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
}

const STORAGE_KEY = 'novo_tip_index_offset';

const categoryLabel: Record<Tip['category'], string> = {
  general: 'General',
  mortgage: 'Mortgage',
  credit_card: 'Credit',
  auto: 'Auto',
  student: 'Student',
  behavioral: 'Mindset',
  heloc: 'HELOC',
};

const categoryColor: Record<Tip['category'], string> = {
  general: 'bg-sky-100 text-sky-700',
  mortgage: 'bg-amber-100 text-amber-700',
  credit_card: 'bg-red-100 text-red-700',
  auto: 'bg-emerald-100 text-emerald-700',
  student: 'bg-violet-100 text-violet-700',
  behavioral: 'bg-teal-100 text-teal-700',
  heloc: 'bg-blue-100 text-blue-700',
};

interface DailyTipProps {
  debts?: Debt[];
}

export default function DailyTip({ debts = [] }: DailyTipProps) {
  const tips = getPersonalizedTips(debts);
  const dayBase = getDayOfYear() % tips.length;

  const getStoredOffset = (): number => {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? parseInt(raw, 10) : 0;
  };

  const [offset, setOffset] = useState(getStoredOffset);
  const [tipVisible, setTipVisible] = useState(true);

  const currentIdx = (dayBase + offset) % tips.length;
  const tip = tips[currentIdx];

  const fadeTimeoutRef = useRef<number | null>(null);
  const rotateIntervalRef = useRef<number | null>(null);

  const navigateTip = useCallback(
    (dir: 1 | -1) => {
      if (fadeTimeoutRef.current) window.clearTimeout(fadeTimeoutRef.current);
      setTipVisible(false);
      fadeTimeoutRef.current = window.setTimeout(() => {
        setOffset((prev) => {
          const next = (prev + dir + tips.length) % tips.length;
          localStorage.setItem(STORAGE_KEY, String(next));
          return next;
        });
        setTipVisible(true);
      }, FADE_MS);
    },
    [tips.length]
  );

  const startAutoRotate = useCallback(() => {
    if (rotateIntervalRef.current) window.clearInterval(rotateIntervalRef.current);
    rotateIntervalRef.current = window.setInterval(() => navigateTip(1), ROTATE_MS);
  }, [navigateTip]);

  useEffect(() => {
    startAutoRotate();
    return () => {
      if (rotateIntervalRef.current) window.clearInterval(rotateIntervalRef.current);
      if (fadeTimeoutRef.current) window.clearTimeout(fadeTimeoutRef.current);
    };
  }, [startAutoRotate]);

  const handleManualNav = (dir: 1 | -1) => {
    navigateTip(dir);
    startAutoRotate();
  };

  return (
    <div className="bg-slate-50 border border-slate-200/80 rounded-lg px-3 py-2.5 sm:px-4">
      <div className="flex items-center gap-2 sm:gap-3">
        <button
          type="button"
          onClick={() => handleManualNav(-1)}
          className="flex-shrink-0 p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors"
          aria-label="Previous tip"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        <div className="flex-1 min-w-0 flex items-center gap-2">
          <span
            className={`flex-shrink-0 text-[10px] sm:text-xs font-semibold px-1.5 py-0.5 rounded ${categoryColor[tip.category]}`}
          >
            {categoryLabel[tip.category]}
          </span>
          <p
            className={`text-xs sm:text-sm text-slate-700 leading-snug line-clamp-2 transition-opacity duration-[400ms] ease-in-out ${
              tipVisible ? 'opacity-100' : 'opacity-0'
            }`}
          >
            {tip.text}
          </p>
        </div>

        <button
          type="button"
          onClick={() => handleManualNav(1)}
          className="flex-shrink-0 p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors"
          aria-label="Next tip"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
