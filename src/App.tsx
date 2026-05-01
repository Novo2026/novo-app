import { useState, useEffect, useRef } from 'react';
import { Home, CreditCard, TrendingUp, BarChart3, Settings as SettingsIcon, Wallet, PiggyBank, MessageCircle, BookOpen, CheckCircle, X, Menu } from 'lucide-react';
import Dashboard from './components/Dashboard';
import MyDebts from './components/MyDebts';
import PaymentStrategies from './components/PaymentStrategies';
import WhatIfSimulator from './components/WhatIfSimulator';
import { Tracker } from './components/Tracker';
import SavingsTracker from './components/SavingsTracker';
import ProgressReports from './components/ProgressReports';
import Guide from './components/Guide';
import Settings from './components/Settings';
import OnboardingModal from './components/OnboardingModal';
import WelcomeTourModal from './components/WelcomeTourModal';
import { StorageService } from './services/storage';
import type { Debt, Transaction, FeaturePreferences } from './types';

type Section = 'dashboard' | 'debts' | 'strategies' | 'what-if' | 'tracker' | 'savings' | 'progress' | 'guide' | 'settings';

function App() {
  const [currentSection, setCurrentSection] = useState<Section>('dashboard');
  const [debts, setDebts] = useState<Debt[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showWelcomeTour, setShowWelcomeTour] = useState(false);
  const [welcomeTourData, setWelcomeTourData] = useState<{ userName: string; hasHELOC: boolean }>({ userName: '', hasHELOC: false });
  const [featurePreferences, setFeaturePreferences] = useState<FeaturePreferences>({
    helocEnabled: false,
    checkingEnabled: true,
  });
  const [showHelocWelcome, setShowHelocWelcome] = useState(false);
  const [showTrackerNewBadge, setShowTrackerNewBadge] = useState(() => {
    return localStorage.getItem('trackerTabNewSeen') !== 'true' && StorageService.getFeaturePreferences().helocEnabled;
  });
  const [askNovoClicked, setAskNovoClicked] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [menuOpenCount, setMenuOpenCount] = useState(() => {
    return parseInt(localStorage.getItem('menuOpenCount') || '0', 10);
  });
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    StorageService.deduplicatePayments();
    loadData();
    checkOnboarding();
    loadFeaturePreferences();
    const clicked = localStorage.getItem('askNovoClicked') === 'true';
    setAskNovoClicked(clicked);
  }, []);

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
    }
  };

  const handleOnboardingComplete = (data: any) => {
    const parseCurrency = (value: string): number => {
      const num = value.replace(/[^0-9.]/g, '');
      return parseFloat(num) || 0;
    };

    StorageService.clearAllData();

    localStorage.setItem('userName', data.userName);
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
          isAmortized: true,
        }),
      };
    });

    StorageService.saveDebts(newDebts);

    const financialProfile = {
      monthlyGrossIncome: parseCurrency(data.grossIncome),
      monthlyNetIncome: parseCurrency(data.monthlyIncome),
      monthlyEssentialExpenses: parseCurrency(data.essentialExpenses),
      monthlyDiscretionaryExpenses: parseCurrency(data.discretionaryExpenses),
      monthlySavingsGoal: parseCurrency(data.monthlySavingsGoal || ''),
      surplusCommitmentPercent: 100,
    };
    StorageService.saveFinancialProfile(financialProfile);

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

    const shouldShowTour = localStorage.getItem('welcomeTourCompleted') !== 'true';
    if (shouldShowTour) {
      setWelcomeTourData({
        userName: data.userName,
        hasHELOC: data.hasHELOC || false,
      });
      setShowWelcomeTour(true);
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

  const handleWelcomeTourNavigate = (section: 'dashboard' | 'strategies', scrollTo?: string) => {
    setCurrentSection(section);
    if (scrollTo) {
      setTimeout(() => {
        const element = document.getElementById(scrollTo);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 100);
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

    window.open('https://chatgpt.com/g/g-68c32b52752c819199d83ce4a6d6435e-novo-gpt', '_blank');
  };

  const renderSection = () => {
    switch (currentSection) {
      case 'dashboard':
        return <Dashboard onDataUpdate={handleDataUpdate} onNavigateToSavings={() => setCurrentSection('savings')} onNavigateToTracker={() => setCurrentSection('tracker')} />;
      case 'debts':
        return <MyDebts onDataUpdate={handleDataUpdate} />;
      case 'strategies':
        return <PaymentStrategies onDataUpdate={handleDataUpdate} />;
      case 'what-if':
        return <WhatIfSimulator />;
      case 'tracker':
        return <Tracker />;
      case 'savings':
        return <SavingsTracker />;
      case 'progress':
        return <ProgressReports onDataUpdate={handleDataUpdate} />;
      case 'guide':
        return <Guide />;
      case 'settings':
        return <Settings onDataUpdate={handleDataUpdate} onHelocEnabledFirstTime={handleHelocEnabledFirstTime} onNavigate={handleNavigateFromSettings} />;
      default:
        return <Dashboard onDataUpdate={handleDataUpdate} onNavigateToSavings={() => setCurrentSection('savings')} />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {showOnboarding && <OnboardingModal onComplete={handleOnboardingComplete} />}
      {showWelcomeTour && (
        <WelcomeTourModal
          userName={welcomeTourData.userName}
          hasHELOC={welcomeTourData.hasHELOC}
          onNavigate={handleWelcomeTourNavigate}
          onAskNovo={handleAskNovoClick}
          onClose={() => setShowWelcomeTour(false)}
        />
      )}

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
        className={`fixed top-0 left-0 h-full w-[280px] bg-white z-50 shadow-2xl flex flex-col md:hidden transition-transform duration-300 ease-in-out ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
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
            { section: 'strategies' as Section, label: 'Payment Strategies', icon: TrendingUp },
            ...((featurePreferences.helocEnabled || featurePreferences.checkingEnabled)
              ? [{ section: 'tracker' as Section, label: featurePreferences.helocEnabled ? 'HELOC Tracker' : 'Cash Flow', icon: Wallet, isNew: showTrackerNewBadge && featurePreferences.helocEnabled }]
              : []),
            { section: 'savings' as Section, label: 'Savings Tracker', icon: PiggyBank },
            { section: 'progress' as Section, label: 'Progress Reports', icon: BarChart3 },
            { section: 'guide' as Section, label: 'How to Use', icon: BookOpen },
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
                  ? 'bg-[#FF6B35]/10 text-[#FF6B35] font-semibold border-l-4 border-[#FF6B35]'
                  : 'text-gray-700 hover:bg-gray-50 border-l-4 border-transparent'
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
            className="w-full flex items-center justify-center gap-2 bg-[#2D9CDB] hover:bg-[#1E8BBD] text-white font-semibold px-4 py-3 rounded-lg transition-colors"
          >
            <MessageCircle className="w-5 h-5" />
            Ask NOVO
          </button>
        </div>
      </div>

      <header className="bg-[#1E3A5F] text-white shadow-lg">
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
                className="flex items-center space-x-3 group cursor-pointer"
              >
                <img
                  src="/novo_primary.png"
                  alt="NOVO Logo"
                  className="h-10 w-auto transition-transform duration-200 group-hover:scale-105"
                />
                <div className="hidden sm:block text-sm text-gray-300">Debt Payoff Calculator</div>
              </button>
            </div>

            <button
              onClick={handleAskNovoClick}
              className={`group flex items-center space-x-2 bg-[#2D9CDB] hover:bg-[#1E8BBD] text-white font-semibold px-4 py-2 rounded-lg transition-all transform hover:scale-105 shadow-md hover:shadow-lg ${
                !askNovoClicked ? 'animate-gentle-pulse' : ''
              }`}
              title="Get personalized debt coaching from NOVO's AI assistant"
            >
              <MessageCircle className="w-5 h-5" />
              <span className="hidden sm:inline">Ask NOVO</span>
            </button>
          </div>
        </div>
      </header>

      <nav className="bg-white border-b border-gray-200 sticky top-0 z-10 shadow-sm hidden md:block">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex overflow-x-auto">
            <button
              onClick={() => setCurrentSection('dashboard')}
              className={`flex items-center space-x-2 px-4 py-3 border-b-2 transition-colors whitespace-nowrap ${
                currentSection === 'dashboard'
                  ? 'border-[#FF6B35] text-[#1E3A5F] font-semibold'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Home className="w-4 h-4" />
              <span>Dashboard</span>
            </button>
            <button
              onClick={() => setCurrentSection('debts')}
              className={`flex items-center space-x-2 px-4 py-3 border-b-2 transition-colors whitespace-nowrap ${
                currentSection === 'debts'
                  ? 'border-[#FF6B35] text-[#1E3A5F] font-semibold'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <CreditCard className="w-4 h-4" />
              <span>My Debts</span>
            </button>
            <button
              onClick={() => setCurrentSection('strategies')}
              className={`flex items-center space-x-2 px-4 py-3 border-b-2 transition-colors whitespace-nowrap ${
                currentSection === 'strategies'
                  ? 'border-[#FF6B35] text-[#1E3A5F] font-semibold'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <TrendingUp className="w-4 h-4" />
              <span>Payment Strategies</span>
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
                    ? 'border-[#FF6B35] text-[#1E3A5F] font-semibold'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
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
                  ? 'border-[#FF6B35] text-[#1E3A5F] font-semibold'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <PiggyBank className="w-4 h-4" />
              <span>Savings Tracker</span>
            </button>
            <button
              onClick={() => setCurrentSection('progress')}
              className={`flex items-center space-x-2 px-4 py-3 border-b-2 transition-colors whitespace-nowrap ${
                currentSection === 'progress'
                  ? 'border-[#FF6B35] text-[#1E3A5F] font-semibold'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <BarChart3 className="w-4 h-4" />
              <span>Progress Reports</span>
            </button>
            <button
              onClick={() => setCurrentSection('guide')}
              className={`flex items-center space-x-2 px-4 py-3 border-b-2 transition-colors whitespace-nowrap ${
                currentSection === 'guide'
                  ? 'border-[#FF6B35] text-[#1E3A5F] font-semibold'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <BookOpen className="w-4 h-4" />
              <span>How to Use</span>
            </button>
            <button
              onClick={() => setCurrentSection('settings')}
              data-section="settings"
              className={`flex items-center space-x-2 px-4 py-3 border-b-2 transition-colors whitespace-nowrap ${
                currentSection === 'settings'
                  ? 'border-[#FF6B35] text-[#1E3A5F] font-semibold'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <SettingsIcon className="w-4 h-4" />
              <span>Settings</span>
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div key={refreshKey}>{renderSection()}</div>
      </main>

      {showHelocWelcome && (
        <div className="fixed bottom-8 right-8 z-50 animate-slide-up">
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
