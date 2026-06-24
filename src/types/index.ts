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
  paidOffAt?: string;
  createdAt: string;
  originalAmount?: number;
  loanStartDate?: string;
  loanTerm?: number;
  loanTermUnit?: 'months' | 'years';
  isAmortized?: boolean;
  transferredToHELOC?: boolean;
  refinanceHistory?: RefinanceRecord[];
  introRate?: number;
  introEndDate?: string;
  rateAfterIntro?: number;
  homeSold?: boolean;
  homeSaleDate?: string;
  homeSalePrice?: number;
  homeSaleNetProceeds?: number;
  replacedByDebtId?: string;
  replacedDebtId?: string;
  replacedDebtName?: string;
  replacementRelationship?: 'upgraded' | 'downsized' | 'relocated' | 'investment';
  notes?: string;
}

export interface RefinanceRecord {
  id: string;
  date: string;
  type: 'refinance' | 'balance_transfer' | 'consolidation' | 'cash_out';
  previousBalance: number;
  newBalance: number;
  previousRate: number;
  newRate: number;
  previousPayment: number;
  newPayment: number;
  previousTerm?: number;
  newTerm?: number;
  newLender?: string;
  newAccountName?: string;
  introRate?: number;
  introEndDate?: string;
  rateAfterIntro?: number;
  notes?: string;
}

export type TransactionType = 'payment' | 'charge' | 'refinance';

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
  paidWithHELOC?: boolean;
  transferredToHELOC?: boolean;
  source?: 'direct' | 'heloc' | 'checking';
}

export type SavingsAccountType =
  | 'High-Yield Savings'
  | 'Money Market'
  | 'CD'
  | 'Checking'
  | 'Other';

export type SavingsTransactionType =
  | 'deposit'
  | 'withdrawal'
  | 'interest'
  | 'transfer'
  | 'transfer_to_checking'
  | 'transfer_from_checking';

export interface SavingsTransaction {
  id: string;
  date: string;
  type: SavingsTransactionType;
  amount: number;
  description: string;
  balanceAfter: number;
  category?: string;
  linkedCheckingTransactionId?: string;
  linkedCheckingAccountId?: string;
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
  monthlySavingsGoal?: number;
  surplusCommitmentPercent?: number;
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

export interface Milestone {
  id: string;
  type: 'debt_payoff' | 'goal_reached' | 'milestone';
  title: string;
  description: string;
  date: string;
  debtId?: string;
  debtName?: string;
  amount?: number;
  freedPayment?: number;
}

export interface HELOCTransaction {
  id: string;
  date: string;
  type: 'draw' | 'payment' | 'interest';
  amount: number;
  description: string;
  debtLinked?: string;
  balance: number;
  linkedCheckingTransactionId?: string;
  isTransferToChecking?: boolean;
  isTransferFromChecking?: boolean;
}

export interface CheckingAccount {
  id: string;
  name: string;
  bankName: string;
  accountType: 'checking' | 'savings';
  startingBalance: number;
  currentBalance: number;
  lastReconciledAt: string | null;
  lastReconciledBalance: number | null;
  createdAt: string;
  isDefault: boolean;
}

export type CheckingTransactionType =
  | 'deposit'
  | 'withdrawal'
  | 'debt_payment'
  | 'transfer_to_savings'
  | 'transfer_from_savings'
  | 'transfer_to_checking'
  | 'transfer_from_checking'
  | 'transfer_to_heloc'
  | 'transfer_from_heloc'
  | 'internal_transfer'
  | 'bill_payment'
  | 'other';

export interface CheckingTransaction {
  id: string;
  accountId: string;
  date: string;
  type: CheckingTransactionType;
  amount: number;
  description: string;
  balance: number;
  category?: string;
  subcategory?: string;
  isReconciled: boolean;
  reconciledAt?: string;
  debtId?: string;
  debtName?: string;
  linkedHelocTransactionId?: string;
  linkedCheckingTransactionId?: string;
  linkedSavingsTransactionId?: string;
  isTransferToHeloc?: boolean;
  isTransferFromHeloc?: boolean;
}

export type UnifiedActivityType =
  | 'debt_payment'
  | 'debt_charge'
  | 'heloc_draw'
  | 'heloc_payment'
  | 'heloc_interest'
  | 'checking_deposit'
  | 'checking_withdrawal'
  | 'checking_transfer'
  | 'milestone';

export interface UnifiedActivity {
  id: string;
  date: string;
  type: UnifiedActivityType;
  description: string;
  amount?: number;
  icon: string;
  source: 'debt' | 'heloc' | 'checking' | 'milestone';
  transaction?: Transaction | HELOCTransaction | CheckingTransaction;
}

export interface FeaturePreferences {
  helocEnabled: boolean;
  checkingEnabled: boolean;
}

export interface AppData {
  debts: Debt[];
  transactions: Transaction[];
  savingsAccounts: SavingsAccount[];
  milestones?: Milestone[];
  financialProfile?: FinancialProfile;
  homeEquity?: HomeEquity;
  strategy?: Strategy;
  strategyResult?: StrategyResult;
  featurePreferences?: FeaturePreferences;
}

export type UnifiedPaymentSource = 'direct' | 'heloc' | 'checking';

export interface UnifiedPayment {
  id: string;
  date: string;
  debtId: string;
  debtName: string;
  amount: number;
  source: UnifiedPaymentSource;
  interestCharged: number;
  principalPaid: number;
  previousBalance: number;
  newBalance: number;
  description?: string;
  isPaidOff?: boolean;
  transferredToHELOC?: boolean;
}
