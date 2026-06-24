import { useState, useMemo } from 'react';
import { AlertTriangle, CheckCircle, XCircle, Calculator, TrendingDown, Zap, Mail, Phone } from 'lucide-react';
import { CalculationService } from '../services/calculations';
import ChunkingRiskAssessment from './ChunkingRiskAssessment';

interface SmartChunkingCalculatorProps {
  monthlyNetIncome: number;
  monthlyExpenses: number;
  helocBalance: number;
  helocLimit: number;
  helocRate: number;
  mortgageBalance: number;
  mortgageRate: number;
}

interface QualificationAnswers {
  emergencySavings: boolean | null;
  stableIncome: boolean | null;
  noMissedPayments: boolean | null;
  willingToTrack: boolean | null;
  committedToDiscipline: boolean | null;
}

function SmartChunkingCalculator({
  monthlyNetIncome,
  monthlyExpenses,
  helocBalance,
  helocLimit,
  helocRate,
  mortgageBalance,
  mortgageRate,
}: SmartChunkingCalculatorProps) {
  const [qualificationAnswers, setQualificationAnswers] = useState<QualificationAnswers>({
    emergencySavings: null,
    stableIncome: null,
    noMissedPayments: null,
    willingToTrack: null,
    committedToDiscipline: null,
  });
  const [showCalculator, setShowCalculator] = useState(false);
  const [selectedChunkAmount, setSelectedChunkAmount] = useState(0);

  const monthlyCashFlow = monthlyNetIncome - monthlyExpenses;
  const availableToChunk = helocLimit - helocBalance;

  const allAnswered = Object.values(qualificationAnswers).every((answer) => answer !== null);
  const allQualified = Object.values(qualificationAnswers).every((answer) => answer === true);

  const recommendedMinChunk = Math.max(1000, monthlyCashFlow);
  const recommendedMaxChunk = Math.min(monthlyCashFlow * 3, availableToChunk * 0.8);

  const chunkToDisplay = selectedChunkAmount || recommendedMinChunk;

  // Calculate payback timeline
  const paybackTimeline = useMemo(() => {
    if (chunkToDisplay === 0 || monthlyCashFlow <= 0) return [];

    const timeline = [];
    let balance = chunkToDisplay;
    let month = 0;

    while (balance > 0 && month < 24) {
      month++;
      const monthlyInterest = (balance * (helocRate / 100)) / 12;
      const payment = Math.min(monthlyCashFlow, balance + monthlyInterest);
      balance = balance + monthlyInterest - payment;

      timeline.push({
        month,
        startBalance: month === 1 ? chunkToDisplay : timeline[month - 2].endBalance,
        payment,
        interest: monthlyInterest,
        endBalance: Math.max(0, balance),
      });

      if (balance <= 0) break;
    }

    return timeline;
  }, [chunkToDisplay, monthlyCashFlow, helocRate]);

  const totalInterestPaid = paybackTimeline.reduce((sum, month) => sum + month.interest, 0);
  const monthsToPayback = paybackTimeline.length;

  // Calculate mortgage savings from chunk
  const mortgageSavings = useMemo(() => {
    if (chunkToDisplay === 0) return 0;

    // Simple calculation: interest saved by paying down principal early
    const remainingMonths = 360; // Assume 30 years remaining for simplicity
    const monthlyMortgageRate = mortgageRate / 100 / 12;

    // Interest that would have been paid on this chunk amount
    return chunkToDisplay * monthlyMortgageRate * remainingMonths;
  }, [chunkToDisplay, mortgageRate]);

  const handleAnswer = (question: keyof QualificationAnswers, answer: boolean) => {
    setQualificationAnswers((prev) => ({
      ...prev,
      [question]: answer,
    }));
  };

  const handleProceed = () => {
    if (allQualified) {
      setShowCalculator(true);
      setSelectedChunkAmount(recommendedMinChunk);
    }
  };

  if (!showCalculator) {
    return (
      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg p-8 shadow-lg">
        <h2 className="text-3xl font-bold text-gray-800 mb-2 flex items-center space-x-3">
          <Calculator className="w-8 h-8 text-brand-blue" />
          <span>Smart Chunking Calculator</span>
        </h2>
        <p className="text-gray-600 mb-6 text-lg">Advanced Strategy - Qualification Required</p>

        <div className="bg-white rounded-lg p-6 shadow-md">
          <h3 className="text-xl font-bold text-gray-800 mb-4">Step 1: Qualification Check</h3>
          <p className="text-gray-600 mb-6">
            Answer these 5 questions honestly to determine if chunking is right for you:
          </p>

          <div className="space-y-4">
            <QualificationQuestion
              number={1}
              question="Do you have emergency savings of at least $1,000?"
              answer={qualificationAnswers.emergencySavings}
              onAnswer={(answer) => handleAnswer('emergencySavings', answer)}
            />
            <QualificationQuestion
              number={2}
              question="Has your income been stable for 3+ months?"
              answer={qualificationAnswers.stableIncome}
              onAnswer={(answer) => handleAnswer('stableIncome', answer)}
            />
            <QualificationQuestion
              number={3}
              question="Have you avoided missed payments in the last 6 months?"
              answer={qualificationAnswers.noMissedPayments}
              onAnswer={(answer) => handleAnswer('noMissedPayments', answer)}
            />
            <QualificationQuestion
              number={4}
              question="Are you willing to track your HELOC balance daily or weekly?"
              answer={qualificationAnswers.willingToTrack}
              onAnswer={(answer) => handleAnswer('willingToTrack', answer)}
            />
            <QualificationQuestion
              number={5}
              question="Are you committed to discipline (no lifestyle inflation)?"
              answer={qualificationAnswers.committedToDiscipline}
              onAnswer={(answer) => handleAnswer('committedToDiscipline', answer)}
            />
          </div>

          {allAnswered && !allQualified && (
            <div className="mt-6 bg-red-50 border-l-4 border-red-500 p-4 rounded">
              <div className="flex items-start space-x-3">
                <AlertTriangle className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-bold text-red-800 mb-2">Chunking may not be right for you yet</h4>
                  <p className="text-red-700 mb-3">
                    Focus on building your emergency fund and payment consistency first.
                    These are critical foundations before attempting advanced strategies.
                  </p>
                  <p className="text-red-700 font-semibold">
                    Ask NOVO AI Coach for personalized guidance on getting ready for chunking.
                  </p>
                </div>
              </div>
            </div>
          )}

          {allAnswered && allQualified && (
            <div className="mt-6">
              <div className="bg-green-50 border-l-4 border-green-500 p-4 rounded mb-4">
                <div className="flex items-start space-x-3">
                  <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-bold text-green-800 mb-1">You're qualified for chunking!</h4>
                    <p className="text-green-700">
                      You meet the basic requirements. Let's calculate your optimal chunk size.
                    </p>
                  </div>
                </div>
              </div>
              <button
                onClick={handleProceed}
                className="w-full bg-brand-blue hover:bg-[#2589c4] text-white font-bold py-3 px-6 rounded-lg transition-colors"
              >
                Continue to Calculator
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg p-8 shadow-lg">
        <h2 className="text-3xl font-bold text-gray-800 mb-6 flex items-center space-x-3">
          <Calculator className="w-8 h-8 text-brand-blue" />
          <span>Your Chunking Analysis</span>
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div className="bg-white rounded-lg p-4 shadow">
            <p className="text-sm text-gray-600 mb-1">Monthly Cash Flow</p>
            <p className="text-2xl font-bold text-gray-800">
              {CalculationService.formatCurrency(monthlyCashFlow)}
            </p>
          </div>
          <div className="bg-white rounded-lg p-4 shadow">
            <p className="text-sm text-gray-600 mb-1">Current HELOC Balance</p>
            <p className="text-2xl font-bold text-gray-800">
              {CalculationService.formatCurrency(helocBalance)}
            </p>
          </div>
          <div className="bg-white rounded-lg p-4 shadow">
            <p className="text-sm text-gray-600 mb-1">HELOC Credit Limit</p>
            <p className="text-2xl font-bold text-gray-800">
              {CalculationService.formatCurrency(helocLimit)}
            </p>
          </div>
          <div className="bg-white rounded-lg p-4 shadow">
            <p className="text-sm text-gray-600 mb-1">Available to Chunk</p>
            <p className="text-2xl font-bold text-green-600">
              {CalculationService.formatCurrency(availableToChunk)}
            </p>
          </div>
        </div>

        <div className="bg-gradient-to-r from-brand-blue to-brand-green text-white rounded-lg p-6 shadow-lg">
          <h3 className="text-2xl font-bold mb-4">Recommended Chunk Size</h3>
          <p className="text-4xl font-bold mb-2">
            {CalculationService.formatCurrency(recommendedMinChunk)} - {CalculationService.formatCurrency(recommendedMaxChunk)}
          </p>
          <div className="mt-4 space-y-2 text-sm opacity-90">
            <p>✓ Safe payback period: 2-4 months</p>
            <p>✓ Based on your {CalculationService.formatCurrency(monthlyCashFlow)} monthly cash flow</p>
            <p>✓ Leaves emergency room on HELOC</p>
            <p>✓ Optimal balance of savings vs. risk</p>
          </div>
        </div>
      </div>

      {/* Comparison Section */}
      <div className="bg-white rounded-lg p-8 shadow-lg">
        <h3 className="text-2xl font-bold text-gray-800 mb-6">
          Scenario: {CalculationService.formatCurrency(chunkToDisplay)} Extra Toward Mortgage
        </h3>

        <div className="mb-6">
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Adjust Chunk Amount: {CalculationService.formatCurrency(chunkToDisplay)}
          </label>
          <input
            type="range"
            min={1000}
            max={Math.min(recommendedMaxChunk, availableToChunk)}
            step={500}
            value={chunkToDisplay}
            onChange={(e) => setSelectedChunkAmount(Number(e.target.value))}
            className="w-full h-3 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
          />
          <div className="flex justify-between text-xs text-gray-600 mt-1">
            <span>$1,000</span>
            <span>{CalculationService.formatCurrency(Math.min(recommendedMaxChunk, availableToChunk))}</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="border-2 border-gray-300 rounded-lg p-6">
            <h4 className="text-xl font-bold text-gray-800 mb-4">Option A: Direct Payment</h4>
            <div className="space-y-3">
              <div className="flex items-start space-x-2">
                <span className="text-gray-600">•</span>
                <p className="text-gray-700">Pay {CalculationService.formatCurrency(chunkToDisplay)} to mortgage today</p>
              </div>
              <div className="flex items-start space-x-2">
                <span className="text-gray-600">•</span>
                <p className="text-gray-700">
                  Balance: {CalculationService.formatCurrency(mortgageBalance)} → {CalculationService.formatCurrency(mortgageBalance - chunkToDisplay)}
                </p>
              </div>
              <div className="flex items-start space-x-2">
                <span className="text-gray-600">•</span>
                <p className="text-gray-700">
                  Interest saved: ~{CalculationService.formatCurrency(mortgageSavings)} over loan life
                </p>
              </div>
              <div className="flex items-start space-x-2">
                <span className="text-red-600 font-bold">✗</span>
                <p className="text-gray-700 font-semibold">Your cash: Gone (locked in mortgage)</p>
              </div>
            </div>
          </div>

          <div className="border-4 border-green-500 rounded-lg p-6 bg-green-50">
            <h4 className="text-xl font-bold text-green-800 mb-4 flex items-center space-x-2">
              <span>Option B: HELOC Chunking</span>
              <Zap className="w-5 h-5" />
            </h4>
            <div className="space-y-3">
              <div className="flex items-start space-x-2">
                <span className="text-green-600">•</span>
                <p className="text-gray-700">Draw {CalculationService.formatCurrency(chunkToDisplay)} from HELOC → pay mortgage</p>
              </div>
              <div className="flex items-start space-x-2">
                <span className="text-green-600">•</span>
                <p className="text-gray-700">
                  Same mortgage savings: ~{CalculationService.formatCurrency(mortgageSavings)}
                </p>
              </div>
              <div className="flex items-start space-x-2">
                <span className="text-green-600">•</span>
                <p className="text-gray-700">
                  Pay back HELOC in {monthsToPayback} months: {CalculationService.formatCurrency(monthlyCashFlow)}/month
                </p>
              </div>
              <div className="flex items-start space-x-2">
                <span className="text-green-600">•</span>
                <p className="text-gray-700">
                  HELOC interest cost: ~{CalculationService.formatCurrency(totalInterestPaid)} (during payback)
                </p>
              </div>
              <div className="flex items-start space-x-2">
                <span className="text-green-600">•</span>
                <p className="text-gray-700">
                  Net savings: {CalculationService.formatCurrency(mortgageSavings - totalInterestPaid)}
                </p>
              </div>
              <div className="flex items-start space-x-2">
                <span className="text-green-600 font-bold">✓</span>
                <p className="text-gray-700 font-semibold">Your flexibility: Keep cash flow intact</p>
              </div>
              <div className="flex items-start space-x-2">
                <span className="text-green-600 font-bold">✓</span>
                <p className="text-gray-700 font-semibold">Bonus: Can repeat cycle immediately</p>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 bg-blue-50 border-l-4 border-blue-500 p-4 rounded">
          <h4 className="font-bold text-blue-800 mb-2">Why Chunking Wins:</h4>
          <p className="text-blue-900">
            You "rent" the HELOC for {monthsToPayback} months at {CalculationService.formatCurrency(totalInterestPaid)} cost
            to save {CalculationService.formatCurrency(mortgageSavings)} in mortgage interest.
            That's a {CalculationService.formatCurrency(mortgageSavings - totalInterestPaid)} net gain!
          </p>
          <p className="text-blue-900 font-semibold mt-2">
            Even Better: Route income through HELOC to minimize daily interest and accelerate payback.
          </p>
        </div>
      </div>

      {/* Payback Timeline */}
      <div className="bg-white rounded-lg p-8 shadow-lg">
        <h3 className="text-2xl font-bold text-gray-800 mb-6 flex items-center space-x-2">
          <TrendingDown className="w-7 h-7 text-green-600" />
          <span>Your Chunking Plan: {CalculationService.formatCurrency(chunkToDisplay)}</span>
        </h3>

        <div className="space-y-3 mb-6">
          {paybackTimeline.slice(0, 6).map((month) => (
            <div key={month.month} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-gray-800">Month {month.month}</span>
                <span className="text-sm text-gray-600">
                  End Balance: {CalculationService.formatCurrency(month.endBalance)}
                </span>
              </div>
              <div className="text-sm text-gray-700">
                Start {CalculationService.formatCurrency(month.startBalance)},
                pay {CalculationService.formatCurrency(month.payment)},
                interest +{CalculationService.formatCurrency(month.interest)}
              </div>
            </div>
          ))}
          {paybackTimeline.length > 6 && (
            <div className="text-center text-gray-600 text-sm">
              ... {paybackTimeline.length - 6} more months
            </div>
          )}
          {paybackTimeline.length > 0 && (
            <div className="bg-green-50 border-2 border-green-500 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <span className="font-bold text-green-800">Month {paybackTimeline.length}</span>
                <span className="text-lg font-bold text-green-600">HELOC back to $0!</span>
              </div>
            </div>
          )}
        </div>

        <div className="bg-gradient-to-r from-green-500 to-blue-500 text-white rounded-lg p-6">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-sm opacity-90 mb-1">Total Interest Paid</p>
              <p className="text-2xl font-bold">{CalculationService.formatCurrency(totalInterestPaid)}</p>
            </div>
            <div>
              <p className="text-sm opacity-90 mb-1">Total Time</p>
              <p className="text-2xl font-bold">{monthsToPayback} months</p>
            </div>
            <div>
              <p className="text-sm opacity-90 mb-1">Status</p>
              <p className="text-2xl font-bold">✓ Ready to chunk again!</p>
            </div>
          </div>
        </div>
      </div>

      {/* Advanced Strategy */}
      <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-lg p-8 shadow-lg">
        <h3 className="text-2xl font-bold text-gray-800 mb-4 flex items-center space-x-2">
          <Zap className="w-7 h-7 text-purple-600" />
          <span>Next-Level: HELOC as Checking Account</span>
        </h3>

        <div className="bg-white rounded-lg p-6 mb-6 shadow">
          <h4 className="font-bold text-gray-800 mb-3">Route all income through HELOC:</h4>
          <div className="space-y-2 text-gray-700 mb-4">
            <p>• Paycheck → Deposit to HELOC (drops balance)</p>
            <p>• Bills → Pay from HELOC (raises balance slightly)</p>
            <p className="font-semibold text-green-700">• Net effect: HELOC drops faster due to lower average daily balance</p>
          </div>

          <div className="bg-green-50 border-l-4 border-green-500 p-4 rounded mb-4">
            <p className="font-bold text-green-800 mb-1">Example:</p>
            <p className="text-green-900">
              {CalculationService.formatCurrency(chunkToDisplay)} chunk paid off in 20 days instead of {monthsToPayback} months
            </p>
          </div>

          <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded">
            <p className="font-bold text-red-800 mb-2">Requirements & Risks:</p>
            <p className="text-red-700 mb-2">
              <strong>Requirements:</strong> Extreme discipline, daily tracking, no impulse spending
            </p>
            <p className="text-red-700">
              <strong>Risk:</strong> Overspending grows HELOC balance instead of shrinking it
            </p>
          </div>
        </div>

        <div className="bg-blue-600 text-white rounded-lg p-4">
          <p className="font-semibold">
            Ask NOVO AI Coach: "How do I use HELOC as checking account?"
          </p>
        </div>
      </div>

      {/* Risk Warnings */}
      <ChunkingRiskAssessment />
    </div>
  );
}

function QualificationQuestion({
  number,
  question,
  answer,
  onAnswer,
}: {
  number: number;
  question: string;
  answer: boolean | null;
  onAnswer: (answer: boolean) => void;
}) {
  return (
    <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
      <div className="flex items-start justify-between">
        <div className="flex items-start space-x-3 flex-1">
          <div className="flex-shrink-0 w-8 h-8 bg-brand-blue text-white rounded-full flex items-center justify-center font-bold">
            {number}
          </div>
          <p className="text-gray-800 font-semibold pt-1">{question}</p>
        </div>
        <div className="flex space-x-2 ml-4">
          <button
            onClick={() => onAnswer(true)}
            className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
              answer === true
                ? 'bg-green-500 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            Yes
          </button>
          <button
            onClick={() => onAnswer(false)}
            className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
              answer === false
                ? 'bg-red-500 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            No
          </button>
        </div>
      </div>
    </div>
  );
}

export default SmartChunkingCalculator;
