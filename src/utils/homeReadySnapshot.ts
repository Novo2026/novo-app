import type { Debt, FinancialProfile } from '../types';

/** Mirrors Home Ready tab defaults for a printable snapshot when a financial profile exists. */
type CreditScoreRange =
  | '760+'
  | '740-759'
  | '720-739'
  | '700-719'
  | '680-699'
  | '660-679'
  | '640-659'
  | '620-639';

const PMI_TABLE: Record<CreditScoreRange, readonly [number, number, number]> = {
  '760+': [0.41, 0.25, 0.19],
  '740-759': [0.54, 0.37, 0.26],
  '720-739': [0.65, 0.44, 0.33],
  '700-719': [0.77, 0.58, 0.41],
  '680-699': [0.93, 0.71, 0.54],
  '660-679': [1.15, 0.88, 0.67],
  '640-659': [1.4, 1.1, 0.85],
  '620-639': [1.75, 1.35, 1.05],
};

function getPmiLtvColumnIndex(ltvPercent: number): 0 | 1 | 2 | null {
  if (ltvPercent <= 80) return null;
  if (ltvPercent > 90) return 0;
  if (ltvPercent > 85) return 1;
  return 2;
}

interface CalcResult {
  monthlyPayment: number;
  downPct: number;
  loanAmount: number;
  ltvPercent: number;
}

function calcMortgage(
  homePrice: number,
  downPayment: number,
  rate: number,
  termYears: number,
  annualTax: number,
  annualInsurance: number,
  creditScoreRange: CreditScoreRange
): CalcResult | null {
  if (!homePrice || !rate || !termYears) return null;
  const loanAmount = homePrice - downPayment;
  if (loanAmount <= 0) return null;

  const monthlyRate = rate / 100 / 12;
  const n = termYears * 12;
  const pi =
    monthlyRate === 0
      ? loanAmount / n
      : (loanAmount * (monthlyRate * Math.pow(1 + monthlyRate, n))) /
        (Math.pow(1 + monthlyRate, n) - 1);

  const monthlyTax = annualTax / 12;
  const monthlyInsurance = annualInsurance / 12;
  const downPct = (downPayment / homePrice) * 100;
  const ltvPercent = (loanAmount / homePrice) * 100;

  let monthlyPMI = 0;
  if (downPct < 20) {
    const col = getPmiLtvColumnIndex(ltvPercent);
    if (col !== null) {
      const pmiAnnualPercent = PMI_TABLE[creditScoreRange][col];
      monthlyPMI = (loanAmount * (pmiAnnualPercent / 100)) / 12;
    }
  }

  return {
    monthlyPayment: pi + monthlyTax + monthlyInsurance + monthlyPMI,
    downPct,
    loanAmount,
    ltvPercent,
  };
}

function sumActiveDebtMinimums(debts: Debt[]): number {
  return debts.filter((d) => !d.isPaidOff).reduce((sum, d) => sum + (Number(d.minimumPayment) || 0), 0);
}

function getReadinessScore(
  result: CalcResult,
  monthlyGrossIncome: number,
  existingDebtMinimums: number
) {
  const housing = result.monthlyPayment;
  const frontDti = (housing / monthlyGrossIncome) * 100;
  const backDti = ((housing + existingDebtMinimums) / monthlyGrossIncome) * 100;
  if (frontDti <= 28 && backDti <= 36) {
    return { score: 'Strong' as const, msg: "You're in great shape on both housing ratio and total debt. Let's talk.", frontDti, backDti };
  }
  if (backDti <= 43) {
    return { score: 'Good' as const, msg: 'Solid position. Small changes to price, down payment, or debt can improve your ratios.', frontDti, backDti };
  }
  if (backDti <= 50) {
    return {
      score: 'Caution' as const,
      msg: 'Possible for some loan types, but lowering back-end DTI (debt paydown or lower housing payment) helps a lot.',
      frontDti,
      backDti,
    };
  }
  return { score: 'Not Yet' as const, msg: "NOVO's debt plan is your next step before buying.", frontDti, backDti };
}

const fmtUsd = (n: number) =>
  n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

/** Same default scenario as the Home Ready screen on first load. */
export function getHomeReadySnapshotForReport(profile: FinancialProfile | null, debts: Debt[]) {
  if (!profile || profile.monthlyGrossIncome <= 0) return null;

  const homePrice = 300_000;
  const downPayment = 15_000;
  const rate = 6.75;
  const termYears = 30;
  const annualTax = 3600;
  const annualInsurance = 1200;
  const creditScoreRange: CreditScoreRange = '740-759';

  const result = calcMortgage(homePrice, downPayment, rate, termYears, annualTax, annualInsurance, creditScoreRange);
  if (!result) return null;

  const monthlyDebtMinimums = sumActiveDebtMinimums(debts);
  const readiness = getReadinessScore(result, profile.monthlyGrossIncome, monthlyDebtMinimums);

  return {
    homePrice: fmtUsd(homePrice),
    downPayment: fmtUsd(downPayment),
    ratePercent: `${rate}%`,
    termYears,
    estimatedMonthlyPayment: fmtUsd(result.monthlyPayment),
    loanAmount: fmtUsd(result.loanAmount),
    downPct: `${result.downPct.toFixed(1)}%`,
    ltvPct: `${result.ltvPercent.toFixed(1)}%`,
    grossMonthlyIncome: fmtUsd(profile.monthlyGrossIncome),
    monthlyDebtMinimums: fmtUsd(monthlyDebtMinimums),
    readinessLevel: readiness.score,
    readinessMessage: readiness.msg,
    frontDti: `${readiness.frontDti.toFixed(1)}%`,
    backDti: `${readiness.backDti.toFixed(1)}%`,
  };
}
