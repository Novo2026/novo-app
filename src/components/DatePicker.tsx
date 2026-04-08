import { Calendar } from 'lucide-react';

interface DatePickerProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  allowFuture?: boolean;
  demoMode?: boolean;
}

export default function DatePicker({ value, onChange, label = 'Date', allowFuture = false, demoMode = false }: DatePickerProps) {
  const today = new Date().toISOString().split('T')[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
  const oneWeekAgo = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];
  const oneMonthAgo = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];

  const fiveYearsAgo = new Date();
  fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 5);
  const minDate = fiveYearsAgo.toISOString().split('T')[0];

  const maxDate = allowFuture || demoMode ? '2099-12-31' : today;

  const handleQuickSelect = (dateValue: string) => {
    onChange(dateValue);
  };

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-700">{label}</label>

      <div className="flex flex-wrap gap-2 mb-2">
        <button
          type="button"
          onClick={() => handleQuickSelect(today)}
          className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
            value === today
              ? 'bg-emerald-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          Today
        </button>
        <button
          type="button"
          onClick={() => handleQuickSelect(yesterday)}
          className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
            value === yesterday
              ? 'bg-emerald-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          Yesterday
        </button>
        <button
          type="button"
          onClick={() => handleQuickSelect(oneWeekAgo)}
          className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
            value === oneWeekAgo
              ? 'bg-emerald-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          1 Week Ago
        </button>
        <button
          type="button"
          onClick={() => handleQuickSelect(oneMonthAgo)}
          className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
            value === oneMonthAgo
              ? 'bg-emerald-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          1 Month Ago
        </button>
      </div>

      <div className="relative">
        <input
          type="date"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          min={minDate}
          max={maxDate}
          className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
        />
        <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
      </div>

      {demoMode && (
        <p className="text-xs text-amber-600 flex items-center space-x-1">
          <span>⚠️</span>
          <span>Demo Mode: Any date allowed</span>
        </p>
      )}
      {!allowFuture && !demoMode && (
        <p className="text-xs text-gray-500">
          Dates from past 5 years allowed
        </p>
      )}
    </div>
  );
}
