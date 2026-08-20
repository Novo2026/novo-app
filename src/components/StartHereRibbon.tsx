import { useState, useEffect } from 'react';
import {
  CheckCircle2,
  Circle,
  ChevronDown,
  ChevronUp,
  ArrowRight,
  Share,
  PlusSquare,
  Download,
} from 'lucide-react';
import { StorageService } from '../services/storage';
import BrandProgressBar from './BrandProgressBar';
import {
  hasDeferredInstallPrompt,
  isIosSafariLike,
  isPwaInstallComplete,
  markPwaInstallComplete,
  promptNovoInstall,
  subscribePwaInstall,
} from '../utils/pwaInstall';

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
      novoCoaching: `This is the foundation everything else builds on. Your income, expenses, and surplus number tell me how we can plan your debt payoff. The more accurate this is, the better your plan will be.`,
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
      novoCoaching: `I need the full picture to help you. Add the debts you're working on — credit cards, car loans, student loans, personal loans. The more complete this is, the better NOVO can help. This step usually takes about 5 minutes.`,
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
      id: 'install',
      title: 'Add NOVO to your home screen',
      novoCoaching: `You've got a real plan now — keep it one tap away. Adding NOVO to your home screen makes it feel like an app, loads faster, and means you're more likely to log payments and stay on track.`,
      completedMessage: `NOVO is on your home screen — easy access locked in.`,
      ctaLabel: 'Install NOVO',
      ctaSection: 'pwa_install',
      checkComplete: () => isPwaInstallComplete(),
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
        const transactions = StorageService.getCheckingTransactions();
        return transactions.length > 0;
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

function InstallStepActions({ onDone }: { onDone: () => void }) {
  const [canNativeInstall, setCanNativeInstall] = useState(hasDeferredInstallPrompt());
  const [installBusy, setInstallBusy] = useState(false);
  const ios = isIosSafariLike();

  useEffect(() => subscribePwaInstall(() => {
    setCanNativeInstall(hasDeferredInstallPrompt());
    if (isPwaInstallComplete()) onDone();
  }), [onDone]);

  const handleNativeInstall = async () => {
    setInstallBusy(true);
    try {
      const outcome = await promptNovoInstall();
      if (outcome === 'accepted' || isPwaInstallComplete()) {
        onDone();
      }
    } finally {
      setInstallBusy(false);
      setCanNativeInstall(hasDeferredInstallPrompt());
    }
  };

  if (ios) {
    return (
      <div className="space-y-3">
        <ol className="space-y-2.5 text-sm text-brand-navy">
          <li className="flex items-start gap-2.5">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-navy text-[11px] font-bold text-white">
              1
            </span>
            <span className="pt-0.5 leading-snug">
              Tap the <Share className="inline-block h-3.5 w-3.5 align-text-bottom text-brand-blue" />{' '}
              <strong>Share</strong> button in Safari (bottom center on iPhone).
            </span>
          </li>
          <li className="flex items-start gap-2.5">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-navy text-[11px] font-bold text-white">
              2
            </span>
            <span className="pt-0.5 leading-snug">
              Scroll and tap <PlusSquare className="inline-block h-3.5 w-3.5 align-text-bottom text-brand-blue" />{' '}
              <strong>Add to Home Screen</strong>.
            </span>
          </li>
          <li className="flex items-start gap-2.5">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-navy text-[11px] font-bold text-white">
              3
            </span>
            <span className="pt-0.5 leading-snug">
              Tap <strong>Add</strong> in the top right — NOVO appears on your home screen.
            </span>
          </li>
        </ol>
        <button
          type="button"
          onClick={() => {
            markPwaInstallComplete();
            onDone();
          }}
          className="flex items-center gap-2 bg-brand-orange hover:bg-brand-orange-dark text-white font-bold text-sm py-2.5 px-5 rounded-lg transition-colors"
        >
          I&apos;ve added it
          <CheckCircle2 className="w-4 h-4" />
        </button>
      </div>
    );
  }

  if (canNativeInstall) {
    return (
      <button
        type="button"
        disabled={installBusy}
        onClick={handleNativeInstall}
        className="flex items-center gap-2 bg-brand-orange hover:bg-brand-orange-dark disabled:opacity-60 text-white font-bold text-sm py-2.5 px-5 rounded-lg transition-colors"
      >
        <Download className="w-4 h-4" />
        {installBusy ? 'Opening install…' : 'Install NOVO'}
      </button>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-brand-gray leading-relaxed">
        Your browser may already offer install from the address bar (install icon) or the browser menu
        → <strong>Install app</strong> / <strong>Add to Home screen</strong>. After you install, this
        step will check off automatically — or confirm below.
      </p>
      <button
        type="button"
        onClick={() => {
          markPwaInstallComplete();
          onDone();
        }}
        className="flex items-center gap-2 bg-brand-orange hover:bg-brand-orange-dark text-white font-bold text-sm py-2.5 px-5 rounded-lg transition-colors"
      >
        I&apos;ve installed it
        <CheckCircle2 className="w-4 h-4" />
      </button>
    </div>
  );
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

  useEffect(() => subscribePwaInstall(() => forceUpdate((n) => n + 1)), []);

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

  const dismissed = localStorage.getItem(RIBBON_KEY) === 'true';

  if (dismissed) return null;
  if (allComplete) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-lg py-3 px-4 flex items-center gap-3">
        <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0" />
        <p className="text-[13px] text-green-800">Setup complete — your plan is fully activated</p>
      </div>
    );
  }

  const currentStep = steps.find(s => !s.checkComplete());

  const progressPercent = Math.round((completedSteps.length / steps.length) * 100);

  return (
    <div className="bg-white border border-brand-gray-border rounded-lg overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-3 flex items-center justify-between bg-brand-navy text-white rounded-t-lg"
      >
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium">Setup guide</span>
          <span className="bg-brand-orange text-white text-[11px] font-semibold px-2 py-0.5 rounded-full">
            {completedSteps.length} of {steps.length}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-white/70">{progressPercent}%</span>
          <BrandProgressBar
            percent={progressPercent}
            tone="orange"
            size="sm"
            className="!w-20 !bg-white/20"
          />
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </div>
      </button>

      {expanded && (
        <div className="divide-y divide-brand-gray-border">
          {steps.map((step, index) => {
            const isComplete = step.checkComplete();
            const isCurrent = currentStep?.id === step.id;
            const isLocked = !isComplete && !isCurrent;
            const isExpanded = activeStep === step.id;

            return (
              <div
                key={step.id}
                className={`${isCurrent ? 'bg-orange-50' : ''}`}
              >
                <button
                  onClick={() => {
                    if (!isLocked) {
                      setActiveStep(isExpanded ? null : step.id);
                    }
                  }}
                  className="w-full px-4 py-3 flex items-center gap-3 text-left"
                  disabled={isLocked}
                >
                  <div className="flex-shrink-0">
                    {isComplete ? (
                      <CheckCircle2 className="w-5 h-5 text-brand-green" />
                    ) : isCurrent ? (
                      <div className="w-5 h-5 rounded-full border-2 border-brand-orange flex items-center justify-center">
                        <div className="w-2 h-2 rounded-full bg-brand-orange" />
                      </div>
                    ) : (
                      <Circle className="w-5 h-5 text-brand-gray-border" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-bold ${isCurrent ? 'text-brand-orange' : isComplete ? 'text-brand-gray' : 'text-brand-gray'}`}>
                        Step {index + 1}
                      </span>
                      {isCurrent && (
                        <span className="text-xs bg-brand-orange text-white px-2 py-0.5 rounded-full font-bold">
                          Up next
                        </span>
                      )}
                    </div>
                    <p className={`text-sm mt-0.5 ${isComplete ? 'text-brand-gray' : isCurrent ? 'font-bold text-brand-navy' : isLocked ? 'text-brand-gray' : 'text-brand-navy'}`}>
                      {step.title}
                    </p>
                    {isComplete && (
                      <p className="text-xs text-brand-gray mt-0.5">{step.completedMessage}</p>
                    )}
                  </div>
                  {!isLocked && (
                    isExpanded
                      ? <ChevronUp className="w-4 h-4 text-brand-gray flex-shrink-0" />
                      : <ChevronDown className="w-4 h-4 text-brand-gray flex-shrink-0" />
                  )}
                </button>

                {isExpanded && !isComplete && (
                  <div className="px-5 pb-4 space-y-3">
                    <div className="bg-white border border-orange-200 rounded-lg p-4">
                      <div className="flex items-start gap-2 mb-2">
                        <div className="w-6 h-6 rounded-full bg-brand-orange flex items-center justify-center flex-shrink-0 mt-0.5">
                          <span className="text-white text-xs font-bold">N</span>
                        </div>
                        <p className="text-sm text-gray-700 leading-relaxed italic">
                          &ldquo;{step.novoCoaching}&rdquo;
                        </p>
                      </div>
                    </div>
                    {step.id === 'install' ? (
                      <InstallStepActions
                        onDone={() => {
                          setActiveStep(null);
                          forceUpdate((n) => n + 1);
                        }}
                      />
                    ) : (
                      <button
                        onClick={() => {
                          setActiveStep(null);
                          handleNavigate(step.ctaSection);
                        }}
                        className="flex items-center gap-2 bg-brand-orange hover:bg-brand-orange-dark text-white font-bold text-sm py-2.5 px-5 rounded-lg transition-colors"
                      >
                        {step.ctaLabel}
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    )}
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
