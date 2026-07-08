import { useState } from 'react';
import { CheckCircle, Briefcase, Building2, TrendingUp, Home, Wallet } from 'lucide-react';
import { StorageService } from '../services/storage';

export interface IncomeSource {
  id: string;
  type: 'w2' | 'self_employed' | 'commission' | 'rental' | 'other';
  label: string;
  monthlyAmount: string;
  annualAmount: string;
  useAnnual: boolean;
  description: string;
  w2NetMonthlyAmount?: string;
  w2GrossMonthlyAmount?: string;
  w2Person1Net?: string;
  w2Person1Gross?: string;
  w2Person2Net?: string;
  w2Person2Gross?: string;
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
    if (v2) {
      return (JSON.parse(v2) as IncomeSource[]).map((s) => ({
        ...s,
        useAnnual: s.type === 'self_employed' ? s.useAnnual : false,
        w2NetMonthlyAmount:
          s.type === 'w2'
            ? s.w2NetMonthlyAmount ?? s.monthlyAmount ?? ''
            : s.w2NetMonthlyAmount,
        w2GrossMonthlyAmount:
          s.type === 'w2'
            ? s.w2GrossMonthlyAmount ?? s.monthlyAmount ?? ''
            : s.w2GrossMonthlyAmount,
        w2Person1Net:
          s.type === 'w2'
            ? s.w2Person1Net ?? s.w2NetMonthlyAmount ?? s.monthlyAmount ?? ''
            : s.w2Person1Net,
        w2Person1Gross:
          s.type === 'w2'
            ? s.w2Person1Gross ?? s.w2GrossMonthlyAmount ?? s.monthlyAmount ?? ''
            : s.w2Person1Gross,
        w2Person2Net: s.type === 'w2' ? s.w2Person2Net ?? '' : s.w2Person2Net,
        w2Person2Gross: s.type === 'w2' ? s.w2Person2Gross ?? '' : s.w2Person2Gross,
      }));
    }
    const v1 = JSON.parse(localStorage.getItem('novo_income_sources') || '[]');
    return v1.map((s: any) => ({
      id: `income_${s.type}_${Date.now()}`,
      type: s.type,
      label: s.label,
      monthlyAmount: s.monthlyAmount ? String(s.monthlyAmount) : '',
      annualAmount: '',
      useAnnual: false,
      description: '',
      w2NetMonthlyAmount: s.type === 'w2' ? (s.monthlyAmount ? String(s.monthlyAmount) : '') : undefined,
      w2GrossMonthlyAmount: s.type === 'w2' ? (s.monthlyAmount ? String(s.monthlyAmount) : '') : undefined,
      w2Person1Net: s.type === 'w2' ? (s.monthlyAmount ? String(s.monthlyAmount) : '') : undefined,
      w2Person1Gross: s.type === 'w2' ? (s.monthlyAmount ? String(s.monthlyAmount) : '') : undefined,
      w2Person2Net: s.type === 'w2' ? '' : undefined,
      w2Person2Gross: s.type === 'w2' ? '' : undefined,
    }));
  } catch {
    return [];
  }
}

export default function IncomeSourcesEditor({ onSaved }: { onSaved?: () => void }) {
  const [sources, setSources] = useState<IncomeSource[]>(getStoredIncomeSources());
  const [showSuccess, setShowSuccess] = useState(false);
  const [isW2Annual, setIsW2Annual] = useState(false);
  const [isW2Person2Annual, setIsW2Person2Annual] = useState(false);
  const accountType = StorageService.getAccountType();
  console.log('NOVO account type detected:', accountType);
  const showSecondW2Person = accountType === 'couple' || accountType === 'family';

  const totalMonthlyNet = sources.reduce((sum, s) => {
    if (s.type === 'w2') {
      const person1Net = parseFloat((s.w2Person1Net || s.w2NetMonthlyAmount || '').replace(/[^0-9.]/g, '')) || 0;
      const person2Net = parseFloat((s.w2Person2Net || '').replace(/[^0-9.]/g, '')) || 0;
      return sum + person1Net + person2Net;
    }
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
      monthlyAmount: s.type === 'w2'
        ? (parseFloat((s.w2Person1Net || s.w2NetMonthlyAmount || '').replace(/[^0-9.]/g, '')) || 0) +
          (parseFloat((s.w2Person2Net || '').replace(/[^0-9.]/g, '')) || 0)
        : s.useAnnual
          ? (parseFloat(s.annualAmount.replace(/[^0-9.]/g, '')) / 12 || 0)
          : (parseFloat(s.monthlyAmount.replace(/[^0-9.]/g, '')) || 0),
    }));
    localStorage.setItem('novo_income_sources', JSON.stringify(summary));

    const rentalSource = sources.find(s => s.type === 'rental');
    const rentalIncome = rentalSource
      ? (parseFloat(rentalSource.monthlyAmount.replace(/[^0-9.]/g, '')) || 0)
      : 0;
    localStorage.setItem('novo_rental_income', rentalIncome.toString());

    const w2Source = sources.find((s) => s.type === 'w2');
    const w2Person1Net = parseFloat((w2Source?.w2Person1Net || w2Source?.w2NetMonthlyAmount || '').replace(/[^0-9.]/g, '')) || 0;
    const w2Person1Gross = parseFloat((w2Source?.w2Person1Gross || w2Source?.w2GrossMonthlyAmount || '').replace(/[^0-9.]/g, '')) || 0;
    const w2Person2Net = parseFloat((w2Source?.w2Person2Net || '').replace(/[^0-9.]/g, '')) || 0;
    const w2Person2Gross = parseFloat((w2Source?.w2Person2Gross || '').replace(/[^0-9.]/g, '')) || 0;
    const combinedGrossIncome = w2Person1Gross + w2Person2Gross;

    localStorage.setItem('w2Person1Net', w2Person1Net.toString());
    localStorage.setItem('w2Person1Gross', w2Person1Gross.toString());
    localStorage.setItem('w2Person2Net', w2Person2Net.toString());
    localStorage.setItem('w2Person2Gross', w2Person2Gross.toString());
    localStorage.setItem('combinedGrossIncome', combinedGrossIncome.toString());

    if (totalMonthlyNet > 0 || combinedGrossIncome > 0) {
      try {
        const existingProfile = JSON.parse(
          localStorage.getItem('novo_financial_profile') || 'null'
        );
        if (existingProfile) {
          const updated = {
            ...existingProfile,
            monthlyNetIncome: Math.round(totalMonthlyNet),
            monthlyGrossIncome: combinedGrossIncome > 0 ? Math.round(combinedGrossIncome) : existingProfile.monthlyGrossIncome,
            combinedGrossIncome: Math.round(combinedGrossIncome),
          };
          localStorage.setItem('novo_financial_profile', JSON.stringify(updated));
        }
      } catch {
        // If no profile yet, skip
      }
    }

    window.dispatchEvent(new Event('focus'));

    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 3000);
    onSaved?.();
  };

  return (
    <div className="bg-white border border-brand-gray-border rounded-lg border-t-[3px] border-t-brand-orange p-5">
      <div className="flex items-center gap-2 mb-2">
        <Wallet className="w-4 h-4 text-brand-orange" />
        <h3 className="text-sm font-medium text-brand-navy">Income Sources</h3>
      </div>
      <p className="text-xs text-brand-gray mb-5 leading-relaxed">
        Add or update where your household income comes from. Your situation may change over time — keep this current for the most accurate coaching.
      </p>

      <div className="space-y-2">
        {INCOME_TYPES.map(typeInfo => {
          const existing = sources.find(s => s.type === typeInfo.type);
          const isActive = !!existing;
          const Icon = typeInfo.icon;

          return (
            <div
              key={typeInfo.type}
              className={`border rounded-lg transition-all ${
                isActive ? 'border-brand-orange bg-orange-50' : 'border-brand-gray-border bg-white'
              }`}
            >
              <button
                type="button"
                onClick={() => toggleSource(typeInfo)}
                className="w-full flex items-center gap-3 p-4 text-left"
              >
                <Icon className={`w-5 h-5 shrink-0 ${isActive ? 'text-brand-orange' : 'text-brand-gray'}`} />
                <div className="flex-1 min-w-0">
                  <p className={`text-[13px] font-medium ${isActive ? 'text-brand-navy' : 'text-brand-navy'}`}>{typeInfo.label}</p>
                  <p className="text-[11px] text-brand-gray">{typeInfo.desc}</p>
                </div>
                <div
                  className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                    isActive ? 'border-brand-orange bg-brand-orange' : 'border-brand-gray-border bg-white'
                  }`}
                >
                  {isActive && <div className="w-2 h-2 rounded-full bg-white" />}
                </div>
              </button>

              {isActive && existing && (
                <div className="px-4 pb-4 space-y-3 border-t border-brand-gray-border pt-3">
                  {typeInfo.type === 'self_employed' && (
                    <div className="flex items-center gap-3 mb-2 flex-wrap">
                      <span className="text-xs font-medium text-brand-gray">Enter as:</span>
                      <button
                        type="button"
                        onClick={() => updateSource(typeInfo.type, { useAnnual: false })}
                        className={`text-xs px-3 py-1 rounded-full border transition-all ${
                          !existing.useAnnual
                            ? 'bg-brand-navy text-white border-brand-navy'
                            : 'bg-white text-brand-gray border-brand-gray-border'
                        }`}
                      >
                        Monthly
                      </button>
                      <button
                        type="button"
                        onClick={() => updateSource(typeInfo.type, { useAnnual: true })}
                        className={`text-xs px-3 py-1 rounded-full border transition-all ${
                          existing.useAnnual
                            ? 'bg-brand-navy text-white border-brand-navy'
                            : 'bg-white text-brand-gray border-brand-gray-border'
                        }`}
                      >
                        Annual (we&apos;ll average it)
                      </button>
                    </div>
                  )}

                  {(!existing.useAnnual || typeInfo.type !== 'self_employed') && (
                    <div>
                      {typeInfo.type === 'w2' ? (
                        <div className="space-y-3">
                          <div>
                            {showSecondW2Person && (
                              <label className="block text-xs font-medium text-brand-gray mb-1">
                                Person 1 — W2 / Salary
                              </label>
                            )}
                            <div className="flex items-center gap-3 mb-2 flex-wrap">
                              <span className="text-xs font-medium text-brand-gray">Enter as:</span>
                              <button
                                type="button"
                                onClick={() => setIsW2Annual(false)}
                                className={`text-xs px-3 py-1 rounded-full border transition-all ${
                                  !isW2Annual
                                    ? 'bg-brand-orange text-white border-brand-orange'
                                    : 'bg-white text-brand-gray border-brand-gray-border'
                                }`}
                              >
                                Monthly
                              </button>
                              <button
                                type="button"
                                onClick={() => setIsW2Annual(true)}
                                className={`text-xs px-3 py-1 rounded-full border transition-all ${
                                  isW2Annual
                                    ? 'bg-brand-navy text-white border-brand-navy'
                                    : 'bg-white text-brand-gray border-brand-gray-border'
                                }`}
                              >
                                Annual
                              </button>
                            </div>
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-brand-gray mb-1">
                              {isW2Annual ? 'Annual Take-Home Pay (after taxes)' : 'Take-Home Pay (after taxes)'}
                            </label>
                            <div className="relative">
                              <span className="absolute left-3 top-2 text-brand-gray text-sm">$</span>
                              <input
                                type="text"
                                value={
                                  (() => {
                                    const currentMonthlyValue = existing.w2Person1Net || existing.w2NetMonthlyAmount || '';
                                    const monthly = parseFloat(currentMonthlyValue.replace(/[^0-9.]/g, '')) || 0;
                                    if (currentMonthlyValue === '') return '';
                                    return isW2Annual ? (monthly * 12).toString() : currentMonthlyValue;
                                  })()
                                }
                                onChange={e => {
                                  const raw = e.target.value;
                                  const parsed = parseFloat(raw.replace(/[^0-9.]/g, '')) || 0;
                                  const monthlyValue = isW2Annual ? parsed / 12 : parsed;
                                  updateSource(typeInfo.type, {
                                    w2Person1Net: raw === '' ? '' : monthlyValue.toString(),
                                    w2NetMonthlyAmount: raw === '' ? '' : monthlyValue.toString(),
                                  });
                                }}
                                placeholder="0"
                                className="w-full pl-7 pr-4 py-2 border border-brand-gray-border rounded-md text-sm text-brand-navy focus:border-brand-navy outline-none"
                              />
                            </div>
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-brand-gray mb-1">
                              {isW2Annual
                                ? 'Gross Annual Salary (before taxes)'
                                : 'Gross Monthly Salary (before taxes)'}
                            </label>
                            <div className="relative">
                              <span className="absolute left-3 top-2 text-brand-gray text-sm">$</span>
                              <input
                                type="text"
                                value={
                                  (() => {
                                    const currentMonthlyValue = existing.w2Person1Gross || existing.w2GrossMonthlyAmount || '';
                                    const monthly = parseFloat(currentMonthlyValue.replace(/[^0-9.]/g, '')) || 0;
                                    if (currentMonthlyValue === '') return '';
                                    return isW2Annual ? (monthly * 12).toString() : currentMonthlyValue;
                                  })()
                                }
                                onChange={e => {
                                  const raw = e.target.value;
                                  const parsed = parseFloat(raw.replace(/[^0-9.]/g, '')) || 0;
                                  const monthlyValue = isW2Annual ? parsed / 12 : parsed;
                                  updateSource(typeInfo.type, {
                                    w2Person1Gross: raw === '' ? '' : monthlyValue.toString(),
                                    w2GrossMonthlyAmount: raw === '' ? '' : monthlyValue.toString(),
                                  });
                                }}
                                placeholder="0"
                                className="w-full pl-7 pr-4 py-2 border border-brand-gray-border rounded-md text-sm text-brand-navy focus:border-brand-navy outline-none"
                              />
                            </div>
                            <p className="text-[11px] text-brand-gray mt-1">
                              Used for mortgage qualification calculations only.
                            </p>
                          </div>
                          {showSecondW2Person && (
                            <div className="pt-2 mt-1 border-t border-brand-gray-border space-y-3">
                              <div>
                                <label className="block text-xs font-medium text-brand-gray mb-1">
                                  Person 2 — W2 / Salary
                                </label>
                                <div className="flex items-center gap-3 mb-2 flex-wrap">
                                  <span className="text-xs font-medium text-brand-gray">Enter as:</span>
                                  <button
                                    type="button"
                                    onClick={() => setIsW2Person2Annual(false)}
                                    className={`text-xs px-3 py-1 rounded-full border transition-all ${
                                      !isW2Person2Annual
                                        ? 'bg-brand-orange text-white border-brand-orange'
                                        : 'bg-white text-brand-gray border-brand-gray-border'
                                    }`}
                                  >
                                    Monthly
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setIsW2Person2Annual(true)}
                                    className={`text-xs px-3 py-1 rounded-full border transition-all ${
                                      isW2Person2Annual
                                        ? 'bg-brand-navy text-white border-brand-navy'
                                        : 'bg-white text-brand-gray border-brand-gray-border'
                                    }`}
                                  >
                                    Annual
                                  </button>
                                </div>
                              </div>
                              <div>
                                <label className="block text-xs font-medium text-brand-gray mb-1">
                                  {isW2Person2Annual ? 'Annual Take-Home Pay (after taxes)' : 'Take-Home Pay (after taxes)'}
                                </label>
                                <div className="relative">
                                  <span className="absolute left-3 top-2 text-brand-gray text-sm">$</span>
                                  <input
                                    type="text"
                                    value={
                                      (() => {
                                        const currentMonthlyValue = existing.w2Person2Net || '';
                                        const monthly = parseFloat(currentMonthlyValue.replace(/[^0-9.]/g, '')) || 0;
                                        if (currentMonthlyValue === '') return '';
                                        return isW2Person2Annual ? (monthly * 12).toString() : currentMonthlyValue;
                                      })()
                                    }
                                    onChange={e => {
                                      const raw = e.target.value;
                                      const parsed = parseFloat(raw.replace(/[^0-9.]/g, '')) || 0;
                                      const monthlyValue = isW2Person2Annual ? parsed / 12 : parsed;
                                      updateSource(typeInfo.type, { w2Person2Net: raw === '' ? '' : monthlyValue.toString() });
                                    }}
                                    placeholder="0"
                                    className="w-full pl-7 pr-4 py-2 border border-brand-gray-border rounded-md text-sm text-brand-navy focus:border-brand-navy outline-none"
                                  />
                                </div>
                              </div>
                              <div>
                                <label className="block text-xs font-medium text-brand-gray mb-1">
                                  {isW2Person2Annual
                                    ? 'Gross Annual Salary (before taxes)'
                                    : 'Gross Monthly Salary (before taxes)'}
                                </label>
                                <div className="relative">
                                  <span className="absolute left-3 top-2 text-brand-gray text-sm">$</span>
                                  <input
                                    type="text"
                                    value={
                                      (() => {
                                        const currentMonthlyValue = existing.w2Person2Gross || '';
                                        const monthly = parseFloat(currentMonthlyValue.replace(/[^0-9.]/g, '')) || 0;
                                        if (currentMonthlyValue === '') return '';
                                        return isW2Person2Annual ? (monthly * 12).toString() : currentMonthlyValue;
                                      })()
                                    }
                                    onChange={e => {
                                      const raw = e.target.value;
                                      const parsed = parseFloat(raw.replace(/[^0-9.]/g, '')) || 0;
                                      const monthlyValue = isW2Person2Annual ? parsed / 12 : parsed;
                                      updateSource(typeInfo.type, { w2Person2Gross: raw === '' ? '' : monthlyValue.toString() });
                                    }}
                                    placeholder="0"
                                    className="w-full pl-7 pr-4 py-2 border border-brand-gray-border rounded-md text-sm text-brand-navy focus:border-brand-navy outline-none"
                                  />
                                </div>
                                <p className="text-[11px] text-brand-gray mt-1">
                                  Used for mortgage qualification calculations only.
                                </p>
                              </div>
                            </div>
                          )}
                        </div>
                      ) : (
                        <>
                          <label className="block text-xs font-medium text-brand-gray mb-1">
                            {typeInfo.type === 'commission'
                          ? '12-month average monthly amount'
                          : typeInfo.type === 'rental'
                            ? 'Monthly rental income'
                            : 'Monthly amount (gross)'}
                          </label>
                          <div className="relative">
                            <span className="absolute left-3 top-2 text-brand-gray text-sm">$</span>
                            <input
                              type="text"
                              value={existing.monthlyAmount}
                              onChange={e => updateSource(typeInfo.type, { monthlyAmount: e.target.value })}
                              placeholder="0"
                              className="w-full pl-7 pr-4 py-2 border border-brand-gray-border rounded-md text-sm text-brand-navy focus:border-brand-navy outline-none"
                            />
                          </div>
                          {typeInfo.type === 'commission' && (
                            <p className="text-[11px] text-brand-gray mt-1">Add up last 12 months of commission and divide by 12</p>
                          )}
                        </>
                      )}
                    </div>
                  )}

                  {existing.useAnnual && typeInfo.type === 'self_employed' && (
                    <div>
                      <label className="block text-xs font-medium text-brand-gray mb-1">Annual amount</label>
                      <div className="relative">
                        <span className="absolute left-3 top-2 text-brand-gray text-sm">$</span>
                        <input
                          type="text"
                          value={existing.annualAmount}
                          onChange={e => updateSource(typeInfo.type, { annualAmount: e.target.value })}
                          placeholder="0"
                          className="w-full pl-7 pr-4 py-2 border border-brand-gray-border rounded-md text-sm text-brand-navy focus:border-brand-navy outline-none"
                        />
                      </div>
                      {existing.annualAmount && parseFloat(existing.annualAmount.replace(/[^0-9.]/g, '')) > 0 && (
                        <p className="text-[11px] text-brand-gray mt-2">
                          Using{' '}
                          <span className="font-medium text-brand-navy">
                            ${(parseFloat(existing.annualAmount.replace(/[^0-9.]/g, '')) / 12).toLocaleString('en-US', { maximumFractionDigits: 0 })}/month
                          </span>{' '}
                          as your monthly average for planning purposes
                        </p>
                      )}
                    </div>
                  )}

                  {typeInfo.type === 'other' && (
                    <div>
                      <label className="block text-xs font-medium text-brand-gray mb-1">Description (optional)</label>
                      <input
                        type="text"
                        value={existing.description}
                        onChange={e => updateSource(typeInfo.type, { description: e.target.value })}
                        placeholder="e.g. Social Security, pension"
                        className="w-full px-3 py-2 border border-brand-gray-border rounded-md text-sm text-brand-navy focus:border-brand-navy outline-none"
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {sources.length > 0 && totalMonthlyNet > 0 && (
        <div className="bg-brand-gray-light border border-brand-gray-border rounded-lg p-3 mt-4">
          <div className="flex justify-between items-center gap-3">
            <p className="text-xs text-brand-gray">Combined Household Take-Home Pay</p>
            <p className="text-base font-medium text-brand-navy">
              ${totalMonthlyNet.toLocaleString('en-US', { maximumFractionDigits: 0 })}
            </p>
          </div>
          <p className="text-[11px] text-brand-gray mt-1">
            Across {sources.length} income source{sources.length > 1 ? 's' : ''}. This total feeds into your monthly net income for payoff planning.
          </p>
        </div>
      )}

      <button
        type="button"
        onClick={handleSave}
        className="w-full mt-4 bg-brand-navy hover:bg-brand-navy-dark text-white text-[13px] font-medium py-2 px-4 rounded-lg transition-colors"
      >
        Save Income Sources
      </button>

      {showSuccess && (
        <div className="flex items-center gap-2 bg-green-50 border border-brand-green text-brand-green px-4 py-3 rounded-lg mt-3 text-sm">
          <CheckCircle className="w-4 h-4 shrink-0" />
          <span>Income sources saved</span>
        </div>
      )}
    </div>
  );
}
