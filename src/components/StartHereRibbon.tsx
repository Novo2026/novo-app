import { useState, useEffect } from 'react';
import { CheckCircle2, Circle, ChevronDown, ChevronUp, ArrowRight, X } from 'lucide-react';
import { StorageService } from '../services/storage';

interface StartHereStep {
  id: string;
  title: string;
  novoCoaching: string;
  completedMessage: string;
  ctaLabel: string;
  ctaSection: string;
  checkComplete: () => boolean;
}

interface StartHereRibbonProps {
  onNavigate: (section: string) => void;
  onOpenChat: (context: string) => void;
  userName: string;
}

const RIBBON_KEY = 'novo_start_here_dismissed';
const INSTALL_DATE_KEY = 'novo_install_date';

function getSteps(hasHELOC: boolean, _isHomeowner: boolean): StartHereStep[] {
  return [
    {
      id: 'profile',
      title: 'Your profile is set up',
      novoCoaching: `This is the foundation everything else builds on. Your income, expenses, and surplus number tell me how aggressively we can attack your debt. The more accurate this is, the better your plan will be.`,
      completedMessage: `Profile complete — I have what I need to build your plan.`,
      ctaLabel: 'Review your profile',
      ctaSection: 'settings',
      checkComplete: () => {
        const profile = StorageService.getFinancialProfile();
        return !!(profile && profile.monthlyNetIncome > 0);
      },
    },
    {
      id: 'debts',
      title: 'Add all your debts',
      novoCoaching: `I need the full picture to help you. Every debt — credit cards, car loans, student loans, personal loans — needs to be in here. Don't leave anything out. The interest you're paying on debts you forgot to add is still costing you every single day. This step usually takes about 5 minutes and it's the most important thing you'll do in NOVO.`,
      completedMessage: `All debts entered — I can see your full financial picture now.`,
      ctaLabel: 'Go to My Debts',
      ctaSection: 'debts',
      checkComplete: () => {
        const debts = StorageService.getDebts();
        return debts.filter(d => !d.isPaidOff).length >= 1;
      },
    },
    {
      id: 'plan',
      title: 'Build your payoff plan',
      novoCoaching: `This is where your debt freedom date gets set. I'll show you two strategies — avalanche (highest interest first, saves the most money) and snowball (smallest balance first, builds momentum fastest). Neither is wrong. The best strategy is the one you'll actually stick to. Once you pick one, I'll show you your exact payoff order, month by month, and how much interest you'll save total.`,
      completedMessage: `Plan locked in — your debt freedom date is set.`,
      ctaLabel: 'Build my plan',
      ctaSection: 'strategies',
      checkComplete: () => {
        const strategy = localStorage.getItem('novo_strategy');
        const strategyResult = localStorage.getItem('novo_strategy_result');
        return !!(strategy || strategyResult);
      },
    },
    {
      id: 'smarter',
      title: 'Check Smarter Payments',
      novoCoaching: `Here's something most people don't know: switching from monthly to bi-weekly payments on even one debt can save you hundreds — sometimes thousands — in interest without spending a single extra dollar. You're just splitting your existing payment in two and paying every 2 weeks instead of once a month. That adds up to one extra payment per year completely free. Go see what it would save you specifically.`,
      completedMessage: `Smarter Payments reviewed — you know your acceleration options.`,
      ctaLabel: 'See Smarter Payments',
      ctaSection: 'smarter-payments',
      checkComplete: () => {
        const visited = localStorage.getItem('novo_smarter_payments_visited');
        const commitments = localStorage.getItem('novo_payment_commitments');
        return !!(visited || (commitments && JSON.parse(commitments || '{}') && Object.keys(JSON.parse(commitments || '{}')).length > 0));
      },
    },
    {
      id: 'tracker',
      title: 'Import your first bank statement',
      novoCoaching: `The Tracker is your financial command center. Import a bank statement — PDF or CSV works — and I'll automatically read every transaction, categorize your spending, and show you exactly where your money is going. Most people are surprised by what they find. Recurring charges they forgot about. Categories that are way higher than they thought. This is where NOVO gets personal — I can coach you on your actual spending, not guesses.`,
      completedMessage: `Statement imported — I can see your real spending patterns now.`,
      ctaLabel: 'Go to Tracker',
      ctaSection: 'tracker',
      checkComplete: () => {
        const transactions = localStorage.getItem('novo_checking_transactions');
        if (!transactions) return false;
        try {
          return JSON.parse(transactions).length > 0;
        } catch { return false; }
      },
    },
    {
      id: 'novo',
      title: 'Have your first conversation with NOVO',
      novoCoaching: `I'm here whenever you have a question, feel stuck, or just want to think something through. Ask me anything — how does bi-weekly actually work, should I use my HELOC to chunk a debt, what happens to my plan if I get a raise, is my spending on track. I know your numbers and I'll give you straight answers based on your actual situation. Not generic advice. Your situation.`,
      completedMessage: `You've talked with NOVO — your AI coach is active and ready.`,
      ctaLabel: 'Ask NOVO something',
      ctaSection: 'novo_chat',
      checkComplete: () => {
        return !!(localStorage.getItem('novo_first_chat_completed'));
      },
    },
  ].filter(step => {
    if (step.id === 'heloc' && !hasHELOC) return false;
    return true;
  });
}

export default function StartHereRibbon({ onNavigate, onOpenChat, userName }: StartHereRibbonProps) {
  const [expanded, setExpanded] = useState(true);
  const [activeStep, setActiveStep] = useState<string | null>(null);
  const [, forceUpdate] = useState(0);

  const homeEquity = StorageService.getHomeEquity();
  const isHomeowner = homeEquity?.ownsHome || false;
  const hasHELOC = homeEquity?.hasHELOC || false;

  const steps = getSteps(hasHELOC, isHomeowner);

  useEffect(() => {
    if (!localStorage.getItem(INSTALL_DATE_KEY)) {
      localStorage.setItem(INSTALL_DATE_KEY, new Date().toISOString());
    }
  }, []);

  const handleNavigate = (section: string) => {
    if (section === 'smarter-payments') {
      localStorage.setItem('novo_smarter_payments_visited', 'true');
    }
    if (section === 'novo_chat') {
      localStorage.setItem('novo_first_chat_completed', 'true');
      forceUpdate(n => n + 1);
      onOpenChat(`The user is just getting started with NOVO. Welcome them warmly, ask one simple question to understand their biggest financial concern right now, and let the conversation flow naturally from there. Keep it short and friendly — this is their first time talking to you.`);
      return;
    }
    onNavigate(section);
  };

  const completedSteps = steps.filter(s => s.checkComplete());
  const allComplete = completedSteps.length === steps.length;

  const installDate = localStorage.getItem(INSTALL_DATE_KEY);
  const daysSinceInstall = installDate
    ? Math.floor((Date.now() - new Date(installDate).getTime()) / (1000 * 60 * 60 * 24))
    : 0;

  const dismissed = localStorage.getItem(RIBBON_KEY) === 'true';

  if (dismissed) return null;
  if (allComplete && daysSinceInstall > 30) return null;

  const currentStep = steps.find(s => !s.checkComplete());

  if (allComplete) {
    return (
      <div className="bg-gradient-to-r from-emerald-500 to-teal-500 rounded-xl p-5 text-white mb-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-bold text-lg">🎉 You're fully set up, {userName}!</p>
            <p className="text-emerald-100 text-sm mt-0.5">
              All 6 steps complete. NOVO has everything it needs to coach you effectively.
            </p>
          </div>
          <button
            onClick={() => {
              localStorage.setItem(RIBBON_KEY, 'true');
              forceUpdate(n => n + 1);
            }}
            className="p-2 hover:bg-white/20 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border-2 border-[#FF6B35] rounded-xl overflow-hidden mb-6 shadow-sm">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-5 py-4 flex items-center justify-between bg-gradient-to-r from-[#1E3A5F] to-[#2d5a8e] text-white"
      >
        <div className="flex items-center gap-3">
          <div className="bg-[#FF6B35] rounded-lg px-2.5 py-1 text-xs font-bold">
            {completedSteps.length}/{steps.length}
          </div>
          <div className="text-left">
            <p className="font-bold text-sm">Start Here — Your Setup Guide</p>
            <p className="text-blue-200 text-xs mt-0.5">
              {completedSteps.length === 0
                ? `Let's get you set up, ${userName}. This takes about 10 minutes.`
                : completedSteps.length < steps.length
                ? `Good progress ${userName} — ${steps.length - completedSteps.length} step${steps.length - completedSteps.length > 1 ? 's' : ''} left to unlock full coaching`
                : `Almost there — one more step to go`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-1.5 w-24 bg-white/20 rounded-full overflow-hidden">
            <div
              className="h-full bg-[#FF6B35] rounded-full transition-all duration-500"
              style={{ width: `${(completedSteps.length / steps.length) * 100}%` }}
            />
          </div>
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </div>
      </button>

      {expanded && (
        <div className="divide-y divide-gray-100">
          {steps.map((step, index) => {
            const isComplete = step.checkComplete();
            const isCurrent = currentStep?.id === step.id;
            const isLocked = !isComplete && !isCurrent;
            const isExpanded = activeStep === step.id;

            return (
              <div
                key={step.id}
                className={`${isCurrent ? 'bg-orange-50' : isComplete ? 'bg-gray-50' : 'bg-white'}`}
              >
                <button
                  onClick={() => {
                    if (!isLocked) {
                      setActiveStep(isExpanded ? null : step.id);
                    }
                  }}
                  className="w-full px-5 py-3.5 flex items-center gap-3 text-left"
                  disabled={isLocked}
                >
                  <div className="flex-shrink-0">
                    {isComplete ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                    ) : isCurrent ? (
                      <div className="w-5 h-5 rounded-full border-2 border-[#FF6B35] flex items-center justify-center">
                        <div className="w-2 h-2 rounded-full bg-[#FF6B35]" />
                      </div>
                    ) : (
                      <Circle className="w-5 h-5 text-gray-300" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-bold ${isCurrent ? 'text-[#FF6B35]' : isComplete ? 'text-emerald-600' : 'text-gray-400'}`}>
                        Step {index + 1}
                      </span>
                      {isCurrent && (
                        <span className="text-xs bg-[#FF6B35] text-white px-2 py-0.5 rounded-full font-bold">
                          Do this next
                        </span>
                      )}
                    </div>
                    <p className={`text-sm font-semibold mt-0.5 ${isLocked ? 'text-gray-400' : 'text-gray-800'}`}>
                      {step.title}
                    </p>
                    {isComplete && (
                      <p className="text-xs text-emerald-600 mt-0.5">{step.completedMessage}</p>
                    )}
                  </div>
                  {!isLocked && (
                    isExpanded
                      ? <ChevronUp className="w-4 h-4 text-gray-400 flex-shrink-0" />
                      : <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  )}
                </button>

                {isExpanded && !isComplete && (
                  <div className="px-5 pb-4 space-y-3">
                    <div className="bg-white border border-orange-200 rounded-lg p-4">
                      <div className="flex items-start gap-2 mb-2">
                        <div className="w-6 h-6 rounded-full bg-[#FF6B35] flex items-center justify-center flex-shrink-0 mt-0.5">
                          <span className="text-white text-xs font-bold">N</span>
                        </div>
                        <p className="text-sm text-gray-700 leading-relaxed italic">
                          &ldquo;{step.novoCoaching}&rdquo;
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        setActiveStep(null);
                        handleNavigate(step.ctaSection);
                      }}
                      className="flex items-center gap-2 bg-[#FF6B35] hover:bg-[#e55a25] text-white font-bold text-sm py-2.5 px-5 rounded-lg transition-colors"
                    >
                      {step.ctaLabel}
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                )}

                {isExpanded && isComplete && (
                  <div className="px-5 pb-4">
                    <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                      <p className="text-sm text-emerald-700">{step.completedMessage}</p>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
