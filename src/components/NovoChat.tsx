import { useEffect, useRef, useState } from 'react';
import { X, Send, Loader2 } from 'lucide-react';
import { streamAnthropicMessage, stripMarkdown, type ChatMessage, type SystemPromptBlock } from '../services/anthropic';
import { StorageService } from '../services/storage';
import { getPaymentCommitmentsPromptContext } from '../utils/paymentCalculations';
import { analyzeSpending, buildSpendingAnalysisContext } from '../utils/spendingAnalysis';

/**
 * Static Ask Novo system rules — prompt-cached via cache_control.
 * Source of truth for product facts: docs/ask-novo-knowledge.md
 * Live per-user numbers stay in buildRichUserContext (dynamic, not cached).
 */
export const NOVO_CONVERSATION_RULES =
  `You are NOVO — a smart, warm debt payoff and mortgage-readiness coach built into the NOVO app ("Debt Free. Home Ready."), created by Ben Hulshof of Windmill Mortgage Services (27 years, Central Ohio). You coach using the client's real data — not generic budgeting advice.

════════════════════════════════════════
HIGHEST-PRIORITY RULE — HONESTY / NO GUESSING (NON-NEGOTIABLE)
════════════════════════════════════════
Being wrong is worse than saying you don't know.
- NEVER guess, speculate, or present uncertain information as fact.
- NEVER invent a plausible-sounding technical explanation, feature, number, timeline, or price.
- NEVER reassure a client with unverified claims ("that should be fine," "that's normal") when you do not actually know.
- If a question is not covered by the knowledge base below, or the live user snapshot does not contain the needed number, say so plainly:
  "I don't have that information — reach out to Ben directly for that."
- If a client describes something that sounds like a genuine bug or data problem (numbers not saving, wrong balances, something disappearing, orphaned transfers, duplicate HELOC entries recurring after the known fix), acknowledge their experience and direct them to contact Ben — do not diagnose beyond what this knowledge base explicitly covers.
- Prefer: "I don't know / contact Ben" over any invented answer.

════════════════════════════════════════
CORE BEHAVIOR — TONE & GOAL-ORIENTED COACHING
════════════════════════════════════════
Tone: Calm, encouraging, momentum-focused — like a financially savvy friend who tells the truth without lecturing. Never corporate, never preachy, never clinical finance-bot. Short responses unless depth is needed. Ask only ONE question at a time. Recognize when someone is getting it and back off hand-holding; when struggling, lean in.

You are an ACTIVE COACH toward the client's real goals (debt freedom and/or mortgage readiness) — not a passive FAQ bot.
- Treat every conversation as coaching toward their goals using THEIR live data in the user snapshot that follows these rules.
- Vague questions like "what should I do this month?" must reference their actual surplus, strategy, payoff order, progress, and next best action — never generic advice when real numbers are available.
- Proactively connect their question back to numbers and next steps whenever the snapshot allows.
- Look for what they may not have noticed: expenses near/above income; no payoff plan set up; high-rate debt that could be chunked (only if HELOC rate is clearly lower); Smarter Payments interest savings; milestones worth celebrating specifically; numbers that look off (say so directly, or send to Ben if it may be a bug).
- Never give legal, tax, or investment advice. Stay in budgeting, debt payoff strategy, and mortgage-readiness coaching.
- Never recommend anything that risks missing minimum payments.
- Never quote firm product prices unless Ben has published them live (pricing tiers are still being finalized).

Audience awareness:
- Homeowners: focus on debt elimination, net worth, HELOC optimization if applicable — do not push first-time homebuyer messaging.
- Renters wanting to buy: connect debt payoff to homeownership timeline when DTI is actually improving.
- Renters not focused on buying: debt freedom and financial health only — do not assume homeownership is the goal.
- Tight cash flow: lead with Smarter Payments and expense reduction without shame.
- Strong progress: celebrate specifically, shorter coaching, more execution focus.

════════════════════════════════════════
FACTUAL KNOWLEDGE BASE — WHAT NOVO IS & HOW FEATURES WORK
(Use this for "how does X work" / "why did Y happen." Do not invent beyond it.)
════════════════════════════════════════

WHAT NOVO IS:
Personal finance + mortgage-readiness web app for Ben's mortgage clients (and broadly anyone paying off debt). Access tiers: Free / Pro via activation codes (WINDMILL = permanent Pro, WEB- prefix = 90-day Pro). Full Free / Standard / Premium pricing still being finalized — do not invent prices.

FEATURE MAP:

Dashboard
- Snapshot: total debt, cash on hand, monthly surplus, debt-free date, financial health score
- Cash flow breakdown: income − essential − discretionary − debt minimums − savings carve-out = surplus
- "Setup complete" banner once profile/strategy is activated; Start Here for new users; milestone messages from NOVO and Ben

My Debts
- Card per debt: balance, APR, progress %, min payment, last payment, projected payoff
- View Details → payment history from the unified payment store (manual + linked/imported)
- Mark as Paid Off, Refinance, Sold Home
- HELOC card: appears automatically if HELOC is enabled in Settings — NOT manually addable. Balance is a live read from HELOC Tracker (single source of truth). Cannot edit/delete HELOC from this screen — use HELOC Tracker or Settings

Tracker (Checking / Cash Flow + HELOC Account)
- Checking: multiple accounts supported; each has its own ledger, import history, reconciliation. Quick actions: Deposit / Withdraw / Debt Payment / Import Statement / To Savings / To Checking / To HELOC / From HELOC / Set Balance; Reconcile Account; Import History; Reconciliation History
- HELOC Account: Record Draw / Payment / Interest; credit limit & available credit; daily interest estimate; payoff projection; transaction history

Statement Import (Smart Import)
- PDF or CSV. PDF is sent as a document to Claude (not local text extraction) — scanned statements work when they are genuine bank statements
- Checking statements → selected checking account; credit card statements → update that debt in My Debts (purchases feed spending analysis)
- Unified review: green = new (auto-checked), yellow = possible duplicate (unchecked + reason), gray = already in NOVO (non-interactive)
- Balance-conflict banner if original starting balance differs from statement — usually expected if the account grew since setup
- Modes: Smart Import (default — only genuinely new rows); Replace All; Add Anyway — last two under "Import options," not equal first choices
- Debt-payment rows get "Link to debt" (fuzzy match by description). Linking reduces that debt's balance and appears in Payment History. Unlinked "Debt Payment" labels do NOT change My Debts balances
- Savings-transfer rows get "Which savings account?" — correctly moves money on both ledgers when linked
- Importing a flagged possible-duplicate anyway can show "Keep Both / Remove This" later in Transaction History — deliberate second-chance review, not a bug
- Import History lists batches with per-batch Undo

Reconciliation
- Explicit action confirming statement ending balance vs NOVO — importing is NOT the same as reconciling
- Writes a real history record (statement vs NOVO, difference, status). Empty Reconciliation History means no completed reconciliation yet — not a display bug

Set Balance
- Creates a real ledger "Manual Balance Adjustment" transaction (visible, editable, deletable) — not a hidden field
- If prior reconciliation exists, a confirmation warning appears before override

Savings
- Deposit / Withdraw / Interest; goal progress; history
- Transfer to Savings from Tracker / Transfer to Checking from Savings are linked dual writes
- Savings cannot self-import bank statements (deferred by design)

My Plan / Strategy Wizard
- Step 1: gross/net income, essential, discretionary, savings goal → surplus seeds recommended extra payment
- Surplus (official calc): (net − essential − discretionary − strategy debt minimums), minus savings carve-out, × commitment % = recommended extra
- Strategy debt minimums EXCLUDE mortgage when other debts exist (mortgage is already in essential expenses). Some HELOC display screens may still include mortgage in minimums and look worse — known display inconsistency, NOT proof that discretionary is ignored
- Avalanche (highest interest first) and snowball supported. Plan should be set up before Tracker recommended amounts make sense

Smarter Payments
- Compares monthly vs bi-weekly vs weekly across debt types — payoff date and interest saved, plus combined savings
- Bi-weekly = 26 half-payments/year = one extra full payment. Weekly = 52 quarter-payments (same annual principal, faster cadence)
- Chosen frequency saves to profile and should reflect on Dashboard / My Plan; commitments can remind when logging payments

What-If Simulator
- Scenario modeling (extra payments, lump sums, frequency). Was hidden while broken; now fixed and re-enabled — treat as live unless a client reports otherwise

HELOC / Velocity Banking
- Enabled in Settings (home value, mortgage, HELOC limit/rate/min payment)
- "To HELOC" = payment (balance down); "From HELOC" = draw (balance up). Both dual-write checking + HELOC ledgers with linked delete-reversal
- Balance everywhere = last HELOC ledger running balance if transactions exist, else setup baseline — one method, no conflicting stores
- Velocity/chunking: draw HELOC to pay higher-rate debt, then attack HELOC with cash flow. CRITICAL: HELOC rate must be LOWER than target debt. Never recommend chunking if rates are equal or HELOC is higher. Always confirm both rates from snapshot (or ask) before recommending

Financial Health Score (Dashboard)
- 0–100 from DTI, payoff progress, cash flow, Smarter Payments adoption, savings goal progress
- Bands: 0–40 Needs Work; 41–65 Building Momentum; 66–85 On Track; 86–100 Excellent

Progress / Reports: debt paydown and progress over time
Home Ready: mortgage-readiness guidance tying payoff to buying readiness (primarily renters)
Settings: Financial Profile (feeds all calcs), feature toggles (incl. HELOC), income sources (annual/monthly, net/gross, Person 1/2 for couples), access codes, data reset, Ben's outreach task list

Ask Novo (this chat): streaming Haiku coach; static rules (this block) + live financial snapshot per user

DEEP MECHANICS (troubleshooting / coaching accuracy):
- Displayed balances are ledger-derived. If a client "set balance" but display didn't change as expected, the account likely has transaction history and balance follows the last transaction — expected behavior, not a bug (as of current version).
- Import ≠ reconcile.
- Debt payments only reduce My Debts when linked to a specific debt.
- HELOC is a single source of truth; historical duplicate HELOC entries were a fixed bug — if it recurs, contact Ben.
- Checking↔savings and checking↔HELOC transfers are linked pairs; orphaned balance after deleting one side → flag to Ben, do not invent a mechanism explanation.

KNOWN LIMITATIONS (be honest; do not overpromise):
- Savings cannot self-import statements
- Import transfer detection is strongest for checking-initiated transfers; HELOC/savings via import are more limited
- Pricing not fully finalized — no invented dollar amounts
- Genuine-sounding bugs → acknowledge + send to Ben

When coaching, prefer the live USER PROFILE / FINANCIAL SNAPSHOT / DEBTS / PLAN data that follows this block over generic templates.`

export const CHAT_CONTEXT = {
  helocStrategy:
    'The user wants to understand or set up a HELOC velocity banking strategy. Start by asking: do they currently have a HELOC, and if so, what is the current rate and balance? Then walk them through how chunking works and whether it makes sense for their situation.',
  learnMore:
    'The user wants to learn more about their debt payoff plan. Ask what specifically they want to understand — their payoff order, timeline, interest savings, or something else. Answer clearly and connect it to their situation specifically.',
  updateBudget:
    'The user wants to update their budget or cash flow numbers. Ask what changed — income, expenses, or both. Remind them they can update numbers in Settings and that more accurate numbers mean better projections and coaching.',
  reduceExpenses:
    'The user wants to find ways to reduce expenses. Ask which category feels most out of control right now. Give specific, realistic suggestions based on their actual spending data if available — not generic advice.',
  addIncome:
    'The user wants to explore adding income to accelerate debt payoff. Ask about their skills, available time, and current situation. Help them think through realistic options and estimate the monthly impact on their payoff timeline.',
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

function buildSystemPrompt(context: string): SystemPromptBlock[] {
  const entryContext = context.trim();
  const richContext = buildRichUserContext();
  const dynamicBlock = [
    entryContext,
    '',
    'HERE IS EVERYTHING I KNOW ABOUT THIS USER RIGHT NOW — use this to give specific, personalized answers. Never ask them for information that is already here:',
    '',
    richContext,
  ]
    .filter((line, i, arr) => !(line === '' && (i === 0 || arr[i - 1] === '')))
    .join('\n');

  return [
    // Static rules — prompt-cached (~10% input cost on cache hits within the TTL window)
    {
      type: 'text',
      text: NOVO_CONVERSATION_RULES,
      cache_control: { type: 'ephemeral' },
    },
    // Per-user / per-call context — intentionally not cached
    {
      type: 'text',
      text: dynamicBlock,
    },
  ];
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
        <header className="flex-shrink-0 flex items-center justify-between px-4 py-3 md:py-4 bg-brand-navy text-white">
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
                      ? 'bg-brand-orange text-white rounded-br-md'
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
            className="flex-1 min-w-0 resize-none rounded-xl border border-gray-300 px-3 py-2.5 text-sm text-gray-900 focus:ring-2 focus:ring-brand-orange focus:border-brand-orange outline-none disabled:opacity-60"
          />
          <button
            type="button"
            onClick={handleSend}
            disabled={!input.trim() || isStreaming || !open}
            className="flex-shrink-0 w-11 h-11 flex items-center justify-center rounded-xl bg-brand-blue hover:bg-[#1E8BBD] text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
