export type DebtCategory =
  | 'Mortgage'
  | 'Auto Loan'
  | 'Student Loan'
  | 'Credit Card'
  | 'Personal Loan'
  | 'HELOC'
  | 'Other';

export interface Debt {
  id: string;
  accountName: string;
  category: DebtCategory;
  startingBalance: number;
  currentBalance: number;
  interestRate: number;
  minimumPayment: number;
  isPaidOff: boolean;
  paidOffDate?: string;
  createdAt: string;
  originalAmount?: number;
  loanStartDate?: string;
  isAmortized?: boolean;
}

export type TransactionType = 'payment' | 'charge';

export interface Transaction {
  id: string;
  debtId: string;
  debtName: string;
  date: string;
  type: TransactionType;
  amount: number;
  previousBalance: number;
  interestCharged: number;
  principalPaid: number;
  newBalance: number;
  isExtraPayment?: boolean;
  notes?: string;
}

export type SavingsAccountType =
  | 'High-Yield Savings'
  | 'Money Market'
  | 'CD'
  | 'Checking'
  | 'Other';

export type SavingsTransactionType = 'deposit' | 'withdrawal' | 'interest';

export interface SavingsTransaction {
  id: string;
  date: string;
  type: SavingsTransactionType;
  amount: number;
  description: string;
  balanceAfter: number;
}

export interface SavingsAccount {
  id: string;
  name: string;
  type: SavingsAccountType;
  balance: number;
  interestRate: number;
  goalAmount: number | null;
  notes: string;
  transactions: SavingsTransaction[];
  createdAt: string;
}

export interface FinancialProfile {
  monthlyGrossIncome: number;
  monthlyNetIncome: number;
  monthlyEssentialExpenses: number;
  monthlyDiscretionaryExpenses: number;
}

export interface HomeEquity {
  ownsHome: boolean;
  homeValue?: number;
  mortgageBalance?: number;
  hasHELOC?: boolean;
  helocLimit?: number;
  helocBalance?: number;
  helocRate?: number;
  helocMinPayment?: number;
}

export type StrategyType = 'extra-payment' | 'heloc-velocity' | 'hybrid';

export interface Strategy {
  type: StrategyType;
  extraMonthlyPayment?: number;
  helocLimit?: number;
  helocRate?: number;
  monthlyCashFlow?: number;
  hybridTargetDebtId?: string;
  calculatedAt: string;
}

export interface StrategyResult {
  strategy: Strategy;
  debtFreeDate: string;
  totalMonths: number;
  totalInterest: number;
  totalPaid: number;
  payoffTimeline: {
    debtId: string;
    debtName: string;
    payoffMonth: number;
    payoffDate: string;
  }[];
  monthlyProjections: {
    month: number;
    date: string;
    debts: {
      debtId: string;
      balance: number;
      payment: number;
      interest: number;
      principal: number;
    }[];
    totalBalance: number;
    helocBalance?: number;
  }[];
  helocBalance?: number;
  helocTimeline?: {
    month: number;
    action: string;
    amount: number;
    balance: number;
  }[];
}

export interface AppData {
  debts: Debt[];
  transactions: Transaction[];
  savingsAccounts: SavingsAccount[];
  financialProfile?: FinancialProfile;
  homeEquity?: HomeEquity;
  strategy?: Strategy;
  strategyResult?: StrategyResult;
}
