import { useState, useEffect, useRef } from 'react';
import {
  Trash2,
  Download,
  Upload,
  AlertTriangle,
  CheckCircle,
  User,
  DollarSign,
  RefreshCw,
  Settings as SettingsIcon,
  Home,
  Shield,
  FileText,
  Info,
  Cloud,
} from 'lucide-react';
import { StorageService } from '../services/storage';
import { CalculationService } from '../services/calculations';
import { assembleNovoReportPayload } from '../utils/novoReportData';
import { buildNovoFullReportHtml, printHtmlDocument } from '../utils/novoPrintReport';
import { confirmFinancialProfileSaveIfNeeded } from '../utils/financialProfileSave';
import LearnHELOCModal from './LearnHELOCModal';
import HelocSuccessModal from './HelocSuccessModal';
import { clearMilestoneHistory } from '../utils/milestoneEngine';
import { UpgradeModal } from './AccessGate';
import IncomeSourcesEditor from './IncomeSourcesEditor';
import { isPro, getAccessRecord, isProExpired } from '../services/accessControl';
import type { FinancialProfile, FeaturePreferences, HomeEquity } from '../types';

interface SettingsProps {
  onDataUpdate: () => void;
  onHelocEnabledFirstTime?: () => void;
  onNavigate?: (section: 'tracker' | 'strategies' | 'guide') => void;
}

const inputClassName =
  'w-full border border-brand-gray-border rounded-md py-2 text-sm text-brand-navy focus:outline-none focus:border-brand-navy transition-colors';

function FeatureToggle({
  enabled,
  onToggle,
  activeColor,
  ariaLabel,
}: {
  enabled: boolean;
  onToggle: () => void;
  activeColor: 'orange' | 'green';
  ariaLabel: string;
}) {
  const trackClass = enabled
    ? activeColor === 'orange'
      ? 'bg-brand-orange'
      : 'bg-brand-green'
    : 'bg-brand-gray-border';

  return (
    <button
      type="button"
      onClick={onToggle}
      className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors focus:outline-none ${trackClass}`}
      role="switch"
      aria-checked={enabled}
      aria-label={ariaLabel}
    >
      <span
        className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
          enabled ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
  );
}

export default function Settings({ onDataUpdate, onHelocEnabledFirstTime, onNavigate }: SettingsProps) {
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const proStatus = isPro();
  const accessRecord = getAccessRecord();
  const expired = isProExpired();
  const showHelocFeature =
    localStorage.getItem('novo_admin_mode') === 'true' || proStatus;

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);
  const [userName, setUserName] = useState(localStorage.getItem('userName') || '');
  const [showProfileSuccess, setShowProfileSuccess] = useState(false);
  const [showFinancialSuccess, setShowFinancialSuccess] = useState(false);
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

  useEffect(() => {
    const profile = StorageService.getFinancialProfile();
    if (profile) {
      setFinancialProfile(profile);
    }

    const preferences = StorageService.getFeaturePreferences();
    setFeaturePreferences(preferences);

    const homeEquity = StorageService.getHomeEquity();
    if (homeEquity && homeEquity.hasHELOC) {
      setHelocDetails({
        creditLimit: homeEquity.helocLimit ? String(homeEquity.helocLimit) : '',
        currentBalance: homeEquity.helocBalance ? String(homeEquity.helocBalance) : '',
        interestRate: homeEquity.helocRate ? String(homeEquity.helocRate) : '',
        openedDate: (homeEquity as HomeEquity & { helocOpenedDate?: string }).helocOpenedDate || '',
        lender: (homeEquity as HomeEquity & { helocLender?: string }).helocLender || '',
      });
    }
  }, []);

  useEffect(() => {
    const refreshProfile = () => {
      const profile = StorageService.getFinancialProfile();
      if (profile) setFinancialProfile(profile);
    };
    window.addEventListener('focus', refreshProfile);
    return () => window.removeEventListener('focus', refreshProfile);
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
    const date = CalculationService.getTodayDateString();
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
      setTimeout(() => setShowProfileSuccess(false), 3000);
    }
  };

  const handleSaveFinancialProfile = () => {
    if (!confirmFinancialProfileSaveIfNeeded(financialProfile)) {
      return;
    }

    StorageService.saveFinancialProfile(financialProfile);
    setShowFinancialSuccess(true);
    onDataUpdate();
    setTimeout(() => setShowFinancialSuccess(false), 3000);
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
      [feature === 'heloc' ? 'helocEnabled' : 'checkingEnabled']:
        !featurePreferences[feature === 'heloc' ? 'helocEnabled' : 'checkingEnabled'],
    };
    setFeaturePreferences(updatedPreferences);
    StorageService.saveFeaturePreferences(updatedPreferences);
    setShowFeaturesSuccess(true);
    onDataUpdate();
    setTimeout(() => setShowFeaturesSuccess(false), 3000);

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
    setTimeout(() => setShowFeaturesSuccess(false), 3000);
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
    updated.helocOpenedDate = helocDetails.openedDate;
    updated.helocLender = helocDetails.lender;

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

  const handleClearAllData = () => {
    if (deleteConfirmText !== 'DELETE') {
      return;
    }

    StorageService.clearAllData();
    clearMilestoneHistory();
    setShowDeleteConfirm(false);
    setShowSuccess(true);

    setTimeout(() => {
      window.location.replace('/');
      window.location.reload();
    }, 500);
  };

  if (showHelocDisableConfirm) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg shadow-2xl max-w-md w-full p-6">
          <div className="flex items-start gap-3 mb-4">
            <AlertTriangle className="w-6 h-6 text-brand-orange shrink-0 mt-1" />
            <div>
              <h3 className="text-lg font-medium text-brand-navy mb-2">Disable HELOC Tracker?</h3>
              <p className="text-sm text-brand-gray leading-relaxed">
                Are you sure? This will hide the HELOC Tracker from your navigation. Your HELOC data will be saved if you re-enable it later.
              </p>
            </div>
          </div>

          <div className="flex gap-3 mt-6">
            <button
              type="button"
              onClick={() => setShowHelocDisableConfirm(false)}
              className="flex-1 px-4 py-2.5 bg-brand-gray-light hover:bg-brand-gray-border text-brand-navy text-sm font-medium rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirmHelocDisable}
              className="flex-1 px-4 py-2.5 bg-brand-orange hover:bg-brand-orange-dark text-white text-sm font-medium rounded-lg transition-colors"
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
      <div className="bg-brand-gray-light min-h-screen flex items-center justify-center py-16">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-brand-green rounded-full mb-4">
            <CheckCircle className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-xl font-medium text-brand-navy mb-2">All Data Cleared</h2>
          <p className="text-brand-gray text-sm">Redirecting...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-brand-gray-light min-h-screen">
      <div className="bg-brand-navy py-3 px-5">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-white text-lg font-medium leading-tight">Settings</h1>
          <p className="text-white/65 text-xs mt-0.5">Manage your NOVO account and preferences</p>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-5 py-6 space-y-5 pb-12">
        <div className="bg-white border border-brand-gray-border rounded-lg border-t-[3px] border-t-brand-navy p-5">
          <div className="flex items-center gap-2 mb-2">
            <Shield className="w-4 h-4 text-brand-navy" />
            <h3 className="text-sm font-medium text-brand-navy">My Data</h3>
          </div>
          <p className="text-xs text-brand-gray mb-4 leading-relaxed">
            Download a secure backup of your NOVO data or restore from a previous backup.
          </p>
          <div className="bg-amber-50 border border-amber-200 border-l-4 border-amber-400 rounded-lg p-3 mb-4 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <p className="text-xs text-brand-navy leading-relaxed">
              Store your backup file somewhere safe — email it to yourself or save to cloud storage.
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
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={handleBackupLocalStorage}
              className="inline-flex items-center gap-2 border border-brand-navy text-brand-navy hover:bg-brand-navy hover:text-white text-[13px] font-medium px-4 py-2 rounded-lg transition-colors"
            >
              <Download className="w-4 h-4" />
              Download Backup
            </button>
            <button
              type="button"
              onClick={handleRestoreBackupClick}
              className="inline-flex items-center gap-2 border border-brand-gray-border text-brand-gray hover:bg-brand-gray-light text-[13px] font-medium px-4 py-2 rounded-lg transition-colors"
            >
              <Upload className="w-4 h-4" />
              Restore from Backup
            </button>
          </div>
        </div>

        <div className="bg-white border border-brand-gray-border rounded-lg border-t-[3px] border-t-brand-orange p-5">
          <div className="flex items-center gap-2 mb-2">
            <FileText className="w-4 h-4 text-brand-orange" />
            <h3 className="text-sm font-medium text-brand-navy">NOVO Report</h3>
          </div>
          <p className="text-xs text-brand-gray mb-4 leading-relaxed">
            Generate a print-friendly summary of your complete financial picture.
          </p>
          <button
            type="button"
            onClick={handleDownloadNovoReport}
            className="inline-flex items-center gap-2 border border-brand-orange text-brand-orange hover:bg-brand-orange hover:text-white text-[13px] font-medium px-4 py-2 rounded-lg transition-colors"
          >
            <Download className="w-4 h-4" />
            Download My Report
          </button>
        </div>

        <div className="bg-white border border-brand-gray-border rounded-lg border-t-[3px] border-t-brand-blue p-5">
          <div className="flex items-center gap-2 mb-2">
            <User className="w-4 h-4 text-brand-blue" />
            <h3 className="text-sm font-medium text-brand-navy">Profile</h3>
          </div>
          <div className="space-y-4 mt-4">
            <div>
              <label className="block text-xs font-medium text-brand-gray mb-1.5">Your Name</label>
              <input
                type="text"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                placeholder="Enter your name"
                className={`${inputClassName} px-3`}
                maxLength={50}
              />
            </div>
            <button
              type="button"
              onClick={handleSaveProfile}
              disabled={!userName.trim()}
              className="bg-brand-navy hover:bg-brand-navy-dark disabled:opacity-50 disabled:cursor-not-allowed text-white text-[13px] font-medium px-4 py-2 rounded-lg transition-colors"
            >
              Save Changes
            </button>
            {showProfileSuccess && (
              <div className="flex items-center gap-2 bg-green-50 border border-brand-green text-brand-green px-4 py-3 rounded-lg text-sm">
                <CheckCircle className="w-4 h-4 shrink-0" />
                <span>Profile updated successfully</span>
              </div>
            )}
          </div>
        </div>

        <IncomeSourcesEditor onSaved={() => {
          const profile = StorageService.getFinancialProfile();
          if (profile) setFinancialProfile(profile);
        }} />

        <div className="bg-white border border-brand-gray-border rounded-lg border-t-[3px] border-t-brand-green p-5">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="w-4 h-4 text-brand-green" />
            <h3 className="text-sm font-medium text-brand-navy">Financial Profile</h3>
          </div>
          <p className="text-xs text-brand-gray mb-5 leading-relaxed">
            Update your income and expense information. These values are used in payment strategy calculations.
          </p>

          <div className="space-y-4">
            {[
              {
                label: 'Gross Monthly Income',
                hint: 'Total income before taxes and deductions',
                field: 'monthlyGrossIncome' as const,
              },
              {
                label: 'Net Monthly Income',
                hint: 'Take-home pay after taxes and deductions',
                field: 'monthlyNetIncome' as const,
              },
              {
                label: 'Monthly Essential Expenses',
                hint: 'Housing, utilities, groceries, insurance, transportation',
                field: 'monthlyEssentialExpenses' as const,
              },
              {
                label: 'Monthly Discretionary Expenses',
                hint: 'Entertainment, dining out, shopping, subscriptions',
                field: 'monthlyDiscretionaryExpenses' as const,
              },
              {
                label: 'Monthly Savings Goal',
                hint: 'Set aside before debt payoff so your emergency fund / savings keep growing',
                field: 'monthlySavingsGoal' as const,
              },
            ].map(({ label, hint, field }) => (
              <div key={field}>
                <label className="block text-xs font-medium text-brand-gray mb-1">{label}</label>
                <p className="text-[11px] text-brand-gray mb-1.5">{hint}</p>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-brand-gray text-sm">$</span>
                  <input
                    type="number"
                    value={financialProfile[field] || ''}
                    onChange={(e) =>
                      setFinancialProfile({ ...financialProfile, [field]: parseFloat(e.target.value) || 0 })
                    }
                    onFocus={(e) => {
                      if (e.target.value === '0') e.target.value = '';
                    }}
                    placeholder="Enter amount"
                    className={`${inputClassName} pl-8 pr-3`}
                    step="0.01"
                    min="0"
                  />
                </div>
              </div>
            ))}

            <button
              type="button"
              onClick={handleSaveFinancialProfile}
              disabled={!(financialProfile.monthlyGrossIncome > 0 && financialProfile.monthlyNetIncome > 0)}
              className="w-full bg-brand-navy hover:bg-brand-navy-dark disabled:opacity-50 disabled:cursor-not-allowed text-white text-[13px] font-medium px-4 py-2 rounded-lg transition-colors"
            >
              Save Financial Profile
            </button>

            {showFinancialSuccess && (
              <div className="flex items-center gap-2 bg-green-50 border border-brand-green text-brand-green px-4 py-3 rounded-lg text-sm">
                <CheckCircle className="w-4 h-4 shrink-0" />
                <span>Financial profile updated successfully</span>
              </div>
            )}
          </div>
        </div>

        <div className="bg-white border border-brand-gray-border rounded-lg border-t-[3px] border-t-brand-blue p-5">
          <div className="flex items-center gap-2 mb-2">
            <SettingsIcon className="w-4 h-4 text-brand-blue" />
            <h3 className="text-sm font-medium text-brand-navy">Account Features</h3>
          </div>
          <p className="text-xs text-brand-gray mb-5 leading-relaxed">
            Enable tools that match your financial situation.
          </p>

          <div className="space-y-4">
            {showHelocFeature && (
              <div
                className={`rounded-lg p-4 border transition-colors ${
                  featurePreferences.helocEnabled
                    ? 'border-brand-orange bg-orange-50'
                    : 'border-brand-gray-border bg-white'
                }`}
              >
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Home className={`w-5 h-5 ${featurePreferences.helocEnabled ? 'text-brand-orange' : 'text-brand-gray'}`} />
                      <h4 className="text-[13px] font-medium text-brand-navy">HELOC / Home Equity Line of Credit</h4>
                    </div>
                    <p className="text-[11px] text-brand-gray leading-relaxed">
                      Enable if you have a HELOC and want to use velocity banking strategies. Track draws, payments, and optimize debt payoff using your home equity.
                    </p>
                  </div>
                  <FeatureToggle
                    enabled={featurePreferences.helocEnabled}
                    onToggle={() => handleToggleFeature('heloc')}
                    activeColor="orange"
                    ariaLabel="Toggle HELOC features"
                  />
                </div>

                {!featurePreferences.helocEnabled && (
                  <button
                    type="button"
                    onClick={() => setShowLearnHELOCModal(true)}
                    className="text-xs font-medium text-brand-blue hover:underline"
                  >
                    Learn About HELOC Strategy →
                  </button>
                )}

                {featurePreferences.helocEnabled && (
                  <div className="mt-4 pt-4 border-t border-brand-gray-border space-y-4">
                    <p className="text-xs font-medium text-brand-navy">HELOC Details</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-brand-gray mb-1">
                          Credit Limit <span className="text-brand-red">*</span>
                        </label>
                        <div className="relative">
                          <span className="absolute left-3 top-2 text-brand-gray text-sm">$</span>
                          <input
                            type="number"
                            value={helocDetails.creditLimit}
                            onChange={(e) => {
                              setHelocDetails({ ...helocDetails, creditLimit: e.target.value });
                              if (helocErrors.creditLimit) setHelocErrors({ ...helocErrors, creditLimit: '' });
                            }}
                            placeholder="100,000"
                            className={`${inputClassName} pl-7 pr-3 ${helocErrors.creditLimit ? 'border-brand-red' : ''}`}
                            min="0"
                            step="1000"
                          />
                        </div>
                        {helocErrors.creditLimit && (
                          <p className="text-brand-red text-[11px] mt-1">{helocErrors.creditLimit}</p>
                        )}
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-brand-gray mb-1">Current Balance</label>
                        <div className="relative">
                          <span className="absolute left-3 top-2 text-brand-gray text-sm">$</span>
                          <input
                            type="number"
                            value={helocDetails.currentBalance}
                            onChange={(e) => {
                              setHelocDetails({ ...helocDetails, currentBalance: e.target.value });
                              if (helocErrors.currentBalance) setHelocErrors({ ...helocErrors, currentBalance: '' });
                            }}
                            placeholder="0"
                            className={`${inputClassName} pl-7 pr-3 ${helocErrors.currentBalance ? 'border-brand-red' : ''}`}
                            min="0"
                            step="100"
                          />
                        </div>
                        {helocErrors.currentBalance && (
                          <p className="text-brand-red text-[11px] mt-1">{helocErrors.currentBalance}</p>
                        )}
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-brand-gray mb-1">
                          Interest Rate (APR) <span className="text-brand-red">*</span>
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
                            className={`${inputClassName} px-3 pr-8 ${helocErrors.interestRate ? 'border-brand-red' : ''}`}
                            min="0"
                            max="25"
                            step="0.1"
                          />
                          <span className="absolute right-3 top-2 text-brand-gray text-sm">%</span>
                        </div>
                        {helocErrors.interestRate && (
                          <p className="text-brand-red text-[11px] mt-1">{helocErrors.interestRate}</p>
                        )}
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-brand-gray mb-1">HELOC Opened Date</label>
                        <input
                          type="date"
                          value={helocDetails.openedDate}
                          onChange={(e) => setHelocDetails({ ...helocDetails, openedDate: e.target.value })}
                          className={`${inputClassName} px-3`}
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-brand-gray mb-1">
                        Lender <span className="text-brand-gray font-normal">(optional)</span>
                      </label>
                      <input
                        type="text"
                        value={helocDetails.lender}
                        onChange={(e) => setHelocDetails({ ...helocDetails, lender: e.target.value })}
                        placeholder="e.g., Huntington Bank"
                        className={`${inputClassName} px-3`}
                        maxLength={80}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={handleSaveHelocDetails}
                      className="w-full bg-brand-navy hover:bg-brand-navy-dark text-white text-[13px] font-medium py-2 px-4 rounded-lg transition-colors"
                    >
                      Save HELOC Details
                    </button>
                    {showHelocSuccess && (
                      <div className="flex items-center gap-2 bg-green-50 border border-brand-green text-brand-green px-4 py-3 rounded-lg text-sm">
                        <CheckCircle className="w-4 h-4 shrink-0" />
                        <span>HELOC details saved</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            <div className="rounded-lg p-4 border border-brand-gray-border bg-white">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <h4 className="text-[13px] font-medium text-brand-navy mb-1">Checking Account Register</h4>
                  <p className="text-[11px] text-brand-gray leading-relaxed">
                    Track your checking account deposits, withdrawals, and expenses. See where your money goes each month and stay on budget.
                  </p>
                </div>
                <FeatureToggle
                  enabled={featurePreferences.checkingEnabled}
                  onToggle={() => handleToggleFeature('checking')}
                  activeColor="green"
                  ariaLabel="Toggle checking account register"
                />
              </div>
            </div>

            {showFeaturesSuccess && (
              <div className="flex items-center gap-2 bg-green-50 border border-brand-green text-brand-green px-4 py-3 rounded-lg text-sm">
                <CheckCircle className="w-4 h-4 shrink-0" />
                <span>Feature preferences saved successfully</span>
              </div>
            )}
          </div>
        </div>

        <div className="bg-white border border-brand-gray-border rounded-lg p-5">
          <div className="flex items-center gap-2 mb-2">
            <RefreshCw className="w-4 h-4 text-brand-gray" />
            <h3 className="text-sm font-medium text-brand-navy">Reset Coaching Messages</h3>
          </div>
          <p className="text-xs text-brand-gray mb-4 leading-relaxed">
            Clear milestone history and proactive messages only. Your debts, transactions, and profile data are not affected.
          </p>
          <button
            type="button"
            onClick={() => {
              clearMilestoneHistory();
              alert('Coaching messages reset. Reload the page to see updated messages.');
            }}
            className="inline-flex items-center gap-2 border border-brand-gray-border text-brand-gray hover:bg-red-50 hover:text-brand-red hover:border-brand-red text-[13px] font-medium px-4 py-2 rounded-lg transition-colors"
          >
            Reset Messages
          </button>
        </div>

        <div className="bg-white border border-brand-gray-border rounded-lg p-5">
          <div className="flex items-center justify-between gap-3 mb-1">
            <h3 className="text-sm font-medium text-brand-navy">NOVO Access Level</h3>
            <span
              className={`text-[11px] font-medium px-3 py-1 rounded-full ${
                proStatus ? 'bg-brand-navy text-white' : 'bg-brand-gray-light text-brand-gray border border-brand-gray-border'
              }`}
            >
              {proStatus ? 'PRO' : 'FREE'}
            </span>
          </div>
          <p className="text-xs text-brand-gray">
            {proStatus
              ? `Pro${accessRecord?.expiresAt ? ` — expires ${new Date(accessRecord.expiresAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}` : ' — Permanent'}`
              : expired
                ? 'Pro access expired — re-enter a code to restore'
                : 'Free tier — enter an access code to unlock Pro'}
          </p>
          {!proStatus && (
            <button
              type="button"
              onClick={() => setShowUpgradeModal(true)}
              className="w-full mt-4 bg-brand-orange hover:bg-brand-orange-dark text-white text-sm font-medium py-2.5 rounded-lg transition-colors"
            >
              Enter Access Code
            </button>
          )}
          {showUpgradeModal && <UpgradeModal onClose={() => setShowUpgradeModal(false)} />}
        </div>

        <div className="bg-white border border-brand-gray-border rounded-lg border-t-[3px] border-t-brand-orange p-5">
          <div className="flex items-center gap-2 mb-3">
            <Info className="w-4 h-4 text-brand-orange" />
            <h3 className="text-sm font-medium text-brand-navy">About NOVO</h3>
          </div>
          <p className="text-[13px] text-brand-gray leading-relaxed mb-4">
            NOVO is your personal financial command center. Track your accounts, eliminate debt faster, and build toward
            homeownership — all in one place. Whether you&apos;re paying off credit cards or preparing to buy a home,
            NOVO gives you the clarity and coaching to make it happen.
          </p>
          <div className="space-y-2 text-[11px] text-brand-gray">
            <p>Version 1.0.0</p>
            <p className="flex items-center gap-1.5">
              <Cloud className="w-3.5 h-3.5 text-brand-green shrink-0" />
              <span>Data Storage: Secure Cloud</span>
            </p>
            <p>Your data is encrypted and never shared or sold.</p>
          </div>
        </div>

        {localStorage.getItem('novo_admin_mode') === 'true' && (
          <div className="bg-white border border-brand-red rounded-lg p-5">
            <div className="flex items-start gap-3 mb-4">
              <AlertTriangle className="w-5 h-5 text-brand-red shrink-0 mt-0.5" />
              <div>
                <h3 className="text-sm font-medium text-brand-red mb-1">Danger Zone</h3>
                <p className="text-xs text-brand-gray">
                  This action will permanently delete all your data from NOVO. This cannot be undone.
                </p>
              </div>
            </div>

            {!showDeleteConfirm ? (
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(true)}
                className="inline-flex items-center gap-2 bg-brand-red hover:opacity-90 text-white text-sm font-medium py-2.5 px-4 rounded-lg transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                Clear All Data
              </button>
            ) : (
              <div className="space-y-4">
                <div className="bg-red-50 border border-brand-red rounded-lg p-4">
                  <p className="font-medium text-brand-red text-sm mb-2">This will permanently delete:</p>
                  <ul className="list-disc list-inside space-y-1 text-brand-gray text-xs mb-3">
                    <li>All debts</li>
                    <li>Payment history</li>
                    <li>Financial profile</li>
                    <li>Strategy results</li>
                  </ul>
                  <p className="text-xs text-brand-gray mb-2">
                    Type <span className="font-medium text-brand-navy">DELETE</span> to confirm:
                  </p>
                  <input
                    type="text"
                    value={deleteConfirmText}
                    onChange={(e) => setDeleteConfirmText(e.target.value)}
                    className={`${inputClassName} px-3`}
                    placeholder="Type DELETE"
                  />
                </div>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setShowDeleteConfirm(false);
                      setDeleteConfirmText('');
                    }}
                    className="flex-1 bg-brand-gray-light hover:bg-brand-gray-border text-brand-navy text-sm font-medium py-2.5 rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleClearAllData}
                    disabled={deleteConfirmText !== 'DELETE'}
                    className="flex-1 bg-brand-red hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium py-2.5 rounded-lg transition-colors"
                  >
                    Yes, Delete Everything
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
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
