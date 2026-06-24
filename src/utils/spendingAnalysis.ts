import type { FinancialProfile } from '../types';
import { CalculationService } from '../services/calculations';

export interface SpendingCategory {
  name: string;
  total: number;
  count: number;
  transactions: { date: string; description: string; amount: number }[];
}

export interface RecurringCharge {
  description: string;
  amount: number;
  frequency: 'weekly' | 'monthly' | 'unknown';
  lastSeen: string;
  occurrences: number;
  annualCost: number;
}

export interface SpendingAnalysis {
  periodLabel: string;
  totalIncome: number;
  totalExpenses: number;
  totalDebtPayments: number;
  netCashFlow: number;
  categories: SpendingCategory[];
  recurringCharges: RecurringCharge[];
  topSpendingCategory: SpendingCategory | null;
  potentialMonthlySavings: number;
  transactionCount: number;
}

interface CheckingTransaction {
  id: string;
  date: string;
  type: string;
  amount: number;
  description: string;
  balance: number;
  category?: string;
}

export function analyzeSpending(
  transactions: CheckingTransaction[],
  _profile: FinancialProfile | null,
  daysBack: number = 60
): SpendingAnalysis {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - daysBack);

  const recent = transactions.filter(t => new Date(t.date + 'T12:00:00') >= cutoff);
  const periodLabel = daysBack <= 31 ? 'Last 30 days' : 'Last 60 days';

  const totalIncome = recent
    .filter(t => t.type === 'deposit' || t.type === 'transfer_from_heloc')
    .reduce((sum, t) => sum + t.amount, 0);

  const totalDebtPayments = recent
    .filter(t => t.type === 'debt_payment')
    .reduce((sum, t) => sum + t.amount, 0);

  const totalExpenses = recent
    .filter(t => t.type === 'withdrawal' || t.type === 'transfer_to_savings' || t.type === 'transfer_to_checking' || t.type === 'transfer_to_heloc')
    .reduce((sum, t) => sum + t.amount, 0);

  const netCashFlow = totalIncome - totalExpenses - totalDebtPayments;

  const categoryMap: Record<string, SpendingCategory> = {};
  recent
    .filter(t => t.type === 'withdrawal')
    .forEach(t => {
      const cat = t.category || 'Other';
      if (!categoryMap[cat]) {
        categoryMap[cat] = { name: cat, total: 0, count: 0, transactions: [] };
      }
      categoryMap[cat].total += t.amount;
      categoryMap[cat].count += 1;
      categoryMap[cat].transactions.push({
        date: t.date,
        description: t.description,
        amount: t.amount,
      });
    });

  const categories = Object.values(categoryMap).sort((a, b) => b.total - a.total);
  const topSpendingCategory = categories[0] || null;

  const merchantMap: Record<string, { dates: string[]; amounts: number[]; description: string }> = {};

  recent
    .filter(t => t.type === 'withdrawal')
    .forEach(t => {
      const normalized = t.description
        .toUpperCase()
        .replace(/[^A-Z0-9 ]/g, '')
        .split(' ')
        .filter(Boolean)
        .slice(0, 4)
        .join(' ');

      if (!merchantMap[normalized]) {
        merchantMap[normalized] = { dates: [], amounts: [], description: t.description };
      }
      merchantMap[normalized].dates.push(t.date);
      merchantMap[normalized].amounts.push(t.amount);
    });

  const recurringCharges: RecurringCharge[] = Object.values(merchantMap)
    .filter(m => m.dates.length >= 2)
    .map(m => {
      const avgAmount = m.amounts.reduce((s, a) => s + a, 0) / m.amounts.length;
      const sortedDates = m.dates.sort();
      const lastSeen = sortedDates[sortedDates.length - 1];

      let frequency: 'weekly' | 'monthly' | 'unknown' = 'unknown';
      if (m.dates.length >= 2) {
        const daysBetween =
          (new Date(sortedDates[sortedDates.length - 1]).getTime() -
            new Date(sortedDates[0]).getTime()) /
          (1000 * 60 * 60 * 24) /
          (m.dates.length - 1);
        if (daysBetween <= 10) frequency = 'weekly';
        else if (daysBetween <= 35) frequency = 'monthly';
      }

      const annualCost =
        frequency === 'weekly'
          ? avgAmount * 52
          : frequency === 'monthly'
          ? avgAmount * 12
          : avgAmount * m.dates.length;

      return {
        description: m.description,
        amount: Math.round(avgAmount * 100) / 100,
        frequency,
        lastSeen,
        occurrences: m.dates.length,
        annualCost: Math.round(annualCost * 100) / 100,
      };
    })
    .sort((a, b) => b.annualCost - a.annualCost)
    .slice(0, 10);

  const topDiscretionary = categories.find(c =>
    ['Dining Out', 'Entertainment', 'Shopping/Clothing', 'Hobbies', 'Subscriptions', 'Other Discretionary'].includes(c.name)
  );
  const potentialMonthlySavings = topDiscretionary
    ? Math.round((topDiscretionary.total / (daysBack / 30)) / 2)
    : 0;

  return {
    periodLabel,
    totalIncome,
    totalExpenses,
    totalDebtPayments,
    netCashFlow,
    categories,
    recurringCharges,
    topSpendingCategory,
    potentialMonthlySavings,
    transactionCount: recent.length,
  };
}

export function buildSpendingAnalysisContext(analysis: SpendingAnalysis): string {
  if (analysis.transactionCount === 0) {
    return 'No transaction data available yet. The user has not imported a statement or logged transactions.';
  }

  const categoryLines = analysis.categories
    .slice(0, 6)
    .map(c => `  - ${c.name}: ${CalculationService.formatCurrency(c.total)} (${c.count} transactions)`)
    .join('\n');

  const recurringLines = analysis.recurringCharges
    .slice(0, 5)
    .map(r => `  - ${r.description}: ~${CalculationService.formatCurrency(r.amount)}/${r.frequency} (~${CalculationService.formatCurrency(r.annualCost)}/year)`)
    .join('\n');

  return `
SPENDING ANALYSIS — ${analysis.periodLabel}:
- Total income logged: ${CalculationService.formatCurrency(analysis.totalIncome)}
- Total expenses: ${CalculationService.formatCurrency(analysis.totalExpenses)}
- Debt payments made: ${CalculationService.formatCurrency(analysis.totalDebtPayments)}
- Net cash flow: ${CalculationService.formatCurrency(analysis.netCashFlow)}
- Transactions analyzed: ${analysis.transactionCount}

TOP SPENDING CATEGORIES:
${categoryLines || '  No categorized spending found'}

RECURRING CHARGES DETECTED:
${recurringLines || '  No recurring charges detected'}

POTENTIAL MONTHLY SAVINGS OPPORTUNITY: ${CalculationService.formatCurrency(analysis.potentialMonthlySavings)}
(Based on cutting top discretionary category in half)
`.trim();
}
