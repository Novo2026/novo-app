import { useState } from 'react';
import { CheckCircle, Briefcase, Building2, TrendingUp, Home, Wallet } from 'lucide-react';

export interface IncomeSource {
  id: string;
  type: 'w2' | 'self_employed' | 'commission' | 'rental' | 'other';
  label: string;
  monthlyAmount: string;
  annualAmount: string;
  useAnnual: boolean;
  description: string;
}

const INCOME_TYPES = [
  { type: 'w2', label: 'W2 / Salary', desc: 'Regular paycheck from employer', icon: Briefcase },
  { type: 'self_employed', label: 'Self-Employed / Business', desc: 'Business income, owner draws, or distributions', icon: Building2 },
  { type: 'commission', label: 'Commission / Variable', desc: 'Income that varies month to month', icon: TrendingUp },
  { type: 'rental', label: 'Rental Income', desc: 'Income from properties in your personal name only', icon: Home },
  { type: 'other', label: 'Other Income', desc: 'Pension, Social Security, alimony, side income', icon: Wallet },
] as const;

function getStoredIncomeSources(): IncomeSource[] {
  try {
    const v2 = localStorage.getItem('novo_income_sources_v2');
    if (v2) return JSON.parse(v2);
    const v1 = JSON.parse(localStorage.getItem('novo_income_sources') || '[]');
    return v1.map((s: any) => ({
      id: `income_${s.type}_${Date.now()}`,
      type: s.type,
      label: s.label,
      monthlyAmount: s.monthlyAmount ? String(s.monthlyAmount) : '',
      annualAmount: '',
      useAnnual: false,
      description: '',
    }));
  } catch {
    return [];
  }
}

export default function IncomeSourcesEditor({ onSaved }: { onSaved?: () => void }) {
  const [sources, setSources] = useState<IncomeSource[]>(getStoredIncomeSources());
  const [showSuccess, setShowSuccess] = useState(false);

  const totalMonthly = sources.reduce((sum, s) => {
    if (s.useAnnual && s.annualAmount) {
      return sum + (parseFloat(s.annualAmount.replace(/[^0-9.]/g, '')) / 12 || 0);
    }
    return sum + (parseFloat(s.monthlyAmount.replace(/[^0-9.]/g, '')) || 0);
  }, 0);

  const toggleSource = (typeInfo: typeof INCOME_TYPES[number]) => {
    const existing = sources.find(s => s.type === typeInfo.type);
    if (existing) {
      setSources(sources.filter(s => s.type !== typeInfo.type));
    } else {
      const newSource: IncomeSource = {
        id: `income_${typeInfo.type}_${Date.now()}`,
        type: typeInfo.type,
        label: typeInfo.label,
        monthlyAmount: '',
        annualAmount: '',
        useAnnual: typeInfo.type === 'self_employed',
        description: '',
      };
      setSources([...sources, newSource]);
    }
  };

  const updateSource = (type: string, updates: Partial<IncomeSource>) => {
    setSources(sources.map(s => s.type === type ? { ...s, ...updates } : s));
  };

  const handleSave = () => {
    localStorage.setItem('novo_income_sources_v2', JSON.stringify(sources));

    const summary = sources.map(s => ({
      type: s.type,
      label: s.label,
      monthlyAmount: s.useAnnual
        ? (parseFloat(s.annualAmount.replace(/[^0-9.]/g, '')) / 12 || 0)
        : (parseFloat(s.monthlyAmount.replace(/[^0-9.]/g, '')) || 0),
    }));
    localStorage.setItem('novo_income_sources', JSON.stringify(summary));

    const rentalSource = sources.find(s => s.type === 'rental');
    const rentalIncome = rentalSource
      ? (parseFloat(rentalSource.monthlyAmount.replace(/[^0-9.]/g, '')) || 0)
      : 0;
    localStorage.setItem('novo_rental_income', rentalIncome.toString());

    // Auto-sync gross income total to Financial Profile
    if (totalMonthly > 0) {
      try {
        const existingProfile = JSON.parse(
          localStorage.getItem('novo_financial_profile') || 'null'
        );
        if (existingProfile) {
          const updated = { ...existingProfile, monthlyGrossIncome: Math.round(totalMonthly) };
          localStorage.setItem('novo_financial_profile', JSON.stringify(updated));
        }
      } catch {
        // If no profile yet, skip
      }
    }

    // Trigger a storage event so Settings Financial Profile refreshes
    window.dispatchEvent(new Event('focus'));

    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 3000);
    onSaved?.();
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex items-center space-x-2 mb-4">
        <Wallet className="w-6 h-6 text-brand-navy" />
        <h3 className="text-xl font-bold text-gray-800">Income Sources</h3>
      </div>
      <p className="text-gray-600 mb-6">
        Add or update where your household income comes from. Your situation may change over time — keep this current for the most accurate coaching.
      </p>

      <div className="space-y-2">
        {INCOME_TYPES.map(typeInfo => {
          const existing = sources.find(s => s.type === typeInfo.type);
          const isActive = !!existing;
          const Icon = typeInfo.icon;

          return (
            <div key={typeInfo.type} className={`border-2 rounded-xl transition-all ${isActive ? 'border-brand-orange bg-brand-orange/5' : 'border-gray-200 bg-white'}`}>
              <button
                type="button"
                onClick={() => toggleSource(typeInfo)}
                className="w-full flex items-center gap-3 p-3 text-left"
              >
                <Icon className={`w-5 h-5 flex-shrink-0 ${isActive ? 'text-brand-orange' : 'text-gray-400'}`} />
                <div className="flex-1">
                  <p className={`text-sm font-semibold ${isActive ? 'text-brand-orange' : 'text-gray-700'}`}>{typeInfo.label}</p>
                  <p className="text-xs text-gray-500">{typeInfo.desc}</p>
                </div>
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${isActive ? 'border-brand-orange bg-brand-orange' : 'border-gray-300'}`}>
                  {isActive && <div className="w-2 h-2 rounded-full bg-white" />}
                </div>
              </button>

              {isActive && existing && (
                <div className="px-4 pb-4 space-y-3 border-t border-brand-orange/20 pt-3">
                  {typeInfo.type === 'self_employed' && (
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-xs font-semibold text-gray-600">Enter as:</span>
                      <button
                        type="button"
                        onClick={() => updateSource(typeInfo.type, { useAnnual: false })}
                        className={`text-xs px-3 py-1 rounded-full border transition-all ${!existing.useAnnual ? 'bg-brand-navy text-white border-brand-navy' : 'bg-white text-gray-600 border-gray-300'}`}
                      >
                        Monthly
                      </button>
                      <button
                        type="button"
                        onClick={() => updateSource(typeInfo.type, { useAnnual: true })}
                        className={`text-xs px-3 py-1 rounded-full border transition-all ${existing.useAnnual ? 'bg-brand-navy text-white border-brand-navy' : 'bg-white text-gray-600 border-gray-300'}`}
                      >
                        Annual (we'll average it)
                      </button>
                    </div>
                  )}

                  {(!existing.useAnnual || typeInfo.type !== 'self_employed') && (
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">
                        {typeInfo.type === 'commission' ? '12-month average monthly amount' :
                         typeInfo.type === 'rental' ? 'Monthly rental income' : 'Monthly amount (gross)'}
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-2 text-gray-500 text-sm">$</span>
                        <input
                          type="text"
                          value={existing.monthlyAmount}
                          onChange={e => updateSource(typeInfo.type, { monthlyAmount: e.target.value })}
                          placeholder="0"
                          className="w-full pl-7 pr-4 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-orange/30 focus:border-brand-orange outline-none"
                        />
                      </div>
                      {typeInfo.type === 'commission' && (
                        <p className="text-xs text-gray-400 mt-1">Add up last 12 months of commission and divide by 12</p>
                      )}
                    </div>
                  )}

                  {existing.useAnnual && typeInfo.type === 'self_employed' && (
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">Annual amount</label>
                      <div className="relative">
                        <span className="absolute left-3 top-2 text-gray-500 text-sm">$</span>
                        <input
                          type="text"
                          value={existing.annualAmount}
                          onChange={e => updateSource(typeInfo.type, { annualAmount: e.target.value })}
                          placeholder="0"
                          className="w-full pl-7 pr-4 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-orange/30 focus:border-brand-orange outline-none"
                        />
                      </div>
                      {existing.annualAmount && parseFloat(existing.annualAmount.replace(/[^0-9.]/g, '')) > 0 && (
                        <div className="mt-2 bg-blue-50 border border-blue-200 rounded-lg p-2">
                          <p className="text-xs text-blue-800 font-medium">
                            📊 Using <strong>${(parseFloat(existing.annualAmount.replace(/[^0-9.]/g, '')) / 12).toLocaleString('en-US', { maximumFractionDigits: 0 })}/month</strong> as your monthly average for planning purposes
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {typeInfo.type === 'other' && (
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">Description (optional)</label>
                      <input
                        type="text"
                        value={existing.description}
                        onChange={e => updateSource(typeInfo.type, { description: e.target.value })}
                        placeholder="e.g. Social Security, pension"
                        className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-orange/30 focus:border-brand-orange outline-none"
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {sources.length > 0 && totalMonthly > 0 && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 mt-4">
          <div className="flex justify-between items-center">
            <p className="text-sm font-semibold text-emerald-800">Combined Monthly Income (Gross)</p>
            <p className="text-lg font-bold text-emerald-700">${totalMonthly.toLocaleString('en-US', { maximumFractionDigits: 0 })}</p>
          </div>
          <p className="text-xs text-emerald-600 mt-1">
            Across {sources.length} income source{sources.length > 1 ? 's' : ''}. This total feeds into your Gross Monthly Income above — update that field to match if needed.
          </p>
        </div>
      )}

      <button
        onClick={handleSave}
        className="w-full mt-4 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-semibold py-3 px-6 rounded-lg transition-all duration-200 shadow-md hover:shadow-lg"
      >
        Save Income Sources
      </button>

      {showSuccess && (
        <div className="flex items-center space-x-2 bg-emerald-50 border border-emerald-300 text-emerald-800 px-4 py-3 rounded-lg mt-3">
          <CheckCircle className="w-5 h-5" />
          <span>Income sources saved</span>
        </div>
      )}
    </div>
  );
}
