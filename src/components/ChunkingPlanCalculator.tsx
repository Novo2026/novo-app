import { useState } from 'react';
import { TrendingDown, Calendar, DollarSign, Zap, CheckCircle2 } from 'lucide-react';
import { CalculationService } from '../services/calculations';

interface ChunkingPlanCalculatorProps {
  initialChunkAmount: number;
  monthlyCashFlow: number;
  helocRate: number;
  currentHELOCBalance?: number;
  className?: string;
}

interface MonthDetail {
  monthNumber: number;
  monthName: string;
  startingBalance: number;
  payment: number;
  interest: number;
  endingBalance: number;
}

function ChunkingPlanCalculator({
  initialChunkAmount,
  monthlyCashFlow,
  helocRate,
  currentHELOCBalance = 0,
  className = '',
}: ChunkingPlanCalculatorProps) {
  const [chunkAmount, setChunkAmount] = useState(initialChunkAmount);

  const calculatePaybackPlan = (): MonthDetail[] => {
    const months: MonthDetail[] = [];
    let balance = chunkAmount + currentHELOCBalance;
    const monthlyRate = helocRate / 100 / 12;
    let monthNumber = 1;
    const startDate = new Date();

    while (balance > 0.01 && monthNumber <= 60) {
      const monthDate = new Date(startDate);
      monthDate.setMonth(monthDate.getMonth() + monthNumber);
      const monthName = monthDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });

      const interest = balance * monthlyRate;
      const payment = Math.min(monthlyCashFlow, balance + interest);
      const principalPaid = payment - interest;
      const endingBalance = Math.max(0, balance - principalPaid);

      months.push({
        monthNumber,
        monthName,
        startingBalance: balance,
        payment,
        interest,
        endingBalance,
      });

      balance = endingBalance;
      monthNumber++;
    }

    return months;
  };

  const paybackPlan = calculatePaybackPlan();
  const totalInterest = paybackPlan.reduce((sum, month) => sum + month.interest, 0);
  const totalMonths = paybackPlan.length;
  const finalMonth = paybackPlan[paybackPlan.length - 1];

  const minChunk = Math.max(1000, Math.floor(monthlyCashFlow / 3 / 1000) * 1000);
  const maxChunk = Math.floor(monthlyCashFlow * 6 / 1000) * 1000;

  const estimatedMortgageInterestSaved = chunkAmount * 2.75;

  return (
    <div className={`space-y-6 ${className}`}>
      <div className="bg-gradient-to-br from-brand-blue to-[#3498DB] text-white rounded-lg p-6 shadow-lg">
        <div className="flex items-center space-x-3 mb-4">
          <div className="bg-white/20 p-3 rounded-full">
            <Calendar className="w-6 h-6" />
          </div>
          <h3 className="text-2xl font-bold">Your Chunking Plan: {CalculationService.formatCurrency(chunkAmount)}</h3>
        </div>

        <div className="bg-white/10 rounded-lg p-5 mb-6">
          <label className="block text-sm font-semibold mb-3">Adjust Chunk Amount:</label>
          <div className="flex items-center space-x-4">
            <input
              type="range"
              min={minChunk}
              max={maxChunk}
              step={1000}
              value={chunkAmount}
              onChange={(e) => setChunkAmount(Number(e.target.value))}
              className="flex-1 h-3 bg-white/20 rounded-lg appearance-none cursor-pointer slider-thumb"
              style={{
                background: `linear-gradient(to right, #27AE60 0%, #27AE60 ${((chunkAmount - minChunk) / (maxChunk - minChunk)) * 100}%, rgba(255,255,255,0.2) ${((chunkAmount - minChunk) / (maxChunk - minChunk)) * 100}%, rgba(255,255,255,0.2) 100%)`
              }}
            />
            <div className="text-right min-w-[100px]">
              <div className="text-2xl font-bold">{CalculationService.formatCurrency(chunkAmount)}</div>
              <div className="text-xs opacity-80">{totalMonths} month{totalMonths !== 1 ? 's' : ''} to payback</div>
            </div>
          </div>
          <div className="flex justify-between text-xs mt-2 opacity-75">
            <span>{CalculationService.formatCurrency(minChunk)}</span>
            <span>{CalculationService.formatCurrency(maxChunk)}</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white/10 rounded-lg p-4">
            <div className="flex items-center space-x-2 mb-2">
              <DollarSign className="w-5 h-5 text-brand-green" />
              <span className="text-sm opacity-80">Interest Paid</span>
            </div>
            <div className="text-2xl font-bold">{CalculationService.formatCurrency(totalInterest)}</div>
          </div>

          <div className="bg-white/10 rounded-lg p-4">
            <div className="flex items-center space-x-2 mb-2">
              <Calendar className="w-5 h-5 text-[#F2C94C]" />
              <span className="text-sm opacity-80">Total Time</span>
            </div>
            <div className="text-2xl font-bold">{totalMonths === 1 ? '1 month' : `${totalMonths} months`}</div>
          </div>

          <div className="bg-white/10 rounded-lg p-4">
            <div className="flex items-center space-x-2 mb-2">
              <TrendingDown className="w-5 h-5 text-brand-blue" />
              <span className="text-sm opacity-80">Mortgage Reduced</span>
            </div>
            <div className="text-2xl font-bold">{CalculationService.formatCurrency(chunkAmount)}</div>
          </div>
        </div>

        <div className="bg-gradient-to-r from-brand-green to-[#229954] rounded-lg p-4 mb-4">
          <div className="flex items-center justify-between">
            <span className="font-semibold">Estimated Mortgage Interest Saved:</span>
            <span className="text-2xl font-bold">{CalculationService.formatCurrency(estimatedMortgageInterestSaved)}</span>
          </div>
          <div className="flex items-center justify-between mt-2 pt-2 border-t border-white/20">
            <span className="font-semibold">Net Benefit:</span>
            <span className="text-2xl font-bold">{CalculationService.formatCurrency(estimatedMortgageInterestSaved - totalInterest)}</span>
          </div>
        </div>

        <div className="space-y-3">
          {paybackPlan.map((month, index) => (
            <div
              key={month.monthNumber}
              className="bg-white/10 rounded-lg p-4 hover:bg-white/15 transition-colors"
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center space-x-3">
                  <div className="flex-shrink-0 w-10 h-10 bg-white/20 rounded-full flex items-center justify-center font-bold">
                    {month.monthNumber}
                  </div>
                  <div>
                    <div className="font-bold text-lg">{month.monthName}</div>
                    {index === 0 && (
                      <div className="text-xs opacity-75">Draw {CalculationService.formatCurrency(chunkAmount)} from HELOC → pay mortgage</div>
                    )}
                  </div>
                </div>
                {month.endingBalance < 0.01 && (
                  <CheckCircle2 className="w-6 h-6 text-brand-green flex-shrink-0" />
                )}
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                <div>
                  <div className="opacity-75 text-xs">Starting Balance</div>
                  <div className="font-semibold">{CalculationService.formatCurrency(month.startingBalance)}</div>
                </div>
                <div>
                  <div className="opacity-75 text-xs">Payment</div>
                  <div className="font-semibold text-brand-green">-{CalculationService.formatCurrency(month.payment)}</div>
                </div>
                <div>
                  <div className="opacity-75 text-xs">Interest</div>
                  <div className="font-semibold text-orange-200">+{CalculationService.formatCurrency(month.interest)}</div>
                </div>
                <div>
                  <div className="opacity-75 text-xs">Ending Balance</div>
                  <div className="font-semibold">
                    {month.endingBalance < 0.01 ? (
                      <span className="text-brand-green flex items-center space-x-1">
                        <span>$0</span>
                        <Zap className="w-4 h-4" />
                      </span>
                    ) : (
                      CalculationService.formatCurrency(month.endingBalance)
                    )}
                  </div>
                </div>
              </div>

              {month.endingBalance < 0.01 && (
                <div className="mt-3 pt-3 border-t border-white/20">
                  <div className="flex items-center space-x-2 text-sm font-semibold text-brand-green">
                    <CheckCircle2 className="w-5 h-5" />
                    <span>HELOC back to $0! You're ready to chunk again!</span>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="mt-6 bg-white/10 rounded-lg p-4 border-l-4 border-brand-green">
          <div className="flex items-start space-x-3">
            <Zap className="w-6 h-6 text-[#F2C94C] flex-shrink-0 mt-1" />
            <div className="flex-1">
              <h4 className="font-bold mb-2">Strategy Summary</h4>
              <div className="space-y-1 text-sm">
                <p>• Total interest paid to HELOC: <span className="font-bold text-orange-200">{CalculationService.formatCurrency(totalInterest)}</span></p>
                <p>• Total time to pay back: <span className="font-bold text-[#F2C94C]">{totalMonths === 1 ? '1 month' : `${totalMonths} months`}</span></p>
                <p>• Mortgage principal reduced: <span className="font-bold text-brand-green">{CalculationService.formatCurrency(chunkAmount)}</span></p>
                <p>• Estimated long-term mortgage interest saved: <span className="font-bold text-brand-green">{CalculationService.formatCurrency(estimatedMortgageInterestSaved)}</span></p>
                <p className="pt-2 border-t border-white/20 mt-2 font-bold text-brand-green">
                  Net benefit: {CalculationService.formatCurrency(estimatedMortgageInterestSaved - totalInterest)} saved!
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        .slider-thumb::-webkit-slider-thumb {
          appearance: none;
          width: 24px;
          height: 24px;
          border-radius: 50%;
          background: #27AE60;
          cursor: pointer;
          box-shadow: 0 2px 4px rgba(0,0,0,0.2);
        }

        .slider-thumb::-moz-range-thumb {
          width: 24px;
          height: 24px;
          border-radius: 50%;
          background: #27AE60;
          cursor: pointer;
          border: none;
          box-shadow: 0 2px 4px rgba(0,0,0,0.2);
        }
      `}</style>
    </div>
  );
}

export default ChunkingPlanCalculator;
