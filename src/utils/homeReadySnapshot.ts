import type { Debt, FinancialProfile } from '../types';

/** Mirrors Home Ready tab defaults for analysis when a financial profile exists. */
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

interface CalcResultFull {
  monthlyPayment: number;
  principalAndInterest: number;
  monthlyTax: number;
  monthlyInsurance: number;
  monthlyPMI: number;
  downPct: number;
  loanAmount: number;
  ltvPercent: number;
  pmiAnnualPercent: number;
}

function calcMortgageFull(
  homePrice: number,
  downPayment: number,
  rate: number,
  termYears: number,
  annualTax: number,
  annualInsurance: number,
  creditScoreRange: CreditScoreRange
): CalcResultFull | null {
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
  let pmiAnnualPercent = 0;
  if (downPct < 20) {
    const col = getPmiLtvColumnIndex(ltvPercent);
    if (col !== null) {
      pmiAnnualPercent = PMI_TABLE[creditScoreRange][col];
      monthlyPMI = (loanAmount * (pmiAnnualPercent / 100)) / 12;
    }
  }

  return {
    monthlyPayment: pi + monthlyTax + monthlyInsurance + monthlyPMI,
    principalAndInterest: pi,
    monthlyTax,
    monthlyInsurance,
    monthlyPMI,
    downPct,
    loanAmount,
    ltvPercent,
    pmiAnnualPercent,
  };
}

function sumActiveDebtMinimums(debts: Debt[]): number {
  return debts.filter((d) => !d.isPaidOff).reduce((sum, d) => sum + (Number(d.minimumPayment) || 0), 0);
}

function getReadinessScore(
  result: CalcResultFull,
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

const fmtUsd2 = (n: number) =>
  n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Same default scenario as the Home Ready screen on first load. */
export function getHomeReadyFullAnalysisForReport(profile: FinancialProfile | null, debts: Debt[]) {
  if (!profile || profile.monthlyGrossIncome <= 0) return null;

  const homePrice = 300_000;
  const downPayment = 15_000;
  const rate = 6.75;
  const termYears = 30;
  const annualTax = 3600;
  const annualInsurance = 1200;
  const creditScoreRange: CreditScoreRange = '740-759';
  const creditScoreRangeLabel = '740–759 (default)';

  const result = calcMortgageFull(homePrice, downPayment, rate, termYears, annualTax, annualInsurance, creditScoreRange);
  if (!result) return null;

  const monthlyDebtMinimums = sumActiveDebtMinimums(debts);
  const readiness = getReadinessScore(result, profile.monthlyGrossIncome, monthlyDebtMinimums);

  const improvementTips: string[] = [];
  if (readiness.backDti > 43) {
    improvementTips.push('Lower back-end DTI below 43%: pay down revolving/installment debt, reduce the target home price, or increase documented income.');
  } else if (readiness.backDti > 36) {
    improvementTips.push('Improve back-end DTI toward the ~36% “ideal” band by paying down debts or lowering total housing payment.');
  }
  if (readiness.frontDti > 28) {
    improvementTips.push('Front-end DTI is above ~28%: consider a lower price, larger down payment, better rate, or lower taxes/insurance assumptions.');
  }
  if (result.downPct < 20) {
    improvementTips.push('Put 20% down to remove PMI at closing and reduce monthly obligation.');
  }
  if (readiness.score === 'Not Yet' || readiness.score === 'Caution') {
    improvementTips.push(readiness.msg);
  }
  if (improvementTips.length === 0) {
    improvementTips.push('Maintain income stability and keep paying down debts on schedule to preserve readiness.');
  }

  const pmiDropoffSummary =
    'PMI on conventional loans often drops after the loan balance reaches ~78–80% of the original value through scheduled paydown (and/or reappraisal in some cases). Putting 20%+ down avoids PMI at the start.';

  const pmiEstimateLine =
    result.monthlyPMI > 0
      ? `${fmtUsd2(result.monthlyPMI)}/mo (~${result.pmiAnnualPercent.toFixed(2)}% annual of loan, illustrative)`
      : 'None at this down payment / LTV (illustrative)';

  return {
    targetHomePriceFmt: fmtUsd(homePrice),
    targetHomePrice: homePrice,
    downPaymentFmt: fmtUsd(downPayment),
    downPayment: downPayment,
    downPct: result.downPct,
    creditScoreRangeLabel,
    ratePercent: `${rate}%`,
    termYears,
    frontDti: `${readiness.frontDti.toFixed(1)}%`,
    backDti: `${readiness.backDti.toFixed(1)}%`,
    frontDtiNum: readiness.frontDti,
    backDtiNum: readiness.backDti,
    readinessLevel: readiness.score,
    readinessNarrative: readiness.msg,
    pmiEstimateLine,
    pmiMonthly: result.monthlyPMI,
    pmiAnnualPercent: result.pmiAnnualPercent,
    improvementTips,
    pmiDropoffSummary,
    estimatedHousingPaymentFmt: fmtUsd(result.monthlyPayment),
    loanAmountFmt: fmtUsd(result.loanAmount),
    ltvPct: `${result.ltvPercent.toFixed(1)}%`,
  };
}
