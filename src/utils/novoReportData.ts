import type { Debt, HomeEquity, Strategy } from '../types';
import { StorageService } from '../services/storage';
import { CalculationService } from '../services/calculations';
import { getHomeReadyFullAnalysisForReport } from './homeReadySnapshot';

export type CoachingSeverity = 'red' | 'yellow' | 'green';

export interface CoachingFlagRow {
  severity: CoachingSeverity;
  text: string;
}

export interface NovoDebtPrintRow {
  account: string;
  category: string;
  balance: string;
  rate: string;
  minimum: string;
  status: string;
  note: string;
  isHighestRate: boolean;
}

export interface NovoPrintFullPayload {
  header: {
    userName: string;
    memberSince: string;
    generatedAt: string;
  };
  income: {
    grossMonthlyIncome: string;
    netMonthlyIncome: string;
    grossAnnualIncome: string;
    essentialExpenses: string;
    discretionaryExpenses: string;
    totalDebtMinimums: string;
    trueMonthlySurplus: string;
    monthlySavingsGoal: string;
    deployableCashAfterSavings: string;
    hasProfile: boolean;
  };
  debts: {
    rows: NovoDebtPrintRow[];
    totalBalance: string;
    totalMinimums: string;
    strategySummary: string;
    estimatedMonthsToDebtFree: string;
    projectedDebtFreeDate: string;
  };
  homeEquity: null | {
    addressOnFile: string | null;
    estimatedHomeValue: string;
    mortgageBalance: string;
    estimatedEquity: string;
    helocLimit: string;
    helocBalance: string;
    helocAvailable: string;
  };
  savings: {
    currentTotalBalance: string;
    monthlySavingsGoal: string;
    emergencyFundStatus: string;
    downPaymentProgress: string;
    monthsToReachDownPayment: string;
    savingsFootnote: string;
  };
  homeReady: null | {
    targetHomePrice: string;
    downPayment: string;
    creditScoreRange: string;
    frontDti: string;
    backDti: string;
    readinessLevel: string;
    improvementBullets: string[];
    pmiEstimate: string;
    pmiDropoff: string;
  };
  coaching: { flags: CoachingFlagRow[] };
}

const fmt = (n: number) =>
  n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 });

const dash = '—';

function memberSinceLabel(): string {
  const times: number[] = [];
  for (const d of StorageService.getDebts()) {
    if (d.createdAt) times.push(new Date(d.createdAt).getTime());
  }
  for (const a of StorageService.getSavingsAccounts()) {
    if (a.createdAt) times.push(new Date(a.createdAt).getTime());
  }
  if (times.length === 0) return dash;
  const d = new Date(Math.min(...times));
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

function formatStrategySummary(strategy: Strategy | null, debts: Debt[]): string {
  if (!strategy) {
    return 'No saved strategy. Run the Strategy Wizard under Strategies to save a payoff plan.';
  }
  if (strategy.type === 'extra-payment') {
    const x = strategy.extraMonthlyPayment ?? 0;
    return `Extra payment / avalanche — approximately ${fmt(x)} per month toward debt (from last saved strategy).`;
  }
  if (strategy.type === 'heloc-velocity') {
    return 'HELOC velocity banking (from last saved strategy).';
  }
  if (strategy.type === 'hybrid') {
    const id = strategy.hybridTargetDebtId;
    const name = debts.find((d) => d.id === id)?.accountName ?? 'target debt';
    return `Hybrid strategy focused on ${name} (from last saved strategy).`;
  }
  return String(strategy.type);
}

function resolveHomeValue(homeEquity: HomeEquity | null, userAddress: string | null): string {
  if (homeEquity?.homeValue != null && homeEquity.homeValue > 0) {
    return fmt(homeEquity.homeValue);
  }
  if (userAddress && userAddress.trim()) {
    return `${dash} (add home value in Strategy Wizard / home equity — address on file is not a value estimate)`;
  }
  return dash;
}

export function assembleNovoReportPayload(): NovoPrintFullPayload {
  const profile = StorageService.getFinancialProfile();
  const debts = StorageService.getDebts();
  const transactions = StorageService.getTransactions();
  const strategy = StorageService.getStrategy();
  const strategyResult = StorageService.getStrategyResult();
  const homeEquity = StorageService.getHomeEquity();
  const savingsAccounts = StorageService.getSavingsAccounts();
  const helocTx = StorageService.getHELOCTransactions();

  const userName = (localStorage.getItem('userName') || '').trim() || 'NOVO user';
  const userAddress = localStorage.getItem('userAddress');
  const generatedAt = new Date().toLocaleString('en-US', { dateStyle: 'long', timeStyle: 'short' });

  const activeDebts = debts.filter((d) => !d.isPaidOff);
  const totalMinimumPayments = activeDebts.reduce((sum, d) => sum + d.minimumPayment, 0);

  const cashFlow = profile
    ? CalculationService.calculateCashFlow(
        profile.monthlyNetIncome,
        profile.monthlyEssentialExpenses,
        profile.monthlyDiscretionaryExpenses,
        totalMinimumPayments,
        profile.monthlySavingsGoal ?? 0,
        profile.surplusCommitmentPercent ?? 100
      )
    : null;

  const income = profile
    ? {
        hasProfile: true,
        grossMonthlyIncome: fmt(profile.monthlyGrossIncome),
        netMonthlyIncome: fmt(profile.monthlyNetIncome),
        grossAnnualIncome: fmt(profile.monthlyGrossIncome * 12),
        essentialExpenses: fmt(profile.monthlyEssentialExpenses),
        discretionaryExpenses: fmt(profile.monthlyDiscretionaryExpenses),
        totalDebtMinimums: fmt(totalMinimumPayments),
        trueMonthlySurplus: fmt(cashFlow!.grossSurplus),
        monthlySavingsGoal: fmt(profile.monthlySavingsGoal ?? 0),
        deployableCashAfterSavings: fmt(cashFlow!.recommendedExtraPayment),
      }
    : {
        hasProfile: false,
        grossMonthlyIncome: dash,
        netMonthlyIncome: dash,
        grossAnnualIncome: dash,
        essentialExpenses: dash,
        discretionaryExpenses: dash,
        totalDebtMinimums: fmt(totalMinimumPayments),
        trueMonthlySurplus: dash,
        monthlySavingsGoal: dash,
        deployableCashAfterSavings: dash,
      };

  const activeForRate = activeDebts.filter((d) => d.currentBalance > 0);
  let maxRate = -1;
  let highId: string | null = null;
  for (const d of activeForRate) {
    if (d.interestRate > maxRate) {
      maxRate = d.interestRate;
      highId = d.id;
    }
  }

  const debtRows: NovoDebtPrintRow[] = debts.map((d) => {
    const isHigh = !d.isPaidOff && d.id === highId && maxRate >= 0;
    return {
      account: d.accountName,
      category: d.category,
      balance: fmt(d.currentBalance),
      rate: `${d.interestRate}%`,
      minimum: fmt(d.minimumPayment),
      status: d.isPaidOff ? 'Paid off' : 'Active',
      note: isHigh ? 'Highest rate (active)' : '',
      isHighestRate: isHigh,
    };
  });

  const totalBal = debts.reduce((s, d) => s + d.currentBalance, 0);
  const totalMin = activeDebts.reduce((s, d) => s + d.minimumPayment, 0);

  let estimatedMonths = dash;
  let projectedDebtFreeDate = dash;
  if (activeDebts.length === 0) {
    estimatedMonths = debts.length === 0 ? '0 (no debts)' : '0 (nothing active)';
    projectedDebtFreeDate = 'N/A';
  } else if (profile && cashFlow) {
    const extra = Math.floor(Math.max(0, cashFlow.recommendedExtraPayment));
    const projection = CalculationService.projectDebtPayoff(activeDebts, extra);
    estimatedMonths = String(projection.totalMonths);
    projectedDebtFreeDate = CalculationService.formatDate(projection.debtFreeDate);
  } else if (strategyResult) {
    estimatedMonths = String(strategyResult.totalMonths);
    projectedDebtFreeDate = CalculationService.formatDate(strategyResult.debtFreeDate);
  }

  const metrics = CalculationService.calculateTotalDebtMetrics(debts, transactions);
  const helocBalanceStored = metrics.helocBalance;
  const helocLimit = homeEquity?.helocLimit ?? 0;
  const helocAvailable =
    helocLimit > 0 ? Math.max(0, helocLimit - helocBalanceStored) : 0;

  let homeEquityBlock: NovoPrintFullPayload['homeEquity'] = null;
  if (homeEquity?.ownsHome) {
    const hv = homeEquity.homeValue;
    const mb = homeEquity.mortgageBalance;
    const equity =
      hv != null && mb != null ? hv - mb : null;
    const hasHelocLine = Boolean(homeEquity.hasHELOC) || helocTx.length > 0;
    homeEquityBlock = {
      addressOnFile: userAddress?.trim() || null,
      estimatedHomeValue: resolveHomeValue(homeEquity, userAddress),
      mortgageBalance: mb != null ? fmt(mb) : dash,
      estimatedEquity: equity != null ? fmt(equity) : dash,
      helocLimit: helocLimit > 0 ? fmt(helocLimit) : dash,
      helocBalance: hasHelocLine ? fmt(helocBalanceStored) : dash,
      helocAvailable: hasHelocLine && helocLimit > 0 ? fmt(helocAvailable) : dash,
    };
  }

  const savingsMetrics = CalculationService.calculateSavingsMetrics(savingsAccounts);
  const totalSavings = savingsMetrics.totalSavings;
  const monthlyGoal = profile?.monthlySavingsGoal ?? 0;
  const emergencyStatus =
    totalSavings >= 1000
      ? `At or above a typical $1,000 starter emergency cushion (${fmt(totalSavings)} total savings).`
      : `Below a typical $1,000 starter cushion — currently ${fmt(totalSavings)} across savings accounts.`;

  const homeReady = getHomeReadyFullAnalysisForReport(profile, debts);
  const targetTwentyPct = homeReady ? homeReady.targetHomePrice * 0.2 : 60000;
  const gapDown = Math.max(0, targetTwentyPct - totalSavings);
  const monthlyTowardSavings = Math.max(
    savingsMetrics.monthlySavingsRate,
    monthlyGoal,
    1
  );
  const monthsToDown =
    gapDown <= 0
      ? '0 (already at or above 20% of sample $300k home)'
      : `${Math.ceil(gapDown / monthlyTowardSavings)} (illustrative: total savings vs 20% of sample $300k home, using max of this month’s net savings deposits or your monthly savings goal)`;

  const downProgress = homeReady
    ? `${fmt(totalSavings)} saved toward a 20% benchmark (${fmt(targetTwentyPct)}) on the sample ${homeReady.targetHomePriceFmt} scenario — ${Math.min(100, Math.round((totalSavings / targetTwentyPct) * 100))}% of that benchmark.`
    : 'Complete your financial profile to align down-payment benchmarks with the Home Ready scenario.';

  const savingsFootnote =
    'Emergency and down-payment lines use total savings across all NOVO savings accounts; allocate accounts in Savings for clearer tracking.';

  const coachingFlags: CoachingFlagRow[] = [];

  for (const d of debts) {
    if (d.isPaidOff) {
      coachingFlags.push({
        severity: 'green',
        text: `Win: ${d.accountName} is paid off.`,
      });
    } else if (d.interestRate > 15) {
      coachingFlags.push({
        severity: 'red',
        text: `High interest: ${d.accountName} at ${d.interestRate}% APR — prioritize payoff or consolidation.`,
      });
    }
  }

  if (homeReady) {
    if (homeReady.backDtiNum > 43) {
      coachingFlags.push({
        severity: 'red',
        text: `Back-end DTI (${homeReady.backDti}) exceeds 43% on the sample purchase — approval risk until debt or housing payment drops.`,
      });
    } else if (homeReady.backDtiNum > 36) {
      coachingFlags.push({
        severity: 'yellow',
        text: `Back-end DTI (${homeReady.backDti}) is above 36% on the sample purchase — consider debt paydown or a lower price.`,
      });
    }
    if (homeReady.downPct < 20) {
      coachingFlags.push({
        severity: 'yellow',
        text: `Less than 20% down on the sample scenario — PMI applies; building equity reduces monthly strain.`,
      });
    }
  }

  if (profile && cashFlow && cashFlow.grossSurplus < 500) {
    coachingFlags.push({
      severity: 'red',
      text: `True monthly surplus under $500 (${fmt(cashFlow.grossSurplus)}) after expenses and debt minimums — limited room for acceleration.`,
    });
  }

  if (coachingFlags.length === 0) {
    coachingFlags.push({
      severity: 'green',
      text: 'No automated flags triggered — keep updating NOVO as your situation changes.',
    });
  }

  const severityOrder: CoachingSeverity[] = ['red', 'yellow', 'green'];
  coachingFlags.sort((a, b) => severityOrder.indexOf(a.severity) - severityOrder.indexOf(b.severity));

  return {
    header: {
      userName,
      memberSince: memberSinceLabel(),
      generatedAt,
    },
    income,
    debts: {
      rows: debtRows,
      totalBalance: fmt(totalBal),
      totalMinimums: fmt(totalMin),
      strategySummary: formatStrategySummary(strategy, debts),
      estimatedMonthsToDebtFree: estimatedMonths,
      projectedDebtFreeDate,
    },
    homeEquity: homeEquityBlock,
    savings: {
      currentTotalBalance: fmt(totalSavings),
      monthlySavingsGoal: profile ? fmt(monthlyGoal) : dash,
      emergencyFundStatus: emergencyStatus,
      downPaymentProgress: downProgress,
      monthsToReachDownPayment: monthsToDown,
      savingsFootnote,
    },
    homeReady: homeReady
      ? {
          targetHomePrice: homeReady.targetHomePriceFmt,
          downPayment: homeReady.downPaymentFmt,
          creditScoreRange: homeReady.creditScoreRangeLabel,
          frontDti: homeReady.frontDti,
          backDti: homeReady.backDti,
          readinessLevel: homeReady.readinessLevel,
          improvementBullets: homeReady.improvementTips,
          pmiEstimate: homeReady.pmiEstimateLine,
          pmiDropoff: homeReady.pmiDropoffSummary,
        }
      : null,
    coaching: { flags: coachingFlags },
  };
}
