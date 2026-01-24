import { useState } from 'react';
import { TrendingDown, AlertTriangle, CheckCircle2, DollarSign, Calendar, Zap, ArrowDown, ArrowUp } from 'lucide-react';
import { CalculationService } from '../services/calculations';

interface AdvancedVelocityBankingProps {
  chunkAmount: number;
  biweeklyPaycheck: number;
  monthlyBills: number;
  helocRate: number;
  className?: string;
}

interface DailyEvent {
  day: number;
  type: 'chunk' | 'paycheck' | 'bills' | 'interest';
  amount: number;
  description: string;
  balanceBefore: number;
  balanceAfter: number;
}

function AdvancedVelocityBanking({
  chunkAmount,
  biweeklyPaycheck,
  monthlyBills,
  helocRate,
  className = '',
}: AdvancedVelocityBankingProps) {
  const [showSimulation, setShowSimulation] = useState(false);

  const calculateDailyEvents = (): DailyEvent[] => {
    const events: DailyEvent[] = [];
    let balance = 0;
    const dailyRate = helocRate / 100 / 365;

    // Day 1: Initial chunk
    events.push({
      day: 1,
      type: 'chunk',
      amount: chunkAmount,
      description: `Chunk ${CalculationService.formatCurrency(chunkAmount)} from HELOC → pay mortgage`,
      balanceBefore: balance,
      balanceAfter: chunkAmount,
    });
    balance = chunkAmount;

    // Day 5: First paycheck
    events.push({
      day: 5,
      type: 'paycheck',
      amount: biweeklyPaycheck,
      description: `Paycheck deposited to HELOC`,
      balanceBefore: balance,
      balanceAfter: balance - biweeklyPaycheck,
    });
    balance -= biweeklyPaycheck;

    // Days 6-19: Bills spread out (half of monthly bills)
    const billsFirstHalf = monthlyBills / 2;
    events.push({
      day: 10,
      type: 'bills',
      amount: billsFirstHalf,
      description: `Bills paid from HELOC`,
      balanceBefore: balance,
      balanceAfter: balance + billsFirstHalf,
    });
    balance += billsFirstHalf;

    // Day 20: Second paycheck
    events.push({
      day: 20,
      type: 'paycheck',
      amount: biweeklyPaycheck,
      description: `Paycheck deposited to HELOC`,
      balanceBefore: balance,
      balanceAfter: balance - biweeklyPaycheck,
    });
    balance -= biweeklyPaycheck;

    // Days 21-30: More bills (second half)
    const billsSecondHalf = monthlyBills / 2;
    events.push({
      day: 25,
      type: 'bills',
      amount: billsSecondHalf,
      description: `Bills paid from HELOC`,
      balanceBefore: balance,
      balanceAfter: balance + billsSecondHalf,
    });
    balance += billsSecondHalf;

    // Day 30: Interest charged
    const averageDailyBalance = events.reduce((sum, e) => {
      if (e.day < 30) {
        const nextDay = events.find(ev => ev.day > e.day)?.day || 30;
        const days = nextDay - e.day;
        return sum + (e.balanceAfter * days);
      }
      return sum;
    }, 0) / 30;

    const monthlyInterest = averageDailyBalance * dailyRate * 30;

    events.push({
      day: 30,
      type: 'interest',
      amount: monthlyInterest,
      description: `Monthly interest charged`,
      balanceBefore: balance,
      balanceAfter: balance + monthlyInterest,
    });

    return events;
  };

  const calculateTraditionalMethod = () => {
    const monthlyRate = helocRate / 100 / 12;
    const balance = chunkAmount;
    const netCashFlow = (biweeklyPaycheck * 2) - monthlyBills;
    const interest = balance * monthlyRate;
    const newBalance = balance - netCashFlow + interest;

    return {
      averageBalance: balance,
      interest,
      endingBalance: newBalance,
    };
  };

  const events = calculateDailyEvents();
  const traditional = calculateTraditionalMethod();
  const finalBalance = events[events.length - 1].balanceAfter;
  const totalInterest = events.find(e => e.type === 'interest')?.amount || 0;
  const interestSavings = traditional.interest - totalInterest;
  const averageDailyBalance = events.reduce((sum, e, i) => {
    if (i < events.length - 1) {
      const nextDay = events[i + 1]?.day || 30;
      const days = nextDay - e.day;
      return sum + (e.balanceAfter * days);
    }
    return sum;
  }, 0) / 30;

  return (
    <div className={`space-y-6 ${className}`}>
      <div className="bg-gradient-to-br from-[#9B59B6] to-[#8E44AD] text-white rounded-lg p-6 shadow-lg">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div className="bg-white/20 p-3 rounded-full">
              <Zap className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-2xl font-bold">Advanced Velocity Banking</h3>
              <p className="text-sm opacity-90 mt-1">Use Your HELOC as Your Checking Account</p>
            </div>
          </div>
        </div>

        <div className="bg-white/10 rounded-lg p-5 mb-6 border-l-4 border-[#F39C12]">
          <div className="flex items-start space-x-3">
            <AlertTriangle className="w-6 h-6 text-[#F39C12] flex-shrink-0 mt-1" />
            <div className="flex-1">
              <h4 className="font-bold mb-2">⚠️ Advanced Strategy - High Discipline Required</h4>
              <div className="space-y-1 text-sm">
                <p>✓ Requires daily balance monitoring</p>
                <p>✓ No impulse spending allowed</p>
                <p>✓ Must track all upcoming bills</p>
                <p>✗ Risk: Overspending grows HELOC balance</p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div className="bg-white/10 rounded-lg p-4">
            <h4 className="font-semibold mb-3 flex items-center space-x-2">
              <span>📊 Traditional Method</span>
            </h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="opacity-80">Average Balance:</span>
                <span className="font-bold">{CalculationService.formatCurrency(traditional.averageBalance)}</span>
              </div>
              <div className="flex justify-between">
                <span className="opacity-80">Interest Charged:</span>
                <span className="font-bold text-orange-200">{CalculationService.formatCurrency(traditional.interest)}</span>
              </div>
              <div className="flex justify-between pt-2 border-t border-white/20">
                <span className="opacity-80">Month-End Balance:</span>
                <span className="font-bold">{CalculationService.formatCurrency(traditional.endingBalance)}</span>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-[#27AE60] to-[#229954] rounded-lg p-4">
            <h4 className="font-semibold mb-3 flex items-center space-x-2">
              <Zap className="w-5 h-5" />
              <span>Advanced Method</span>
            </h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="opacity-80">Avg Daily Balance:</span>
                <span className="font-bold">{CalculationService.formatCurrency(averageDailyBalance)}</span>
              </div>
              <div className="flex justify-between">
                <span className="opacity-80">Interest Charged:</span>
                <span className="font-bold">{CalculationService.formatCurrency(totalInterest)}</span>
              </div>
              <div className="flex justify-between pt-2 border-t border-white/20">
                <span className="opacity-80">Month-End Balance:</span>
                <span className="font-bold">{CalculationService.formatCurrency(finalBalance)}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-r from-[#27AE60] to-[#229954] rounded-lg p-4 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <TrendingDown className="w-6 h-6" />
              <span className="font-bold">Interest Savings This Month:</span>
            </div>
            <span className="text-2xl font-bold">{CalculationService.formatCurrency(interestSavings)}</span>
          </div>
          <div className="flex items-center justify-between mt-2 pt-2 border-t border-white/20 text-sm">
            <span>Average Balance Reduction:</span>
            <span className="font-bold">{CalculationService.formatCurrency(traditional.averageBalance - averageDailyBalance)}</span>
          </div>
        </div>

        <button
          onClick={() => setShowSimulation(!showSimulation)}
          className="w-full bg-white/20 hover:bg-white/30 text-white font-semibold py-3 px-4 rounded-lg transition-colors flex items-center justify-center space-x-2"
        >
          <Calendar className="w-5 h-5" />
          <span>{showSimulation ? 'Hide' : 'Show'} Day-by-Day Simulation</span>
        </button>

        {showSimulation && (
          <div className="mt-6 space-y-3">
            <h4 className="font-bold text-lg flex items-center space-x-2 mb-4">
              <Calendar className="w-5 h-5" />
              <span>30-Day Cash Flow Simulation</span>
            </h4>

            {events.map((event, index) => (
              <div
                key={index}
                className={`rounded-lg p-4 ${
                  event.type === 'chunk'
                    ? 'bg-[#E74C3C]/20 border-l-4 border-[#E74C3C]'
                    : event.type === 'paycheck'
                    ? 'bg-[#27AE60]/20 border-l-4 border-[#27AE60]'
                    : event.type === 'bills'
                    ? 'bg-[#F39C12]/20 border-l-4 border-[#F39C12]'
                    : 'bg-white/10 border-l-4 border-white/30'
                }`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center space-x-3">
                    <div className="flex-shrink-0 w-10 h-10 bg-white/20 rounded-full flex items-center justify-center font-bold">
                      {event.day}
                    </div>
                    <div className="flex-1">
                      <div className="font-semibold flex items-center space-x-2">
                        {event.type === 'chunk' && <ArrowUp className="w-4 h-4 text-[#E74C3C]" />}
                        {event.type === 'paycheck' && <ArrowDown className="w-4 h-4 text-[#27AE60]" />}
                        {event.type === 'bills' && <ArrowUp className="w-4 h-4 text-[#F39C12]" />}
                        {event.type === 'interest' && <DollarSign className="w-4 h-4" />}
                        <span>{event.description}</span>
                      </div>
                      <div className="text-sm opacity-75 mt-1">
                        {event.type === 'paycheck' ? (
                          <span className="text-[#27AE60]">-{CalculationService.formatCurrency(event.amount)} (reduces balance)</span>
                        ) : (
                          <span className={event.type === 'interest' ? 'text-orange-200' : ''}>
                            +{CalculationService.formatCurrency(event.amount)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm mt-3 pt-3 border-t border-white/20">
                  <div>
                    <div className="opacity-75">Balance Before:</div>
                    <div className="font-semibold">{CalculationService.formatCurrency(event.balanceBefore)}</div>
                  </div>
                  <div>
                    <div className="opacity-75">Balance After:</div>
                    <div className="font-semibold flex items-center space-x-2">
                      <span>{CalculationService.formatCurrency(event.balanceAfter)}</span>
                      {event.balanceAfter < event.balanceBefore && event.type === 'paycheck' && (
                        <CheckCircle2 className="w-4 h-4 text-[#27AE60]" />
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}

            <div className="bg-gradient-to-r from-[#27AE60] to-[#229954] rounded-lg p-4 mt-4">
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold">Month-End Result:</span>
                <span className="text-2xl font-bold">{CalculationService.formatCurrency(finalBalance)}</span>
              </div>
              <div className="text-sm opacity-90">
                You paid down {CalculationService.formatCurrency(chunkAmount - finalBalance)} of the chunk in 30 days!
              </div>
            </div>
          </div>
        )}

        <div className="mt-6 bg-white/10 rounded-lg p-4 border-l-4 border-[#F39C12]">
          <div className="flex items-start space-x-3">
            <AlertTriangle className="w-6 h-6 text-[#F39C12] flex-shrink-0 mt-1" />
            <div className="flex-1">
              <h4 className="font-bold mb-2">How It Works:</h4>
              <div className="space-y-2 text-sm">
                <p><strong>Instead of:</strong> Paycheck → Checking → Pay Bills → Pay HELOC</p>
                <p><strong>You do:</strong> Paycheck → HELOC → Pay Bills from HELOC</p>
                <p className="pt-2 border-t border-white/20 mt-2">
                  By routing everything through your HELOC, your money works to reduce the balance immediately.
                  Every dollar that sits in the HELOC reduces your average daily balance, which means less interest charged.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-4 bg-[#E74C3C]/20 rounded-lg p-4 border-l-4 border-[#E74C3C]">
          <div className="flex items-start space-x-3">
            <AlertTriangle className="w-6 h-6 text-[#E74C3C] flex-shrink-0 mt-1" />
            <div className="flex-1">
              <h4 className="font-bold mb-2">🚨 Critical Warning:</h4>
              <div className="space-y-1 text-sm">
                <p>• Every purchase comes directly from HELOC (increases balance)</p>
                <p>• No buffer zone like a checking account</p>
                <p>• One impulse buy can derail your progress</p>
                <p>• ONLY for extremely disciplined individuals</p>
                <p className="pt-2 border-t border-white/30 mt-2 font-bold">
                  If you're not 100% confident in your spending discipline, stick with the traditional chunking method!
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AdvancedVelocityBanking;
