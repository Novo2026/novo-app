import { useState, useEffect } from 'react';
import { ArrowRight, DollarSign, TrendingUp, CheckCircle } from 'lucide-react';
import { StorageService } from '../services/storage';
import { CalculationService } from '../services/calculations';
import StrategyWizard from './StrategyWizard';
import StrategyResults from './StrategyResults';
import SmartChunkingCalculator from './SmartChunkingCalculator';
import type { StrategyResult } from '../types';

interface PaymentStrategiesProps {
  onDataUpdate: () => void;
}

export default function PaymentStrategies({ onDataUpdate }: PaymentStrategiesProps) {
  const [showWizard, setShowWizard] = useState(false);
  const [strategyResult, setStrategyResult] = useState<StrategyResult | null>(
    StorageService.getStrategyResult()
  );
  const [showAutoUpdateBanner, setShowAutoUpdateBanner] = useState(false);
  const [isAutoCalculating, setIsAutoCalculating] = useState(false);

  const debts = StorageService.getDebts();
  const financialProfile = StorageService.getFinancialProfile();

  useEffect(() => {
    const checkAndAutoRecalculate = () => {
      if (StorageService.shouldAutoRecalculate()) {
        setIsAutoCalculating(true);

        setTimeout(() => {
          const activeDebts = StorageService.getDebts().filter(d => !d.isPaidOff);
          if (activeDebts.length === 0) {
            setIsAutoCalculating(false);
            return;
          }

          const profile = StorageService.getFinancialProfile();
          if (!profile) {
            setIsAutoCalculating(false);
            return;
          }

          const totalMinimumPayments = activeDebts.reduce((sum, d) => sum + d.minimumPayment, 0);
          const cashFlow = CalculationService.calculateCashFlow(
            profile.monthlyNetIncome,
            profile.monthlyEssentialExpenses,
            profile.monthlyDiscretionaryExpenses,
            totalMinimumPayments
          );

          const extraPayment = Math.floor(cashFlow.recommendedExtraPayment);
          const newResult = CalculationService.projectDebtPayoff(activeDebts, extraPayment);

          setStrategyResult(newResult);
          StorageService.saveStrategyResult(newResult);
          StorageService.markStrategyCalculated();
          setIsAutoCalculating(false);
          setShowAutoUpdateBanner(true);

          setTimeout(() => {
            setShowAutoUpdateBanner(false);
          }, 5000);

          onDataUpdate();
        }, 500);
      }
    };

    checkAndAutoRecalculate();
  }, [onDataUpdate]);

  const handleWizardComplete = (result: StrategyResult) => {
    setStrategyResult(result);
    StorageService.saveStrategyResult(result);
    StorageService.markStrategyCalculated();
    setShowWizard(false);
    onDataUpdate();
  };

  if (showWizard) {
    return (
      <StrategyWizard
        onComplete={handleWizardComplete}
        onCancel={() => setShowWizard(false)}
      />
    );
  }

  if (strategyResult) {
    return (
      <StrategyResults
        result={strategyResult}
        onRunNew={() => setShowWizard(true)}
        showAutoUpdateBanner={showAutoUpdateBanner}
        isAutoCalculating={isAutoCalculating}
      />
    );
  }

  if (debts.length === 0) {
    return (
      <div className="text-center py-16">
        <DollarSign className="w-16 h-16 text-gray-400 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-gray-800 mb-2">No Debts to Calculate</h2>
        <p className="text-gray-600 mb-6">
          Add your debts first before running payment strategies.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="text-center">
        <TrendingUp className="w-16 h-16 text-[#2D9CDB] mx-auto mb-4" />
        <h2 className="text-3xl font-bold text-gray-800 mb-3">Create Your Payoff Strategy</h2>
        <p className="text-lg text-gray-600 mb-8 max-w-2xl mx-auto">
          Run different scenarios to see how quickly you can become debt-free and how much interest you'll save.
        </p>
        <button
          onClick={() => setShowWizard(true)}
          className="inline-flex items-center space-x-2 bg-[#FF6B35] hover:bg-[#E55A25] text-white font-bold text-lg py-4 px-8 rounded-lg shadow-lg transition-colors"
        >
          <span>Get Started</span>
          <ArrowRight className="w-5 h-5" />
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
        <div className="bg-white rounded-lg shadow-md p-6 text-center">
          <div className="w-12 h-12 bg-[#2D9CDB]/20 rounded-full flex items-center justify-center mx-auto mb-3">
            <span className="text-2xl font-bold text-[#2D9CDB]">1</span>
          </div>
          <h3 className="font-bold text-gray-800 mb-2">Financial Profile</h3>
          <p className="text-sm text-gray-600">
            Enter your income, expenses, and available cash flow
          </p>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6 text-center">
          <div className="w-12 h-12 bg-[#2D9CDB]/20 rounded-full flex items-center justify-center mx-auto mb-3">
            <span className="text-2xl font-bold text-[#2D9CDB]">2</span>
          </div>
          <h3 className="font-bold text-gray-800 mb-2">Home Equity</h3>
          <p className="text-sm text-gray-600">
            Enter home value and mortgage to unlock HELOC strategies
          </p>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6 text-center">
          <div className="w-12 h-12 bg-[#27AE60]/20 rounded-full flex items-center justify-center mx-auto mb-3">
            <span className="text-2xl font-bold text-[#27AE60]">3</span>
          </div>
          <h3 className="font-bold text-gray-800 mb-2">Choose Strategy</h3>
          <p className="text-sm text-gray-600">
            Select extra payment or HELOC velocity banking strategy
          </p>
        </div>
      </div>

      {financialProfile && (
        <div className="bg-white rounded-lg shadow-md p-6 max-w-2xl mx-auto">
          <h3 className="text-xl font-bold text-gray-800 mb-4">Your Financial Profile</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-600">Monthly Net Income</p>
              <p className="text-lg font-semibold text-gray-800">
                {CalculationService.formatCurrency(financialProfile.monthlyNetIncome)}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Total Expenses</p>
              <p className="text-lg font-semibold text-gray-800">
                {CalculationService.formatCurrency(
                  financialProfile.monthlyEssentialExpenses + financialProfile.monthlyDiscretionaryExpenses
                )}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Smart Chunking Calculator */}
      {financialProfile &&
       financialProfile.homeValue &&
       financialProfile.mortgageBalance &&
       financialProfile.helocLimit &&
       financialProfile.helocBalance !== undefined && (
        <div className="mt-12">
          <SmartChunkingCalculator
            monthlyNetIncome={financialProfile.monthlyNetIncome}
            monthlyExpenses={
              financialProfile.monthlyEssentialExpenses +
              financialProfile.monthlyDiscretionaryExpenses
            }
            helocBalance={financialProfile.helocBalance}
            helocLimit={financialProfile.helocLimit}
            helocRate={financialProfile.helocInterestRate || 8}
            mortgageBalance={financialProfile.mortgageBalance}
            mortgageRate={
              debts.find((d) => d.type === 'mortgage')?.interestRate || 6
            }
          />
        </div>
      )}
    </div>
  );
}
