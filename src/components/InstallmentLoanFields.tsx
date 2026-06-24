import type { LoanTermUnit } from '../utils/installmentLoan';

interface InstallmentLoanFieldsProps {
  originalAmount: string;
  loanStartDate: string;
  loanTerm: string;
  loanTermUnit: LoanTermUnit;
  onOriginalAmountChange: (value: string) => void;
  onLoanStartDateChange: (value: string) => void;
  onLoanTermChange: (value: string) => void;
  onLoanTermUnitChange: (unit: LoanTermUnit) => void;
}

export default function InstallmentLoanFields({
  originalAmount,
  loanStartDate,
  loanTerm,
  loanTermUnit,
  onOriginalAmountChange,
  onLoanStartDateChange,
  onLoanTermChange,
  onLoanTermUnitChange,
}: InstallmentLoanFieldsProps) {
  return (
    <div className="space-y-4 pt-2 border-t border-gray-200">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
        Loan details (optional)
      </p>

      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">
          Original Loan Balance
        </label>
        <div className="relative">
          <span className="absolute left-3 top-2 text-gray-500">$</span>
          <input
            type="text"
            inputMode="decimal"
            value={originalAmount}
            onChange={(e) => onOriginalAmountChange(e.target.value)}
            className="w-full pl-8 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-blue focus:border-transparent"
            placeholder="0.00"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">
          Loan Start Date
        </label>
        <input
          type="date"
          value={loanStartDate}
          onChange={(e) => onLoanStartDateChange(e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-blue focus:border-transparent"
        />
      </div>

      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">
          Loan Term
        </label>
        <div className="flex gap-2">
          <input
            type="number"
            value={loanTerm}
            onChange={(e) => onLoanTermChange(e.target.value)}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-blue focus:border-transparent"
            placeholder={loanTermUnit === 'years' ? '30' : '360'}
            min="1"
            step="1"
          />
          <select
            value={loanTermUnit}
            onChange={(e) => onLoanTermUnitChange(e.target.value as LoanTermUnit)}
            className="w-28 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-blue focus:border-transparent"
          >
            <option value="months">Months</option>
            <option value="years">Years</option>
          </select>
        </div>
      </div>
    </div>
  );
}
