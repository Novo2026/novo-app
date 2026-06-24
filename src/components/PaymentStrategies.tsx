import { useState, useEffect } from 'react';
import { ArrowRight, DollarSign, TrendingUp, CheckCircle, Home, Zap, AlertTriangle } from 'lucide-react';
import { StorageService } from '../services/storage';
import { CalculationService } from '../services/calculations';
import StrategyWizard from './StrategyWizard';
import StrategyResults from './StrategyResults';
import SmartChunkingCalculator from './SmartChunkingCalculator';
import LearnHELOCModal from './LearnHELOCModal';
import type { StrategyResult } from '../types';

interface PaymentStrategiesProps {
  onDataUpdate: () => void;
  onNavigateToSmarterPayments?: () => void;
}

export default function PaymentStrategies({ onDataUpdate, onNavigateToSmarterPayments }: PaymentStrategiesProps) {
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

  // Track strategy page view
  useEffect(() => {
    if (typeof window !== 'undefined' && (window as any).gtag) {
      (window as any).gtag('event', 'strategy_viewed');
    }
  }, []);

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
        onNavigateToSmarterPayments={onNavigateToSmarterPayments}
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
        <TrendingUp className="w-16 h-16 text-brand-blue mx-auto mb-4" />
        <h2 className="text-3xl font-bold text-gray-800 mb-3">Create Your Payoff Strategy</h2>
        <p className="text-lg text-gray-600 mb-8 max-w-2xl mx-auto">
          Run different scenarios to see how quickly you can become debt-free and how much interest you'll save.
        </p>
        <button
          onClick={() => setShowWizard(true)}
          className="inline-flex items-center space-x-2 bg-brand-orange hover:bg-brand-orange-dark text-white font-bold text-lg py-4 px-8 rounded-lg shadow-lg transition-colors"
        >
          <span>Get Started</span>
          <ArrowRight className="w-5 h-5" />
        </button>
      </div>

      {!featurePreferences.helocEnabled && (
        <div className="bg-gradient-to-br from-blue-50 to-cyan-50 border-2 border-blue-300 rounded-xl p-8 shadow-md max-w-3xl mx-auto">
          <div className="flex items-start space-x-4">
            <div className="flex-shrink-0">
              <div className="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center">
                <CheckCircle className="w-7 h-7 text-white" />
              </div>
            </div>
            <div className="flex-1">
              <h3 className="text-2xl font-bold text-gray-900 mb-3">
                Good News: You Don't Need a HELOC to Succeed
              </h3>
              <p className="text-gray-700 leading-relaxed mb-4">
                Most NOVO users eliminate debt using the debt avalanche method with regular cash flow.
              </p>

              <div className="bg-white/60 border border-blue-200 rounded-lg p-5 mb-4">
                <p className="font-semibold text-gray-900 mb-2">
                  Example: Sarah had $38K in debt (credit cards, auto loan, student loans)
                </p>
                <ul className="space-y-2 text-sm text-gray-700">
                  <li className="flex items-start">
                    <span className="text-emerald-600 mr-2 font-bold">•</span>
                    <span>Used debt avalanche (highest interest first)</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-emerald-600 mr-2 font-bold">•</span>
                    <span>Freed up $520/month as debts paid off</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-emerald-600 mr-2 font-bold">•</span>
                    <span>Debt-free in 5 years vs. 14 years</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-emerald-600 mr-2 font-bold">•</span>
                    <span>Saved $22K in interest</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-emerald-600 mr-2 font-bold">•</span>
                    <span className="font-semibold">No HELOC required - just discipline</span>
                  </li>
                </ul>
              </div>

              <p className="text-gray-800 font-semibold text-lg">
                Your strategy below shows YOUR fastest path.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
        <div className="bg-white rounded-lg shadow-md p-6 text-center">
          <div className="w-12 h-12 bg-brand-blue/20 rounded-full flex items-center justify-center mx-auto mb-3">
            <span className="text-2xl font-bold text-brand-blue">1</span>
          </div>
          <h3 className="font-bold text-gray-800 mb-2">Financial Profile</h3>
          <p className="text-sm text-gray-600">
            Enter your income, expenses, and available cash flow
          </p>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6 text-center">
          <div className="w-12 h-12 bg-brand-blue/20 rounded-full flex items-center justify-center mx-auto mb-3">
            <span className="text-2xl font-bold text-brand-blue">2</span>
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
          <div className="w-12 h-12 bg-brand-green/20 rounded-full flex items-center justify-center mx-auto mb-3">
            <span className="text-2xl font-bold text-brand-green">3</span>
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

      {featurePreferences.helocEnabled && (
        <div id="heloc-strategies-section" className="max-w-3xl mx-auto">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center">
              <Home className="w-5 h-5 text-emerald-700" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-gray-900">HELOC Acceleration Strategies</h3>
              <p className="text-sm text-gray-500">Advanced techniques for homeowners</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="bg-white rounded-xl border-2 border-emerald-200 shadow-sm p-5">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 bg-emerald-500 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Zap className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1">
                  <h4 className="font-bold text-gray-800 mb-1">1. Velocity Banking</h4>
                  <p className="text-sm text-gray-600 leading-relaxed mb-3">
                    Deposit your paycheck directly into your HELOC each month. Pay all living expenses from the HELOC. The net effect: your average daily HELOC balance drops, dramatically reducing interest charges.
                  </p>
                  <div className="bg-emerald-50 rounded-lg p-3 mb-3">
                    <p className="text-xs font-semibold text-emerald-800 mb-1">How it works:</p>
                    <ul className="text-xs text-emerald-700 space-y-1">
                      <li>1. Deposit paycheck ($5,000) into HELOC → balance drops $5,000</li>
                      <li>2. Pay bills/expenses ($3,500) from HELOC → balance rises $3,500</li>
                      <li>3. Net paydown = $1,500/month with no extra spending</li>
                    </ul>
                  </div>
                  <button
                    onClick={() => setShowLearnHELOCModal(true)}
                    className="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-700 hover:text-emerald-900 transition-colors"
                  >
                    Learn More <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl border-2 border-blue-200 shadow-sm p-5">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center flex-shrink-0">
                  <DollarSign className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1">
                  <h4 className="font-bold text-gray-800 mb-1">2. Chunking Payments</h4>
                  <p className="text-sm text-gray-600 leading-relaxed mb-3">
                    Draw a large lump sum from your HELOC and apply it directly to your mortgage principal. Then aggressively pay down the HELOC. This bypasses years of amortization interest.
                  </p>
                  <div className="bg-blue-50 rounded-lg p-3 mb-3">
                    <p className="text-xs font-semibold text-blue-800 mb-1">Example:</p>
                    <p className="text-xs text-blue-700">Draw $20K from HELOC → Apply to mortgage → Pay HELOC back in 10 months → Save years of 6.5% mortgage interest</p>
                  </div>
                  <button
                    onClick={() => {
                      const chunkingEl = document.getElementById('smart-chunking-calculator');
                      if (chunkingEl) {
                        chunkingEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
                      }
                    }}
                    className="inline-flex items-center gap-1.5 text-sm font-semibold text-blue-700 hover:text-blue-900 transition-colors"
                  >
                    Chunking Calculator <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl border-2 border-amber-200 shadow-sm p-5">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 bg-amber-500 rounded-lg flex items-center justify-center flex-shrink-0">
                  <TrendingUp className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1">
                  <h4 className="font-bold text-gray-800 mb-1">3. Debt Consolidation via HELOC</h4>
                  <p className="text-sm text-gray-600 leading-relaxed mb-3">
                    Pay off high-interest credit cards or personal loans using your HELOC. Trade a 20–29% rate for your HELOC rate. You must avoid accumulating new debt for this to work.
                  </p>
                  <div className="bg-amber-50 rounded-lg p-3 mb-1">
                    <p className="text-xs text-amber-700">
                      <span className="font-semibold">Requirement:</span> Discipline to not reuse paid-off credit cards.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-start gap-3 bg-amber-50 border border-amber-300 rounded-xl p-4">
              <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-amber-800">
                <span className="font-semibold">Important:</span> HELOC strategies require stable income and strict discipline. Variable rates can increase your costs. Not recommended if your income is unpredictable.
              </p>
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
