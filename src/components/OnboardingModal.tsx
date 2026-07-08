import { useState, useEffect, useRef } from 'react';
import { DollarSign, CreditCard, CheckCircle, ChevronLeft, Plus, X, Info, ChevronDown, ChevronUp } from 'lucide-react';
import { CalculationService } from '../services/calculations';
import CashFlowWarningModal from './CashFlowWarningModal';
import LearnHELOCModal from './LearnHELOCModal';

interface DebtInput {
  id: string;
  name: string;
  type: string;
  balance: string;
  interestRate: string;
  minPayment: string;
  originalAmount?: string;
  loanStartDate?: string;
  loanTerm?: string;
}

export interface IncomeSource {
  id: string;
  type: 'w2' | 'self_employed' | 'commission' | 'rental' | 'other';
  label: string;
  monthlyAmount: string;
  annualAmount: string;
  useAnnual: boolean;
  description: string;
}

export interface AdditionalProperty {
  id: string;
  description: string;
  mortgageBalance: string;
  monthlyPayment: string;
  monthlyRentalIncome: string;
  hasHELOC: boolean;
  helocBalance: string;
  helocLimit: string;
  helocRate: string;
}

interface OnboardingData {
  userName: string;
  partnerName?: string;
  accountType?: 'solo' | 'couple' | 'family';
  incomeSources?: IncomeSource[];
  additionalProperties?: AdditionalProperty[];
  grossIncome: string;
  monthlyIncome: string;
  essentialExpenses: string;
  discretionaryExpenses: string;
  monthlySavingsGoal: string;
  address: string;
  debts: DebtInput[];
  hasHELOC: boolean;
  helocLimit: string;
  helocRate: string;
  helocBalance: string;
  helocMinPayment: string;
}

interface OnboardingModalProps {
  onComplete: (data: OnboardingData) => void;
}

export default function OnboardingModal({ onComplete }: OnboardingModalProps) {
  const [step, setStep] = useState(1);
  const restoreBackupInputRef = useRef<HTMLInputElement>(null);
  const [showCashFlowWarning, setShowCashFlowWarning] = useState(false);
  const [showLearnHELOCModal, setShowLearnHELOCModal] = useState(false);
  const [isResuming, setIsResuming] = useState(false);
  const [showStrategyExplanation, setShowStrategyExplanation] = useState(false);
  const [data, setData] = useState<OnboardingData>({
    userName: '',
    partnerName: '',
    accountType: 'solo',
    incomeSources: [],
    additionalProperties: [],
    grossIncome: '',
    monthlyIncome: '',
    essentialExpenses: '',
    discretionaryExpenses: '',
    monthlySavingsGoal: '',
    address: '',
    debts: [{ id: '1', name: '', type: 'Credit Card', balance: '', interestRate: '', minPayment: '' }],
    hasHELOC: false,
    helocLimit: '',
    helocRate: '',
    helocBalance: '',
    helocMinPayment: '',
  });

  // Load saved onboarding progress on mount
  useEffect(() => {
    const savedProgress = localStorage.getItem('onboardingProgress');
    if (savedProgress) {
      try {
        const { step: savedStep, data: savedData } = JSON.parse(savedProgress);
        setStep(savedStep);
        setData(savedData);
        if (savedData.accountType) {
          localStorage.setItem('novo_account_type', savedData.accountType);
        }
        setIsResuming(true);
      } catch (error) {
        console.error('Failed to load onboarding progress:', error);
      }
    }
  }, []);

  // Save onboarding progress whenever step or data changes
  useEffect(() => {
    if (step > 0 && step < 4) {
      localStorage.setItem('onboardingProgress', JSON.stringify({ step, data }));
    }
  }, [step, data]);

  const formatCurrency = (value: string): string => {
    const num = value.replace(/[^0-9.]/g, '');
    if (!num) return '';
    const parsed = parseFloat(num);
    if (isNaN(parsed)) return '';
    return parsed.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  };

  const parseCurrency = (value: string): number => {
    const num = value.replace(/[^0-9.]/g, '');
    return parseFloat(num) || 0;
  };

  const handleCurrencyChange = (field: keyof OnboardingData, value: string) => {
    setData({ ...data, [field]: formatCurrency(value) });
  };

  const handleDebtChange = (id: string, field: keyof DebtInput, value: string) => {
    const updatedDebts = data.debts.map(debt => {
      if (debt.id === id) {
        if (field === 'balance' || field === 'minPayment' || field === 'originalAmount') {
          return { ...debt, [field]: formatCurrency(value) };
        }
        return { ...debt, [field]: value };
      }
      return debt;
    });
    setData({ ...data, debts: updatedDebts });
  };

  const addDebt = () => {
    setData({
      ...data,
      debts: [...data.debts, { id: Date.now().toString(), name: '', type: 'Credit Card', balance: '', interestRate: '', minPayment: '' }],
    });
  };

  const removeDebt = (id: string) => {
    if (data.debts.length > 1) {
      setData({ ...data, debts: data.debts.filter(d => d.id !== id) });
    }
  };

  const getCashFlow = (): number => {
    const income = parseCurrency(data.monthlyIncome);
    const essential = parseCurrency(data.essentialExpenses);
    const discretionary = parseCurrency(data.discretionaryExpenses);
    const savings = parseCurrency(data.monthlySavingsGoal);
    return Math.max(0, income - essential - discretionary - savings);
  };

  const getTotalDebt = (): number => {
    return data.debts.reduce((sum, debt) => sum + parseCurrency(debt.balance), 0);
  };

  const getEstimatedMonths = (): number => {
    const totalDebt = getTotalDebt();
    const cashFlow = getCashFlow();
    if (cashFlow <= 0 || totalDebt <= 0) return 0;

    const avgRate = data.debts.reduce((sum, debt) => {
      const balance = parseCurrency(debt.balance);
      const rate = parseFloat(debt.interestRate) || 0;
      return sum + (balance * rate);
    }, 0) / totalDebt / 100;

    const monthlyRate = avgRate / 12;
    if (monthlyRate === 0) {
      return Math.ceil(totalDebt / cashFlow);
    }

    const months = -Math.log(1 - (totalDebt * monthlyRate) / cashFlow) / Math.log(1 + monthlyRate);
    return Math.ceil(months);
  };

  const canProceed = (): boolean => {
    switch (step) {
      case 1:
        return data.userName.trim() !== '';
      case 2:
        return parseCurrency(data.grossIncome) > 0 && parseCurrency(data.monthlyIncome) > 0 && parseCurrency(data.essentialExpenses) >= 0 && parseCurrency(data.discretionaryExpenses) >= 0;
      case 3:
        const hasHELOC = data.hasHELOC === true;
        const debtCount = data.debts.filter(d =>
          d.name.trim() !== '' && parseCurrency(d.balance) > 0
        ).length;

        return hasHELOC || debtCount >= 1;
      default:
        return true;
    }
  };

  const handleNext = () => {
    if (canProceed()) {
      if (step === 4) {
        // Clear onboarding progress when complete
        localStorage.removeItem('onboardingProgress');
        localStorage.setItem('novo_account_type', data.accountType || 'solo');

        // Track onboarding completion in Google Analytics
        if (typeof window !== 'undefined' && (window as any).gtag) {
          (window as any).gtag('event', 'onboarding_complete');
        }

        onComplete(data);
      } else if (step === 2) {
        // Check cash flow after step 2 before proceeding
        const cashFlow = getCashFlow();
        if (cashFlow < 500) {
          setShowCashFlowWarning(true);
        } else {
          setStep(step + 1);
        }
      } else {
        setStep(step + 1);
      }
    }
  };

  const handleCashFlowContinue = () => {
    setShowCashFlowWarning(false);
    setStep(step + 1);
  };

  const handleCashFlowReview = () => {
    setShowCashFlowWarning(false);
    // Stay on step 2 so they can adjust their expenses
  };

  const handleCashFlowContactCoach = () => {
    // Open email client
    window.location.href = 'mailto:ben@windmillmortgage.com?subject=NOVO%20Cash%20Flow%20Consultation&body=Hi%20Ben%2C%0A%0AI%27m%20working%20through%20the%20NOVO%20debt%20payoff%20calculator%20and%20would%20like%20some%20guidance%20on%20my%20cash%20flow%20situation.%0A%0AThank%20you%21';
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
    }
  };

  const handleStartOver = () => {
    localStorage.removeItem('onboardingProgress');
    localStorage.setItem('novo_account_type', 'solo');
    setStep(1);
    setData({
      userName: '',
      partnerName: '',
      accountType: 'solo',
      incomeSources: [],
      additionalProperties: [],
      grossIncome: '',
      monthlyIncome: '',
      essentialExpenses: '',
      discretionaryExpenses: '',
      monthlySavingsGoal: '',
      address: '',
      debts: [{ id: '1', name: '', type: 'Credit Card', balance: '', interestRate: '', minPayment: '' }],
      hasHELOC: false,
      helocLimit: '',
      helocRate: '',
      helocBalance: '',
      helocMinPayment: '',
    });
    setIsResuming(false);
  };

  const handleRestoreBackupClick = () => {
    restoreBackupInputRef.current?.click();
  };

  const isPlausibleNovoBackup = (obj: Record<string, unknown>): boolean => {
    const keys = Object.keys(obj);
    if (keys.length === 0) return false;
    return keys.some((k) => k.startsWith('novo_'));
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
          e.target.value = '';
          return;
        }
        const record = parsed as Record<string, unknown>;
        if (!isPlausibleNovoBackup(record)) {
          window.alert('This file does not look like a valid NOVO backup. Use a JSON file exported from NOVO Settings → Data Protection.');
          e.target.value = '';
          return;
        }
        for (const [key, value] of Object.entries(record)) {
          if (typeof value === 'string') {
            localStorage.setItem(key, value);
          }
        }
        localStorage.removeItem('onboardingProgress');
        window.location.reload();
      } catch {
        window.alert('Could not read this backup file. Make sure it is valid JSON from NOVO.');
        e.target.value = '';
      }
    };
    reader.readAsText(file);
  };

  const renderProgressBar = () => (
    <div className="mb-6">
      <div className="flex items-center justify-between text-sm text-gray-600 mb-2">
        <span>Step {step} of 4</span>
        <span>{Math.round((step / 4) * 100)}% Complete</span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
        <div
          className="bg-gradient-to-r from-emerald-500 to-teal-600 h-full transition-all duration-300"
          style={{ width: `${(step / 4) * 100}%` }}
        />
      </div>
    </div>
  );

  const renderStep1 = () => {
    return (
      <div className="space-y-6">
        <div className="text-center mb-6">
          <div className="flex justify-center mb-4">
            <img
              src="/novo_primary.png"
              alt="NOVO Logo"
              className="h-auto"
              style={{ width: '120px' }}
            />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Welcome to NOVO!</h1>
          <p className="text-lg text-gray-600">Let's start your debt freedom journey.</p>
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-3">Who's using NOVO?</label>
          <div className="grid grid-cols-3 gap-3">
            {[
              { value: 'solo', label: 'Just me', emoji: '👤' },
              { value: 'couple', label: 'My partner & I', emoji: '👫' },
              { value: 'family', label: 'Our family', emoji: '👨‍👩‍👧' },
            ].map(option => (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  const selectedType = option.value as 'solo' | 'couple' | 'family';
                  localStorage.setItem('novo_account_type', selectedType);
                  setData({ ...data, accountType: selectedType });
                }}
                className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
                  data.accountType === option.value
                    ? 'border-brand-orange bg-brand-orange/5 text-brand-orange'
                    : 'border-gray-200 text-gray-600 hover:border-gray-300'
                }`}
              >
                <span className="text-2xl">{option.emoji}</span>
                <span className="text-xs font-semibold">{option.label}</span>
              </button>
            ))}
          </div>
        </div>

        {data.accountType === 'solo' && (
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Your first name</label>
            <input
              type="text"
              value={data.userName}
              onChange={(e) => setData({ ...data, userName: e.target.value })}
              placeholder="First name"
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-orange/30 focus:border-brand-orange transition-all"
              style={{ fontSize: '16px' }}
              autoFocus
              maxLength={30}
            />
          </div>
        )}

        {data.accountType === 'couple' && (
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Your first name</label>
              <input
                type="text"
                value={data.userName}
                onChange={(e) => setData({ ...data, userName: e.target.value })}
                placeholder="Your first name"
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-orange/30 focus:border-brand-orange transition-all"
                style={{ fontSize: '16px' }}
                autoFocus
                maxLength={30}
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Partner's first name <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <input
                type="text"
                value={data.partnerName || ''}
                onChange={(e) => setData({ ...data, partnerName: e.target.value })}
                placeholder="Partner's first name"
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-orange/30 focus:border-brand-orange transition-all"
                style={{ fontSize: '16px' }}
                maxLength={30}
              />
            </div>
          </div>
        )}

        {data.accountType === 'family' && (
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Family or last name</label>
            <input
              type="text"
              value={data.userName}
              onChange={(e) => setData({ ...data, userName: e.target.value })}
              placeholder="e.g. Hulshof, Smith Family"
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-orange/30 focus:border-brand-orange transition-all"
              style={{ fontSize: '16px' }}
              autoFocus
              maxLength={50}
            />
          </div>
        )}
      </div>
    );
  };

  const renderStep2 = () => (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-full mb-4">
          <DollarSign className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Hi {data.userName}, let's get your financial snapshot</h1>
        <p className="text-gray-600">This helps us calculate your available cash flow</p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">
            How does income come into your household? <span className="text-red-500">*</span>
          </label>
          <p className="text-xs text-gray-500 mb-3">Select all that apply — you can add up to 5 sources</p>
        </div>

        <div className="grid grid-cols-1 gap-2">
          {[
            { type: 'w2', label: 'W2 / Salary', desc: 'Regular paycheck from employer', emoji: '💼' },
            { type: 'self_employed', label: 'Self-Employed / Business', desc: 'Business income, owner draws, or distributions', emoji: '🏢' },
            { type: 'commission', label: 'Commission / Variable', desc: 'Income that varies month to month', emoji: '📈' },
            { type: 'rental', label: 'Rental Income', desc: 'Income from properties in your personal name only', emoji: '🏠' },
            { type: 'other', label: 'Other Income', desc: 'Pension, Social Security, alimony, side income', emoji: '💰' },
          ].map(source => {
            const existing = (data.incomeSources || []).find(s => s.type === source.type);
            const isActive = !!existing;
            return (
              <div key={source.type} className={`border-2 rounded-xl transition-all ${isActive ? 'border-brand-orange bg-brand-orange/5' : 'border-gray-200 bg-white'}`}>
                <button
                  type="button"
                  onClick={() => {
                    const current = data.incomeSources || [];
                    if (isActive) {
                      setData({ ...data, incomeSources: current.filter(s => s.type !== source.type) });
                    } else if (current.length < 5) {
                      const newSource: IncomeSource = {
                        id: `income_${Date.now()}`,
                        type: source.type as IncomeSource['type'],
                        label: source.label,
                        monthlyAmount: '',
                        annualAmount: '',
                        useAnnual: source.type === 'self_employed',
                        description: '',
                      };
                      setData({ ...data, incomeSources: [...current, newSource] });
                    }
                  }}
                  className="w-full flex items-center gap-3 p-3 text-left"
                >
                  <span className="text-xl">{source.emoji}</span>
                  <div className="flex-1">
                    <p className={`text-sm font-semibold ${isActive ? 'text-brand-orange' : 'text-gray-700'}`}>{source.label}</p>
                    <p className="text-xs text-gray-500">{source.desc}</p>
                  </div>
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${isActive ? 'border-brand-orange bg-brand-orange' : 'border-gray-300'}`}>
                    {isActive && <div className="w-2 h-2 rounded-full bg-white" />}
                  </div>
                </button>

                {isActive && existing && (
                  <div className="px-4 pb-4 space-y-3 border-t border-brand-orange/20 pt-3">
                    {source.type === 'self_employed' && (
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-xs font-semibold text-gray-600">Enter as:</span>
                        <button
                          type="button"
                          onClick={() => {
                            const updated = (data.incomeSources || []).map(s =>
                              s.type === source.type ? { ...s, useAnnual: false } : s
                            );
                            setData({ ...data, incomeSources: updated });
                          }}
                          className={`text-xs px-3 py-1 rounded-full border transition-all ${!existing.useAnnual ? 'bg-brand-navy text-white border-brand-navy' : 'bg-white text-gray-600 border-gray-300'}`}
                        >
                          Monthly
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const updated = (data.incomeSources || []).map(s =>
                              s.type === source.type ? { ...s, useAnnual: true } : s
                            );
                            setData({ ...data, incomeSources: updated });
                          }}
                          className={`text-xs px-3 py-1 rounded-full border transition-all ${existing.useAnnual ? 'bg-brand-navy text-white border-brand-navy' : 'bg-white text-gray-600 border-gray-300'}`}
                        >
                          Annual (we'll average it)
                        </button>
                      </div>
                    )}

                    {(!existing.useAnnual || source.type !== 'self_employed') && (
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">
                          {source.type === 'commission' ? '12-month average monthly amount' : 'Monthly amount (gross)'}
                        </label>
                        <div className="relative">
                          <span className="absolute left-3 top-2 text-gray-500 text-sm">$</span>
                          <input
                            type="text"
                            value={existing.monthlyAmount}
                            onChange={e => {
                              const updated = (data.incomeSources || []).map(s =>
                                s.type === source.type ? { ...s, monthlyAmount: e.target.value } : s
                              );
                              setData({ ...data, incomeSources: updated });
                            }}
                            placeholder="0"
                            className="w-full pl-7 pr-4 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-orange/30 focus:border-brand-orange outline-none"
                          />
                        </div>
                        {source.type === 'commission' && (
                          <p className="text-xs text-gray-400 mt-1">Add up last 12 months of commission and divide by 12</p>
                        )}
                      </div>
                    )}

                    {existing.useAnnual && source.type === 'self_employed' && (
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">Annual amount</label>
                        <div className="relative">
                          <span className="absolute left-3 top-2 text-gray-500 text-sm">$</span>
                          <input
                            type="text"
                            value={existing.annualAmount}
                            onChange={e => {
                              const updated = (data.incomeSources || []).map(s =>
                                s.type === source.type ? { ...s, annualAmount: e.target.value } : s
                              );
                              setData({ ...data, incomeSources: updated });
                            }}
                            placeholder="0"
                            className="w-full pl-7 pr-4 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-orange/30 focus:border-brand-orange outline-none"
                          />
                        </div>
                        {existing.annualAmount && parseFloat(existing.annualAmount.replace(/[^0-9.]/g, '')) > 0 && (
                          <div className="mt-2 bg-blue-50 border border-blue-200 rounded-lg p-2">
                            <p className="text-xs text-blue-800 font-medium">
                              📊 Using <strong>${(parseFloat(existing.annualAmount.replace(/[^0-9.]/g, '')) / 12).toLocaleString('en-US', { maximumFractionDigits: 0 })}/month</strong> as your monthly average for planning purposes
                            </p>
                          </div>
                        )}
                      </div>
                    )}

                    {source.type === 'other' && (
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">Description (optional)</label>
                        <input
                          type="text"
                          value={existing.description}
                          onChange={e => {
                            const updated = (data.incomeSources || []).map(s =>
                              s.type === source.type ? { ...s, description: e.target.value } : s
                            );
                            setData({ ...data, incomeSources: updated });
                          }}
                          placeholder="e.g. Social Security, rental income, pension"
                          className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-orange/30 focus:border-brand-orange outline-none"
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {(data.incomeSources || []).length > 0 && (() => {
          const totalMonthly = (data.incomeSources || []).reduce((sum, s) => {
            if (s.useAnnual && s.annualAmount) {
              return sum + (parseFloat(s.annualAmount.replace(/[^0-9.]/g, '')) / 12);
            }
            return sum + (parseFloat(s.monthlyAmount.replace(/[^0-9.]/g, '')) || 0);
          }, 0);
          if (totalMonthly === 0) return null;
          return (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
              <div className="flex justify-between items-center">
                <p className="text-sm font-semibold text-emerald-800">Combined Monthly Income</p>
                <p className="text-lg font-bold text-emerald-700">${totalMonthly.toLocaleString('en-US', { maximumFractionDigits: 0 })}</p>
              </div>
              <p className="text-xs text-emerald-600 mt-1">Gross total across all {(data.incomeSources || []).length} income source{(data.incomeSources || []).length > 1 ? 's' : ''}</p>
            </div>
          );
        })()}
      </div>

      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">
          Combined Monthly Take-Home Pay <span className="text-red-500">*</span>
        </label>
        <p className="text-xs text-gray-500 mb-2">Total monthly amount that actually lands in your bank accounts after all taxes and deductions</p>
        <div className="relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">$</span>
          <input
            type="text"
            value={data.monthlyIncome}
            onChange={(e) => handleCurrencyChange('monthlyIncome', e.target.value)}
            placeholder="5,000"
            className="w-full pl-8 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-orange/30 focus:border-brand-orange transition-all min-h-[48px]"
            style={{ fontSize: '16px' }}
          />
        </div>
        <p className="text-xs text-gray-400 mt-1">For irregular income, use your typical monthly deposit amount</p>
      </div>

      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">
          Combined Gross Monthly Income <span className="text-red-500">*</span>
        </label>
        <p className="text-xs text-gray-500 mb-2">Before taxes — used for DTI calculation</p>
        <div className="relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">$</span>
          <input
            type="text"
            value={data.grossIncome}
            onChange={(e) => handleCurrencyChange('grossIncome', e.target.value)}
            placeholder="7,000"
            className="w-full pl-8 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-orange/30 focus:border-brand-orange transition-all min-h-[48px]"
            style={{ fontSize: '16px' }}
          />
        </div>
      </div>

      <div className="bg-blue-50 border-2 border-blue-300 rounded-lg p-4">
        <div className="flex items-start gap-2">
          <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-900">
            <p className="font-bold mb-2">Understanding Your Spending</p>
            <p className="mb-2">Breaking down your expenses helps you find extra cash flow to eliminate debt faster. Be honest with yourself - most people can reduce discretionary spending by 20-30% when motivated.</p>
            <p className="font-bold text-red-600">IMPORTANT: Do NOT include debt payments here - we'll add those separately in the next step.</p>
          </div>
        </div>
      </div>

      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">
          Essential Monthly Expenses <span className="text-red-500">*</span>
        </label>
        <p className="text-xs text-gray-500 mb-2">Fixed costs you cannot easily reduce</p>
        <div className="relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">$</span>
          <input
            type="text"
            value={data.essentialExpenses}
            onChange={(e) => handleCurrencyChange('essentialExpenses', e.target.value)}
            placeholder="Enter amount"
            className="w-full pl-8 pr-4 py-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all min-h-[48px]"
            style={{ fontSize: '16px' }}
          />
        </div>
        <p className="text-xs text-gray-600 mt-2 italic">Examples: Rent (if renting), utilities, groceries, insurance, childcare, transportation</p>
      </div>

      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">
          Discretionary Monthly Expenses <span className="text-red-500">*</span>
        </label>
        <p className="text-xs text-gray-500 mb-2">Flexible spending you could reduce if needed</p>
        <div className="relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">$</span>
          <input
            type="text"
            value={data.discretionaryExpenses}
            onChange={(e) => handleCurrencyChange('discretionaryExpenses', e.target.value)}
            placeholder="Enter amount"
            className="w-full pl-8 pr-4 py-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all min-h-[48px]"
            style={{ fontSize: '16px' }}
          />
        </div>
        <p className="text-xs text-gray-600 mt-2 italic">Examples: Dining out, entertainment, subscriptions, hobbies, shopping, travel, luxury items</p>
      </div>

      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">
          Monthly Savings Goal
        </label>
        <p className="text-xs text-gray-500 mb-2">
          Set aside before debt payoff so your emergency fund / savings keep growing
        </p>
        <div className="relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">$</span>
          <input
            type="text"
            value={data.monthlySavingsGoal}
            onChange={(e) => handleCurrencyChange('monthlySavingsGoal', e.target.value)}
            placeholder="0"
            className="w-full pl-8 pr-4 py-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all min-h-[48px]"
            style={{ fontSize: '16px' }}
          />
        </div>
        <p className="text-xs text-gray-600 mt-2 italic">Optional. Leave blank if you'd rather throw 100% of your surplus at debt.</p>
      </div>

      {parseCurrency(data.essentialExpenses) > 0 && parseCurrency(data.discretionaryExpenses) >= 0 && (
        <div className="bg-gray-50 border-2 border-gray-300 rounded-lg p-4">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-semibold text-gray-700">Total Monthly Expenses:</span>
            <span className="text-lg font-bold text-gray-900">
              {CalculationService.formatCurrency(parseCurrency(data.essentialExpenses) + parseCurrency(data.discretionaryExpenses))}
            </span>
          </div>
          <div className="text-xs text-gray-600 space-y-1">
            <div className="flex justify-between">
              <span>Essential:</span>
              <span>{CalculationService.formatCurrency(parseCurrency(data.essentialExpenses))}</span>
            </div>
            <div className="flex justify-between">
              <span>Discretionary:</span>
              <span>{CalculationService.formatCurrency(parseCurrency(data.discretionaryExpenses))}</span>
            </div>
            {parseCurrency(data.monthlySavingsGoal) > 0 && (
              <div className="flex justify-between text-emerald-700">
                <span>Savings carve-out:</span>
                <span>{CalculationService.formatCurrency(parseCurrency(data.monthlySavingsGoal))}</span>
              </div>
            )}
          </div>
        </div>
      )}

      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">Address (optional)</label>
        <input
          type="text"
          value={data.address}
          onChange={(e) => setData({ ...data, address: e.target.value })}
          placeholder="123 Main St, City, State ZIP"
          className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all min-h-[48px]"
          style={{ fontSize: '16px' }}
        />
      </div>

      {parseCurrency(data.monthlyIncome) > 0 && parseCurrency(data.essentialExpenses) >= 0 && parseCurrency(data.discretionaryExpenses) >= 0 && (
        <div className="bg-gradient-to-br from-emerald-50 to-teal-50 border-2 border-emerald-300 rounded-lg p-4">
          <p className="text-sm font-semibold text-emerald-900 mb-1">Your Available Monthly Cash Flow</p>
          <p className="text-3xl font-bold text-emerald-700">
            {CalculationService.formatCurrency(getCashFlow())}
          </p>
          <p className="text-xs text-emerald-800 mt-2">
            Net Income - Essential Expenses - Discretionary Expenses{parseCurrency(data.monthlySavingsGoal) > 0 ? ' - Savings Goal' : ''}
          </p>
        </div>
      )}
    </div>
  );

  const getStep3HelperText = (): { text: string; className: string } => {
    const hasHELOC = data.hasHELOC === true;
    const debtCount = data.debts.filter(d =>
      d.name.trim() !== '' && parseCurrency(d.balance) > 0
    ).length;

    if (hasHELOC && debtCount > 0) {
      return { text: "Looking good! You can proceed when ready.", className: "text-emerald-600" };
    } else if (hasHELOC && debtCount === 0) {
      return { text: "You can proceed to explore HELOC features, or add debts to track", className: "text-emerald-600" };
    } else if (!hasHELOC && debtCount > 0) {
      return { text: "Looking good! You can proceed when ready.", className: "text-emerald-600" };
    } else {
      return { text: "Please add at least one debt or enable HELOC to continue", className: "text-red-600" };
    }
  };

  const renderStep3 = () => {
    const helperInfo = getStep3HelperText();

    return (
      <div className="space-y-6">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-full mb-4">
            <CreditCard className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">NOVO works for everyone</h1>
          <p className="text-gray-600">With or without a HELOC</p>
        </div>

      {/* Strategy Selection Section */}
      <div className="space-y-4 mb-8">
        <div className="text-center mb-6">
          <h3 className="text-xl font-bold text-gray-800 mb-2">Choose your debt elimination approach</h3>
          <p className="text-sm text-gray-600">Most users eliminate debt using cash flow strategies alone. HELOC is an advanced option for homeowners.</p>
        </div>

        <div className="space-y-4">
          {/* Cash Flow Strategies Card */}
          <button
            type="button"
            onClick={() => setData({ ...data, hasHELOC: false })}
            className={`w-full p-6 rounded-xl border-2 transition-all duration-200 text-left ${
              !data.hasHELOC
                ? 'bg-gradient-to-br from-emerald-50 to-green-50 border-emerald-500 shadow-lg'
                : 'bg-white border-gray-300 hover:border-emerald-300 hover:shadow-md'
            }`}
          >
            <div className="flex items-start space-x-4">
              <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center font-bold text-xl ${
                !data.hasHELOC ? 'bg-emerald-500 text-white' : 'bg-gray-200 text-gray-600'
              }`}>
                {!data.hasHELOC ? '●' : '○'}
              </div>
              <div className="flex-1">
                <h4 className="font-bold text-gray-900 mb-2 text-lg">Cash Flow Strategies</h4>
                <p className="text-sm text-gray-700 leading-relaxed mb-3">
                  I'll use my income and budget to eliminate debt (works for everyone)
                </p>
                <div className="inline-flex items-center space-x-1 bg-emerald-100 text-emerald-700 text-xs font-semibold px-3 py-1 rounded-full">
                  <CheckCircle className="w-3 h-3" />
                  <span>Recommended for most users</span>
                </div>
              </div>
            </div>
          </button>

          {/* Cash Flow + HELOC Card */}
          <button
            type="button"
            onClick={() => setData({ ...data, hasHELOC: true })}
            className={`w-full p-6 rounded-xl border-2 transition-all duration-200 text-left ${
              data.hasHELOC
                ? 'bg-gradient-to-br from-blue-50 to-cyan-50 border-blue-500 shadow-lg'
                : 'bg-white border-gray-300 hover:border-blue-300 hover:shadow-md'
            }`}
          >
            <div className="flex items-start space-x-4">
              <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center font-bold text-xl ${
                data.hasHELOC ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-600'
              }`}>
                {data.hasHELOC ? '●' : '○'}
              </div>
              <div className="flex-1">
                <h4 className="font-bold text-gray-900 mb-2 text-lg">Cash Flow + HELOC Strategies</h4>
                <p className="text-sm text-gray-700 leading-relaxed mb-3">
                  I'm a homeowner with a HELOC and want to explore velocity banking (advanced)
                </p>
                <div className="text-xs text-gray-600 font-medium">
                  Optional - for homeowners only
                </div>
              </div>
            </div>
          </button>
        </div>

        {/* Expandable Explanation */}
        <div className="border-t border-gray-200 pt-4">
          <button
            type="button"
            onClick={() => setShowStrategyExplanation(!showStrategyExplanation)}
            className="w-full flex items-center justify-center space-x-2 text-sm text-blue-600 hover:text-blue-700 font-semibold transition-colors"
          >
            <Info className="w-4 h-4" />
            <span>What's the difference between these options?</span>
            {showStrategyExplanation ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          {showStrategyExplanation && (
            <div className="mt-4 bg-gray-50 border border-gray-200 rounded-lg p-5 space-y-4 text-sm">
              <div>
                <h5 className="font-bold text-gray-900 mb-2">Cash Flow Strategies:</h5>
                <p className="text-gray-700 leading-relaxed">
                  Attack highest-interest debt first with extra payments from your budget. Works for everyone - renters and homeowners.
                </p>
              </div>

              <div>
                <h5 className="font-bold text-gray-900 mb-2">HELOC Strategies:</h5>
                <p className="text-gray-700 leading-relaxed">
                  Use home equity to pay off high-interest debt, then pay down HELOC aggressively. Advanced option for homeowners with equity and stable income.
                </p>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
                <p className="text-gray-800 font-medium">
                  <span className="font-bold">Not sure?</span> Start with Cash Flow Strategies - you can always enable HELOC features later in Settings.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* HELOC Input Fields */}
        {data.hasHELOC && (
          <div className="mt-6 space-y-4 bg-blue-50 border-2 border-blue-200 rounded-xl p-6">
            <h4 className="font-bold text-gray-800 text-lg mb-4">Enter Your HELOC Details</h4>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">HELOC Credit Limit</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                <input
                  type="text"
                  value={data.helocLimit}
                  onChange={(e) => handleCurrencyChange('helocLimit', e.target.value)}
                  placeholder="50,000"
                  className="w-full pl-7 pr-3 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">HELOC Interest Rate</label>
              <div className="relative">
                <input
                  type="text"
                  value={data.helocRate}
                  onChange={(e) => setData({ ...data, helocRate: e.target.value.replace(/[^0-9.]/g, '') })}
                  placeholder="6.5"
                  className="w-full pl-3 pr-10 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500">%</span>
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">HELOC Current Balance</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                <input
                  type="text"
                  value={data.helocBalance}
                  onChange={(e) => handleCurrencyChange('helocBalance', e.target.value)}
                  onFocus={(e) => {
                    if (e.target.value === '0') handleCurrencyChange('helocBalance', '');
                  }}
                  placeholder="Enter amount or leave blank"
                  className="w-full pl-7 pr-3 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">Leave blank if no current balance</p>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                HELOC Minimum Monthly Payment
                {parseCurrency(data.helocBalance) > 0 && <span className="text-red-500 ml-1">*</span>}
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                <input
                  type="text"
                  value={data.helocMinPayment}
                  onChange={(e) => handleCurrencyChange('helocMinPayment', e.target.value)}
                  onFocus={(e) => {
                    if (e.target.value === '0') handleCurrencyChange('helocMinPayment', '');
                  }}
                  placeholder="Enter amount or leave blank"
                  className="w-full pl-7 pr-3 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              {parseCurrency(data.helocBalance) > 0 && parseCurrency(data.helocMinPayment) === 0 && (
                <p className="text-xs text-red-600 mt-1">Required when current balance is greater than $0</p>
              )}
            </div>
          </div>
        )}

        <div className="space-y-4 pt-2">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Do you own additional properties?</label>
            <p className="text-xs text-gray-500 mb-3">Investment properties, rental properties, or second homes — in your personal name only. Do NOT include properties owned by an LLC or partnership.</p>
          </div>

          {(data.additionalProperties || []).map((prop, idx) => (
            <div key={prop.id} className="border-2 border-brand-navy/20 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-bold text-brand-navy">Property {idx + 1}</p>
                <button
                  type="button"
                  onClick={() => {
                    setData({
                      ...data,
                      additionalProperties: (data.additionalProperties || []).filter(p => p.id !== prop.id)
                    });
                  }}
                  className="text-xs text-red-400 hover:text-red-600 transition-colors"
                >
                  Remove
                </button>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Description</label>
                <input
                  type="text"
                  value={prop.description}
                  onChange={e => {
                    const updated = (data.additionalProperties || []).map(p =>
                      p.id === prop.id ? { ...p, description: e.target.value } : p
                    );
                    setData({ ...data, additionalProperties: updated });
                  }}
                  placeholder="e.g. Rental property — 123 Main St, Investment property"
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-orange/30 focus:border-brand-orange outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Mortgage Balance</label>
                  <div className="relative">
                    <span className="absolute left-3 top-2 text-gray-500 text-sm">$</span>
                    <input
                      type="text"
                      value={prop.mortgageBalance}
                      onChange={e => {
                        const updated = (data.additionalProperties || []).map(p =>
                          p.id === prop.id ? { ...p, mortgageBalance: e.target.value } : p
                        );
                        setData({ ...data, additionalProperties: updated });
                      }}
                      placeholder="0"
                      className="w-full pl-7 pr-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-orange/30 focus:border-brand-orange outline-none"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Monthly Payment</label>
                  <div className="relative">
                    <span className="absolute left-3 top-2 text-gray-500 text-sm">$</span>
                    <input
                      type="text"
                      value={prop.monthlyPayment}
                      onChange={e => {
                        const updated = (data.additionalProperties || []).map(p =>
                          p.id === prop.id ? { ...p, monthlyPayment: e.target.value } : p
                        );
                        setData({ ...data, additionalProperties: updated });
                      }}
                      placeholder="0"
                      className="w-full pl-7 pr-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-orange/30 focus:border-brand-orange outline-none"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Monthly Rental Income (if applicable)</label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-gray-500 text-sm">$</span>
                  <input
                    type="text"
                    value={prop.monthlyRentalIncome}
                    onChange={e => {
                      const updated = (data.additionalProperties || []).map(p =>
                        p.id === prop.id ? { ...p, monthlyRentalIncome: e.target.value } : p
                      );
                      setData({ ...data, additionalProperties: updated });
                    }}
                    placeholder="0"
                    className="w-full pl-7 pr-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-orange/30 focus:border-brand-orange outline-none"
                  />
                </div>
                {prop.monthlyRentalIncome && parseFloat(prop.monthlyRentalIncome.replace(/[^0-9.]/g, '')) > 0 && (
                  <div className="mt-2 bg-blue-50 border border-blue-200 rounded-lg p-2">
                    <p className="text-xs text-blue-800">
                      💡 Rental income of <strong>${parseFloat(prop.monthlyRentalIncome.replace(/[^0-9.]/g, '')).toLocaleString()}/month</strong> will be added to your income for cash flow calculations
                    </p>
                  </div>
                )}
              </div>
            </div>
          ))}

          {(data.additionalProperties || []).length < 5 && (
            <button
              type="button"
              onClick={() => {
                const newProp: AdditionalProperty = {
                  id: `prop_${Date.now()}`,
                  description: '',
                  mortgageBalance: '',
                  monthlyPayment: '',
                  monthlyRentalIncome: '',
                  hasHELOC: false,
                  helocBalance: '',
                  helocLimit: '',
                  helocRate: '',
                };
                setData({
                  ...data,
                  additionalProperties: [...(data.additionalProperties || []), newProp]
                });
              }}
              className="w-full border-2 border-dashed border-brand-navy/20 hover:border-brand-navy/40 rounded-xl p-4 text-sm font-medium text-brand-navy/60 hover:text-brand-navy transition-all"
            >
              + Add a property
            </button>
          )}
        </div>
      </div>

      {/* Debts Section */}
      <div className="border-t-2 border-gray-200 pt-6">
        <h3 className="text-lg font-bold text-gray-800 mb-4 text-center">Add Your Debts</h3>
        <p className={`text-sm font-semibold mb-4 text-center ${helperInfo.className}`}>
          {helperInfo.text}
        </p>
      </div>

      <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2">
        {data.debts.map((debt, index) => (
          <div key={debt.id} className="bg-gray-50 border-2 border-gray-200 rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-bold text-gray-700">Debt {index + 1}</span>
              {data.debts.length > 1 && (
                <button
                  onClick={() => removeDebt(debt.id)}
                  className="text-red-600 hover:text-red-700 p-1"
                  type="button"
                >
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Debt Type</label>
              <select
                value={debt.type}
                onChange={(e) => handleDebtChange(debt.id, 'type', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              >
                <option value="Credit Card">Credit Card</option>
                <option value="Personal Loan">Personal Loan</option>
                <option value="Auto Loan">Auto Loan</option>
                <option value="Student Loan">Student Loan</option>
                <option value="Mortgage">Mortgage</option>
                <option value="Other">Other</option>
              </select>
            </div>

            {debt.type === 'Mortgage' && (
              <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-3">
                <div className="flex items-start gap-2">
                  <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                  <div className="text-xs text-blue-900">
                    <p className="font-bold mb-1">Important: Enter P&I Payment Only</p>
                    <p className="mb-1">Your mortgage payment should include only Principal & Interest.</p>
                    <p className="mb-1">If you're unsure, check your loan statement for the "P&I" or "Principal & Interest" line.</p>
                    <p className="font-semibold">Property taxes, homeowners insurance, and PMI should be entered in your Monthly Expenses (from the previous step).</p>
                  </div>
                </div>
              </div>
            )}

            <input
              type="text"
              value={debt.name}
              onChange={(e) => handleDebtChange(debt.id, 'name', e.target.value)}
              placeholder="Debt name (e.g., Visa, Student Loan)"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            />

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Current Balance</label>
                <div className="relative">
                  <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-500 text-sm">$</span>
                  <input
                    type="text"
                    value={debt.balance}
                    onChange={(e) => handleDebtChange(debt.id, 'balance', e.target.value)}
                    placeholder="5,000"
                    className="w-full pl-6 pr-2 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Interest Rate</label>
                <div className="relative">
                  <input
                    type="number"
                    value={debt.interestRate}
                    onChange={(e) => handleDebtChange(debt.id, 'interestRate', e.target.value)}
                    placeholder={debt.type === 'Mortgage' ? '6.625' : '18.50'}
                    step={debt.type === 'Mortgage' ? '0.001' : '0.01'}
                    min="0"
                    className="w-full pl-2 pr-6 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  />
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 text-sm">%</span>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">
                {debt.type === 'Mortgage' ? 'Monthly Payment (P&I Only)' : 'Minimum Monthly Payment'}
              </label>
              <div className="relative">
                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-500 text-sm">$</span>
                <input
                  type="text"
                  value={debt.minPayment}
                  onChange={(e) => handleDebtChange(debt.id, 'minPayment', e.target.value)}
                  placeholder="150"
                  className="w-full pl-6 pr-2 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                />
              </div>
              {debt.type === 'Mortgage' && (
                <p className="text-xs text-gray-600 mt-1">Enter Principal & Interest only. Exclude property taxes, insurance, and escrow.</p>
              )}
            </div>

            {debt.type === 'Mortgage' && (
              <div className="mt-4 pt-4 border-t-2 border-emerald-200 space-y-3">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                  <p className="text-xs font-bold text-emerald-700">Mortgage-Specific Information</p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Original Loan Amount</label>
                    <div className="relative">
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-500 text-sm">$</span>
                      <input
                        type="text"
                        value={debt.originalAmount || ''}
                        onChange={(e) => handleDebtChange(debt.id, 'originalAmount', e.target.value)}
                        placeholder="250,000"
                        className="w-full pl-6 pr-2 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Loan Start Date</label>
                    <input
                      type="text"
                      value={debt.loanStartDate || ''}
                      onChange={(e) => handleDebtChange(debt.id, 'loanStartDate', e.target.value)}
                      placeholder="MM/YYYY"
                      maxLength={7}
                      className="w-full px-2 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Loan Term (Years) <span className="text-red-500">*</span></label>
                  <select
                    value={debt.loanTerm || '30'}
                    onChange={(e) => handleDebtChange(debt.id, 'loanTerm', e.target.value)}
                    className="w-full px-2 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  >
                    <option value="10">10 years</option>
                    <option value="15">15 years</option>
                    <option value="20">20 years</option>
                    <option value="25">25 years</option>
                    <option value="30">30 years</option>
                  </select>
                </div>

                <p className="text-xs text-gray-500 italic">This enables accurate principal/interest tracking</p>
              </div>
            )}
          </div>
        ))}
      </div>

      <button
        onClick={addDebt}
        className="w-full flex items-center justify-center space-x-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold py-3 px-4 rounded-lg transition-colors border-2 border-dashed border-gray-300"
        type="button"
      >
        <Plus className="w-5 h-5" />
        <span>Add Another Debt</span>
      </button>
      </div>
    );
  };

  const renderStep4 = () => {
    const totalDebt = getTotalDebt();
    const cashFlow = getCashFlow();
    const estimatedMonths = getEstimatedMonths();
    const validDebts = data.debts.filter(d => d.name.trim() && parseCurrency(d.balance) > 0);

    return (
      <div className="space-y-6">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-full mb-4">
            <CheckCircle className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">You're all set, {data.userName}!</h1>
          <p className="text-gray-600">Here's your debt freedom summary</p>
        </div>

        <div className="bg-gradient-to-br from-gray-50 to-gray-100 border-2 border-gray-200 rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between py-2 border-b border-gray-300">
            <span className="text-gray-700 font-semibold">Total Debt:</span>
            <span className="text-2xl font-bold text-gray-900">{CalculationService.formatCurrency(totalDebt)}</span>
          </div>

          <div className="flex items-center justify-between py-2 border-b border-gray-300">
            <span className="text-gray-700 font-semibold">Monthly Cash Flow:</span>
            <span className="text-2xl font-bold text-emerald-700">{CalculationService.formatCurrency(cashFlow)}</span>
          </div>

          <div className="flex items-center justify-between py-2 border-b border-gray-300">
            <span className="text-gray-700 font-semibold">Number of Debts:</span>
            <span className="text-2xl font-bold text-gray-900">{validDebts.length}</span>
          </div>

          <div className="flex items-center justify-between py-2">
            <span className="text-gray-700 font-semibold">HELOC Available:</span>
            <span className="text-xl font-bold text-gray-900">{data.hasHELOC ? 'Yes' : 'No'}</span>
          </div>
        </div>

        {estimatedMonths > 0 && cashFlow > 0 && (
          <div className="bg-gradient-to-br from-emerald-500 to-teal-600 text-white rounded-xl p-6 text-center">
            <p className="text-lg mb-2">Based on your cash flow, you could be debt-free in approximately</p>
            <p className="text-5xl font-bold mb-2">{estimatedMonths}</p>
            <p className="text-2xl font-semibold">
              {estimatedMonths === 1 ? 'month' : 'months'}
            </p>
            <p className="text-sm mt-3 opacity-90">That's {Math.floor(estimatedMonths / 12)} years and {estimatedMonths % 12} months!</p>
          </div>
        )}

        {cashFlow <= 0 && (
          <div className="bg-yellow-50 border-2 border-yellow-300 rounded-lg p-4">
            <p className="text-yellow-800 font-semibold">
              Note: Your expenses exceed your income. Consider reviewing your budget to free up cash flow for debt payments.
            </p>
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-gray-900/50 backdrop-blur-sm" />

        <div className="relative bg-white rounded-2xl shadow-2xl max-w-2xl w-full my-8 animate-in fade-in zoom-in duration-300 flex flex-col max-h-[90vh]">
          <div className="p-8 pb-4">
            {renderProgressBar()}

            {isResuming && (
              <div className="mb-4 bg-blue-50 border-2 border-blue-300 rounded-lg p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <p className="text-blue-900 font-semibold">Welcome back! Let's pick up where you left off.</p>
                  </div>
                  <button
                    onClick={handleStartOver}
                    className="text-sm text-blue-700 hover:text-blue-800 font-semibold underline whitespace-nowrap"
                  >
                    Start Over
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="flex-1 overflow-y-auto px-8 pb-6" style={{ WebkitOverflowScrolling: 'touch' }}>
            {step === 1 && renderStep1()}
            {step === 2 && renderStep2()}
            {step === 3 && renderStep3()}
            {step === 4 && renderStep4()}
          </div>

          <div className="border-t border-gray-200 bg-white rounded-b-2xl">
            <div className="flex items-center justify-between space-x-4 p-8 pt-4">
              {step > 1 && (
                <button
                  onClick={handleBack}
                  className="flex items-center space-x-2 px-6 py-3 bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold rounded-lg transition-colors min-h-[48px]"
                >
                  <ChevronLeft className="w-5 h-5" />
                  <span>Back</span>
                </button>
              )}

              <button
                onClick={handleNext}
                disabled={!canProceed()}
                className={`flex-1 bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-semibold py-3 px-6 rounded-lg hover:from-emerald-600 hover:to-teal-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl transform hover:scale-[1.02] active:scale-[0.98] min-h-[48px] ${
                  step === 1 ? 'w-full' : ''
                }`}
              >
                {step === 4 ? 'Start My Journey' : 'Next'}
              </button>
            </div>

            {step === 1 && (
              <div className="px-8 pb-8 pt-1 space-y-3">
                <input
                  ref={restoreBackupInputRef}
                  type="file"
                  accept="application/json,.json"
                  className="hidden"
                  aria-hidden
                  onChange={handleRestoreBackupFile}
                />
                <div className="flex items-center gap-3 py-1">
                  <div className="flex-1 h-px bg-gray-200" />
                  <span className="text-[11px] font-medium text-gray-400 uppercase tracking-wider">or</span>
                  <div className="flex-1 h-px bg-gray-200" />
                </div>
                <button
                  type="button"
                  onClick={handleRestoreBackupClick}
                  className="w-full py-3 px-4 rounded-lg border-2 border-gray-300 bg-white text-gray-700 font-semibold text-sm hover:bg-gray-50 hover:border-gray-400 transition-colors min-h-[48px]"
                >
                  Restore from Backup File
                </button>
                <p className="text-center text-xs text-gray-500 leading-relaxed px-1">
                  Have a backup file? Skip setup and restore your data instantly.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {showCashFlowWarning && (
        <CashFlowWarningModal
          cashFlow={getCashFlow()}
          onContinue={handleCashFlowContinue}
          onReviewExpenses={handleCashFlowReview}
          onContactCoach={handleCashFlowContactCoach}
        />
      )}

      <LearnHELOCModal
        isOpen={showLearnHELOCModal}
        onClose={() => setShowLearnHELOCModal(false)}
        showEnableButton={false}
      />
    </>
  );
}
