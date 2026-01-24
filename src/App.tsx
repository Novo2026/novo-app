import { useState, useEffect } from 'react';
import { Home, CreditCard, TrendingUp, BarChart3, Settings as SettingsIcon, Wallet, PiggyBank, MessageCircle, BookOpen } from 'lucide-react';
import Dashboard from './components/Dashboard';
import MyDebts from './components/MyDebts';
import PaymentStrategies from './components/PaymentStrategies';
import { HELOCTracker } from './components/HELOCTracker';
import SavingsTracker from './components/SavingsTracker';
import ProgressReports from './components/ProgressReports';
import Guide from './components/Guide';
import Settings from './components/Settings';
import OnboardingModal from './components/OnboardingModal';
import { StorageService } from './services/storage';
import type { Debt, Transaction } from './types';

type Section = 'dashboard' | 'debts' | 'strategies' | 'heloc' | 'savings' | 'progress' | 'guide' | 'settings';

function App() {
  const [currentSection, setCurrentSection] = useState<Section>('dashboard');
  const [debts, setDebts] = useState<Debt[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    loadData();
    checkOnboarding();
  }, []);

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
    }

    setShowOnboarding(false);
    loadData();
  };

  const loadData = () => {
    const loadedDebts = StorageService.getDebts();
    const loadedTransactions = StorageService.getTransactions();
    setDebts(loadedDebts);
    setTransactions(loadedTransactions);
  };

  const handleDataUpdate = () => {
    loadData();
    setRefreshKey(prev => prev + 1);
  };

  const renderSection = () => {
    switch (currentSection) {
      case 'dashboard':
        return <Dashboard onDataUpdate={handleDataUpdate} onNavigateToSavings={() => setCurrentSection('savings')} />;
      case 'debts':
        return <MyDebts onDataUpdate={handleDataUpdate} />;
      case 'strategies':
        return <PaymentStrategies onDataUpdate={handleDataUpdate} />;
      case 'heloc':
        return <HELOCTracker />;
      case 'savings':
        return <SavingsTracker />;
      case 'progress':
        return <ProgressReports onDataUpdate={handleDataUpdate} />;
      case 'guide':
        return <Guide />;
      case 'settings':
        return <Settings onDataUpdate={handleDataUpdate} />;
      default:
        return <Dashboard onDataUpdate={handleDataUpdate} onNavigateToSavings={() => setCurrentSection('savings')} />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {showOnboarding && <OnboardingModal onComplete={handleOnboardingComplete} />}

      <header className="bg-[#1E3A5F] text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-3">
              <div className="text-2xl font-bold text-[#FF6B35]">NOVO</div>
              <div className="hidden sm:block text-sm text-gray-300">Debt Payoff Calculator</div>
            </div>
            <a
              href="https://chatgpt.com/g/g-68c32b52752c819199d83ce4a6d6435e-novo-gpt"
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-center space-x-2 bg-[#2D9CDB] hover:bg-[#1E8BBD] text-white font-semibold px-4 py-2 rounded-lg transition-all transform hover:scale-105 shadow-md hover:shadow-lg"
              title="Get personalized debt coaching from NOVO's AI assistant"
            >
              <MessageCircle className="w-5 h-5" />
              <span className="hidden sm:inline">Ask NOVO</span>
            </a>
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
            <button
              onClick={() => setCurrentSection('heloc')}
              className={`flex items-center space-x-2 px-4 py-3 border-b-2 transition-colors whitespace-nowrap ${
                currentSection === 'heloc'
                  ? 'border-[#FF6B35] text-[#1E3A5F] font-semibold'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Wallet className="w-4 h-4" />
              <span>Tracker</span>
            </button>
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
    </div>
  );
}

export default App;
