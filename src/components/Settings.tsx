import { useState, useEffect, useRef } from 'react';
import { Trash2, Download, Upload, AlertTriangle, CheckCircle, User, DollarSign, RefreshCw, Target, Mail, Phone, Settings as SettingsIcon, Home, Shield } from 'lucide-react';
import { StorageService } from '../services/storage';
import { assembleNovoReportPayload } from '../utils/novoReportData';
import { buildNovoFullReportHtml, printHtmlDocument } from '../utils/novoPrintReport';
import LearnHELOCModal from './LearnHELOCModal';
import HelocSuccessModal from './HelocSuccessModal';
import BenTaskPanel from './BenTaskPanel';
import { clearMilestoneHistory } from '../utils/milestoneEngine';
import { UpgradeModal } from './AccessGate';
import { isPro, getAccessRecord, isProExpired } from '../services/accessControl';
import type { FinancialProfile, FeaturePreferences, HomeEquity } from '../types';

interface SettingsProps {
  onDataUpdate: () => void;
  onHelocEnabledFirstTime?: () => void;
  onNavigate?: (section: 'tracker' | 'strategies' | 'guide') => void;
}

export default function Settings({ onDataUpdate, onHelocEnabledFirstTime, onNavigate }: SettingsProps) {
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const proStatus = isPro();
  const accessRecord = getAccessRecord();
  const expired = isProExpired();

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);
  const [userName, setUserName] = useState(localStorage.getItem('userName') || '');
  const [showProfileSuccess, setShowProfileSuccess] = useState(false);
  const [showFinancialSuccess, setShowFinancialSuccess] = useState(false);
  const [quizStatus, setQuizStatus] = useState<'passed' | 'failed' | 'not-taken'>('not-taken');
  const [showQuizResetSuccess, setShowQuizResetSuccess] = useState(false);
  const [showFeaturesSuccess, setShowFeaturesSuccess] = useState(false);
  const [showHelocDisableConfirm, setShowHelocDisableConfirm] = useState(false);
  const [showLearnHELOCModal, setShowLearnHELOCModal] = useState(false);
  const [showHelocSuccess, setShowHelocSuccess] = useState(false);
  const [showHelocSuccessModal, setShowHelocSuccessModal] = useState(false);
  const [helocDetails, setHelocDetails] = useState({
    creditLimit: '',
    currentBalance: '',
    interestRate: '',
    openedDate: '',
    lender: '',
  });
  const [helocErrors, setHelocErrors] = useState<Record<string, string>>({});
  const [financialProfile, setFinancialProfile] = useState<FinancialProfile>({
    monthlyGrossIncome: 0,
    monthlyNetIncome: 0,
    monthlyEssentialExpenses: 0,
    monthlyDiscretionaryExpenses: 0,
    monthlySavingsGoal: 0,
    surplusCommitmentPercent: 100,
  });
  const [featurePreferences, setFeaturePreferences] = useState<FeaturePreferences>({
    helocEnabled: false,
    checkingEnabled: true,
  });
  const [demoMode, setDemoMode] = useState(false);

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

    const demoModeStored = localStorage.getItem('novo_demo_mode') === 'true';
    setDemoMode(demoModeStored);

    const homeEquity = StorageService.getHomeEquity();
    if (homeEquity && homeEquity.hasHELOC) {
      setHelocDetails({
        creditLimit: homeEquity.helocLimit ? String(homeEquity.helocLimit) : '',
        currentBalance: homeEquity.helocBalance ? String(homeEquity.helocBalance) : '',
        interestRate: homeEquity.helocRate ? String(homeEquity.helocRate) : '',
        openedDate: (homeEquity as any).helocOpenedDate || '',
        lender: (homeEquity as any).helocLender || '',
      });
    }
  }, []);

  const handleDownloadNovoReport = () => {
    printHtmlDocument(buildNovoFullReportHtml(assembleNovoReportPayload()));
  };

  const restoreBackupInputRef = useRef<HTMLInputElement>(null);

  const handleBackupLocalStorage = () => {
    const snapshot: Record<string, string> = {};
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (key) snapshot[key] = localStorage.getItem(key) ?? '';
    }
    const date = new Date().toISOString().split('T')[0];
    const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `novo-backup-${date}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleRestoreBackupClick = () => {
    restoreBackupInputRef.current?.click();
  };

  const handleRestoreBackupFile: React.ChangeEventHandler<HTMLInputElement> = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const raw = reader.result as string;
        const parsed = JSON.parse(raw) as unknown;
        if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
          window.alert('This file does not look like a valid NOVO backup.');
          return;
        }
        for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
          if (typeof value === 'string') {
            localStorage.setItem(key, value);
          }
        }
        window.location.reload();
      } catch {
        window.alert('Could not read this backup file. Make sure it is valid JSON from NOVO.');
      }
      e.target.value = '';
    };
    reader.readAsText(file);
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
    if (feature === 'heloc' && featurePreferences.helocEnabled) {
      setShowHelocDisableConfirm(true);
      return;
    }

    const wasHelocDisabled = feature === 'heloc' && !featurePreferences.helocEnabled;
    const isFirstTimeEnable = wasHelocDisabled && !localStorage.getItem('heloc_enabled_once');

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

    if (isFirstTimeEnable) {
      localStorage.setItem('heloc_enabled_once', 'true');
      onHelocEnabledFirstTime?.();
    }
  };

  const handleConfirmHelocDisable = () => {
    const updatedPreferences = {
      ...featurePreferences,
      helocEnabled: false,
    };
    setFeaturePreferences(updatedPreferences);
    StorageService.saveFeaturePreferences(updatedPreferences);
    setShowHelocDisableConfirm(false);
    setShowFeaturesSuccess(true);
    onDataUpdate();
    setTimeout(() => {
      setShowFeaturesSuccess(false);
    }, 3000);
  };

  const handleSaveHelocDetails = () => {
    const errors: Record<string, string> = {};
    const creditLimit = parseFloat(helocDetails.creditLimit);
    const interestRate = parseFloat(helocDetails.interestRate);
    const currentBalance = parseFloat(helocDetails.currentBalance) || 0;

    if (!helocDetails.creditLimit || isNaN(creditLimit) || creditLimit <= 0) {
      errors.creditLimit = 'Credit limit is required and must be greater than $0';
    }
    if (!helocDetails.interestRate || isNaN(interestRate) || interestRate < 0 || interestRate > 25) {
      errors.interestRate = 'Interest rate is required and must be between 0% and 25%';
    }
    if (helocDetails.currentBalance && !isNaN(parseFloat(helocDetails.currentBalance)) && currentBalance > creditLimit) {
      errors.currentBalance = 'Current balance cannot exceed credit limit';
    }

    setHelocErrors(errors);
    if (Object.keys(errors).length > 0) return;

    const existing: HomeEquity = StorageService.getHomeEquity() || { ownsHome: true };
    const updated: HomeEquity & { helocOpenedDate?: string; helocLender?: string } = {
      ...existing,
      ownsHome: true,
      hasHELOC: true,
      helocLimit: creditLimit,
      helocBalance: currentBalance,
      helocRate: interestRate,
    };
    (updated as any).helocOpenedDate = helocDetails.openedDate;
    (updated as any).helocLender = helocDetails.lender;

    StorageService.saveHomeEquity(updated);
    onDataUpdate();

    const isFirstSave = !localStorage.getItem('heloc_details_saved_once');
    if (isFirstSave) {
      localStorage.setItem('heloc_details_saved_once', 'true');
      setShowHelocSuccessModal(true);
      onHelocEnabledFirstTime?.();
    } else {
      setShowHelocSuccess(true);
      setTimeout(() => setShowHelocSuccess(false), 4000);
    }
  };

  const handleToggleDemoMode = () => {
    const newDemoMode = !demoMode;
    setDemoMode(newDemoMode);
    localStorage.setItem('novo_demo_mode', newDemoMode.toString());
    setShowFeaturesSuccess(true);
    setTimeout(() => setShowFeaturesSuccess(false), 3000);
  };

  const handleClearAllData = () => {
    if (deleteConfirmText !== 'DELETE') {
      return;
    }

    StorageService.clearAllData();
    clearMilestoneHistory();
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

  if (showHelocDisableConfirm) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg shadow-2xl max-w-md w-full p-6">
          <div className="flex items-start space-x-3 mb-4">
            <AlertTriangle className="w-6 h-6 text-amber-500 flex-shrink-0 mt-1" />
            <div>
              <h3 className="text-xl font-bold text-gray-800 mb-2">Disable HELOC Tracker?</h3>
              <p className="text-gray-600 leading-relaxed">
                Are you sure? This will hide the HELOC Tracker from your navigation. Your HELOC data will be saved if you re-enable it later.
              </p>
            </div>
          </div>

          <div className="flex space-x-3 mt-6">
            <button
              onClick={() => setShowHelocDisableConfirm(false)}
              className="flex-1 px-4 py-3 bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirmHelocDisable}
              className="flex-1 px-4 py-3 bg-amber-500 hover:bg-amber-600 text-white font-semibold rounded-lg transition-colors"
            >
              Yes, Disable
            </button>
          </div>
        </div>
      </div>
    );
  }

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

      <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
        <div className="flex items-center space-x-2 mb-3">
          <Shield className="w-6 h-6 text-[#1E3A5F]" />
          <h3 className="text-xl font-bold text-gray-800">Data Protection</h3>
        </div>
        <p className="text-gray-600 text-sm mb-4 leading-relaxed">
          Download a full snapshot of NOVO data stored in this browser, or restore from an earlier backup file.
        </p>
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 mb-4">
          <p className="text-sm text-amber-900 leading-relaxed">
            <strong className="font-semibold">Important:</strong> Store your backup file somewhere safe — email it to yourself or save to cloud storage.
          </p>
        </div>
        <input
          ref={restoreBackupInputRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          aria-hidden
          onChange={handleRestoreBackupFile}
        />
        <div className="space-y-3">
          <button
            type="button"
            onClick={handleBackupLocalStorage}
            className="w-full flex items-center justify-center gap-2 font-semibold py-3 px-6 rounded-lg transition-colors shadow-md hover:shadow-lg text-white bg-[#1E3A5F] hover:bg-[#152a45] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#1E3A5F]"
          >
            <Download className="w-5 h-5" />
            Backup My Data
          </button>
          <button
            type="button"
            onClick={handleRestoreBackupClick}
            className="w-full flex items-center justify-center gap-2 font-semibold py-3 px-6 rounded-lg transition-colors shadow-md hover:shadow-lg text-white bg-[#FF6B35] hover:bg-[#e85d2a] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#FF6B35]"
          >
            <Upload className="w-5 h-5" />
            Restore From Backup
          </button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-md p-6 border border-orange-100">
        <h3 className="text-lg font-bold text-gray-800 mb-2">NOVO report</h3>
        <p className="text-gray-600 text-sm mb-4 leading-relaxed">
          Open a print-friendly summary of your NOVO data. In the print dialog, choose <strong>Save as PDF</strong> to download.
        </p>
        <button
          type="button"
          onClick={handleDownloadNovoReport}
          className="w-full flex items-center justify-center gap-2 font-semibold py-3 px-6 rounded-lg transition-colors shadow-md hover:shadow-lg text-white bg-[#FF6B35] hover:bg-[#e85d2a] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#FF6B35]"
        >
          <Download className="w-5 h-5" />
          Download My NOVO Report
        </button>
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

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Monthly Savings Goal
            </label>
            <p className="text-xs text-gray-500 mb-2">
              Set aside before debt payoff so your emergency fund / savings keep growing
            </p>
            <div className="relative">
              <span className="absolute left-3 top-2 text-gray-500">$</span>
              <input
                type="number"
                value={financialProfile.monthlySavingsGoal || ''}
                onChange={(e) => setFinancialProfile({ ...financialProfile, monthlySavingsGoal: parseFloat(e.target.value) || 0 })}
                onFocus={(e) => {
                  if (e.target.value === '0') e.target.value = '';
                }}
                placeholder="0"
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
          <div className={`rounded-lg p-5 border-2 transition-colors ${featurePreferences.helocEnabled ? 'bg-emerald-50 border-emerald-300' : 'bg-gray-50 border-gray-200'}`}>
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1">
                <div className="flex items-center space-x-2 mb-2">
                  <Home className={`w-6 h-6 ${featurePreferences.helocEnabled ? 'text-emerald-600' : 'text-gray-500'}`} />
                  <h4 className="font-bold text-gray-800 text-lg">HELOC / Home Equity Line of Credit</h4>
                </div>
                <p className="text-sm text-gray-600 leading-relaxed">
                  Enable if you have a HELOC and want to use velocity banking strategies. Track draws, payments, and optimize debt payoff using your home equity.
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

            {!featurePreferences.helocEnabled && (
              <div className="mt-3 pt-3 border-t border-gray-300">
                <button
                  onClick={() => setShowLearnHELOCModal(true)}
                  className="text-[#2D9CDB] hover:text-[#1E8BBD] font-semibold text-sm underline transition-colors"
                >
                  Learn About HELOC Strategy →
                </button>
              </div>
            )}

            {featurePreferences.helocEnabled && (
              <div className="mt-4 pt-4 border-t border-emerald-200">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-2 h-2 bg-emerald-500 rounded-full" />
                  <h5 className="font-bold text-gray-800">HELOC Details</h5>
                  <span className="text-xs text-gray-500">(enter your HELOC information below)</span>
                </div>

                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1">
                        Credit Limit <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-2 text-gray-500 text-sm">$</span>
                        <input
                          type="number"
                          value={helocDetails.creditLimit}
                          onChange={(e) => {
                            setHelocDetails({ ...helocDetails, creditLimit: e.target.value });
                            if (helocErrors.creditLimit) setHelocErrors({ ...helocErrors, creditLimit: '' });
                          }}
                          placeholder="100,000"
                          className={`w-full pl-7 pr-3 py-2 border-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all ${helocErrors.creditLimit ? 'border-red-400 bg-red-50' : 'border-gray-200 bg-white'}`}
                          min="0"
                          step="1000"
                        />
                      </div>
                      {helocErrors.creditLimit && (
                        <p className="text-red-600 text-xs mt-1">{helocErrors.creditLimit}</p>
                      )}
                      <p className="text-xs text-gray-500 mt-1">Maximum amount you can borrow</p>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1">
                        Current Balance
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-2 text-gray-500 text-sm">$</span>
                        <input
                          type="number"
                          value={helocDetails.currentBalance}
                          onChange={(e) => {
                            setHelocDetails({ ...helocDetails, currentBalance: e.target.value });
                            if (helocErrors.currentBalance) setHelocErrors({ ...helocErrors, currentBalance: '' });
                          }}
                          placeholder="0"
                          className={`w-full pl-7 pr-3 py-2 border-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all ${helocErrors.currentBalance ? 'border-red-400 bg-red-50' : 'border-gray-200 bg-white'}`}
                          min="0"
                          step="100"
                        />
                      </div>
                      {helocErrors.currentBalance && (
                        <p className="text-red-600 text-xs mt-1">{helocErrors.currentBalance}</p>
                      )}
                      <p className="text-xs text-gray-500 mt-1">Leave blank or $0 if no draws yet</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1">
                        Interest Rate (APR) <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          value={helocDetails.interestRate}
                          onChange={(e) => {
                            setHelocDetails({ ...helocDetails, interestRate: e.target.value });
                            if (helocErrors.interestRate) setHelocErrors({ ...helocErrors, interestRate: '' });
                          }}
                          placeholder="8.5"
                          className={`w-full pl-3 pr-8 py-2 border-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all ${helocErrors.interestRate ? 'border-red-400 bg-red-50' : 'border-gray-200 bg-white'}`}
                          min="0"
                          max="25"
                          step="0.1"
                        />
                        <span className="absolute right-3 top-2 text-gray-500 text-sm">%</span>
                      </div>
                      {helocErrors.interestRate && (
                        <p className="text-red-600 text-xs mt-1">{helocErrors.interestRate}</p>
                      )}
                      <p className="text-xs text-gray-500 mt-1">Variable rate — check your statement</p>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1">
                        HELOC Opened Date
                      </label>
                      <input
                        type="date"
                        value={helocDetails.openedDate}
                        onChange={(e) => setHelocDetails({ ...helocDetails, openedDate: e.target.value })}
                        className="w-full px-3 py-2 border-2 border-gray-200 bg-white rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                      />
                      <p className="text-xs text-gray-500 mt-1">When did you open your HELOC?</p>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">
                      Lender <span className="text-gray-400 font-normal">(optional)</span>
                    </label>
                    <input
                      type="text"
                      value={helocDetails.lender}
                      onChange={(e) => setHelocDetails({ ...helocDetails, lender: e.target.value })}
                      placeholder="e.g., Huntington Bank"
                      className="w-full px-3 py-2 border-2 border-gray-200 bg-white rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                      maxLength={80}
                    />
                  </div>

                  <button
                    onClick={handleSaveHelocDetails}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2.5 px-4 rounded-lg transition-colors text-sm"
                  >
                    Save HELOC Details
                  </button>

                  {showHelocSuccess && (
                    <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-400 text-emerald-800 px-4 py-3 rounded-lg">
                      <CheckCircle className="w-5 h-5 flex-shrink-0" />
                      <span className="font-semibold text-sm">HELOC details saved! HELOC features are now enabled.</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="bg-gray-50 rounded-lg p-5 border-2 border-gray-200">
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1">
                <div className="flex items-center space-x-2 mb-2">
                  <span className="text-2xl">💳</span>
                  <h4 className="font-bold text-gray-800 text-lg">Checking Account Register</h4>
                </div>
                <p className="text-sm text-gray-600 leading-relaxed">
                  Track your checking account deposits, withdrawals, and expenses. See where your money goes each month and stay on budget.
                </p>
              </div>
              <button
                onClick={() => handleToggleFeature('checking')}
                className={`ml-4 flex-shrink-0 relative inline-flex h-8 w-14 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 ${
                  featurePreferences.checkingEnabled ? 'bg-emerald-600' : 'bg-gray-300'
                }`}
                role="switch"
                aria-checked={featurePreferences.checkingEnabled}
              >
                <span
                  className={`${
                    featurePreferences.checkingEnabled ? 'translate-x-7' : 'translate-x-1'
                  } inline-block h-6 w-6 transform rounded-full bg-white transition-transform shadow-lg`}
                />
              </button>
            </div>
          </div>

          <div className="pt-4 border-t border-gray-300">
            <div className="flex items-center justify-between">
              <div className="flex items-start space-x-3 flex-1">
                <div className="flex-shrink-0 w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
                  <span className="text-lg">⚙️</span>
                </div>
                <div className="flex-1">
                  <h4 className="font-semibold text-gray-800">Demo Mode</h4>
                  <p className="text-sm text-gray-600">
                    Allow unrestricted date entry for demonstrations and testing
                  </p>
                  {demoMode && (
                    <div className="mt-2 bg-amber-50 border border-amber-300 rounded-md px-3 py-2">
                      <p className="text-xs text-amber-800 font-medium">
                        ⚠️ Demo Mode Active - Any date can be entered for transactions
                      </p>
                    </div>
                  )}
                </div>
              </div>
              <button
                onClick={handleToggleDemoMode}
                className={`ml-4 flex-shrink-0 relative inline-flex h-8 w-14 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 ${
                  demoMode ? 'bg-amber-500' : 'bg-gray-300'
                }`}
                role="switch"
                aria-checked={demoMode}
              >
                <span
                  className={`${
                    demoMode ? 'translate-x-7' : 'translate-x-1'
                  } inline-block h-6 w-6 transform rounded-full bg-white transition-transform shadow-lg`}
                />
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

      <div className="bg-gray-50 border border-gray-200 rounded-xl p-5 space-y-3">
        <h3 className="font-semibold text-gray-800 flex items-center gap-2">
          <span>🔄</span> Reset Coaching Messages
        </h3>
        <p className="text-sm text-gray-500">
          Clear milestone history and proactive messages only. Your debts, transactions, and profile data are not affected.
        </p>
        <button
          onClick={() => {
            clearMilestoneHistory();
            alert('Coaching messages reset. Reload the page to see updated messages.');
          }}
          className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold py-2 px-4 rounded-lg transition-colors text-sm"
        >
          Reset Coaching Messages
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

      <BenTaskPanel />

      <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-bold text-gray-900">NOVO Access Level</h3>
            <p className="text-sm text-gray-500 mt-0.5">
              {proStatus
                ? `Pro${accessRecord?.expiresAt ? ` — expires ${new Date(accessRecord.expiresAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}` : ' — Permanent'}`
                : expired
                ? 'Pro access expired — re-enter a code to restore'
                : 'Free tier — enter an access code to unlock Pro'}
            </p>
          </div>
          <span className={`text-xs font-bold px-3 py-1 rounded-full ${proStatus ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600'}`}>
            {proStatus ? 'PRO' : 'FREE'}
          </span>
        </div>
        {!proStatus && (
          <button
            type="button"
            onClick={() => setShowUpgradeModal(true)}
            className="w-full bg-[#FF6B35] hover:bg-[#e55a25] text-white font-bold py-2.5 rounded-lg transition-colors text-sm"
          >
            Enter Access Code
          </button>
        )}
        {showUpgradeModal && <UpgradeModal onClose={() => setShowUpgradeModal(false)} />}
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

      <LearnHELOCModal
        isOpen={showLearnHELOCModal}
        onClose={() => setShowLearnHELOCModal(false)}
        showEnableButton={!featurePreferences.helocEnabled}
        onEnableHELOC={() => {
          handleToggleFeature('heloc');
        }}
      />

      {showHelocSuccessModal && (
        <HelocSuccessModal
          onClose={() => setShowHelocSuccessModal(false)}
          onNavigate={(section) => {
            setShowHelocSuccessModal(false);
            onNavigate?.(section);
          }}
        />
      )}
    </div>
  );
}
