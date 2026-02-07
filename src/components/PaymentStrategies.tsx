import { useState, useEffect } from 'react';
import { ArrowRight, DollarSign, TrendingUp, CheckCircle } from 'lucide-react';
import { StorageService } from '../services/storage';
import { CalculationService } from '../services/calculations';
import StrategyWizard from './StrategyWizard';
import StrategyResults from './StrategyResults';
import SmartChunkingCalculator from './SmartChunkingCalculator';
import LearnHELOCModal from './LearnHELOCModal';
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
  const [showLearnHELOCModal, setShowLearnHELOCModal] = useState(false);

  const debts = StorageService.getDebts();
  const financialProfile = StorageService.getFinancialProfile();
  const featurePreferences = StorageService.getFeaturePreferences();

  useEffect(() => {
    const checkAndAutoRecalculate = () => {
      if (StorageService.shouldAutoRecalculate()) {
        setIsAutoCalculating(true);

        setTimeout(() => {
          const newResult = CalculationService.calculateCurrentStrategy();

          if (!newResult) {
            setIsAutoCalculating(false);
            return;
          }

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
          <h3 className="font-bold text-gray-800 mb-2">
            {featurePreferences.helocEnabled ? 'Home Equity' : 'Review Your Debts'}
          </h3>
          <p className="text-sm text-gray-600">
            {featurePreferences.helocEnabled
              ? 'Enter home value and mortgage to unlock HELOC strategies'
              : 'Ensure all your debts are entered with accurate rates'}
          </p>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6 text-center">
          <div className="w-12 h-12 bg-[#27AE60]/20 rounded-full flex items-center justify-center mx-auto mb-3">
            <span className="text-2xl font-bold text-[#27AE60]">3</span>
          </div>
          <h3 className="font-bold text-gray-800 mb-2">Choose Strategy</h3>
          <p className="text-sm text-gray-600">
            {featurePreferences.helocEnabled
              ? 'Select extra payment or HELOC velocity banking strategy'
              : 'Apply the debt avalanche method with extra payments'}
          </p>
        </div>
      </div>

      {!featurePreferences.helocEnabled && (
        <div id="heloc-section" className="bg-gradient-to-br from-blue-50 to-cyan-50 border-2 border-blue-200 rounded-xl p-6 shadow-lg max-w-3xl mx-auto">
          <div className="flex items-start space-x-4">
            <div className="text-4xl">💡</div>
            <div className="flex-1">
              <h3 className="text-xl font-bold text-gray-800 mb-2">
                Want to accelerate your debt payoff even faster?
              </h3>
              <p className="text-gray-700 mb-4 leading-relaxed">
                If you're a homeowner with equity, a HELOC can help you eliminate high-interest debt faster by trading expensive rates for lower HELOC rates. Enable HELOC features to access advanced velocity banking strategies and powerful tracking tools.
              </p>
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={() => setShowLearnHELOCModal(true)}
                  className="inline-flex items-center px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-lg shadow-md transition-colors"
                >
                  Learn About HELOC Strategy
                </button>
                <button
                  onClick={() => {
                    const settingsButton = document.querySelector('[data-section="settings"]');
                    if (settingsButton instanceof HTMLElement) {
                      settingsButton.click();
                    }
                  }}
                  className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg shadow-md transition-colors"
                >
                  Enable HELOC Features
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

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
      {featurePreferences.helocEnabled &&
       financialProfile &&
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

      <LearnHELOCModal
        isOpen={showLearnHELOCModal}
        onClose={() => setShowLearnHELOCModal(false)}
        showEnableButton={true}
        onEnableHELOC={() => {
          const settingsButton = document.querySelector('[data-section="settings"]');
          if (settingsButton instanceof HTMLElement) {
            settingsButton.click();
          }
        }}
      />
    </div>
  );
}
