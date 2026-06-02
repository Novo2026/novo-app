import { useEffect, useRef, useState } from 'react';
import { X, Send, Loader2 } from 'lucide-react';
import { streamAnthropicMessage, stripMarkdown, type ChatMessage } from '../services/anthropic';
import { StorageService } from '../services/storage';
import { getPaymentCommitmentsPromptContext } from '../utils/paymentCalculations';
import { analyzeSpending, buildSpendingAnalysisContext } from '../utils/spendingAnalysis';

/** Appended to every chat context passed into this panel. */
export const NOVO_CONVERSATION_RULES =
  `You are NOVO — a smart, friendly debt payoff coach built into the NOVO app, created by Ben Hulshof, a mortgage broker with 27 years of experience in Central Ohio.

PERSONALITY: Warm, direct, and knowledgeable — like a financially savvy friend, not a textbook. Never stiff or corporate. Short responses unless depth is needed. Ask only ONE question at a time and wait for the answer before asking another.

YOUR KNOWLEDGE — THE NOVO APP:
NOVO is a debt payoff and mortgage readiness tool. Here is how each tab works:
- Dashboard: Shows total debt, monthly surplus, debt-free date projection, and financial health score. The surplus commitment slider controls how much of the user's surplus goes toward debt vs savings.
- My Debts: Where users add and manage all their debts — credit cards, auto loans, student loans, personal loans, HELOC, mortgage. Each debt has balance, rate, minimum payment. Installment loans have original balance, start date, and term for accurate payoff projections.
- My Plan: Runs avalanche (highest rate first) or snowball (lowest balance first) strategy. Shows month-by-month payoff order and projected debt-free date. Users must set up a plan here before the Tracker shows recommended payment amounts.
- Tracker: The checkbook register of NOVO. Users log debt payments, deposits, withdrawals, and transfers here. When a debt payment is logged, the debt balance updates automatically. Users can also transfer to savings or HELOC from here.
- Savings: Tracks savings accounts separately from debt. Users add accounts and log deposits/withdrawals. The Tracker can auto-deposit into savings via "Transfer to Savings."
- Smarter Payments: Shows how switching from monthly to bi-weekly or weekly payments saves interest without spending more. Users can commit to a strategy here — that commitment shows up as a coaching reminder when they log payments in the Tracker.
- Progress: Shows debt reduction over time, interest saved, and net worth growth.
- Home Ready: Shows mortgage readiness — DTI ratio, credit score readiness, estimated qualification timeline. This is the end goal NOVO is building toward.

YOUR KNOWLEDGE — VELOCITY BANKING:
Velocity banking is an advanced strategy where a HELOC is used as a primary checking account to reduce the average daily balance and therefore the interest charged. Here is how it works:
1. User deposits their paycheck directly into the HELOC, immediately reducing the balance and daily interest.
2. User pays all expenses from the HELOC throughout the month.
3. At the end of the month, the HELOC balance is lower than it would have been — saving interest daily.
4. For "chunking" — the user draws a lump sum from the HELOC, applies it to a high-interest debt to pay it off fast, then aggressively pays back the HELOC draw using monthly cash flow surplus.
5. The key math: HELOC rate must be LOWER than the debt being chunked for this to make sense. Never recommend chunking if the HELOC rate exceeds the target debt rate.

YOUR KNOWLEDGE — SMARTER PAYMENTS:
Bi-weekly payments work because the user makes 26 half-payments per year instead of 12 full payments — effectively making one extra full payment per year at no extra cost. Weekly = 52 quarter-payments = same effect but faster. The Smarter Payments tab shows the exact per-period amount and projected interest savings for each debt.

YOUR KNOWLEDGE — MORTGAGE READINESS:
Ben's core mission is helping clients become homeowner-ready. NOVO tracks DTI (debt-to-income ratio) as debts are paid down. When DTI reaches qualifying levels and savings reach down payment targets, NOVO signals the user is Home Ready. Always connect debt payoff progress back to this goal — it is the "why" behind everything.

COACHING RULES:
- If the user has active payment commitments, reference them — they are already doing the right thing.
- If the user has no strategy set up in My Plan, gently guide them there first — it unlocks recommended payment amounts in the Tracker.
- If the user mentions struggling with cash flow, point them to Smarter Payments — same budget, faster payoff.
- If the user asks about HELOC velocity banking, explain chunking clearly and always ask their HELOC rate vs their target debt rate before recommending it.
- Never give specific legal, tax, or investment advice. Stay in your lane: debt payoff, cash flow, mortgage readiness.
- Never recommend a strategy that would hurt their ability to make minimum payments.
- Always connect progress back to the Home Ready goal.`;

export const CHAT_CONTEXT = {
  helocStrategy:
    'The user wants to understand or set up a HELOC velocity banking strategy. Start by asking: do they currently have a HELOC, and if so, what is the current rate and balance? Then walk them through how chunking works and whether it makes sense for their situation.',
  learnMore:
    'The user wants to learn more about their debt payoff plan. Ask what specifically they want to understand — their payoff order, timeline, interest savings, or something else. Answer clearly and connect it back to their Home Ready goal.',
  updateBudget:
    'The user wants to update their budget or cash flow numbers. Ask them what changed — income, expenses, or both. Remind them they can update their numbers in Settings, and that more accurate numbers mean better payoff projections.',
  reduceExpenses:
    'The user wants to find ways to reduce expenses and free up more cash flow for debt payoff. Ask them which expense category feels most bloated right now — essential or discretionary. Help them find realistic cuts, not just generic advice.',
  addIncome:
    'The user wants to explore adding income to accelerate debt payoff. Ask about their skills, available time, and current employment situation. Help them think through realistic options — side work, overtime, selling assets — and estimate the monthly impact on their payoff timeline.',
} as const;

function buildRichUserContext(): string {
  try {
    const profile = StorageService.getFinancialProfile();
    const homeEquity = StorageService.getHomeEquity();
    const allDebts = StorageService.getDebts();
    const activeDebts = allDebts.filter(d => !d.isPaidOff && d.currentBalance > 0);
    const paidOffDebts = allDebts.filter(d => d.isPaidOff);
    const strategyResult = StorageService.getStrategyResult();
    const savingsAccounts = StorageService.getSavingsAccounts();
    const userName = localStorage.getItem('userName') || 'the user';

    const fmt = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
    const pct = (n: number) => `${Math.round(n * 10) / 10}%`;

    const isHomeowner = homeEquity?.ownsHome || false;
    const hasHELOC = homeEquity?.hasHELOC || false;
    const identityLines = [
      `User name: ${userName}`,
      `Homeowner: ${isHomeowner ? 'Yes' : 'No — renter working toward first home'}`,
      hasHELOC ? `Has HELOC: Yes — balance ${fmt(homeEquity?.helocBalance || 0)}, limit ${fmt(homeEquity?.helocLimit || 0)}, rate ${pct(homeEquity?.helocRate || 0)}` : 'No HELOC',
    ];

    let profileLines: string[] = [];
    if (profile) {
      const surplus = profile.monthlyNetIncome - profile.monthlyEssentialExpenses - profile.monthlyDiscretionaryExpenses;
      const monthlyDebtPayments = activeDebts.reduce((s, d) => s + d.minimumPayment, 0);
      const dti = profile.monthlyGrossIncome > 0
        ? Math.round((monthlyDebtPayments / profile.monthlyGrossIncome) * 100)
        : 0;
      const savingsGoal = profile.monthlySavingsGoal || 0;
      profileLines = [
        `Monthly gross income: ${fmt(profile.monthlyGrossIncome)}`,
        `Monthly net income: ${fmt(profile.monthlyNetIncome)}`,
        `Monthly essential expenses: ${fmt(profile.monthlyEssentialExpenses)}`,
        `Monthly discretionary expenses: ${fmt(profile.monthlyDiscretionaryExpenses)}`,
        savingsGoal > 0 ? `Monthly savings goal: ${fmt(savingsGoal)}` : null,
        `Monthly cash flow surplus: ${fmt(Math.max(0, surplus))}`,
        `Surplus committed to debt payoff: ${profile.surplusCommitmentPercent || 100}%`,
        `Current DTI ratio: ${dti}% (monthly debt payments vs gross income)`,
        dti < 36 ? '→ DTI is in excellent mortgage qualifying range' :
        dti < 43 ? '→ DTI is in acceptable mortgage qualifying range' :
        dti < 50 ? '→ DTI is above ideal — reducing debt will improve qualification' :
        '→ DTI is high — significant debt reduction needed before mortgage qualification',
      ].filter(Boolean) as string[];
    }

    const debtLines = activeDebts.map(d => {
      const totalStarting = d.startingBalance || d.currentBalance;
      const paidDown = totalStarting - d.currentBalance;
      const paidPct = totalStarting > 0 ? Math.round((paidDown / totalStarting) * 100) : 0;
      return `  • ${d.accountName} (${d.category}): ${fmt(d.currentBalance)} remaining at ${pct(d.interestRate)} — min payment ${fmt(d.minimumPayment)}${paidDown > 0 ? ` — ${fmt(paidDown)} paid down (${paidPct}%)` : ''}`;
    });

    const paidOffLines = paidOffDebts.length > 0
      ? [`Debts paid off (${paidOffDebts.length}): ${paidOffDebts.map(d => d.accountName).join(', ')}`]
      : [];

    const totalStartingBalance = allDebts.reduce((s, d) => s + (d.startingBalance || d.currentBalance), 0);
    const totalCurrentBalance = allDebts.reduce((s, d) => s + d.currentBalance, 0);
    const totalPaidDown = totalStartingBalance - totalCurrentBalance;
    const progressLines = totalPaidDown > 0 ? [
      `Total debt paid down: ${fmt(totalPaidDown)} (${Math.round((totalPaidDown / totalStartingBalance) * 100)}% of original debt eliminated)`,
    ] : [];

    let strategyLines: string[] = [];
    if (strategyResult) {
      const strategy = strategyResult.strategy;
      const strategyMethod = (strategy as { method?: string }).method;
      const strategyLabel =
        strategyMethod === 'avalanche' ? 'Debt Avalanche (highest rate first)' :
        strategyMethod === 'snowball' ? 'Debt Snowball (lowest balance first)' :
        strategy.type === 'heloc-velocity' ? 'HELOC Velocity Banking' :
        strategy.type === 'hybrid' ? 'Hybrid (HELOC + extra payments)' :
        'Extra Payment Strategy';
      strategyLines = [
        `Payoff strategy: ${strategyLabel}`,
        `Extra monthly payment toward debt: ${fmt(strategy.extraMonthlyPayment || 0)}`,
        `Projected debt-free date: ${strategyResult.debtFreeDate}`,
        `Total months to debt free: ${strategyResult.totalMonths}`,
        `Total interest to be paid: ${fmt(strategyResult.totalInterest)}`,
        `Total to be paid: ${fmt(strategyResult.totalPaid)}`,
        strategyResult.payoffTimeline?.length > 0
          ? `Payoff order: ${strategyResult.payoffTimeline.map(t => `${t.debtName} (month ${t.payoffMonth})`).join(' → ')}`
          : null,
      ].filter(Boolean) as string[];
    }

    let savingsLines: string[] = [];
    if (savingsAccounts.length > 0) {
      const totalSavings = savingsAccounts.reduce((s, a) => s + a.balance, 0);
      savingsLines = [
        `Total savings: ${fmt(totalSavings)} across ${savingsAccounts.length} account${savingsAccounts.length > 1 ? 's' : ''}`,
        ...savingsAccounts.map(a => `  • ${a.name}: ${fmt(a.balance)}${a.goalAmount ? ` (goal: ${fmt(a.goalAmount)})` : ''}`),
      ];
    }

    let spendingLines: string[] = [];
    try {
      const stored = localStorage.getItem('novo_checking_transactions');
      if (stored) {
        const txns = JSON.parse(stored);
        if (txns.length > 0) {
          const analysis = analyzeSpending(txns, profile, 60);
          spendingLines = [buildSpendingAnalysisContext(analysis)];
        }
      }
    } catch { /* spending context is enhancement not requirement */ }

    const commitmentsContext = getPaymentCommitmentsPromptContext(activeDebts);

    const sections = [
      ['USER PROFILE', identityLines],
      profileLines.length > 0 ? ['FINANCIAL SNAPSHOT', profileLines] : null,
      activeDebts.length > 0 ? [`ACTIVE DEBTS (${activeDebts.length})`, debtLines] : null,
      paidOffLines.length > 0 ? ['PROGRESS', [...progressLines, ...paidOffLines]] : progressLines.length > 0 ? ['PROGRESS', progressLines] : null,
      strategyLines.length > 0 ? ['PAYOFF PLAN', strategyLines] : null,
      savingsLines.length > 0 ? ['SAVINGS', savingsLines] : null,
    ].filter(Boolean) as [string, string[]][];

    const contextBlock = sections
      .map(([title, lines]) => `${title}:\n${lines.join('\n')}`)
      .join('\n\n');

    return contextBlock + (spendingLines.length > 0 ? '\n\n' + spendingLines[0] : '') + commitmentsContext;
  } catch (err) {
    console.error('Failed to build rich context:', err);
    return '';
  }
}

function buildSystemPrompt(context: string): string {
  const base = context.trim();
  const richContext = buildRichUserContext();
  return `${base}\n\n${NOVO_CONVERSATION_RULES}\n\nHERE IS EVERYTHING I KNOW ABOUT THIS USER RIGHT NOW — use this to give specific, personalized answers. Never ask them for information that is already here:\n\n${richContext}`;
}

/** Space reserved above the fixed input bar (textarea + padding + safe area + mobile browser chrome). */
const THREAD_BOTTOM_PADDING =
  'pb-[calc(6.25rem+env(safe-area-inset-bottom,0px)+1.25rem)]';

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
    if (open) {
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = '';
      };
    }
  }, [open]);

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

      {/* Full-screen overlay on mobile; right side panel on md+ */}
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="NOVO chat"
        className={`fixed z-50 flex flex-col min-h-0 bg-white shadow-2xl transition-transform duration-300 ease-out
          inset-0 w-full h-[100dvh] max-h-[100dvh]
          md:inset-y-0 md:left-auto md:right-0 md:bottom-0 md:w-full md:max-w-md md:h-[100dvh]
          ${open ? 'translate-x-0' : 'translate-x-full'}`}
      >
        <header className="flex-shrink-0 flex items-center justify-between px-4 py-3 md:py-4 bg-[#1E3A5F] text-white">
          <div className="flex items-center gap-3 min-w-0">
            <img src="/novo_primary.png" alt="NOVO" className="h-8 w-auto flex-shrink-0" />
            <div className="min-w-0">
              <p className="font-bold text-sm truncate">Ask NOVO</p>
              <p className="text-xs text-blue-200 truncate">AI coaching assistant</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-white/10 transition-colors flex-shrink-0"
            aria-label="Close chat"
          >
            <X className="w-5 h-5" />
          </button>
        </header>

        <div
          ref={threadRef}
          className={`flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 py-4 space-y-3 bg-gray-50 ${THREAD_BOTTOM_PADDING}`}
        >
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
                  className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap break-words ${
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
      </aside>

      {/* Input pinned to viewport bottom; width matches panel on desktop */}
      <footer
        className={`fixed bottom-0 left-0 right-0 z-[51] border-t border-gray-200 bg-white px-4 pt-3
          pb-[max(1rem,env(safe-area-inset-bottom,0px))]
          md:left-auto md:right-0 md:w-full md:max-w-md
          transition-transform duration-300 ease-out
          ${open ? 'translate-x-0' : 'translate-x-full pointer-events-none'}`}
      >
        <div className="flex gap-2 items-end max-w-full">
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type your message…"
            rows={2}
            disabled={isStreaming || !open}
            className="flex-1 min-w-0 resize-none rounded-xl border border-gray-300 px-3 py-2.5 text-sm text-gray-900 focus:ring-2 focus:ring-[#FF6B35] focus:border-[#FF6B35] outline-none disabled:opacity-60"
          />
          <button
            type="button"
            onClick={handleSend}
            disabled={!input.trim() || isStreaming || !open}
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
      </footer>
    </>
  );
}
