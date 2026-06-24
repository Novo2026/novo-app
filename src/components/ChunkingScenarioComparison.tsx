import { TrendingUp, Lock, Unlock, Zap, AlertCircle } from 'lucide-react';
import { CalculationService } from '../services/calculations';

interface ChunkingScenarioComparisonProps {
  chunkAmount: number;
  mortgageBalance: number;
  mortgageRate: number;
  helocRate: number;
  monthlyCashFlow: number;
  className?: string;
}

function ChunkingScenarioComparison({
  chunkAmount,
  mortgageBalance,
  mortgageRate,
  helocRate,
  monthlyCashFlow,
  className = '',
}: ChunkingScenarioComparisonProps) {
  const paybackMonths = Math.ceil(chunkAmount / monthlyCashFlow);

  const estimatedMortgageInterestSaved = chunkAmount * (mortgageRate / 100) * 2.75;

  const helocInterestCost = (chunkAmount * (helocRate / 100) / 12) * paybackMonths;

  const netSavings = estimatedMortgageInterestSaved - helocInterestCost;

  const roi = ((netSavings / helocInterestCost) * 100);

  const monthsSavedOnPayoff = Math.floor((chunkAmount / (mortgageBalance * mortgageRate / 100 / 12)) * 1.2);

  return (
    <div className={`space-y-6 ${className}`}>
      <div className="bg-gradient-to-br from-brand-navy to-[#2D5F8D] text-white rounded-lg p-6 shadow-lg">
        <div className="flex items-center space-x-3 mb-4">
          <div className="bg-white/20 p-3 rounded-full">
            <TrendingUp className="w-6 h-6" />
          </div>
          <h3 className="text-2xl font-bold">Scenario Comparison: {CalculationService.formatCurrency(chunkAmount)} Extra Payment</h3>
        </div>
        <p className="text-sm opacity-90 mb-6">
          See the dramatic difference between paying your mortgage directly vs. using HELOC chunking
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white/10 rounded-lg p-5 border-2 border-white/30">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-lg font-bold">Option A: Direct Mortgage Payment</h4>
              <Lock className="w-6 h-6 text-red-300" />
            </div>

            <div className="space-y-3 text-sm">
              <div className="flex items-start space-x-2">
                <span className="text-white/70">•</span>
                <p>Pay {CalculationService.formatCurrency(chunkAmount)} extra to mortgage principal today</p>
              </div>
              <div className="flex items-start space-x-2">
                <span className="text-white/70">•</span>
                <p>Mortgage balance: {CalculationService.formatCurrency(mortgageBalance)} → {CalculationService.formatCurrency(mortgageBalance - chunkAmount)}</p>
              </div>
              <div className="flex items-start space-x-2">
                <span className="text-white/70">•</span>
                <p>Interest saved over life of loan: <span className="font-bold text-brand-green">~{CalculationService.formatCurrency(estimatedMortgageInterestSaved)}</span></p>
              </div>
              <div className="flex items-start space-x-2">
                <span className="text-white/70">•</span>
                <p>Payoff date: Moves up by ~{monthsSavedOnPayoff} months</p>
              </div>
              <div className="flex items-start space-x-2 pt-2 border-t border-white/20">
                <span className="text-red-300">✗</span>
                <p className="font-bold text-red-300">Your cash: Gone (can't get it back)</p>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-brand-green to-[#229954] rounded-lg p-5 border-2 border-brand-green shadow-lg">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-lg font-bold">Option B: HELOC Chunking</h4>
              <Unlock className="w-6 h-6 text-white" />
            </div>

            <div className="space-y-3 text-sm">
              <div className="flex items-start space-x-2">
                <span className="text-white/70">•</span>
                <p>Draw {CalculationService.formatCurrency(chunkAmount)} from HELOC → pay mortgage principal</p>
              </div>
              <div className="flex items-start space-x-2">
                <span className="text-white/70">•</span>
                <p>Mortgage balance: {CalculationService.formatCurrency(mortgageBalance)} → {CalculationService.formatCurrency(mortgageBalance - chunkAmount)} (same as Option A)</p>
              </div>
              <div className="flex items-start space-x-2">
                <span className="text-white/70">•</span>
                <p>Interest saved on mortgage: <span className="font-bold">~{CalculationService.formatCurrency(estimatedMortgageInterestSaved)}</span> (same as Option A)</p>
              </div>
              <div className="flex items-start space-x-2">
                <span className="text-white/70">•</span>
                <p>HELOC balance: $0 → {CalculationService.formatCurrency(chunkAmount)} at {helocRate.toFixed(2)}%</p>
              </div>
              <div className="flex items-start space-x-2">
                <span className="text-white/70">•</span>
                <p>Pay back HELOC in {paybackMonths} months with {CalculationService.formatCurrency(monthlyCashFlow)}/month cash flow</p>
              </div>
              <div className="flex items-start space-x-2">
                <span className="text-white/70">•</span>
                <p>HELOC interest paid during payback: <span className="text-orange-200 font-semibold">~{CalculationService.formatCurrency(helocInterestCost)}</span></p>
              </div>
              <div className="flex items-start space-x-2 pt-2 border-t border-white/20">
                <span className="text-white">✓</span>
                <p className="font-bold">Your cash flow: Intact (not tied up in mortgage)</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-gradient-to-r from-brand-green to-[#229954] text-white rounded-lg p-6 shadow-lg">
        <div className="flex items-start space-x-4">
          <div className="bg-white/20 p-3 rounded-lg">
            <Zap className="w-8 h-8" />
          </div>
          <div className="flex-1">
            <h3 className="text-2xl font-bold mb-3">Net Benefit of HELOC Chunking</h3>
            <div className="space-y-2 text-lg">
              <div className="flex justify-between items-center bg-white/10 rounded-lg p-3">
                <span>Same mortgage interest savings:</span>
                <span className="font-bold">{CalculationService.formatCurrency(estimatedMortgageInterestSaved)}</span>
              </div>
              <div className="flex justify-between items-center bg-white/10 rounded-lg p-3">
                <span>HELOC interest cost:</span>
                <span className="font-bold text-orange-200">-{CalculationService.formatCurrency(helocInterestCost)}</span>
              </div>
              <div className="flex justify-between items-center bg-white text-brand-green rounded-lg p-4 font-bold text-xl border-2 border-white">
                <span>Net Savings:</span>
                <span>{CalculationService.formatCurrency(netSavings)}</span>
              </div>
            </div>

            <div className="mt-4 space-y-2 text-sm bg-white/10 rounded-lg p-4">
              <p className="flex items-start space-x-2">
                <span className="text-white">✓</span>
                <span><strong>PLUS:</strong> Flexibility to repeat the cycle immediately</span>
              </p>
              <p className="flex items-start space-x-2">
                <span className="text-white">✓</span>
                <span><strong>PLUS:</strong> Emergency access to HELOC if needed</span>
              </p>
              <p className="flex items-start space-x-2">
                <span className="text-white">✓</span>
                <span><strong>PLUS:</strong> Can accelerate multiple debts using same strategy</span>
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-blue-50 border-l-4 border-brand-blue p-5 rounded-r-lg">
        <h4 className="font-bold text-gray-900 mb-3 flex items-center space-x-2">
          <TrendingUp className="w-5 h-5 text-brand-blue" />
          <span>Why It Works</span>
        </h4>
        <p className="text-gray-700 mb-3">
          You "rent" the HELOC for {paybackMonths} months (<span className="font-bold text-orange-600">{CalculationService.formatCurrency(helocInterestCost)} cost</span>)
          to save <span className="font-bold text-brand-green">{CalculationService.formatCurrency(estimatedMortgageInterestSaved)}</span> in mortgage interest.
          That's a <span className="font-bold text-brand-blue">{roi.toFixed(0)}% return</span> on the {CalculationService.formatCurrency(helocInterestCost)} you paid.
        </p>
        <div className="bg-white rounded-lg p-4 border border-blue-200">
          <p className="text-sm text-gray-700 font-semibold mb-2">The key insight:</p>
          <p className="text-sm text-gray-600">
            Your mortgage charges {mortgageRate.toFixed(2)}% on the full balance for 30 years.
            The HELOC charges {helocRate.toFixed(2)}% for just {paybackMonths} months.
            You eliminate long-term compound interest by using short-term simple interest.
          </p>
        </div>
      </div>

      <div className="bg-gradient-to-r from-[#F2C94C]/20 to-[#F2994A]/20 border-l-4 border-[#F2C94C] p-5 rounded-r-lg">
        <h4 className="font-bold text-gray-900 mb-3 flex items-center space-x-2">
          <Zap className="w-5 h-5 text-[#F2994A]" />
          <span>Advanced Strategy: Route Your Income Through HELOC</span>
        </h4>
        <div className="space-y-2 text-gray-700 text-sm">
          <p className="flex items-start space-x-2">
            <span className="text-[#F2994A] font-bold">1.</span>
            <span>Deposit paychecks directly to HELOC</span>
          </p>
          <p className="flex items-start space-x-2">
            <span className="text-[#F2994A] font-bold">2.</span>
            <span>Pay bills from HELOC</span>
          </p>
          <p className="flex items-start space-x-2">
            <span className="text-[#F2994A] font-bold">3.</span>
            <span>Daily balance drops when income hits</span>
          </p>
          <p className="flex items-start space-x-2">
            <span className="text-[#F2994A] font-bold">4.</span>
            <span>Interest calculates on average daily balance (lower than static {CalculationService.formatCurrency(chunkAmount)})</span>
          </p>
          <p className="flex items-start space-x-2">
            <span className="text-[#F2994A] font-bold">5.</span>
            <span>Payback happens even faster with this method</span>
          </p>
        </div>
        <div className="mt-3 pt-3 border-t border-[#F2994A]/30">
          <p className="text-xs text-gray-600 italic flex items-start space-x-2">
            <AlertCircle className="w-4 h-4 text-[#F2994A] flex-shrink-0 mt-0.5" />
            <span>
              This is velocity banking at its peak efficiency. Your income actively fights your debt 24/7,
              reducing your average daily balance and minimizing interest costs.
            </span>
          </p>
        </div>
      </div>
    </div>
  );
}

export default ChunkingScenarioComparison;
