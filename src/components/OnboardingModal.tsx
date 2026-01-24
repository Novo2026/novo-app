import { useState } from 'react';
import { DollarSign, CreditCard, CheckCircle, ChevronLeft, Plus, X, Info } from 'lucide-react';
import { CalculationService } from '../services/calculations';

interface DebtInput {
  id: string;
  name: string;
  type: string;
  balance: string;
  interestRate: string;
  minPayment: string;
  originalAmount?: string;
  loanStartDate?: string;
}

interface OnboardingData {
  userName: string;
  grossIncome: string;
  monthlyIncome: string;
  monthlyExpenses: string;
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
  const [data, setData] = useState<OnboardingData>({
    userName: '',
    grossIncome: '',
    monthlyIncome: '',
    monthlyExpenses: '',
    address: '',
    debts: [{ id: '1', name: '', type: 'Credit Card', balance: '', interestRate: '', minPayment: '' }],
    hasHELOC: false,
    helocLimit: '',
    helocRate: '',
    helocBalance: '',
    helocMinPayment: '',
  });

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
    const expenses = parseCurrency(data.monthlyExpenses);
    return Math.max(0, income - expenses);
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
        return parseCurrency(data.grossIncome) > 0 && parseCurrency(data.monthlyIncome) > 0 && parseCurrency(data.monthlyExpenses) >= 0;
      case 3:
        const hasValidDebts = data.debts.some(d => {
          const basicValid = d.name.trim() !== '' &&
            parseCurrency(d.balance) > 0 &&
            parseFloat(d.interestRate) >= 0 &&
            parseCurrency(d.minPayment) > 0;

          if (d.type === 'Mortgage') {
            return basicValid &&
              parseCurrency(d.originalAmount || '0') > 0 &&
              (d.loanStartDate || '').match(/^\d{2}\/\d{4}$/) !== null;
          }

          return basicValid;
        });
        if (data.hasHELOC) {
          const helocBalance = parseCurrency(data.helocBalance);
          const helocMinPayment = parseCurrency(data.helocMinPayment);
          const helocValid =
            parseCurrency(data.helocLimit) > 0 &&
            parseFloat(data.helocRate) >= 0 &&
            (helocBalance === 0 || helocMinPayment > 0);
          return hasValidDebts && helocValid;
        }
        return hasValidDebts;
      default:
        return true;
    }
  };

  const handleNext = () => {
    if (canProceed()) {
      if (step === 4) {
        onComplete(data);
      } else {
        setStep(step + 1);
      }
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
    }
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

  const renderStep1 = () => (
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
        <p className="text-lg text-gray-600">Let's start your debt freedom journey. What should I call you?</p>
      </div>

      <input
        type="text"
        value={data.userName}
        onChange={(e) => setData({ ...data, userName: e.target.value })}
        placeholder="Enter your name"
        className="w-full px-4 py-3 text-lg border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
        autoFocus
        maxLength={50}
      />
    </div>
  );

  const renderStep2 = () => (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-full mb-4">
          <DollarSign className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Hi {data.userName}, let's get your financial snapshot</h1>
        <p className="text-gray-600">This helps us calculate your available cash flow</p>
      </div>

      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">
          Gross Monthly Income <span className="text-red-500">*</span>
        </label>
        <p className="text-xs text-gray-500 mb-2">Your total income before taxes and deductions</p>
        <div className="relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 text-lg">$</span>
          <input
            type="text"
            value={data.grossIncome}
            onChange={(e) => handleCurrencyChange('grossIncome', e.target.value)}
            placeholder="7,000"
            className="w-full pl-8 pr-4 py-3 text-lg border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">
          Net Monthly Income <span className="text-red-500">*</span>
        </label>
        <p className="text-xs text-gray-500 mb-2">Your take-home pay after taxes and deductions</p>
        <div className="relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 text-lg">$</span>
          <input
            type="text"
            value={data.monthlyIncome}
            onChange={(e) => handleCurrencyChange('monthlyIncome', e.target.value)}
            placeholder="5,000"
            className="w-full pl-8 pr-4 py-3 text-lg border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">
          Monthly Expenses <span className="text-red-500">*</span>
        </label>
        <p className="text-xs text-gray-500 mb-2">Housing, utilities, food, transportation, etc. (excluding debt payments)</p>
        <div className="relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 text-lg">$</span>
          <input
            type="text"
            value={data.monthlyExpenses}
            onChange={(e) => handleCurrencyChange('monthlyExpenses', e.target.value)}
            placeholder="3,000"
            className="w-full pl-8 pr-4 py-3 text-lg border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">Address (optional)</label>
        <input
          type="text"
          value={data.address}
          onChange={(e) => setData({ ...data, address: e.target.value })}
          placeholder="123 Main St, City, State ZIP"
          className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
        />
      </div>

      {parseCurrency(data.monthlyIncome) > 0 && (
        <div className="bg-gradient-to-br from-emerald-50 to-teal-50 border-2 border-emerald-300 rounded-lg p-4">
          <p className="text-sm font-semibold text-emerald-900 mb-1">Available Monthly Cash Flow</p>
          <p className="text-3xl font-bold text-emerald-700">
            {CalculationService.formatCurrency(getCashFlow())}
          </p>
        </div>
      )}
    </div>
  );

  const renderStep3 = () => (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-full mb-4">
          <CreditCard className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Now let's add your debts</h1>
        <p className="text-gray-600">Add at least one debt to continue</p>
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
                    type="text"
                    value={debt.interestRate}
                    onChange={(e) => handleDebtChange(debt.id, 'interestRate', e.target.value.replace(/[^0-9.]/g, ''))}
                    placeholder="18.5"
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

      <div className="pt-4 border-t-2 border-gray-200">
        <label className="flex items-center space-x-3 cursor-pointer">
          <input
            type="checkbox"
            checked={data.hasHELOC}
            onChange={(e) => setData({ ...data, hasHELOC: e.target.checked })}
            className="w-5 h-5 text-emerald-600 border-gray-300 rounded focus:ring-emerald-500"
          />
          <span className="font-semibold text-gray-700">I have a HELOC available</span>
        </label>

        {data.hasHELOC && (
          <div className="mt-4 space-y-3 bg-blue-50 border-2 border-blue-200 rounded-lg p-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">HELOC Credit Limit</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                <input
                  type="text"
                  value={data.helocLimit}
                  onChange={(e) => handleCurrencyChange('helocLimit', e.target.value)}
                  placeholder="50,000"
                  className="w-full pl-7 pr-3 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
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
                  className="w-full pl-3 pr-8 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
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
                  className="w-full pl-7 pr-3 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
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
                  className="w-full pl-7 pr-3 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                />
              </div>
              {parseCurrency(data.helocBalance) > 0 && parseCurrency(data.helocMinPayment) === 0 && (
                <p className="text-xs text-red-600 mt-1">Required when current balance is greater than $0</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="absolute inset-0 bg-gray-900/50 backdrop-blur-sm" />

      <div className="relative bg-white rounded-2xl shadow-2xl max-w-2xl w-full p-8 my-8 animate-in fade-in zoom-in duration-300">
        {renderProgressBar()}

        <div className="mb-8">
          {step === 1 && renderStep1()}
          {step === 2 && renderStep2()}
          {step === 3 && renderStep3()}
          {step === 4 && renderStep4()}
        </div>

        <div className="flex items-center justify-between space-x-4">
          {step > 1 && (
            <button
              onClick={handleBack}
              className="flex items-center space-x-2 px-6 py-3 bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold rounded-lg transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
              <span>Back</span>
            </button>
          )}

          <button
            onClick={handleNext}
            disabled={!canProceed()}
            className={`flex-1 bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-semibold py-3 px-6 rounded-lg hover:from-emerald-600 hover:to-teal-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl transform hover:scale-[1.02] active:scale-[0.98] ${
              step === 1 ? 'w-full' : ''
            }`}
          >
            {step === 4 ? 'Start My Journey' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  );
}
