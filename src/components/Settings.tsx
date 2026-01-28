import { useState, useEffect } from 'react';
import { Trash2, Download, AlertTriangle, CheckCircle, User, DollarSign, RefreshCw, Target, Mail, Phone, Settings as SettingsIcon } from 'lucide-react';
import { StorageService } from '../services/storage';
import type { FinancialProfile, FeaturePreferences } from '../types';

interface SettingsProps {
  onDataUpdate: () => void;
}

export default function Settings({ onDataUpdate }: SettingsProps) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);
  const [userName, setUserName] = useState(localStorage.getItem('userName') || '');
  const [showProfileSuccess, setShowProfileSuccess] = useState(false);
  const [showFinancialSuccess, setShowFinancialSuccess] = useState(false);
  const [quizStatus, setQuizStatus] = useState<'passed' | 'failed' | 'not-taken'>('not-taken');
  const [showQuizResetSuccess, setShowQuizResetSuccess] = useState(false);
  const [showFeaturesSuccess, setShowFeaturesSuccess] = useState(false);
  const [financialProfile, setFinancialProfile] = useState<FinancialProfile>({
    monthlyGrossIncome: 0,
    monthlyNetIncome: 0,
    monthlyEssentialExpenses: 0,
    monthlyDiscretionaryExpenses: 0,
  });
  const [featurePreferences, setFeaturePreferences] = useState<FeaturePreferences>({
    helocEnabled: false,
    checkingEnabled: false,
  });

  // Strategy Readiness Assessment state
  const [readinessAnswers, setReadinessAnswers] = useState<Record<number, boolean>>(() => {
    const saved = localStorage.getItem('strategy_readiness_answers');
    return saved ? JSON.parse(saved) : {};
  });

  useEffect(() => {
    const profile = StorageService.getFinancialProfile();
    if (profile) {
      setFinancialProfile(profile);
    }

    const preferences = StorageService.getFeaturePreferences();
    setFeaturePreferences(preferences);

    const stored = localStorage.getItem('chunkingQuizPassed');
    if (stored === 'true') {
      setQuizStatus('passed');
    } else if (stored === 'false') {
      setQuizStatus('failed');
    } else {
      setQuizStatus('not-taken');
    }
  }, []);

  const handleExportPaymentHistory = () => {
    const transactions = StorageService.getTransactions();
    const headers = ['Date', 'Debt', 'Type', 'Previous Balance', 'Interest', 'Principal', 'Payment/Charge', 'New Balance', 'Notes'];
    const rows = transactions.map(t => [
      t.date,
      t.debtName,
      t.type,
      t.previousBalance.toFixed(2),
      t.interestCharged.toFixed(2),
      t.principalPaid.toFixed(2),
      t.amount.toFixed(2),
      t.newBalance.toFixed(2),
      t.notes || '',
    ]);

    const csv = [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
    downloadCSV(csv, 'payment_history.csv');
  };

  const handleExportDebtSummary = () => {
    const debts = StorageService.getDebts();
    const headers = ['Account Name', 'Category', 'Starting Balance', 'Current Balance', 'Amount Paid Off', 'Interest Rate', 'Minimum Payment', 'Status'];
    const rows = debts.map(d => [
      d.accountName,
      d.category,
      d.startingBalance.toFixed(2),
      d.currentBalance.toFixed(2),
      (d.startingBalance - d.currentBalance).toFixed(2),
      d.interestRate.toString(),
      d.minimumPayment.toFixed(2),
      d.isPaidOff ? 'Paid Off' : 'Active',
    ]);

    const csv = [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
    downloadCSV(csv, 'debt_summary.csv');
  };

  const handleExportFullReport = () => {
    const data = StorageService.exportData();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `novo_full_report_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadCSV = (csv: string, filename: string) => {
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleSaveProfile = () => {
    if (userName.trim()) {
      localStorage.setItem('userName', userName.trim());
      setShowProfileSuccess(true);
      setTimeout(() => {
        setShowProfileSuccess(false);
      }, 3000);
    }
  };

  const handleSaveFinancialProfile = () => {
    if (financialProfile.monthlyGrossIncome > 0 && financialProfile.monthlyNetIncome > 0) {
      StorageService.saveFinancialProfile(financialProfile);
      setShowFinancialSuccess(true);
      onDataUpdate();
      setTimeout(() => {
        setShowFinancialSuccess(false);
      }, 3000);
    }
  };

  const handleToggleFeature = (feature: 'heloc' | 'checking') => {
    const updatedPreferences = {
      ...featurePreferences,
      [feature === 'heloc' ? 'helocEnabled' : 'checkingEnabled']: !featurePreferences[feature === 'heloc' ? 'helocEnabled' : 'checkingEnabled'],
    };
    setFeaturePreferences(updatedPreferences);
    StorageService.saveFeaturePreferences(updatedPreferences);
    setShowFeaturesSuccess(true);
    onDataUpdate();
    setTimeout(() => {
      setShowFeaturesSuccess(false);
    }, 3000);
  };

  const handleClearAllData = () => {
    if (deleteConfirmText !== 'DELETE') {
      return;
    }

    StorageService.clearAllData();
    localStorage.removeItem('userName');
    localStorage.removeItem('lastVisit');
    localStorage.removeItem('userAddress');
    localStorage.removeItem('chunkingQuizPassed');
    setShowDeleteConfirm(false);
    setShowSuccess(true);
    setQuizStatus('not-taken');

    setTimeout(() => {
      window.location.href = '/';
    }, 2000);
  };

  const handleResetQuiz = () => {
    localStorage.removeItem('chunkingQuizPassed');
    setQuizStatus('not-taken');
    setShowQuizResetSuccess(true);
    setTimeout(() => setShowQuizResetSuccess(false), 3000);
  };

  const handleReadinessToggle = (questionNumber: number) => {
    const newAnswers = {
      ...readinessAnswers,
      [questionNumber]: !readinessAnswers[questionNumber],
    };
    setReadinessAnswers(newAnswers);
    localStorage.setItem('strategy_readiness_answers', JSON.stringify(newAnswers));
  };

  const calculateReadinessScore = () => {
    return Object.values(readinessAnswers).filter(answer => answer === true).length;
  };

  const getReadinessMessage = (score: number) => {
    if (score === 7) {
      return {
        emoji: '✅',
        title: "You're ready for NOVO's advanced strategies!",
        color: 'emerald',
        description: "You have all the key elements in place for successful velocity banking and advanced debt payoff strategies.",
      };
    } else if (score >= 5) {
      return {
        emoji: '⚠️',
        title: "You're close - work on the areas you marked 'No' first",
        color: 'amber',
        description: "You're on the right track but need to strengthen a few areas before diving into advanced strategies.",
      };
    } else if (score >= 3) {
      return {
        emoji: '💡',
        title: "Focus on building financial stability before velocity banking",
        color: 'blue',
        description: "Build your financial foundation first. Get these fundamentals solid before attempting advanced strategies.",
      };
    } else {
      return {
        emoji: '🚨',
        title: "Consider basic budgeting and credit counseling first",
        color: 'red',
        description: "It's important to establish financial stability before attempting aggressive payoff strategies. Consider working with a financial coach.",
      };
    }
  };

  const readinessQuestions = [
    { id: 1, text: "I have at least $500/month in positive cash flow (after all expenses and debt minimums)" },
    { id: 2, text: "I have at least $1,000 in emergency savings" },
    { id: 3, text: "My income has been stable for the last 3 months" },
    { id: 4, text: "I haven't missed any debt payments in the last 6 months" },
    { id: 5, text: "I'm willing to track my finances daily/weekly" },
    { id: 6, text: "I can commit to not using credit cards for new purchases" },
    { id: 7, text: "I'm ready to reduce discretionary spending if needed" },
  ];

  if (showSuccess) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-[#27AE60] rounded-full mb-6">
            <CheckCircle className="w-12 h-12 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">All Data Cleared</h2>
          <p className="text-gray-600">Redirecting...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-gray-800 mb-2">Settings</h2>
        <p className="text-gray-600">Manage your profile, data, and export options.</p>
      </div>

      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center space-x-2 mb-4">
          <User className="w-6 h-6 text-[#1E3A5F]" />
          <h3 className="text-xl font-bold text-gray-800">Edit Profile</h3>
        </div>
        <p className="text-gray-600 mb-6">
          Update your personal information.
        </p>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Your Name
            </label>
            <input
              type="text"
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              placeholder="Enter your name"
              className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
              maxLength={50}
            />
          </div>

          <button
            onClick={handleSaveProfile}
            disabled={!userName.trim()}
            className="w-full bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 px-6 rounded-lg transition-all duration-200 shadow-md hover:shadow-lg"
          >
            Save Changes
          </button>

          {showProfileSuccess && (
            <div className="flex items-center space-x-2 bg-emerald-50 border border-emerald-300 text-emerald-800 px-4 py-3 rounded-lg">
              <CheckCircle className="w-5 h-5" />
              <span className="font-semibold">Profile updated successfully!</span>
            </div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center space-x-2 mb-4">
          <DollarSign className="w-6 h-6 text-[#1E3A5F]" />
          <h3 className="text-xl font-bold text-gray-800">Financial Profile</h3>
        </div>
        <p className="text-gray-600 mb-6">
          Update your income and expense information. These values are used in payment strategy calculations.
        </p>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Gross Monthly Income
            </label>
            <p className="text-xs text-gray-500 mb-2">Total income before taxes and deductions</p>
            <div className="relative">
              <span className="absolute left-3 top-2 text-gray-500">$</span>
              <input
                type="number"
                value={financialProfile.monthlyGrossIncome || ''}
                onChange={(e) => setFinancialProfile({ ...financialProfile, monthlyGrossIncome: parseFloat(e.target.value) || 0 })}
                onFocus={(e) => {
                  if (e.target.value === '0') e.target.value = '';
                }}
                placeholder="Enter amount"
                className="w-full pl-8 pr-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                step="0.01"
                min="0"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Net Monthly Income
            </label>
            <p className="text-xs text-gray-500 mb-2">Take-home pay after taxes and deductions</p>
            <div className="relative">
              <span className="absolute left-3 top-2 text-gray-500">$</span>
              <input
                type="number"
                value={financialProfile.monthlyNetIncome || ''}
                onChange={(e) => setFinancialProfile({ ...financialProfile, monthlyNetIncome: parseFloat(e.target.value) || 0 })}
                onFocus={(e) => {
                  if (e.target.value === '0') e.target.value = '';
                }}
                placeholder="Enter amount"
                className="w-full pl-8 pr-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                step="0.01"
                min="0"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Monthly Essential Expenses
            </label>
            <p className="text-xs text-gray-500 mb-2">Housing, utilities, groceries, insurance, transportation</p>
            <div className="relative">
              <span className="absolute left-3 top-2 text-gray-500">$</span>
              <input
                type="number"
                value={financialProfile.monthlyEssentialExpenses || ''}
                onChange={(e) => setFinancialProfile({ ...financialProfile, monthlyEssentialExpenses: parseFloat(e.target.value) || 0 })}
                onFocus={(e) => {
                  if (e.target.value === '0') e.target.value = '';
                }}
                placeholder="Enter amount"
                className="w-full pl-8 pr-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                step="0.01"
                min="0"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Monthly Discretionary Expenses
            </label>
            <p className="text-xs text-gray-500 mb-2">Entertainment, dining out, shopping, subscriptions</p>
            <div className="relative">
              <span className="absolute left-3 top-2 text-gray-500">$</span>
              <input
                type="number"
                value={financialProfile.monthlyDiscretionaryExpenses || ''}
                onChange={(e) => setFinancialProfile({ ...financialProfile, monthlyDiscretionaryExpenses: parseFloat(e.target.value) || 0 })}
                onFocus={(e) => {
                  if (e.target.value === '0') e.target.value = '';
                }}
                placeholder="Enter amount"
                className="w-full pl-8 pr-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                step="0.01"
                min="0"
              />
            </div>
          </div>

          <button
            onClick={handleSaveFinancialProfile}
            disabled={!(financialProfile.monthlyGrossIncome > 0 && financialProfile.monthlyNetIncome > 0)}
            className="w-full bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 px-6 rounded-lg transition-all duration-200 shadow-md hover:shadow-lg"
          >
            Save Financial Profile
          </button>

          {showFinancialSuccess && (
            <div className="flex items-center space-x-2 bg-emerald-50 border border-emerald-300 text-emerald-800 px-4 py-3 rounded-lg">
              <CheckCircle className="w-5 h-5" />
              <span className="font-semibold">Financial profile updated successfully!</span>
            </div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center space-x-2 mb-4">
          <SettingsIcon className="w-6 h-6 text-[#1E3A5F]" />
          <h3 className="text-xl font-bold text-gray-800">Account Features</h3>
        </div>
        <p className="text-gray-600 mb-6">
          What tools do you want to use?
        </p>

        <div className="space-y-4">
          <div className="bg-gray-50 rounded-lg p-5 border-2 border-gray-200">
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1">
                <div className="flex items-center space-x-2 mb-2">
                  <span className="text-2xl">🏠</span>
                  <h4 className="font-bold text-gray-800 text-lg">HELOC / Home Equity Line of Credit</h4>
                </div>
                <p className="text-sm text-gray-600 leading-relaxed">
                  Enable if you have a HELOC and want to use velocity banking strategies. You can track draws, payments, and optimize debt payoff using your home equity.
                </p>
              </div>
              <button
                onClick={() => handleToggleFeature('heloc')}
                className={`ml-4 flex-shrink-0 relative inline-flex h-8 w-14 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 ${
                  featurePreferences.helocEnabled ? 'bg-emerald-600' : 'bg-gray-300'
                }`}
                role="switch"
                aria-checked={featurePreferences.helocEnabled}
              >
                <span
                  className={`${
                    featurePreferences.helocEnabled ? 'translate-x-7' : 'translate-x-1'
                  } inline-block h-6 w-6 transform rounded-full bg-white transition-transform shadow-lg`}
                />
              </button>
            </div>
          </div>

          <div className="bg-gray-50 rounded-lg p-5 border-2 border-gray-200 opacity-50">
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1">
                <div className="flex items-center space-x-2 mb-2">
                  <span className="text-2xl">💳</span>
                  <h4 className="font-bold text-gray-800 text-lg">Checking Account Register</h4>
                  <span className="text-xs font-semibold text-gray-500 bg-gray-200 px-2 py-1 rounded">Coming Soon</span>
                </div>
                <p className="text-sm text-gray-600 leading-relaxed">
                  Track daily expenses and transfers from your HELOC or other accounts.
                </p>
              </div>
              <button
                disabled
                className="ml-4 flex-shrink-0 relative inline-flex h-8 w-14 items-center rounded-full bg-gray-300 cursor-not-allowed"
                role="switch"
                aria-checked={false}
              >
                <span className="translate-x-1 inline-block h-6 w-6 transform rounded-full bg-white shadow-lg" />
              </button>
            </div>
          </div>

          {showFeaturesSuccess && (
            <div className="flex items-center space-x-2 bg-emerald-50 border border-emerald-300 text-emerald-800 px-4 py-3 rounded-lg">
              <CheckCircle className="w-5 h-5" />
              <span className="font-semibold">Feature preferences saved successfully!</span>
            </div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center space-x-2 mb-4">
          <Target className="w-6 h-6 text-[#1E3A5F]" />
          <h3 className="text-xl font-bold text-gray-800">Strategy Readiness Assessment</h3>
        </div>
        <p className="text-gray-600 mb-6">
          Take this quick assessment to determine if you're ready for NOVO's advanced debt acceleration strategies.
        </p>

        <div className="space-y-3 mb-6">
          {readinessQuestions.map((question) => (
            <div
              key={question.id}
              className="flex items-start space-x-3 p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <button
                onClick={() => handleReadinessToggle(question.id)}
                className={`flex-shrink-0 w-12 h-12 rounded-lg border-2 transition-all flex items-center justify-center ${
                  readinessAnswers[question.id]
                    ? 'bg-emerald-500 border-emerald-600 text-white'
                    : 'bg-white border-gray-300 text-gray-400'
                }`}
              >
                {readinessAnswers[question.id] ? (
                  <CheckCircle className="w-6 h-6" />
                ) : (
                  <span className="text-2xl font-light">?</span>
                )}
              </button>
              <div className="flex-1">
                <p className="text-gray-800 font-medium leading-relaxed">{question.text}</p>
              </div>
            </div>
          ))}
        </div>

        {Object.keys(readinessAnswers).length > 0 && (
          <>
            <div className={`rounded-xl p-6 mb-6 border-2 ${
              getReadinessMessage(calculateReadinessScore()).color === 'emerald'
                ? 'bg-gradient-to-br from-emerald-50 to-teal-50 border-emerald-300'
                : getReadinessMessage(calculateReadinessScore()).color === 'amber'
                ? 'bg-gradient-to-br from-amber-50 to-orange-50 border-amber-300'
                : getReadinessMessage(calculateReadinessScore()).color === 'blue'
                ? 'bg-gradient-to-br from-blue-50 to-cyan-50 border-blue-300'
                : 'bg-gradient-to-br from-red-50 to-rose-50 border-red-300'
            }`}>
              <div className="flex items-start gap-4">
                <div className="text-5xl">{getReadinessMessage(calculateReadinessScore()).emoji}</div>
                <div className="flex-1">
                  <div className="mb-3">
                    <p className="text-sm font-semibold text-gray-600 mb-1">
                      Your Score: {calculateReadinessScore()} out of 7
                    </p>
                    <h4 className="text-2xl font-bold text-gray-900 mb-2">
                      {getReadinessMessage(calculateReadinessScore()).title}
                    </h4>
                    <p className="text-gray-700">
                      {getReadinessMessage(calculateReadinessScore()).description}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-r from-blue-50 to-cyan-50 border-2 border-blue-300 rounded-lg p-6 mb-6">
              <h4 className="font-bold text-blue-900 mb-4 text-lg">Tailored Recommendations:</h4>

              {calculateReadinessScore() === 7 ? (
                <div className="space-y-3">
                  <div className="bg-white rounded-lg p-4">
                    <p className="font-semibold text-gray-900 mb-2">✨ You're ready to explore:</p>
                    <ul className="space-y-2 text-gray-700 ml-4">
                      <li className="flex items-start gap-2">
                        <span className="flex-shrink-0">•</span>
                        <span><strong>Smart Chunking Calculator</strong> - Calculate optimal HELOC chunk amounts for mortgage payoff</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="flex-shrink-0">•</span>
                        <span><strong>HELOC Velocity Banking</strong> - Use your HELOC strategically to accelerate debt payoff</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="flex-shrink-0">•</span>
                        <span><strong>Advanced Payment Strategies</strong> - Run scenarios with extra payments and debt avalanche</span>
                      </li>
                    </ul>
                  </div>
                </div>
              ) : calculateReadinessScore() >= 5 ? (
                <div className="space-y-3">
                  <div className="bg-white rounded-lg p-4">
                    <p className="font-semibold text-gray-900 mb-2">🎯 Next Steps:</p>
                    <ul className="space-y-2 text-gray-700 ml-4">
                      <li className="flex items-start gap-2">
                        <span className="flex-shrink-0">•</span>
                        <span>Address the areas you marked "No" before starting advanced strategies</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="flex-shrink-0">•</span>
                        <span>Start with basic debt avalanche (extra payments to highest rate debt)</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="flex-shrink-0">•</span>
                        <span>Build your emergency fund to at least $1,000</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="flex-shrink-0">•</span>
                        <span>Once all items are "Yes", revisit HELOC strategies</span>
                      </li>
                    </ul>
                  </div>
                </div>
              ) : calculateReadinessScore() >= 3 ? (
                <div className="space-y-3">
                  <div className="bg-white rounded-lg p-4">
                    <p className="font-semibold text-gray-900 mb-2">💪 Build Your Foundation:</p>
                    <ul className="space-y-2 text-gray-700 ml-4">
                      <li className="flex items-start gap-2">
                        <span className="flex-shrink-0">•</span>
                        <span>Focus on making all minimum payments on time</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="flex-shrink-0">•</span>
                        <span>Build $1,000 emergency fund before aggressive debt payoff</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="flex-shrink-0">•</span>
                        <span>Track every dollar in and out for 30 days</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="flex-shrink-0">•</span>
                        <span>Cut discretionary spending by 20-30%</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="flex-shrink-0">•</span>
                        <span>Work on stabilizing income before attempting velocity banking</span>
                      </li>
                    </ul>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="bg-white rounded-lg p-4">
                    <p className="font-semibold text-gray-900 mb-2">🆘 Start Here:</p>
                    <ul className="space-y-2 text-gray-700 ml-4">
                      <li className="flex items-start gap-2">
                        <span className="flex-shrink-0">•</span>
                        <span>Work with a financial coach to create a basic budget</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="flex-shrink-0">•</span>
                        <span>Consider credit counseling if you've missed payments recently</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="flex-shrink-0">•</span>
                        <span>Focus on making ALL minimum payments first</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="flex-shrink-0">•</span>
                        <span>Build a small emergency fund ($500-1000) before debt acceleration</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="flex-shrink-0">•</span>
                        <span>HELOC velocity banking is NOT recommended at this time</span>
                      </li>
                    </ul>
                  </div>
                </div>
              )}
            </div>

            <div className="bg-gradient-to-br from-emerald-50 to-teal-50 border-2 border-emerald-300 rounded-lg p-6">
              <p className="text-lg font-semibold text-emerald-900 mb-3">Need personalized coaching?</p>
              <p className="text-gray-700 mb-4">
                Ben Hulshof specializes in helping clients achieve financial freedom through strategic debt elimination.
              </p>
              <div className="space-y-2">
                <div className="flex items-center gap-3 text-emerald-800">
                  <Mail className="w-5 h-5 flex-shrink-0" />
                  <a href="mailto:ben@windmillmortgage.com" className="hover:underline font-medium text-lg">
                    ben@windmillmortgage.com
                  </a>
                </div>
                <div className="flex items-center gap-3 text-emerald-800">
                  <Phone className="w-5 h-5 flex-shrink-0" />
                  <a href="tel:614-327-2213" className="hover:underline font-medium text-lg">
                    614-327-2213
                  </a>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-xl font-bold text-gray-800 mb-4">Export Data</h3>
        <p className="text-gray-600 mb-6">
          Download your data for backup or analysis purposes.
        </p>

        <div className="space-y-3">
          <button
            onClick={handleExportPaymentHistory}
            className="w-full flex items-center justify-between bg-[#2D9CDB] hover:bg-[#1E8BBD] text-white font-semibold py-3 px-6 rounded-lg transition-colors"
          >
            <span>Export Payment History</span>
            <Download className="w-5 h-5" />
          </button>

          <button
            onClick={handleExportDebtSummary}
            className="w-full flex items-center justify-between bg-[#2D9CDB] hover:bg-[#1E8BBD] text-white font-semibold py-3 px-6 rounded-lg transition-colors"
          >
            <span>Export Debt Summary</span>
            <Download className="w-5 h-5" />
          </button>

          <button
            onClick={handleExportFullReport}
            className="w-full flex items-center justify-between bg-[#1E3A5F] hover:bg-[#152A45] text-white font-semibold py-3 px-6 rounded-lg transition-colors"
          >
            <span>Export Full Report (JSON)</span>
            <Download className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-xl font-bold text-gray-800 mb-4">HELOC Chunking Readiness</h3>
        <p className="text-gray-600 mb-6">
          Manage your HELOC velocity banking readiness assessment status.
        </p>

        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold text-gray-800 mb-1">Quiz Status:</p>
              <p className="text-sm text-gray-600">
                {quizStatus === 'passed' && (
                  <span className="text-green-600 font-medium">✅ Passed - You're ready for HELOC chunking</span>
                )}
                {quizStatus === 'failed' && (
                  <span className="text-amber-600 font-medium">⚠️ Not recommended - Build financial foundation first</span>
                )}
                {quizStatus === 'not-taken' && (
                  <span className="text-gray-500 font-medium">📋 Not yet taken</span>
                )}
              </p>
            </div>
          </div>
        </div>

        {showQuizResetSuccess && (
          <div className="mb-4 bg-green-50 border border-green-300 rounded-lg p-4 flex items-center space-x-2">
            <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
            <p className="text-green-800 font-medium">Quiz status reset successfully!</p>
          </div>
        )}

        {quizStatus !== 'not-taken' && (
          <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-r mb-4">
            <p className="text-blue-800 text-sm">
              <strong>Note:</strong> You can retake the assessment anytime from the Strategy Wizard when selecting HELOC velocity banking, or reset it here to start fresh.
            </p>
          </div>
        )}

        <button
          onClick={handleResetQuiz}
          disabled={quizStatus === 'not-taken'}
          className="w-full flex items-center justify-center space-x-2 bg-[#2D9CDB] hover:bg-[#1E8BBD] disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-semibold py-3 px-6 rounded-lg transition-colors"
        >
          <RefreshCw className="w-5 h-5" />
          <span>Reset Quiz Status</span>
        </button>
      </div>

      <div className="bg-white rounded-lg shadow-md border-2 border-red-200 p-6">
        <div className="flex items-start space-x-3 mb-4">
          <AlertTriangle className="w-6 h-6 text-red-600 flex-shrink-0 mt-1" />
          <div>
            <h3 className="text-xl font-bold text-red-600 mb-2">Danger Zone</h3>
            <p className="text-gray-700">
              This action will permanently delete all your data from NOVO. This cannot be undone.
            </p>
          </div>
        </div>

        {!showDeleteConfirm ? (
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="w-full flex items-center justify-center space-x-2 bg-red-600 hover:bg-red-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
          >
            <Trash2 className="w-5 h-5" />
            <span>Clear All Data</span>
          </button>
        ) : (
          <div className="space-y-4">
            <div className="bg-red-50 border border-red-300 rounded-lg p-4">
              <p className="font-bold text-red-800 mb-3">
                This will permanently delete:
              </p>
              <ul className="list-disc list-inside space-y-1 text-red-700 text-sm mb-4">
                <li>All debts</li>
                <li>Payment history</li>
                <li>Financial profile</li>
                <li>Strategy results</li>
              </ul>
              <p className="font-bold text-red-800 mb-2">
                This action cannot be undone!
              </p>
              <p className="text-sm text-red-700">
                Type <span className="font-bold">DELETE</span> to confirm:
              </p>
              <input
                type="text"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                className="w-full mt-2 px-4 py-2 border-2 border-red-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                placeholder="Type DELETE"
              />
            </div>

            <div className="flex space-x-3">
              <button
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setDeleteConfirmText('');
                }}
                className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold py-3 px-4 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleClearAllData}
                disabled={deleteConfirmText !== 'DELETE'}
                className="flex-1 bg-red-600 hover:bg-red-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-semibold py-3 px-4 rounded-lg transition-colors"
              >
                Yes, Delete Everything
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="bg-[#2D9CDB]/10 border border-[#2D9CDB] rounded-lg p-6">
        <h3 className="font-bold text-gray-800 mb-2">About NOVO</h3>
        <p className="text-sm text-gray-700 mb-4">
          NOVO is a comprehensive debt payoff calculator designed to help mortgage consultants coach clients on accelerated debt elimination strategies.
        </p>
        <div className="text-sm text-gray-600 space-y-1">
          <p><span className="font-semibold">Version:</span> 1.0.0</p>
          <p><span className="font-semibold">Data Storage:</span> Local (Browser)</p>
          <p><span className="font-semibold">Privacy:</span> All data stays on your device</p>
        </div>
      </div>
    </div>
  );
}
