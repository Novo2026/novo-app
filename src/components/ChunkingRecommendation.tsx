import { AlertTriangle, CheckCircle, TrendingUp, Shield } from 'lucide-react';
import { CalculationService } from '../services/calculations';

interface ChunkingRecommendationProps {
  monthlyCashFlow: number;
  currentHELOCBalance: number;
  helocLimit: number;
  helocRate: number;
  className?: string;
}

function ChunkingRecommendation({
  monthlyCashFlow,
  currentHELOCBalance,
  helocLimit,
  helocRate,
  className = '',
}: ChunkingRecommendationProps) {
  const availableCredit = helocLimit - currentHELOCBalance;

  const minRecommended = Math.floor((monthlyCashFlow * 2) / 1000) * 1000;
  const maxRecommended = Math.floor((monthlyCashFlow * 3) / 1000) * 1000;

  const safeZoneMin = Math.floor((monthlyCashFlow * 2) / 100) * 100;
  const safeZoneMax = Math.floor((monthlyCashFlow * 3) / 100) * 100;

  const maxWarning = Math.floor((monthlyCashFlow * 5) / 1000) * 1000;

  const minPaybackMonths = minRecommended / monthlyCashFlow;
  const maxPaybackMonths = maxRecommended / monthlyCashFlow;

  return (
    <div className={`space-y-6 ${className}`}>
      <div className="bg-gradient-to-br from-brand-navy to-[#2D5F8D] text-white rounded-lg p-6 shadow-lg">
        <div className="flex items-center space-x-3 mb-4">
          <div className="bg-white/20 p-3 rounded-full">
            <TrendingUp className="w-6 h-6" />
          </div>
          <h3 className="text-2xl font-bold">NOVO Financial Analysis</h3>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-white/10 rounded-lg p-4">
            <p className="text-sm opacity-90 mb-1">Monthly Cash Flow</p>
            <p className="text-2xl font-bold">{CalculationService.formatCurrency(monthlyCashFlow)}</p>
          </div>

          <div className="bg-white/10 rounded-lg p-4">
            <p className="text-sm opacity-90 mb-1">Current HELOC Balance</p>
            <p className="text-2xl font-bold">{CalculationService.formatCurrency(currentHELOCBalance)}</p>
          </div>

          <div className="bg-white/10 rounded-lg p-4">
            <p className="text-sm opacity-90 mb-1">HELOC Credit Limit</p>
            <p className="text-2xl font-bold">{CalculationService.formatCurrency(helocLimit)}</p>
          </div>

          <div className="bg-white/10 rounded-lg p-4">
            <p className="text-sm opacity-90 mb-1">Available to Chunk</p>
            <p className="text-2xl font-bold text-brand-green">{CalculationService.formatCurrency(availableCredit)}</p>
          </div>
        </div>

        <div className="bg-brand-green rounded-lg p-5 mb-4">
          <div className="flex items-start space-x-3 mb-3">
            <CheckCircle className="w-6 h-6 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="text-xl font-bold mb-2">Recommended Chunk Size</h4>
              <p className="text-3xl font-bold mb-2">
                {CalculationService.formatCurrency(minRecommended)} - {CalculationService.formatCurrency(maxRecommended)}
              </p>
            </div>
          </div>

          <div className="bg-white/20 rounded-lg p-4 space-y-2 text-sm">
            <p className="font-semibold text-base mb-2">Why this range?</p>
            <div className="space-y-1">
              <p>• You can pay back {CalculationService.formatCurrency(minRecommended)} in {minPaybackMonths.toFixed(1)} months ({CalculationService.formatCurrency(monthlyCashFlow)}/month cash flow)</p>
              <p>• You can pay back {CalculationService.formatCurrency(maxRecommended)} in {maxPaybackMonths.toFixed(1)} months</p>
              <p>• This keeps payback period under 6 months (safe zone)</p>
              <p>• Leaves emergency HELOC room for unexpected expenses</p>
            </div>
          </div>
        </div>

        <div className="bg-red-500 border-2 border-red-300 rounded-lg p-4 mb-4">
          <div className="flex items-start space-x-3">
            <AlertTriangle className="w-6 h-6 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="font-bold text-lg mb-2">DON'T chunk more than {CalculationService.formatCurrency(maxWarning)}</h4>
              <p className="text-sm mb-2">
                <strong>Risk:</strong> Takes 5+ months to pay back, accumulates more interest
              </p>
              <p className="text-xs opacity-90">
                At {helocRate.toFixed(2)}% APR, a {CalculationService.formatCurrency(maxWarning)} chunk costs approximately {CalculationService.formatCurrency((maxWarning * helocRate / 100 / 12) * 5)} in interest over 5 months
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white/10 rounded-lg p-4">
          <div className="flex items-start space-x-3">
            <Shield className="w-6 h-6 flex-shrink-0 mt-0.5 text-[#F2C94C]" />
            <div>
              <h4 className="font-bold text-lg mb-2">Safe Zone: Chunk 2-3x your monthly cash flow</h4>
              <p className="text-xl font-bold mb-2">
                Your safe zone: {CalculationService.formatCurrency(safeZoneMin)} - {CalculationService.formatCurrency(safeZoneMax)}
              </p>
              <p className="text-sm opacity-90">
                Staying in this range ensures you can pay back the chunk quickly while maintaining financial flexibility
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-r">
        <h4 className="font-semibold text-blue-900 mb-2">How to Use This Analysis:</h4>
        <ol className="space-y-2 text-blue-800 text-sm list-decimal list-inside">
          <li>Choose a debt to pay off within your recommended chunk size</li>
          <li>Draw that amount from your HELOC and pay the debt in full</li>
          <li>Direct ALL available cash flow to pay down the HELOC</li>
          <li>Once HELOC reaches $0, repeat with next highest-rate debt</li>
          <li>Track your HELOC balance daily to monitor progress</li>
        </ol>
      </div>

      <div className="bg-amber-50 border-l-4 border-amber-500 p-4 rounded-r">
        <h4 className="font-semibold text-amber-900 mb-2">Important Reminders:</h4>
        <ul className="space-y-1 text-amber-800 text-sm">
          <li>• Only chunk debts with interest rates higher than your HELOC ({helocRate.toFixed(2)}%)</li>
          <li>• Avoid using HELOC for new purchases or lifestyle expenses</li>
          <li>• Maintain your emergency fund throughout the process</li>
          <li>• HELOC interest is calculated daily, so pay it down aggressively</li>
          <li>• Don't chunk multiple debts at once - focus on one at a time</li>
        </ul>
      </div>
    </div>
  );
}

export default ChunkingRecommendation;
