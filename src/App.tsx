import { useState, useEffect } from 'react';
import { Home, CreditCard, TrendingUp, BarChart3, Settings as SettingsIcon, Wallet, PiggyBank, MessageCircle, BookOpen, CheckCircle, X } from 'lucide-react';
import Dashboard from './components/Dashboard';
import MyDebts from './components/MyDebts';
import PaymentStrategies from './components/PaymentStrategies';
import { Tracker } from './components/Tracker';
import SavingsTracker from './components/SavingsTracker';
import ProgressReports from './components/ProgressReports';
import Guide from './components/Guide';
import Settings from './components/Settings';
import OnboardingModal from './components/OnboardingModal';
import WelcomeTourModal from './components/WelcomeTourModal';
import { StorageService } from './services/storage';
import type { Debt, Transaction, FeaturePreferences } from './types';

type Section = 'dashboard' | 'debts' | 'strategies' | 'tracker' | 'savings' | 'progress' | 'guide' | 'settings';

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
  const [askNovoClicked, setAskNovoClicked] = useState(false);

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
    setTimeout(() => {
      setShowHelocWelcome(false);
    }, 5000);
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

  const handleAskNovoClick = () => {
    if (!askNovoClicked) {
      localStorage.setItem('askNovoClicked', 'true');
      setAskNovoClicked(true);
    }
    window.open('https://chatgpt.com/g/g-68c32b52752c819199d83ce4a6d6435e-novo-gpt', '_blank');
  };

  const renderSection = () => {
    switch (currentSection) {
      case 'dashboard':
        return <Dashboard onDataUpdate={handleDataUpdate} onNavigateToSavings={() => setCurrentSection('savings')} />;
      case 'debts':
        return <MyDebts onDataUpdate={handleDataUpdate} />;
      case 'strategies':
        return <PaymentStrategies onDataUpdate={handleDataUpdate} />;
      case 'tracker':
        return <Tracker />;
      case 'savings':
        return <SavingsTracker />;
      case 'progress':
        return <ProgressReports onDataUpdate={handleDataUpdate} />;
      case 'guide':
        return <Guide />;
      case 'settings':
        return <Settings onDataUpdate={handleDataUpdate} onHelocEnabledFirstTime={handleHelocEnabledFirstTime} />;
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

      <header className="bg-[#1E3A5F] text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
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

      <nav className="bg-white border-b border-gray-200 sticky top-0 z-10 shadow-sm">
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
                onClick={() => setCurrentSection('tracker')}
                className={`flex items-center space-x-2 px-4 py-3 border-b-2 transition-colors whitespace-nowrap ${
                  currentSection === 'tracker'
                    ? 'border-[#FF6B35] text-[#1E3A5F] font-semibold'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Wallet className="w-4 h-4" />
                <span>Tracker</span>
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
