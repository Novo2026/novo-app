import { useState, useEffect, useRef } from 'react';
import type { Session } from '@supabase/supabase-js';
import { Home, CreditCard, TrendingUp, BarChart3, Settings as SettingsIcon, Wallet, PiggyBank, MessageCircle, CheckCircle, X, Menu, Building2, LogOut, CalendarClock, Sliders } from 'lucide-react';
import Dashboard from './components/Dashboard';
import MyDebts from './components/MyDebts';
import PaymentStrategies from './components/PaymentStrategies';
import WhatIfSimulator from './components/WhatIfSimulator';
import { Tracker } from './components/Tracker';
import SavingsTracker from './components/SavingsTracker';
import ProgressReports from './components/ProgressReports';
import Guide from './components/Guide';
import HomeReady from './components/HomeReady';
import Settings from './components/Settings';
import SmarterPayments from './components/SmarterPayments';
import OnboardingModal from './components/OnboardingModal';
import AuthModal from './components/AuthModal';
import NovoChat from './components/NovoChat';
import SpendingAnalysisPanel from './components/SpendingAnalysisPanel';
import ProactiveNOVOMessages from './components/ProactiveNOVOMessages';
import BenTaskPanel from './components/BenTaskPanel';
import PageHero from './components/PageHero';
import { ProFeatureGate, UpgradeButton } from './components/AccessGate';
import { supabase } from './lib/supabase';
import { pushLocalStorageToCloud } from './services/cloudSync';
import { syncTierFromSupabase } from './services/accessControl';
import { StorageService } from './services/storage';
import type { Debt, Transaction, FeaturePreferences } from './types';

type Section = 'dashboard' | 'debts' | 'strategies' | 'smarter-payments' | 'what-if' | 'tracker' | 'savings' | 'progress' | 'home-ready' | 'guide' | 'settings';

const DEFAULT_NOVO_CHAT_CONTEXT =
  'You are NOVO, a friendly debt payoff and financial coaching assistant built by Ben Hulshof, a mortgage broker with 27 years of experience. The user is asking a general question about their finances, debt payoff, or mortgage readiness. Be warm, conversational, and helpful. Ask one question at a time.';

function App() {
  const [authSession, setAuthSession] = useState<Session | null | undefined>(undefined);
  const [currentSection, setCurrentSection] = useState<Section>('dashboard');
  const [debts, setDebts] = useState<Debt[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [featurePreferences, setFeaturePreferences] = useState<FeaturePreferences>({
    helocEnabled: false,
    checkingEnabled: true,
  });
  const [showHelocWelcome, setShowHelocWelcome] = useState(false);
  const [showTrackerNewBadge, setShowTrackerNewBadge] = useState(() => {
    return localStorage.getItem('trackerTabNewSeen') !== 'true' && StorageService.getFeaturePreferences().helocEnabled;
  });
  const [askNovoClicked, setAskNovoClicked] = useState(false);
  const [showNovoChat, setShowNovoChat] = useState(false);
  const [novoChatContext, setNovoChatContext] = useState(DEFAULT_NOVO_CHAT_CONTEXT);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [menuOpenCount, setMenuOpenCount] = useState(() => {
    return parseInt(localStorage.getItem('menuOpenCount') || '0', 10);
  });
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthSession(session);
    });
    supabase.auth.getSession().then(({ data: { session } }) => {
      setAuthSession(session);
    });
    return () => subscription.unsubscribe();
  }, []);

  const bootstrapFromStorage = () => {
    StorageService.deduplicatePayments();
    loadData();
    checkOnboarding();
    loadFeaturePreferences();
    const clicked = localStorage.getItem('askNovoClicked') === 'true';
    setAskNovoClicked(clicked);
  };

  useEffect(() => {
    if (authSession === undefined || authSession === null) return;
    // Sync Pro tier from Supabase so it works across all devices
    syncTierFromSupabase();
    bootstrapFromStorage();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one-shot bootstrap when session becomes available
  }, [authSession]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    StorageService.deduplicatePayments();
    loadData();
    loadFeaturePreferences();
    setRefreshKey(prev => prev + 1);
  };

  const loadFeaturePreferences = () => {
    const preferences = StorageService.getFeaturePreferences();
    setFeaturePreferences(preferences);
    if (preferences.helocEnabled && localStorage.getItem('trackerTabNewSeen') !== 'true') {
      setShowTrackerNewBadge(true);
    }
  };

  const checkOnboarding = () => {
    const userName = localStorage.getItem('userName');
    if (!userName) {
      setShowOnboarding(true);
    } else {
      setShowOnboarding(false);
    }
  };

  const handleOnboardingComplete = (data: any) => {
    const parseCurrency = (value: string): number => {
      const num = value.replace(/[^0-9.]/g, '');
      return parseFloat(num) || 0;
    };

    StorageService.clearAllData();

    let displayName = data.userName;
    if (data.accountType === 'couple' && data.partnerName) {
      displayName = `${data.userName} & ${data.partnerName}`;
    } else if (data.accountType === 'family') {
      displayName = data.userName;
    }
    localStorage.setItem('userName', displayName);
    localStorage.setItem('userFirstName', data.userName);
    localStorage.setItem('userPartnerName', data.partnerName || '');
    localStorage.setItem('userAccountType', data.accountType || 'solo');
    localStorage.setItem('lastVisit', new Date().toISOString());

    if (data.address) {
      localStorage.setItem('userAddress', data.address);
    }

    const validDebts = data.debts.filter((d: any) =>
      d.name.trim() && parseCurrency(d.balance) > 0
    );

    const newDebts = validDebts.map((debt: any) => {
      const isMortgageWithData = debt.type === 'Mortgage' &&
        debt.originalAmount &&
        debt.loanStartDate &&
        debt.loanStartDate.match(/^\d{2}\/\d{4}$/);

      return {
        id: debt.id,
        accountName: debt.name,
        category: debt.type as any,
        startingBalance: parseCurrency(debt.balance),
        currentBalance: parseCurrency(debt.balance),
        interestRate: parseFloat(debt.interestRate) || 0,
        minimumPayment: parseCurrency(debt.minPayment),
        isPaidOff: false,
        createdAt: new Date().toISOString(),
        ...(isMortgageWithData && {
          originalAmount: parseCurrency(debt.originalAmount),
          loanStartDate: debt.loanStartDate,
          loanTerm: parseInt(debt.loanTerm || '30'),
          loanTermUnit: 'years' as const,
          isAmortized: true,
        }),
      };
    });

    StorageService.saveDebts(newDebts);

    const totalRentalIncome = (data.additionalProperties || []).reduce((sum: number, prop: { monthlyRentalIncome?: string }) => {
      return sum + (parseFloat(prop.monthlyRentalIncome?.replace(/[^0-9.]/g, '') || '0') || 0);
    }, 0);

    const netIncome = parseCurrency(data.monthlyIncome) + totalRentalIncome;
    const essential = parseCurrency(data.essentialExpenses);
    const discretionary = parseCurrency(data.discretionaryExpenses);
    const savingsGoal = parseCurrency(data.monthlySavingsGoal || '');
    const totalSurplus = Math.max(0, netIncome - essential - discretionary);
    const derivedSurplusCommitmentPercent =
      totalSurplus > 0 && savingsGoal > 0
        ? Math.round(Math.min(100, Math.max(0, ((totalSurplus - savingsGoal) / totalSurplus) * 100)))
        : 100;

    const financialProfile = {
      monthlyGrossIncome: parseCurrency(data.grossIncome),
      monthlyNetIncome: netIncome,
      monthlyEssentialExpenses: essential,
      monthlyDiscretionaryExpenses: discretionary,
      monthlySavingsGoal: savingsGoal,
      surplusCommitmentPercent: derivedSurplusCommitmentPercent,
    };
    StorageService.saveFinancialProfile(financialProfile);

    const incomeSourcesSummary = (data.incomeSources || []).map((s: { type: string; label: string; useAnnual?: boolean; annualAmount?: string; monthlyAmount?: string }) => ({
      type: s.type,
      label: s.label,
      monthlyAmount: s.useAnnual
        ? parseFloat(s.annualAmount.replace(/[^0-9.]/g, '')) / 12
        : parseFloat(s.monthlyAmount.replace(/[^0-9.]/g, '')) || 0,
    }));

    localStorage.setItem('novo_income_sources', JSON.stringify(incomeSourcesSummary));
    localStorage.setItem('novo_rental_income', totalRentalIncome.toString());

    const additionalPropertyDebts = (data.additionalProperties || [])
      .filter((prop: { mortgageBalance?: string }) => prop.mortgageBalance && parseFloat(prop.mortgageBalance.replace(/[^0-9.]/g, '')) > 0)
      .map((prop: { description?: string; mortgageBalance?: string; monthlyPayment?: string; monthlyRentalIncome?: string }) => ({
        id: `prop_debt_${Date.now()}_${Math.random()}`,
        accountName: prop.description || 'Investment Property Mortgage',
        category: 'Mortgage' as const,
        currentBalance: parseFloat(prop.mortgageBalance.replace(/[^0-9.]/g, '')) || 0,
        startingBalance: parseFloat(prop.mortgageBalance.replace(/[^0-9.]/g, '')) || 0,
        interestRate: 0,
        minimumPayment: parseFloat(prop.monthlyPayment?.replace(/[^0-9.]/g, '') || '0') || 0,
        isPaidOff: false,
        createdAt: new Date().toISOString(),
      }));

    if (additionalPropertyDebts.length > 0) {
      const existingDebts = StorageService.getDebts();
      StorageService.saveDebts([...existingDebts, ...additionalPropertyDebts]);
    }

    if (data.hasHELOC) {
      const homeEquity = {
        ownsHome: true,
        hasHELOC: true,
        helocLimit: parseCurrency(data.helocLimit),
        helocBalance: parseCurrency(data.helocBalance),
        helocRate: parseFloat(data.helocRate) || 0,
        helocMinPayment: parseCurrency(data.helocMinPayment),
      };
      StorageService.saveHomeEquity(homeEquity);

      // Enable HELOC features automatically when user has HELOC
      const preferences = StorageService.getFeaturePreferences();
      preferences.helocEnabled = true;
      StorageService.saveFeaturePreferences(preferences);
    }

    setShowOnboarding(false);
    loadData();

    const uid = authSession?.user?.id;
    if (uid) {
      pushLocalStorageToCloud(uid).catch(err => console.error('NOVO cloud sync failed:', err));
    }
  };

  const loadData = () => {
    const loadedDebts = StorageService.getDebts();
    const loadedTransactions = StorageService.getTransactions();
    setDebts(loadedDebts);
    setTransactions(loadedTransactions);
  };

  const handleDataUpdate = () => {
    loadData();
    loadFeaturePreferences();
    setRefreshKey(prev => prev + 1);
  };

  const handleHelocEnabledFirstTime = () => {
    setShowHelocWelcome(true);
    setShowTrackerNewBadge(true);
    localStorage.removeItem('trackerTabNewSeen');
    setTimeout(() => {
      setShowHelocWelcome(false);
    }, 5000);
  };

  const handleNavigateFromSettings = (section: 'tracker' | 'strategies' | 'guide') => {
    setCurrentSection(section as Section);
    if (section === 'tracker') {
      setShowTrackerNewBadge(false);
      localStorage.setItem('trackerTabNewSeen', 'true');
    }
  };

  const openMobileMenu = () => {
    const newCount = menuOpenCount + 1;
    setMenuOpenCount(newCount);
    localStorage.setItem('menuOpenCount', String(newCount));
    setMobileMenuOpen(true);
    setTimeout(() => {
      if (menuRef.current) {
        const firstFocusable = menuRef.current.querySelector<HTMLElement>('button, [href]');
        firstFocusable?.focus();
      }
    }, 50);
  };

  const closeMobileMenu = () => setMobileMenuOpen(false);

  const handleMobileNavClick = (section: Section) => {
    setCurrentSection(section);
    closeMobileMenu();
  };

  const handleAskNovoClick = () => {
    if (!askNovoClicked) {
      localStorage.setItem('askNovoClicked', 'true');
      setAskNovoClicked(true);
    }

    // Track Ask NOVO button click in Google Analytics
    if (typeof window !== 'undefined' && (window as any).gtag) {
      (window as any).gtag('event', 'ask_novo_clicked');
    }

    setNovoChatContext(DEFAULT_NOVO_CHAT_CONTEXT);
    setShowNovoChat(true);
  };

  const renderSection = () => {
    switch (currentSection) {
      case 'dashboard':
        return (
          <Dashboard
            onDataUpdate={handleDataUpdate}
            onNavigateToSavings={() => setCurrentSection('savings')}
            onNavigateToTracker={() => setCurrentSection('tracker')}
            onNavigateToSmarterPayments={() => setCurrentSection('smarter-payments')}
            onNavigate={(section) => setCurrentSection(section as Section)}
            onOpenChat={(context) => {
              setNovoChatContext(context);
              setShowNovoChat(true);
            }}
          />
        );
      case 'debts':
        return (
          <div>
            <PageHero page="debts" title="My Debts" subtitle="Track and manage every debt in one place" />
            <MyDebts onDataUpdate={handleDataUpdate} />
          </div>
        );
      case 'strategies':
        return (
          <div>
            <PageHero page="plan" title="My Plan" subtitle="Your fastest path to debt freedom" />
            <PaymentStrategies
              onDataUpdate={handleDataUpdate}
              onNavigateToSmarterPayments={() => setCurrentSection('smarter-payments')}
            />
          </div>
        );
      case 'smarter-payments':
        return (
          <div>
            <PageHero page="smarter-payments" title="Smarter Payments" subtitle="Pay less interest without spending more" />
            <SmarterPayments onDataUpdate={handleDataUpdate} />
          </div>
        );
      case 'what-if':
        return (
          <ProFeatureGate featureName="What-If Simulator">
            <div>
              <PageHero page="what-if" title="What-If Simulator" subtitle="Explore scenarios before you commit" />
              <WhatIfSimulator />
            </div>
          </ProFeatureGate>
        );
      case 'tracker':
        return (
          <ProFeatureGate featureName="Tracker & Spending Analysis">
            <div className="space-y-6">
              <PageHero page="tracker" title="Trackers" subtitle="Your cash flow command center" />
              <Tracker onDataUpdate={handleDataUpdate} />
              <SpendingAnalysisPanel
                onOpenChat={(context) => {
                  setNovoChatContext(context);
                  setShowNovoChat(true);
                }}
              />
            </div>
          </ProFeatureGate>
        );
      case 'savings':
        return (
          <ProFeatureGate featureName="Savings Tracker">
            <div>
              <PageHero page="savings" title="Savings" subtitle="Build your financial cushion" />
              <SavingsTracker />
            </div>
          </ProFeatureGate>
        );
      case 'progress':
        return (
          <ProFeatureGate featureName="Progress Reports">
            <div>
              <PageHero page="progress" title="Progress" subtitle="See how far you've come" />
              <ProgressReports onDataUpdate={handleDataUpdate} />
            </div>
          </ProFeatureGate>
        );
      case 'home-ready':
        return (
          <ProFeatureGate featureName="Home Ready">
            <div>
              <PageHero page="home-ready" title="Home Ready" subtitle="Your path from debt freedom to homeownership" />
              <HomeReady onNavigateToSettings={() => setCurrentSection('settings')} />
            </div>
          </ProFeatureGate>
        );
      case 'guide':
        return <Guide />;
      case 'settings':
        return (
          <div>
            <PageHero page="settings" title="Settings" subtitle="Manage your NOVO account and preferences" />
            <Settings onDataUpdate={handleDataUpdate} onHelocEnabledFirstTime={handleHelocEnabledFirstTime} onNavigate={handleNavigateFromSettings} />
          </div>
        );
      default:
        return <Dashboard onDataUpdate={handleDataUpdate} onNavigateToSavings={() => setCurrentSection('savings')} />;
    }
  };

  if (authSession === undefined) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-600 text-sm">Loading…</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(135deg, #EEF2F7 0%, #F5EDE8 100%)' }}>
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
        <div
          className="absolute inset-0"
          style={{
            background: `
      radial-gradient(ellipse at 100% 0%, rgba(255,107,53,0.10) 0%, transparent 45%),
      radial-gradient(ellipse at 0% 100%, rgba(30,58,95,0.10) 0%, transparent 45%),
      radial-gradient(ellipse at 50% 50%, rgba(255,255,255,0.70) 0%, transparent 70%)
    `,
          }}
        />
        <svg
          className="absolute bottom-0 left-0 w-full"
          viewBox="0 0 1440 500"
          preserveAspectRatio="xMidYMax slice"
          xmlns="http://www.w3.org/2000/svg"
          style={{ opacity: 0.09 }}
        >
          <path d="M0,380 Q200,320 400,355 Q600,390 800,345 Q1000,300 1200,335 Q1350,358 1440,330 L1440,500 L0,500Z" fill="#1E3A5F" />
          <path d="M0,420 Q250,370 500,400 Q750,430 1000,390 Q1200,358 1440,380 L1440,500 L0,500Z" fill="#1E3A5F" opacity="0.6" />
          <rect x="200" y="210" width="6" height="175" fill="#1E3A5F" />
          <rect x="190" y="378" width="26" height="7" rx="2" fill="#1E3A5F" />
          <g style={{ transformOrigin: '203px 218px' }}>
            <rect x="199" y="160" width="8" height="56" rx="4" fill="#FF6B35" />
            <rect x="199" y="222" width="8" height="56" rx="4" fill="#FF6B35" opacity="0.7" />
            <rect x="145" y="214" width="56" height="8" rx="4" fill="#FF6B35" opacity="0.6" />
            <rect x="205" y="214" width="56" height="8" rx="4" fill="#FF6B35" opacity="0.8" />
          </g>
          <rect x="750" y="250" width="4" height="130" fill="#1E3A5F" />
          <rect x="742" y="374" width="20" height="6" rx="2" fill="#1E3A5F" />
          <g style={{ transformOrigin: '752px 257px' }}>
            <rect x="748" y="215" width="6" height="42" rx="3" fill="#FF6B35" />
            <rect x="748" y="259" width="6" height="42" rx="3" fill="#FF6B35" opacity="0.7" />
            <rect x="708" y="253" width="42" height="6" rx="3" fill="#FF6B35" opacity="0.6" />
            <rect x="754" y="253" width="42" height="6" rx="3" fill="#FF6B35" opacity="0.8" />
          </g>
          <rect x="1150" y="278" width="3" height="95" fill="#1E3A5F" />
          <rect x="1143" y="368" width="17" height="5" rx="2" fill="#1E3A5F" />
          <g style={{ transformOrigin: '1151px 284px' }}>
            <rect x="1148" y="253" width="5" height="30" rx="2.5" fill="#FF6B35" />
            <rect x="1148" y="285" width="5" height="30" rx="2.5" fill="#FF6B35" opacity="0.7" />
            <rect x="1120" y="279" width="30" height="5" rx="2.5" fill="#FF6B35" opacity="0.6" />
            <rect x="1154" y="279" width="30" height="5" rx="2.5" fill="#FF6B35" opacity="0.8" />
          </g>
          <path d="M0,200 Q360,150 720,185 Q1080,220 1440,175" fill="none" stroke="#1E3A5F" strokeWidth="1" opacity="0.4" />
          <path d="M0,240 Q360,190 720,225 Q1080,260 1440,215" fill="none" stroke="#1E3A5F" strokeWidth="0.8" opacity="0.3" />
          <path d="M0,160 Q360,110 720,145 Q1080,180 1440,135" fill="none" stroke="#FF6B35" strokeWidth="0.8" opacity="0.3" />
        </svg>
      </div>
      {authSession === null && (
        <AuthModal
          onAuthenticated={() => {
            bootstrapFromStorage();
            setRefreshKey(prev => prev + 1);
          }}
        />
      )}
      {showOnboarding && <OnboardingModal onComplete={handleOnboardingComplete} />}

      {/* Mobile slide-out menu overlay */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={closeMobileMenu}
          aria-hidden="true"
        />
      )}

      {/* Mobile slide-out drawer */}
      <div
        ref={menuRef}
        role="dialog"
        aria-modal="true"
        aria-label="Navigation menu"
        className={`fixed top-0 left-0 h-full w-[280px] z-50 shadow-2xl flex flex-col md:hidden transition-transform duration-300 ease-in-out ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        style={{ backgroundColor: '#FDF6EE', borderRight: '1px solid #e8d8c4', backgroundImage: 'radial-gradient(circle, rgba(30,58,95,0.06) 1px, transparent 1px)', backgroundSize: '24px 24px' }}
        onKeyDown={(e) => { if (e.key === 'Escape') closeMobileMenu(); }}
      >
        <div className="flex items-center justify-between px-4 py-4 bg-[#1E3A5F]">
          <img src="/novo_primary.png" alt="NOVO Logo" className="h-8 w-auto" />
          <button
            onClick={closeMobileMenu}
            aria-label="Close navigation menu"
            className="text-white hover:text-gray-300 transition-colors p-1 rounded"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto py-2">
          {([
            { section: 'dashboard' as Section, label: 'Dashboard', icon: Home },
            { section: 'debts' as Section, label: 'My Debts', icon: CreditCard },
            { section: 'strategies' as Section, label: 'My Plan', icon: TrendingUp },
            ...((featurePreferences.helocEnabled || featurePreferences.checkingEnabled)
              ? [{ section: 'tracker' as Section, label: 'Trackers', icon: Wallet, isNew: showTrackerNewBadge && featurePreferences.helocEnabled }]
              : []),
            { section: 'savings' as Section, label: 'Savings', icon: PiggyBank },
            { section: 'what-if' as Section, label: 'What-If Simulator', icon: Sliders },
            { section: 'smarter-payments' as Section, label: 'Smarter Payments', icon: CalendarClock },
            { section: 'progress' as Section, label: 'Progress', icon: BarChart3 },
            { section: 'home-ready' as Section, label: 'Home Ready', icon: Building2 },
            { section: 'settings' as Section, label: 'Settings', icon: SettingsIcon },
          ] as Array<{ section: Section; label: string; icon: any; isNew?: boolean }>).map(({ section, label, icon: Icon, isNew }) => (
            <button
              key={section}
              onClick={() => {
                handleMobileNavClick(section);
                if (section === 'tracker' && showTrackerNewBadge) {
                  setShowTrackerNewBadge(false);
                  localStorage.setItem('trackerTabNewSeen', 'true');
                }
              }}
              className={`w-full flex items-center gap-3 px-5 py-4 text-left transition-colors min-h-[48px] ${
                currentSection === section
                  ? 'bg-[#FF6B35]/10 text-[#FF6B35] font-bold border-l-4 border-[#FF6B35]'
                  : 'text-[#1E3A5F]/70 hover:bg-white/60 border-l-4 border-transparent hover:text-[#1E3A5F]'
              }`}
            >
              <Icon className="w-5 h-5 flex-shrink-0" />
              <span className="text-base flex-1">{label}</span>
              {isNew && (
                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-bold bg-emerald-500 text-white leading-none">
                  NEW
                </span>
              )}
            </button>
          ))}
        </nav>

        <div className="px-4 py-4 border-t border-gray-100">
          <button
            onClick={() => { handleAskNovoClick(); closeMobileMenu(); }}
            className="w-full flex items-center justify-center gap-2 bg-brand-orange hover:bg-brand-orange-dark text-white font-bold px-4 py-3 rounded-xl transition-colors shadow-sm"
          >
            <MessageCircle className="w-5 h-5" />
            Ask NOVO
          </button>
        </div>
      </div>

      <header
        className="bg-[#1E3A5F] shadow-md sticky top-0 z-20 border-b border-white/10 text-white"
        style={{ backgroundImage: 'radial-gradient(ellipse at 80% 50%, rgba(255,107,53,0.15) 0%, transparent 60%), radial-gradient(ellipse at 20% 50%, rgba(45,90,142,0.3) 0%, transparent 50%)' }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Mobile: hamburger + logo | Desktop: logo + subtitle */}
            <div className="flex items-center gap-3">
              <button
                onClick={openMobileMenu}
                aria-label="Open navigation menu"
                className="relative md:hidden flex items-center justify-center w-10 h-10 rounded-lg hover:bg-white/10 transition-colors flex-shrink-0"
              >
                <Menu className="w-6 h-6 text-white" />
                {menuOpenCount < 3 && (
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full" aria-hidden="true" />
                )}
              </button>
              <button
                onClick={() => setCurrentSection('dashboard')}
                className="flex items-center group cursor-pointer"
              >
                <div className="flex items-center gap-3 windmill-logo">
                  <div className="flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: '#FF6B35' }}>
                    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden>
                      <g className="windmill-blades">
                        <rect x="9.5" y="1" width="3" height="9" rx="1.5" fill="white"/>
                        <rect x="9.5" y="12" width="3" height="9" rx="1.5" fill="white" opacity="0.7"/>
                        <rect x="1" y="9.5" width="9" height="3" rx="1.5" fill="white" opacity="0.6"/>
                        <rect x="12" y="9.5" width="9" height="3" rx="1.5" fill="white" opacity="0.9"/>
                      </g>
                      <circle cx="11" cy="11" r="2.5" fill="#FF6B35" stroke="white" strokeWidth="1.5"/>
                    </svg>
                  </div>
                  <div className="hidden sm:block text-left">
                    <div className="text-white font-bold text-base tracking-tight leading-none">NOVO</div>
                    <div className="text-white/50 text-[10px] tracking-wide">Debt Free. Home Ready.</div>
                  </div>
                </div>
              </button>
            </div>

            <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
              {authSession?.user?.email && (
                <>
                  <span
                    className="hidden md:inline text-xs text-gray-300 max-w-[160px] truncate"
                    title={authSession.user.email}
                  >
                    {authSession.user.email}
                  </span>
                  <UpgradeButton />
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="flex items-center gap-1 text-xs sm:text-sm font-medium text-gray-200 hover:text-white border border-white/30 hover:border-white/60 rounded-lg px-2 py-1.5 sm:px-3 transition-colors"
                    title="Log out"
                  >
                    <LogOut className="w-4 h-4" />
                    <span className="hidden sm:inline">Log out</span>
                  </button>
                </>
              )}
              <button
                onClick={handleAskNovoClick}
                className={`group flex items-center space-x-2 bg-[#FF6B35] hover:bg-[#E55A25] text-white font-bold px-4 py-2.5 rounded-xl transition-all transform hover:scale-105 shadow-md hover:shadow-lg ${
                  !askNovoClicked ? 'animate-gentle-pulse' : ''
                }`}
                title="Get personalized debt coaching from NOVO's AI assistant"
              >
                <MessageCircle className="w-5 h-5" />
                <span className="hidden sm:inline">Ask NOVO</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <nav className="bg-brand-cream border-b border-brand-cream-border sticky top-[64px] z-20 hidden md:block" style={{ boxShadow: '0 1px 0 rgba(232,216,196,0.8)' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex overflow-x-auto">
            <button
              onClick={() => setCurrentSection('dashboard')}
              className={`flex items-center space-x-2 px-4 py-3 border-b-2 transition-colors whitespace-nowrap ${
                currentSection === 'dashboard'
                  ? 'border-[#FF6B35] text-[#1E3A5F] font-bold bg-white/60'
                  : 'border-transparent text-[#1E3A5F]/60 font-medium hover:text-[#1E3A5F] hover:border-[#e8d8c4] transition-colors'
              }`}
            >
              <Home className="w-4 h-4" />
              <span>Dashboard</span>
            </button>
            <button
              onClick={() => setCurrentSection('debts')}
              className={`flex items-center space-x-2 px-4 py-3 border-b-2 transition-colors whitespace-nowrap ${
                currentSection === 'debts'
                  ? 'border-[#FF6B35] text-[#1E3A5F] font-bold bg-white/60'
                  : 'border-transparent text-[#1E3A5F]/60 font-medium hover:text-[#1E3A5F] hover:border-[#e8d8c4] transition-colors'
              }`}
            >
              <CreditCard className="w-4 h-4" />
              <span>My Debts</span>
            </button>
            <button
              onClick={() => setCurrentSection('strategies')}
              className={`flex items-center space-x-2 px-4 py-3 border-b-2 transition-colors whitespace-nowrap ${
                currentSection === 'strategies'
                  ? 'border-[#FF6B35] text-[#1E3A5F] font-bold bg-white/60'
                  : 'border-transparent text-[#1E3A5F]/60 font-medium hover:text-[#1E3A5F] hover:border-[#e8d8c4] transition-colors'
              }`}
            >
              <TrendingUp className="w-4 h-4" />
              <span>My Plan</span>
            </button>
            {(featurePreferences.helocEnabled || featurePreferences.checkingEnabled) && (
              <button
                onClick={() => {
                  setCurrentSection('tracker');
                  if (showTrackerNewBadge) {
                    setShowTrackerNewBadge(false);
                    localStorage.setItem('trackerTabNewSeen', 'true');
                  }
                }}
                className={`relative flex items-center space-x-2 px-4 py-3 border-b-2 transition-colors whitespace-nowrap ${
                  currentSection === 'tracker'
                    ? 'border-[#FF6B35] text-[#1E3A5F] font-bold bg-white/60'
                    : 'border-transparent text-[#1E3A5F]/60 font-medium hover:text-[#1E3A5F] hover:border-[#e8d8c4] transition-colors'
                }`}
              >
                <Wallet className="w-4 h-4" />
                <span>Tracker</span>
                {showTrackerNewBadge && featurePreferences.helocEnabled && (
                  <span className="ml-1 inline-flex items-center px-1.5 py-0.5 rounded text-xs font-bold bg-emerald-500 text-white leading-none">
                    NEW
                  </span>
                )}
              </button>
            )}
            <button
              onClick={() => setCurrentSection('savings')}
              className={`flex items-center space-x-2 px-4 py-3 border-b-2 transition-colors whitespace-nowrap ${
                currentSection === 'savings'
                  ? 'border-[#FF6B35] text-[#1E3A5F] font-bold bg-white/60'
                  : 'border-transparent text-[#1E3A5F]/60 font-medium hover:text-[#1E3A5F] hover:border-[#e8d8c4] transition-colors'
              }`}
            >
              <PiggyBank className="w-4 h-4" />
              <span>Savings</span>
            </button>
            <button
              onClick={() => setCurrentSection('what-if')}
              className={`flex items-center space-x-2 px-4 py-3 border-b-2 transition-colors whitespace-nowrap ${
                currentSection === 'what-if'
                  ? 'border-[#FF6B35] text-[#1E3A5F] font-bold bg-white/60'
                  : 'border-transparent text-[#1E3A5F]/60 font-medium hover:text-[#1E3A5F] hover:border-[#e8d8c4] transition-colors'
              }`}
            >
              <Sliders className="w-4 h-4" />
              <span>What-If Simulator</span>
            </button>
            <button
              onClick={() => setCurrentSection('smarter-payments')}
              className={`flex items-center space-x-2 px-4 py-3 border-b-2 transition-colors whitespace-nowrap ${
                currentSection === 'smarter-payments'
                  ? 'border-[#FF6B35] text-[#1E3A5F] font-bold bg-white/60'
                  : 'border-transparent text-[#1E3A5F]/60 font-medium hover:text-[#1E3A5F] hover:border-[#e8d8c4] transition-colors'
              }`}
            >
              <CalendarClock className="w-4 h-4" />
              <span>Smarter Payments</span>
            </button>
            <button
              onClick={() => setCurrentSection('progress')}
              className={`flex items-center space-x-2 px-4 py-3 border-b-2 transition-colors whitespace-nowrap ${
                currentSection === 'progress'
                  ? 'border-[#FF6B35] text-[#1E3A5F] font-bold bg-white/60'
                  : 'border-transparent text-[#1E3A5F]/60 font-medium hover:text-[#1E3A5F] hover:border-[#e8d8c4] transition-colors'
              }`}
            >
              <BarChart3 className="w-4 h-4" />
              <span>Progress</span>
            </button>
            <button
              onClick={() => setCurrentSection('home-ready')}
              className={`flex items-center space-x-2 px-4 py-3 border-b-2 transition-colors whitespace-nowrap ${
                currentSection === 'home-ready'
                  ? 'border-[#FF6B35] text-[#1E3A5F] font-bold bg-white/60'
                  : 'border-transparent text-[#1E3A5F]/60 font-medium hover:text-[#1E3A5F] hover:border-[#e8d8c4] transition-colors'
              }`}
            >
              <Building2 className="w-4 h-4" />
              <span>Home Ready</span>
            </button>
            <button
              onClick={() => setCurrentSection('settings')}
              data-section="settings"
              className={`flex items-center space-x-2 px-4 py-3 border-b-2 transition-colors whitespace-nowrap ${
                currentSection === 'settings'
                  ? 'border-[#FF6B35] text-[#1E3A5F] font-bold bg-white/60'
                  : 'border-transparent text-[#1E3A5F]/60 font-medium hover:text-[#1E3A5F] hover:border-[#e8d8c4] transition-colors'
              }`}
            >
              <SettingsIcon className="w-4 h-4" />
              <span>Settings</span>
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8 pb-20 md:pb-0 animate-fade-in relative z-10">
        <div key={refreshKey}>{renderSection()}</div>
      </main>

      <NovoChat
        open={showNovoChat}
        onClose={() => setShowNovoChat(false)}
        context={novoChatContext}
      />

      <ProactiveNOVOMessages
        onOpenChat={(context) => {
          setNovoChatContext(context);
          setShowNovoChat(true);
        }}
      />

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-30 border-t border-brand-cream-border" style={{ backgroundColor: '#FDF6EE', boxShadow: '0 -4px 24px rgba(30,58,95,0.08)' }}>
        <div className="flex items-center justify-around px-2 py-1">
          {[
            { section: 'dashboard' as Section, label: 'Home', icon: Home },
            { section: 'debts' as Section, label: 'Debts', icon: CreditCard },
            { section: 'strategies' as Section, label: 'Plan', icon: TrendingUp },
            { section: 'smarter-payments' as Section, label: 'Payments', icon: CalendarClock },
            { section: 'settings' as Section, label: 'More', icon: SettingsIcon },
          ].map(({ section, label, icon: Icon }) => (
            <button
              key={section}
              type="button"
              onClick={() => handleMobileNavClick(section)}
              className={`relative flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl transition-all min-w-[56px] ${
                currentSection === section
                  ? 'text-brand-orange'
                  : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              <Icon className={`w-5 h-5 transition-transform ${currentSection === section ? 'scale-110' : ''}`} />
              <span className={`text-[10px] font-semibold ${currentSection === section ? 'text-brand-orange' : 'text-gray-400'}`}>
                {label}
              </span>
              {currentSection === section && (
                <div className="absolute bottom-0 w-8 h-0.5 bg-brand-orange rounded-full" />
              )}
            </button>
          ))}
        </div>
      </nav>

      {showHelocWelcome && (
        <div className="fixed bottom-8 right-8 z-50 animate-slide-up md:bottom-8">
          <div className="bg-white rounded-lg shadow-2xl border-2 border-emerald-500 p-4 max-w-md">
            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0">
                <div className="w-10 h-10 bg-emerald-500 rounded-full flex items-center justify-center">
                  <CheckCircle className="w-6 h-6 text-white" />
                </div>
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-gray-800 mb-1">HELOC Tracker Enabled!</h3>
                <p className="text-sm text-gray-600">
                  Find it in the Tracker tab to start tracking your velocity banking strategy.
                </p>
              </div>
              <button
                onClick={() => setShowHelocWelcome(false)}
                className="flex-shrink-0 text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
