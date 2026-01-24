import { useState } from 'react';
import { ArrowLeft, ArrowRight, Calculator, AlertTriangle } from 'lucide-react';
import { StorageService } from '../services/storage';
import { CalculationService } from '../services/calculations';
import type { FinancialProfile, HomeEquity, StrategyResult } from '../types';

interface StrategyWizardProps {
  onComplete: (result: StrategyResult) => void;
  onCancel: () => void;
}

export default function StrategyWizard({ onComplete, onCancel }: StrategyWizardProps) {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  const existingProfile = StorageService.getFinancialProfile();
  const [profile, setProfile] = useState<FinancialProfile>(
    existingProfile || {
      monthlyGrossIncome: 0,
      monthlyNetIncome: 0,
      monthlyEssentialExpenses: 0,
      monthlyDiscretionaryExpenses: 0,
    }
  );

  const existingHomeEquity = StorageService.getHomeEquity();
  const [homeEquity, setHomeEquity] = useState<HomeEquity>(
    existingHomeEquity || {
      ownsHome: false,
      homeValue: 0,
      mortgageBalance: 0,
      hasHELOC: false,
      helocLimit: 0,
      helocBalance: 0,
      helocRate: 0,
    }
  );

  const [extraPayment, setExtraPayment] = useState('');
  const [selectedStrategy, setSelectedStrategy] = useState<'extra-payment' | 'heloc-velocity' | null>(null);

  const debts = StorageService.getDebts().filter(d => !d.isPaidOff);
  const totalMinimumPayments = debts.reduce((sum, d) => sum + d.minimumPayment, 0);

  const cashFlowMetrics = CalculationService.calculateCashFlow(
    profile.monthlyNetIncome,
    profile.monthlyEssentialExpenses,
    profile.monthlyDiscretionaryExpenses,
    totalMinimumPayments
  );

  const homeEquityMetrics = homeEquity.ownsHome && homeEquity.homeValue && homeEquity.mortgageBalance !== undefined
    ? CalculationService.calculateHomeEquityMetrics(
        homeEquity.homeValue,
        homeEquity.mortgageBalance
      )
    : { totalEquity: 0, availableHELOC: 0 };

  const availableHELOCCredit = homeEquity.hasHELOC && homeEquity.helocLimit && homeEquity.helocBalance !== undefined
    ? homeEquity.helocLimit - homeEquity.helocBalance
    : homeEquityMetrics.availableHELOC;

  const helocRate = homeEquity.hasHELOC && homeEquity.helocRate ? homeEquity.helocRate : 8.5;

  const debtAnalysis = debts.map(debt => {
    const rateDiff = debt.interestRate - helocRate;
    let suitability: 'good' | 'marginal' | 'bad';

    if (rateDiff > 0.5) {
      suitability = 'good';
    } else if (rateDiff >= -0.5 && rateDiff <= 0.5) {
      suitability = 'marginal';
    } else {
      suitability = 'bad';
    }

    return {
      debt,
      rateDiff,
      suitability,
    };
  });

  const goodDebts = debtAnalysis.filter(d => d.suitability === 'good');
  const badDebts = debtAnalysis.filter(d => d.suitability === 'bad');
  const helocMakesSense = goodDebts.length > 0;

  const showHELOCStrategy = homeEquity.ownsHome && availableHELOCCredit > 5000;

  const handleNext = () => {
    if (step === 1) {
      StorageService.saveFinancialProfile(profile);
      setExtraPayment(Math.floor(cashFlowMetrics.recommendedExtraPayment).toString());
    } else if (step === 2) {
      StorageService.saveHomeEquity(homeEquity);
    }
    setStep(step + 1);
  };

  const handleCalculate = () => {
    setLoading(true);

    setTimeout(() => {
      const extra = parseFloat(extraPayment) || 0;
      const result = CalculationService.projectDebtPayoff(debts, extra);
      onComplete(result);
      setLoading(false);
    }, 500);
  };

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-gray-800">Payment Strategy Wizard</h2>
          <button onClick={onCancel} className="text-gray-500 hover:text-gray-700">
            Cancel
          </button>
        </div>

        <div className="flex items-center space-x-2">
          {[1, 2, 3].map(i => (
            <div key={i} className="flex items-center flex-1">
              <div
                className={`flex-1 h-2 rounded-full ${
                  i <= step ? 'bg-[#2D9CDB]' : 'bg-gray-200'
                }`}
              />
            </div>
          ))}
        </div>
        <div className="flex justify-between mt-2 text-sm">
          <span className={step === 1 ? 'text-[#2D9CDB] font-semibold' : 'text-gray-500'}>
            Financial Profile
          </span>
          <span className={step === 2 ? 'text-[#2D9CDB] font-semibold' : 'text-gray-500'}>
            Home Equity
          </span>
          <span className={step === 3 ? 'text-[#2D9CDB] font-semibold' : 'text-gray-500'}>
            Choose Strategy
          </span>
        </div>
      </div>

      {step === 1 && (
        <div className="bg-white rounded-lg shadow-md p-6 space-y-6">
          <div>
            <h3 className="text-xl font-bold text-gray-800 mb-4">Step 1: Financial Profile</h3>
            <p className="text-gray-600 mb-6">
              {existingProfile
                ? "Review and update your income and expenses if needed. These values are from your profile."
                : "Tell us about your monthly income and expenses to calculate available cash flow."}
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Monthly Gross Income
              </label>
              <p className="text-xs text-gray-500 mb-2">Total income before taxes</p>
              <div className="relative">
                <span className="absolute left-3 top-2 text-gray-500">$</span>
                <input
                  type="number"
                  value={profile.monthlyGrossIncome || ''}
                  onChange={(e) =>
                    setProfile({ ...profile, monthlyGrossIncome: parseFloat(e.target.value) || 0 })
                  }
                  onFocus={(e) => {
                    if (e.target.value === '0') e.target.value = '';
                  }}
                  className="w-full pl-8 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2D9CDB] focus:border-transparent"
                  placeholder="Enter amount"
                  step="0.01"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Monthly Net Income (After Taxes)
              </label>
              <p className="text-xs text-gray-500 mb-2">Take-home pay after taxes</p>
              <div className="relative">
                <span className="absolute left-3 top-2 text-gray-500">$</span>
                <input
                  type="number"
                  value={profile.monthlyNetIncome || ''}
                  onChange={(e) =>
                    setProfile({ ...profile, monthlyNetIncome: parseFloat(e.target.value) || 0 })
                  }
                  onFocus={(e) => {
                    if (e.target.value === '0') e.target.value = '';
                  }}
                  className="w-full pl-8 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2D9CDB] focus:border-transparent"
                  placeholder="Enter amount"
                  step="0.01"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Monthly Essential Expenses
              </label>
              <p className="text-xs text-gray-500 mb-2">
                Rent/mortgage, utilities, groceries, insurance, transportation
              </p>
              <div className="relative">
                <span className="absolute left-3 top-2 text-gray-500">$</span>
                <input
                  type="number"
                  value={profile.monthlyEssentialExpenses || ''}
                  onChange={(e) =>
                    setProfile({
                      ...profile,
                      monthlyEssentialExpenses: parseFloat(e.target.value) || 0,
                    })
                  }
                  onFocus={(e) => {
                    if (e.target.value === '0') e.target.value = '';
                  }}
                  className="w-full pl-8 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2D9CDB] focus:border-transparent"
                  placeholder="Enter amount"
                  step="0.01"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Monthly Discretionary Expenses
              </label>
              <p className="text-xs text-gray-500 mb-2">
                Entertainment, dining out, shopping, subscriptions
              </p>
              <div className="relative">
                <span className="absolute left-3 top-2 text-gray-500">$</span>
                <input
                  type="number"
                  value={profile.monthlyDiscretionaryExpenses || ''}
                  onChange={(e) =>
                    setProfile({
                      ...profile,
                      monthlyDiscretionaryExpenses: parseFloat(e.target.value) || 0,
                    })
                  }
                  onFocus={(e) => {
                    if (e.target.value === '0') e.target.value = '';
                  }}
                  className="w-full pl-8 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2D9CDB] focus:border-transparent"
                  placeholder="Enter amount"
                  step="0.01"
                />
              </div>
            </div>
          </div>

          {profile.monthlyNetIncome > 0 && (
            <div className="bg-[#2D9CDB]/10 rounded-lg p-4 space-y-2 border border-[#2D9CDB]">
              <div className="flex justify-between text-sm">
                <span className="text-gray-700">Total Monthly Expenses:</span>
                <span className="font-semibold">
                  {CalculationService.formatCurrency(cashFlowMetrics.totalExpenses)}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-700">Total Minimum Debt Payments:</span>
                <span className="font-semibold">
                  {CalculationService.formatCurrency(totalMinimumPayments)}
                </span>
              </div>
              <div className="flex justify-between font-bold text-base pt-2 border-t border-[#2D9CDB]">
                <span className="text-gray-800">Available Cash Flow:</span>
                <span className="text-[#27AE60]">
                  {CalculationService.formatCurrency(cashFlowMetrics.availableCashFlow)}
                </span>
              </div>
              <div className="flex justify-between text-sm pt-2">
                <span className="text-gray-700">Recommended Extra Payment (80%):</span>
                <span className="font-semibold text-[#2D9CDB]">
                  {CalculationService.formatCurrency(cashFlowMetrics.recommendedExtraPayment)}
                </span>
              </div>
            </div>
          )}

          <div className="flex space-x-3 pt-4">
            <button
              onClick={onCancel}
              className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold py-3 px-4 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleNext}
              disabled={profile.monthlyNetIncome <= 0}
              className="flex-1 bg-[#FF6B35] hover:bg-[#E55A25] disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-semibold py-3 px-4 rounded-lg transition-colors inline-flex items-center justify-center space-x-2"
            >
              <span>Next</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="bg-white rounded-lg shadow-md p-6 space-y-6">
          <div>
            <h3 className="text-xl font-bold text-gray-800 mb-4">Step 2: Home Equity Information (Optional)</h3>
            <p className="text-gray-600 mb-6">
              If you own a home, your equity could unlock powerful debt payoff strategies.
            </p>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-3">
              Do you own a home?
            </label>
            <div className="flex space-x-4">
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="radio"
                  name="ownsHome"
                  checked={homeEquity.ownsHome === true}
                  onChange={() => setHomeEquity({ ...homeEquity, ownsHome: true })}
                  className="w-4 h-4 text-[#2D9CDB] focus:ring-2 focus:ring-[#2D9CDB]"
                />
                <span className="text-sm text-gray-700">Yes</span>
              </label>
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="radio"
                  name="ownsHome"
                  checked={homeEquity.ownsHome === false}
                  onChange={() => setHomeEquity({ ...homeEquity, ownsHome: false })}
                  className="w-4 h-4 text-[#2D9CDB] focus:ring-2 focus:ring-[#2D9CDB]"
                />
                <span className="text-sm text-gray-700">No</span>
              </label>
            </div>
          </div>

          {homeEquity.ownsHome && (
            <div className="space-y-4 pl-6 border-l-4 border-[#2D9CDB]">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Current Home Value
                </label>
                <p className="text-xs text-gray-500 mb-2">Estimated current market value</p>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-gray-500">$</span>
                  <input
                    type="number"
                    value={homeEquity.homeValue || ''}
                    onChange={(e) => {
                      const value = e.target.value === '' ? 0 : parseFloat(e.target.value);
                      setHomeEquity({
                        ...homeEquity,
                        homeValue: isNaN(value) ? 0 : Math.max(0, value),
                      });
                    }}
                    onFocus={(e) => {
                      if (e.target.value === '0') e.target.value = '';
                    }}
                    className="w-full pl-8 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2D9CDB] focus:border-transparent"
                    placeholder="Enter amount"
                    step="1000"
                    min="0"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Current Mortgage Balance
                </label>
                <p className="text-xs text-gray-500 mb-2">Total amount owed on mortgage (leave blank if paid off)</p>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-gray-500">$</span>
                  <input
                    type="number"
                    value={homeEquity.mortgageBalance || ''}
                    onChange={(e) => {
                      const value = e.target.value === '' ? 0 : parseFloat(e.target.value);
                      setHomeEquity({
                        ...homeEquity,
                        mortgageBalance: isNaN(value) ? 0 : Math.max(0, value),
                      });
                    }}
                    onFocus={(e) => {
                      if (e.target.value === '0') e.target.value = '';
                    }}
                    className="w-full pl-8 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2D9CDB] focus:border-transparent"
                    placeholder="Enter amount"
                    step="1000"
                    min="0"
                  />
                </div>
              </div>

              {homeEquity.homeValue && homeEquity.mortgageBalance !== undefined && (
                <div className="bg-[#27AE60]/10 border border-[#27AE60] rounded-lg p-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-700">Total Equity:</span>
                    <span className="font-semibold">
                      {CalculationService.formatCurrency(homeEquityMetrics.totalEquity)}
                    </span>
                  </div>
                  <div className="flex justify-between font-bold text-base pt-2 border-t border-[#27AE60]">
                    <span className="text-gray-800">Available for HELOC (90% CLTV):</span>
                    <span className="text-[#27AE60]">
                      {CalculationService.formatCurrency(homeEquityMetrics.availableHELOC)}
                    </span>
                  </div>
                </div>
              )}

              <div className="pt-4">
                <label className="block text-sm font-semibold text-gray-700 mb-3">
                  Do you currently have a HELOC?
                </label>
                <div className="flex space-x-4">
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="radio"
                      name="hasHELOC"
                      checked={homeEquity.hasHELOC === true}
                      onChange={() => setHomeEquity({ ...homeEquity, hasHELOC: true })}
                      className="w-4 h-4 text-[#2D9CDB] focus:ring-2 focus:ring-[#2D9CDB]"
                    />
                    <span className="text-sm text-gray-700">Yes</span>
                  </label>
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="radio"
                      name="hasHELOC"
                      checked={homeEquity.hasHELOC === false}
                      onChange={() => setHomeEquity({ ...homeEquity, hasHELOC: false })}
                      className="w-4 h-4 text-[#2D9CDB] focus:ring-2 focus:ring-[#2D9CDB]"
                    />
                    <span className="text-sm text-gray-700">No</span>
                  </label>
                </div>
              </div>

              {homeEquity.hasHELOC && (
                <div className="space-y-4 pl-6 border-l-4 border-[#F2C94C]">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      HELOC Credit Limit
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-2 text-gray-500">$</span>
                      <input
                        type="number"
                        value={homeEquity.helocLimit || ''}
                        onChange={(e) => {
                          const value = e.target.value === '' ? 0 : parseFloat(e.target.value);
                          setHomeEquity({
                            ...homeEquity,
                            helocLimit: isNaN(value) ? 0 : Math.max(0, value),
                          });
                        }}
                        onFocus={(e) => {
                          if (e.target.value === '0') e.target.value = '';
                        }}
                        className="w-full pl-8 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2D9CDB] focus:border-transparent"
                        placeholder="Enter amount"
                        step="1000"
                        min="0"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Current HELOC Balance
                    </label>
                    <p className="text-xs text-gray-500 mb-2">Leave blank if you haven't drawn from it yet</p>
                    <div className="relative">
                      <span className="absolute left-3 top-2 text-gray-500">$</span>
                      <input
                        type="number"
                        value={homeEquity.helocBalance || ''}
                        onChange={(e) => {
                          const value = e.target.value === '' ? 0 : parseFloat(e.target.value);
                          setHomeEquity({
                            ...homeEquity,
                            helocBalance: isNaN(value) ? 0 : Math.max(0, value),
                          });
                        }}
                        onFocus={(e) => {
                          if (e.target.value === '0') e.target.value = '';
                        }}
                        className="w-full pl-8 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2D9CDB] focus:border-transparent"
                        placeholder="Enter amount"
                        step="1000"
                        min="0"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      HELOC Interest Rate
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        value={homeEquity.helocRate || ''}
                        onChange={(e) => {
                          const value = e.target.value === '' ? 0 : parseFloat(e.target.value);
                          setHomeEquity({
                            ...homeEquity,
                            helocRate: isNaN(value) ? 0 : Math.max(0, Math.min(30, value)),
                          });
                        }}
                        onFocus={(e) => {
                          if (e.target.value === '0') e.target.value = '';
                        }}
                        className="w-full pr-8 pl-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2D9CDB] focus:border-transparent"
                        placeholder="8.25"
                        step="0.01"
                        min="0"
                        max="30"
                      />
                      <span className="absolute right-3 top-2 text-gray-500">%</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="flex space-x-3 pt-4">
            <button
              onClick={() => setStep(1)}
              className="flex items-center space-x-2 bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold py-3 px-6 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back</span>
            </button>
            <button
              onClick={handleNext}
              className="flex-1 bg-[#FF6B35] hover:bg-[#E55A25] text-white font-semibold py-3 px-4 rounded-lg transition-colors inline-flex items-center justify-center space-x-2"
            >
              <span>Next: Choose Strategy</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="bg-white rounded-lg shadow-md p-6 space-y-6">
          <div>
            <h3 className="text-xl font-bold text-gray-800 mb-4">Step 3: Choose Your Strategy</h3>
            <p className="text-gray-600 mb-6">
              Select the debt payoff strategy that works best for you.
            </p>
          </div>

          <div
            className={`bg-gradient-to-br from-[#1E3A5F] to-[#2D5A8A] text-white rounded-lg p-6 border-4 transition-all cursor-pointer ${
              selectedStrategy === 'extra-payment' ? 'border-[#27AE60] shadow-lg' : 'border-transparent'
            }`}
            onClick={() => setSelectedStrategy('extra-payment')}
          >
            <h4 className="font-bold text-lg mb-3">Standard Extra Payment</h4>
            <p className="text-sm mb-4 opacity-90">
              Make consistent extra payments each month. System automatically applies payments to highest-interest debts first for optimal savings.
            </p>

            <div>
              <label className="block text-sm font-semibold mb-2">
                Extra Monthly Payment
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2 text-white">$</span>
                <input
                  type="number"
                  value={extraPayment}
                  onChange={(e) => {
                    setExtraPayment(e.target.value);
                    setSelectedStrategy('extra-payment');
                  }}
                  onClick={(e) => e.stopPropagation()}
                  className="w-full pl-8 pr-4 py-2 bg-white text-gray-800 border-0 rounded-lg focus:ring-2 focus:ring-[#2D9CDB]"
                  placeholder="0.00"
                  step="0.01"
                  min="0"
                />
              </div>
              <p className="text-xs mt-2 opacity-75">
                Recommended: {CalculationService.formatCurrency(cashFlowMetrics.recommendedExtraPayment)}
                {' '}(80% of available cash flow)
              </p>
            </div>

            {selectedStrategy === 'extra-payment' && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleCalculate();
                }}
                disabled={loading}
                className="w-full mt-4 bg-[#27AE60] hover:bg-[#229954] disabled:bg-gray-400 text-white font-bold py-3 px-6 rounded-lg transition-colors inline-flex items-center justify-center space-x-2"
              >
                <Calculator className="w-5 h-5" />
                <span>{loading ? 'Calculating...' : 'Calculate Results'}</span>
              </button>
            )}
          </div>

          {showHELOCStrategy && (
            <>
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-300"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-4 bg-white text-gray-500">OR</span>
                </div>
              </div>

              <div
                className={`bg-gradient-to-br from-[#27AE60] to-[#1E8449] text-white rounded-lg p-6 border-4 transition-all cursor-pointer ${
                  selectedStrategy === 'heloc-velocity' ? 'border-[#F2C94C] shadow-lg' : 'border-transparent'
                }`}
                onClick={() => setSelectedStrategy('heloc-velocity')}
              >
                <h4 className="font-bold text-lg mb-3">HELOC Velocity Banking</h4>
                <p className="text-sm mb-4 opacity-90">
                  Use your Home Equity Line of Credit to pay off high-interest debts in chunks, then pay down the HELOC with all available cash flow. Repeat until debt-free.
                </p>

                <div className="bg-white/10 rounded-lg p-4 space-y-3 mb-4">
                  <div className="flex justify-between text-sm">
                    <span className="opacity-90">HELOC Available:</span>
                    <span className="font-bold">
                      {CalculationService.formatCurrency(availableHELOCCredit)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="opacity-90">HELOC Interest Rate:</span>
                    <span className="font-bold">{helocRate.toFixed(2)}%</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="opacity-90">Monthly Cash Flow Available:</span>
                    <span className="font-bold">
                      {CalculationService.formatCurrency(cashFlowMetrics.availableCashFlow)}
                    </span>
                  </div>
                </div>

                {!helocMakesSense && badDebts.length > 0 && (
                  <div className="bg-amber-500 border-2 border-amber-300 rounded-lg p-4 mb-4 text-white">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="w-6 h-6 flex-shrink-0 mt-0.5" />
                      <div className="text-sm space-y-2">
                        <p className="font-bold text-base">HELOC Strategy Guidance</p>
                        <p>Your HELOC rate is {helocRate.toFixed(2)}%. Here's how to use it strategically:</p>

                        <div className="mt-3 bg-white/20 rounded p-3">
                          <p className="font-semibold mb-2">⚠️ Not Recommended for HELOC:</p>
                          <ul className="space-y-1 text-xs">
                            {badDebts.map(({ debt }) => (
                              <li key={debt.id}>
                                {debt.accountName}: {debt.interestRate.toFixed(2)}% (lower than HELOC)
                              </li>
                            ))}
                          </ul>
                          <p className="text-xs mt-2 opacity-90">Using HELOC here typically costs more in interest</p>
                        </div>

                        <div className="mt-3 bg-white/20 rounded p-3">
                          <p className="font-semibold mb-2">💡 Advanced Strategy Note:</p>
                          <p className="text-xs opacity-90">
                            Some experienced users chunk lower-rate debt using HELOC as a cash flow tool, routing all income through HELOC to minimize daily interest. This requires discipline and understanding of velocity banking mechanics.
                          </p>
                        </div>

                        <div className="mt-3 bg-white/20 rounded p-3">
                          <p className="font-semibold mb-1">Smart Approach:</p>
                          <p className="text-xs opacity-90">
                            Use extra cash flow payments for lower-rate debts. Save HELOC velocity for high-interest debts where rate arbitrage works in your favor.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {helocMakesSense && badDebts.length > 0 && (
                  <div className="bg-blue-500 border-2 border-blue-300 rounded-lg p-4 mb-4 text-white">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="w-6 h-6 flex-shrink-0 mt-0.5" />
                      <div className="text-sm space-y-2">
                        <p className="font-bold text-base">Mixed Rate Portfolio</p>
                        <p>You have both high-rate and low-rate debts compared to your HELOC ({helocRate.toFixed(2)}%).</p>
                        <div className="mt-2 bg-white/20 rounded p-3">
                          <p className="font-semibold mb-2">✅ Good for HELOC chunking: High-interest debts</p>
                          <p className="font-semibold mb-2 mt-3">⚠️ Better with cash flow payments:</p>
                          <ul className="space-y-1 text-xs">
                            {badDebts.map(({ debt }) => (
                              <li key={debt.id}>
                                {debt.accountName}: {debt.interestRate.toFixed(2)}%
                              </li>
                            ))}
                          </ul>
                          <p className="text-xs mt-2 opacity-90">For advanced users: HELOC chunking can still work if using it as a cash flow acceleration tool</p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <div className="bg-white rounded-lg p-4 mb-4 text-gray-800">
                  <h5 className="font-semibold text-sm mb-3">HELOC Suitability Analysis:</h5>
                  <div className="space-y-2">
                    {debtAnalysis.map(({ debt, rateDiff, suitability }) => {
                      const bgColor = suitability === 'good' ? 'bg-[#27AE60]' : suitability === 'marginal' ? 'bg-[#F2C94C]' : 'bg-[#FF8C42]';
                      const textColor = suitability === 'good' ? 'text-white' : 'text-gray-800';

                      return (
                        <div key={debt.id} className={`${bgColor} ${textColor} rounded p-3 text-sm`}>
                          <div className="flex justify-between items-center">
                            <span className="font-semibold">{debt.accountName}</span>
                            <span className="font-bold">{debt.interestRate.toFixed(2)}%</span>
                          </div>
                          <div className="text-xs mt-1 opacity-90">
                            {suitability === 'good' && (
                              <span>✅ Good candidate - saves {rateDiff.toFixed(2)}% in interest</span>
                            )}
                            {suitability === 'marginal' && (
                              <span>⚠️ Marginal benefit - within 0.5% of HELOC rate</span>
                            )}
                            {suitability === 'bad' && (
                              <span>⚠️ Not recommended - rate is {Math.abs(rateDiff).toFixed(2)}% lower than HELOC (better with cash flow payments)</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="bg-white/10 rounded-lg p-4 mb-4">
                  <h5 className="font-semibold text-sm mb-2">How it works:</h5>
                  <ol className="text-sm space-y-1 opacity-90 list-decimal list-inside">
                    <li>Draw from HELOC to pay highest-interest debt completely</li>
                    <li>
                      Direct ALL cash flow ({CalculationService.formatCurrency(cashFlowMetrics.availableCashFlow)}) to pay down HELOC
                    </li>
                    <li>When HELOC reaches $0, use it to pay next highest-interest debt</li>
                    <li>Repeat until all debts eliminated</li>
                  </ol>
                </div>

                {selectedStrategy === 'heloc-velocity' && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCalculate();
                    }}
                    disabled={loading}
                    className="w-full bg-[#F2C94C] hover:bg-[#F0B429] disabled:bg-gray-400 text-gray-800 font-bold py-3 px-6 rounded-lg transition-colors inline-flex items-center justify-center space-x-2"
                  >
                    <Calculator className="w-5 h-5" />
                    <span>{loading ? 'Calculating...' : 'Calculate Results'}</span>
                  </button>
                )}
              </div>
            </>
          )}

          <div className="flex space-x-3 pt-4">
            <button
              onClick={() => setStep(2)}
              className="flex items-center space-x-2 bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold py-3 px-6 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back</span>
            </button>
            {!selectedStrategy && (
              <div className="flex-1 flex items-center justify-center text-gray-500 text-sm">
                Select a strategy to continue
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
