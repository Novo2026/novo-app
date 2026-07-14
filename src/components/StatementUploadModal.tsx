import { useState, useRef } from 'react';
import { Upload, X, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { CalculationService } from '../services/calculations';
import { StorageService, type ImportDuplicateFlag, type SmartImportMatch } from '../services/storage';
import type { Debt, CheckingTransaction, CheckingAccount } from '../types';

interface ParsedTransaction {
  id: string;
  date: string;
  description: string;
  originalDescription: string;
  amount: number;
  type: 'deposit' | 'withdrawal' | 'debt_payment';
  category?: string;
  approved: boolean;
  debit?: number;
  credit?: number;
  runningBalance?: number;
  accountSection?: string;
}

interface StatementBalanceMeta {
  beginningBalance?: number;
  endingBalance?: number;
}

interface StatementSummaryMeta {
  summaryBeginningBalance?: number;
  summaryEndingBalance?: number;
  statementStartDate?: string;
}

type ImportStep =
  | 'upload'
  | 'balance_conflict'
  | 'preview'
  | 'import_choice'
  | 'replace_confirm'
  | 'smart_summary'
  | 'smart_review'
  | 'credit_card_confirm'
  | 'importing';

type ImportMode = 'normal' | 'smart' | 'replace' | 'add_anyway';

type BalanceConflictChoice = 'keep' | 'update';

type StatementType = 'checking' | 'credit_card' | 'savings' | 'unknown';

interface StatementDetectionResult {
  type: StatementType;
  accountName: string;
  lastFourDigits?: string;
  statementBalance?: number;
  beginningBalance?: number;
  endingBalance?: number;
  statementStartDate?: string;
  minimumPayment?: number;
  dueDate?: string;
  confidence: 'high' | 'low';
}

export interface CreditCardImportResult {
  debtId: string;
  debtName: string;
  newBalance: number;
  transactions: ParsedTransaction[];
  minimumPayment?: number;
  dueDate?: string;
}

interface StatementUploadModalProps {
  onClose: () => void;
  onSuccess: (message: string) => void;
  startingBalance: number;
  currentBalance: number;
  defaultCheckingAccountId?: string;
}

const CATEGORY_OPTIONS = [
  'deposit',
  'Essential Expense',
  'Discretionary Expense',
  'Debt Payment',
  'Other Withdrawal',
];

function detectType(description: string, amount: number): 'deposit' | 'withdrawal' | 'debt_payment' {
  if (amount > 0) return 'deposit';
  const lower = description.toLowerCase();
  if (
    lower.includes('loan') || lower.includes('mortgage') || lower.includes('visa pmt') ||
    lower.includes('mastercard') || lower.includes('auto pay') || lower.includes('credit card') ||
    lower.includes('student') || lower.includes('chase pmt') || lower.includes('payment')
  ) return 'debt_payment';
  return 'withdrawal';
}

const EXCLUDED_ACCOUNT_SECTION_PATTERNS = [
  '351',
  '352',
  '353',
  '354',
  '355',
  '356',
  'savings',
  'ira',
  'vacation',
  'insurance',
  'misc',
  'tax relief',
  'class of',
  'house',
];

const KEEP_ACCOUNT_SECTION_PATTERNS = ['checking', 'draft', '601'];

function filterCheckingSectionTransactions(transactions: ParsedTransaction[]): ParsedTransaction[] {
  const uniqueSections = new Set(
    transactions.map((tx) => {
      const section = tx.accountSection?.trim();
      if (!section || section.toLowerCase() === 'unknown') return '(none)';
      return section.toLowerCase();
    })
  );

  // Single-account statement (e.g. WesBanco "One Account") — nothing to disambiguate.
  if (uniqueSections.size <= 1) {
    return transactions;
  }

  // Multi-account statement (e.g. Hancock CU) — keep checking/draft sections only.
  return transactions.filter((tx) => {
    const section = tx.accountSection;
    if (!section || section.toLowerCase() === 'unknown') {
      return true;
    }

    const lower = section.toLowerCase();
    if (EXCLUDED_ACCOUNT_SECTION_PATTERNS.some((pattern) => lower.includes(pattern))) {
      return false;
    }

    return KEEP_ACCOUNT_SECTION_PATTERNS.some((pattern) => lower.includes(pattern));
  });
}

function parseCSV(text: string): ParsedTransaction[] {
  const lines = text.trim().split('\n');
  const results: ParsedTransaction[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',').map(c => c.replace(/"/g, '').trim());
    if (cols.length < 3) continue;

    const date = cols[0];
    const description = cols[1];
    let amount = 0;
    let debit = 0;
    let credit = 0;
    let runningBalance: number | undefined;

    if (cols.length >= 5) {
      debit = Math.abs(parseFloat(cols[2].replace(/[^0-9.-]/g, '')) || 0);
      credit = Math.abs(parseFloat(cols[3].replace(/[^0-9.-]/g, '')) || 0);
      const balanceValue = parseFloat(cols[4].replace(/[^0-9.-]/g, ''));
      runningBalance = Number.isFinite(balanceValue) ? Math.abs(balanceValue) : undefined;
      amount = credit > 0 ? credit : debit > 0 ? -debit : 0;
    } else if (cols.length >= 4 && (cols[2] !== '' || cols[3] !== '')) {
      debit = Math.abs(parseFloat(cols[2].replace(/[^0-9.-]/g, '')) || 0);
      credit = Math.abs(parseFloat(cols[3].replace(/[^0-9.-]/g, '')) || 0);
      amount = credit > 0 ? credit : debit > 0 ? -debit : 0;
    } else {
      amount = parseFloat(cols[2].replace(/[^0-9.-]/g, '')) || 0;
    }

    if (!date || !description) continue;

    const isBalanceOnlyRow =
      matchesBeginningBalanceDescription(description) ||
      matchesEndingBalanceDescription(description);

    if (amount === 0 && runningBalance == null && !isBalanceOnlyRow) continue;

    const dateObj = new Date(date);
    if (isNaN(dateObj.getTime())) continue;
    const normalizedDate = dateObj.toISOString().split('T')[0];

    const type = amount === 0 ? 'deposit' : detectType(description, amount);

    results.push({
      id: `import_${Date.now()}_${i}`,
      date: normalizedDate,
      description,
      originalDescription: description,
      amount: Math.abs(amount),
      type,
      category: type === 'withdrawal' ? 'Essential Expense' : undefined,
      approved: true,
      debit,
      credit,
      runningBalance,
    });
  }

  return results;
}

const BEGINNING_BALANCE_PHRASES = [
  'beginning balance',
  'starting balance',
  'opening balance',
  'beg balance',
  'start bal',
  'prev balance',
  'previous balance',
  'balance forward',
  'prior balance',
];

function matchesBeginningBalanceDescription(description: string): boolean {
  const lower = description.toLowerCase().trim();
  return BEGINNING_BALANCE_PHRASES.some((phrase) => lower.includes(phrase));
}

function matchesEndingBalanceDescription(description: string): boolean {
  const lower = description.toLowerCase();
  return (
    lower.includes('ending balance') ||
    lower.includes('closing balance') ||
    lower.includes('new balance')
  );
}

function getBeginningBalanceAmount(tx: ParsedTransaction): number | undefined {
  const debit = tx.debit ?? 0;
  const credit = tx.credit ?? 0;

  if (tx.runningBalance != null && debit === 0 && credit === 0) {
    return tx.runningBalance;
  }

  if (tx.amount > 0) {
    return tx.amount;
  }

  if (tx.runningBalance != null && tx.runningBalance > 0) {
    return tx.runningBalance;
  }

  return undefined;
}

function analyzeStatementBalanceEntries(
  parsedTransactions: ParsedTransaction[],
  summary: StatementSummaryMeta = {}
): { transactions: ParsedTransaction[]; meta: StatementBalanceMeta } {
  let beginningBalance = summary.summaryBeginningBalance;
  let endingBalance = summary.summaryEndingBalance;

  const formatDIndex =
    summary.summaryBeginningBalance != null
      ? parsedTransactions.findIndex((tx) => {
          const debit = tx.debit ?? 0;
          const credit = tx.credit ?? 0;
          const balanceAmount = tx.runningBalance ?? tx.amount;
          return (
            debit === 0 &&
            credit === 0 &&
            Math.abs(balanceAmount - summary.summaryBeginningBalance!) <= 0.02
          );
        })
      : -1;

  const filtered = parsedTransactions.filter((tx, index) => {
    const lower = tx.description.toLowerCase().trim();
    const debit = tx.debit ?? 0;
    const credit = tx.credit ?? 0;

    const isFormatA =
      index === 0 &&
      (lower === 'beginning balance' || lower === 'beginning bal' || matchesBeginningBalanceDescription(tx.description));

    const isFormatB =
      matchesBeginningBalanceDescription(tx.description) &&
      debit === 0 &&
      credit === 0 &&
      tx.runningBalance != null &&
      (summary.statementStartDate == null || tx.date === summary.statementStartDate);

    const isFormatC = matchesBeginningBalanceDescription(tx.description);

    const isFormatD = index === formatDIndex;

    if (isFormatA || isFormatB || isFormatC || isFormatD) {
      const amount = getBeginningBalanceAmount(tx);
      if (amount != null) {
        beginningBalance = amount;
      } else if (summary.summaryBeginningBalance != null) {
        beginningBalance = summary.summaryBeginningBalance;
      }
      return false;
    }

    if (matchesEndingBalanceDescription(tx.description)) {
      const amount = getBeginningBalanceAmount(tx) ?? tx.amount;
      if (amount > 0) {
        endingBalance = amount;
      }
      return false;
    }

    return true;
  });

  return {
    transactions: filtered,
    meta: { beginningBalance, endingBalance },
  };
}

function evaluateStartingBalanceConflict(
  accountStartingBalance: number,
  statementBeginningBalance?: number
): {
  infoMessage: string;
  needsConflictStep: boolean;
  resolvedStartingBalance: number;
  shouldUpdateStartingBalance: boolean;
} {
  if (statementBeginningBalance == null) {
    return {
      infoMessage: '',
      needsConflictStep: false,
      resolvedStartingBalance: accountStartingBalance,
      shouldUpdateStartingBalance: false,
    };
  }

  const hasExistingStartingBalance = Math.abs(accountStartingBalance) > 0.001;

  if (!hasExistingStartingBalance) {
    return {
      infoMessage: `ℹ️ Starting balance set to ${CalculationService.formatCurrency(statementBeginningBalance)} from statement`,
      needsConflictStep: false,
      resolvedStartingBalance: statementBeginningBalance,
      shouldUpdateStartingBalance: true,
    };
  }

  if (Math.abs(accountStartingBalance - statementBeginningBalance) <= 0.02) {
    return {
      infoMessage: `ℹ️ Beginning balance of ${CalculationService.formatCurrency(statementBeginningBalance)} excluded from import (already set on your account)`,
      needsConflictStep: false,
      resolvedStartingBalance: accountStartingBalance,
      shouldUpdateStartingBalance: false,
    };
  }

  return {
    infoMessage: '',
    needsConflictStep: true,
    resolvedStartingBalance: accountStartingBalance,
    shouldUpdateStartingBalance: false,
  };
}

async function detectStatementType(file: File, base64: string): Promise<StatementDetectionResult> {
  const isPDF = file.name.endsWith('.pdf');

  if (!isPDF) {
    const text = await file.text();
    const firstLines = text.split('\n').slice(0, 5).join('\n').toLowerCase();
    if (
      firstLines.includes('credit card') ||
      firstLines.includes('minimum payment') ||
      firstLines.includes('payment due') ||
      firstLines.includes('new balance')
    ) {
      return { type: 'credit_card', accountName: 'Credit Card', confidence: 'low' };
    }
    return { type: 'checking', accountName: 'Checking Account', confidence: 'high' };
  }

  const response = await fetch('/.netlify/functions/anthropic-proxy', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 500,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'document',
            source: { type: 'base64', media_type: 'application/pdf', data: base64 },
          },
          {
            type: 'text',
            text: `Analyze this financial statement and return ONLY a JSON object with these fields:
{
  "type": "checking" or "credit_card" or "savings" or "unknown",
  "accountName": "the bank and account name e.g. Chase Sapphire Preferred or Chase Total Checking",
  "lastFourDigits": "last 4 digits of account/card number if visible, or null",
  "statementBalance": the current/new balance as a number if this is a credit card, or null,
  "beginningBalance": the opening/beginning balance from the Activity Summary or account summary section as a number if visible, or null,
  "endingBalance": the closing/ending balance from the Activity Summary or account summary section as a number if visible, or null,
  "statementStartDate": "statement period start date in YYYY-MM-DD format if visible, or null",
  "minimumPayment": the minimum payment due as a number if visible, or null,
  "dueDate": "payment due date in YYYY-MM-DD format if visible, or null",
  "confidence": "high" if you are certain of the type, "low" if uncertain
}
Return ONLY the JSON, no other text.`,
          },
        ],
      }],
    }),
  });

  if (!response.ok) return { type: 'unknown', accountName: '', confidence: 'low' };

  const data = await response.json();
  const text = data.content?.[0]?.text || '';

  try {
    const clean = text.replace(/```json|```/g, '').trim();
    return JSON.parse(clean);
  } catch {
    return { type: 'unknown', accountName: '', confidence: 'low' };
  }
}

function findMatchingDebt(detection: StatementDetectionResult, debts: Debt[]): Debt | null {
  const creditCardDebts = debts.filter(d => d.category === 'Credit Card' && !d.isPaidOff);
  if (creditCardDebts.length === 0) return null;

  const accountName = detection.accountName.toLowerCase();
  const lastFour = detection.lastFourDigits;

  if (lastFour) {
    const match = creditCardDebts.find(d => d.accountName.includes(lastFour));
    if (match) return match;
  }

  const keywords = accountName.split(' ').filter(w => w.length > 3);
  for (const debt of creditCardDebts) {
    const debtName = debt.accountName.toLowerCase();
    if (keywords.some(kw => debtName.includes(kw))) return debt;
  }

  const banks = ['chase', 'bank of america', 'wells fargo', 'citi', 'capital one', 'discover', 'amex', 'american express', 'synchrony', 'barclays'];
  for (const bank of banks) {
    if (accountName.includes(bank)) {
      const match = creditCardDebts.find(d => d.accountName.toLowerCase().includes(bank));
      if (match) return match;
    }
  }

  return null;
}

async function importCreditCardStatement(
  transactions: ParsedTransaction[],
  matchedDebt: Debt,
  detection: StatementDetectionResult
): Promise<void> {
  const batchId = `import_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const batchTimestamp = new Date().toISOString();

  if (detection.statementBalance != null && detection.statementBalance >= 0) {
    const allDebts = StorageService.getDebts();
    const debtIndex = allDebts.findIndex(d => d.id === matchedDebt.id);
    if (debtIndex !== -1) {
      allDebts[debtIndex].currentBalance = detection.statementBalance;
      StorageService.saveDebts(allDebts);
    }
  }

  // Credit card PURCHASES do not go to checking tracker — spending analysis only
  const payments = transactions.filter(t => t.type === 'deposit');
  if (payments.length > 0) {
    // Credit card payments cross-post to checking as debt_payment
    const accounts = StorageService.getCheckingAccounts();
    const defaultAccountId = accounts.find(a => a.isDefault)?.id || accounts[0]?.id || 'default_checking';
    const defaultAccount = accounts.find(a => a.id === defaultAccountId);
    const startingBalance = defaultAccount?.startingBalance ?? 0;

    const existing = StorageService.getCheckingTransactionsForAccount(defaultAccountId);

    const newPaymentTxs = payments.map(p => ({
      id: `cc_payment_${Date.now()}_${Math.random()}`,
      accountId: defaultAccountId,
      date: p.date,
      type: 'debt_payment' as const,
      amount: p.amount,
      description: `Payment — ${matchedDebt.accountName}`,
      originalDescription: p.originalDescription || p.description,
      source: 'import' as const,
      batchId,
      batchTimestamp,
      balance: 0,
      debtId: matchedDebt.id,
      isReconciled: false,
    }));

    const combined = [...existing, ...newPaymentTxs]
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    let running = startingBalance;
    combined.forEach((tx: { type: string; amount: number; balance: number }) => {
      if (tx.type === 'deposit' || tx.type === 'transfer_from_heloc') {
        running += tx.amount;
      } else {
        running -= tx.amount;
      }
      running = Math.max(0, running);
      tx.balance = Math.round(running * 100) / 100;
    });

    StorageService.saveCheckingTransactionsForAccount(defaultAccountId, combined);
    StorageService.syncCheckingAccountBalance(defaultAccountId, combined as CheckingTransaction[]);

    const paymentDates = newPaymentTxs.map((t) => t.date).sort();
    const totalDebits = newPaymentTxs.reduce((sum, t) => sum + t.amount, 0);
    const totalCredits = 0;
    StorageService.saveBatchRecord({
      batchId,
      accountId: defaultAccountId,
      accountName: defaultAccount?.name || 'Primary Checking',
      importedAt: batchTimestamp,
      transactionCount: newPaymentTxs.length,
      dateRangeStart: paymentDates[0],
      dateRangeEnd: paymentDates[paymentDates.length - 1],
      totalDebits,
      totalCredits,
      status: 'active',
    });
  }
}

async function parsePDFWithAI(file: File): Promise<ParsedTransaction[]> {
  const base64 = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(',')[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  const response = await fetch('/.netlify/functions/anthropic-proxy', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 4096,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'document',
            source: { type: 'base64', media_type: 'application/pdf', data: base64 },
          },
          {
            type: 'text',
            text: `This is a bank statement. It may contain multiple account sections (checking, savings, sub-accounts, etc).

Your task:
1. First identify all account sections in this statement
2. Find the PRIMARY CHECKING or DRAFT account section — look for keywords like 'Checking', 'Draft', 'Share Draft', 'Everyday Checking', 'Classic Checking' in the section headers
3. If multiple checking accounts exist, extract from ALL of them
4. EXCLUDE these account types entirely: Savings, IRA, Money Market, CD, Tax Relief, Vacation, Insurance, Misc, Class Of, House, sub-savings accounts (these typically have 3-digit section numbers like 351, 352, 353 etc)
5. Extract ONLY transactions from the checking section(s)

For each transaction return ONLY a JSON array, no other text, no markdown:
{
  'date': 'YYYY-MM-DD',
  'description': 'merchant or transaction name',
  'amount': 123.45,
  'isDeposit': true or false,
  'debit': 0 or the debit/withdrawal amount as a positive number,
  'credit': 0 or the credit/deposit amount as a positive number,
  'runningBalance': the balance column value after this row as a number or null,
  'accountSection': the section name or number this transaction came from
}

Amount should always be a positive number.
Exclude beginning balance and ending balance rows.
Exclude dividend entries.
Exclude rows with no debit or credit amount.
If you cannot identify a checking section, extract all transactions but flag each with accountSection name.`,
          },
        ],
      }],
    }),
  });

  if (!response.ok) throw new Error('Failed to parse PDF');

  const data = await response.json();
  const text = data.content?.[0]?.text || '';

  let parsed: {
    date: string;
    description: string;
    amount: number;
    isDeposit: boolean;
    debit?: number;
    credit?: number;
    runningBalance?: number | null;
    accountSection?: string | null;
  }[] = [];
  try {
    const clean = text.replace(/```json|```/g, '').trim();
    parsed = JSON.parse(clean);
  } catch {
    throw new Error('Could not read transactions from PDF. Try uploading a CSV instead.');
  }

  const mapped = parsed.map((item, i) => {
    const debit = Math.abs(item.debit ?? 0);
    const credit = Math.abs(item.credit ?? 0);
    const runningBalance =
      item.runningBalance != null && Number.isFinite(item.runningBalance)
        ? Math.abs(item.runningBalance)
        : undefined;
    const amount = Math.abs(item.amount);
    const type =
      amount === 0 && matchesBeginningBalanceDescription(item.description)
        ? 'deposit'
        : detectType(item.description, item.isDeposit ? 1 : -1);
    return {
      id: `import_pdf_${Date.now()}_${i}`,
      date: item.date,
      description: item.description,
      originalDescription: item.description,
      amount,
      type,
      category: type === 'withdrawal' ? 'Essential Expense' : undefined,
      approved: true,
      debit,
      credit,
      runningBalance,
      accountSection: item.accountSection ?? undefined,
    };
  });

  return filterCheckingSectionTransactions(mapped);
}

function recalculateImportedBalances(
  existingTransactions: {
    id: string;
    date: string;
    type: string;
    amount: number;
    description: string;
    originalDescription?: string;
    balance: number;
    category?: string;
    source?: 'import' | 'manual';
    batchId?: string;
    batchTimestamp?: string;
  }[],
  newTransactions: ParsedTransaction[],
  startingBalance: number
) {
  const combined = [
    ...existingTransactions,
    ...newTransactions.map(t => ({
      id: t.id,
      date: t.date,
      type: t.type,
      amount: t.amount,
      description: t.description,
      originalDescription: t.originalDescription || t.description,
      balance: 0,
      category: t.category,
      source: (t as ParsedTransaction & { source?: 'import' | 'manual' }).source || 'import',
      batchId: (t as ParsedTransaction & { batchId?: string }).batchId,
      batchTimestamp: (t as ParsedTransaction & { batchTimestamp?: string }).batchTimestamp,
    })),
  ].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  let running = startingBalance;
  combined.forEach(tx => {
    if (tx.type === 'balance_adjustment') {
      running += tx.amount;
    } else if (
      tx.type === 'deposit' ||
      tx.type === 'transfer_from_heloc' ||
      tx.type === 'transfer_from_checking' ||
      tx.type === 'transfer_from_savings'
    ) {
      running += tx.amount;
    } else {
      running -= tx.amount;
    }
    running = Math.max(0, running);
    tx.balance = Math.round(running * 100) / 100;
  });

  return combined;
}

function calculateImportedAccountBalance(
  accountStartingBalance: number,
  transactions: CheckingTransaction[]
): number {
  if (transactions.length === 0) return accountStartingBalance;
  const sorted = [...transactions].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );
  return sorted[sorted.length - 1].balance;
}

function saveImportedAccountCurrentBalance(
  accountId: string,
  accountStartingBalance: number,
  transactions: CheckingTransaction[]
): CheckingAccount[] {
  const calculatedBalance = calculateImportedAccountBalance(accountStartingBalance, transactions);
  const accounts = StorageService.getCheckingAccounts();
  const idx = accounts.findIndex((a) => a.id === accountId);
  if (idx === -1) return accounts;

  const updatedAccounts = [...accounts];
  updatedAccounts[idx] = {
    ...updatedAccounts[idx],
    currentBalance: calculatedBalance,
  };
  StorageService.saveCheckingAccounts(updatedAccounts);
  return updatedAccounts;
}

export default function StatementUploadModal({
  onClose,
  onSuccess,
  startingBalance,
  defaultCheckingAccountId,
}: StatementUploadModalProps) {
  const [step, setStep] = useState<ImportStep>('upload');
  const [checkingAccounts, setCheckingAccounts] = useState(() => StorageService.getCheckingAccounts());
  const [selectedCheckingAccountId, setSelectedCheckingAccountId] = useState(() => {
    const accounts = StorageService.getCheckingAccounts();
    return defaultCheckingAccountId || accounts.find(a => a.isDefault)?.id || accounts[0]?.id || '';
  });
  const [transactions, setTransactions] = useState<ParsedTransaction[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [fileName, setFileName] = useState('');
  const [detectionResult, setDetectionResult] = useState<StatementDetectionResult | null>(null);
  const [matchedDebt, setMatchedDebt] = useState<Debt | null>(null);
  const [creditCardDebts, setCreditCardDebts] = useState<Debt[]>([]);
  const [selectedDebtId, setSelectedDebtId] = useState('');
  const [showCreateDebt, setShowCreateDebt] = useState(false);
  const [newDebtName, setNewDebtName] = useState('');
  const [newDebtBalance, setNewDebtBalance] = useState('');
  const [newDebtMinPayment, setNewDebtMinPayment] = useState('');
  const [newDebtRate, setNewDebtRate] = useState('');
  const [statementBalances, setStatementBalances] = useState<StatementBalanceMeta>({});
  const [balanceInfoMessage, setBalanceInfoMessage] = useState('');
  const [balanceConflictChoice, setBalanceConflictChoice] = useState<BalanceConflictChoice | null>(null);
  const [importMode, setImportMode] = useState<ImportMode>('normal');
  const [smartClassifications, setSmartClassifications] = useState<SmartImportMatch[]>([]);
  const [existingTransactionCount, setExistingTransactionCount] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const selectedAccount = checkingAccounts.find((a) => a.id === selectedCheckingAccountId);
  const accountName = selectedAccount?.name || 'Checking Account';

  const getApprovedTransactions = () => transactions.filter((t) => t.approved);

  const getSmartCounts = () => {
    const approved = getApprovedTransactions();
    const definite = smartClassifications.filter((m) => m.level === 'definite').length;
    const flagged = smartClassifications.filter(
      (m) => m.level === 'probable' || m.level === 'possible'
    ).length;
    const fresh = smartClassifications.filter((m) => m.level === 'none').length;
    return { definite, flagged, fresh, total: approved.length };
  };

  const applyBalanceResolution = (choice?: BalanceConflictChoice) => {
    const accountStartingBalance = selectedAccount?.startingBalance ?? startingBalance;
    const evaluation = evaluateStartingBalanceConflict(
      accountStartingBalance,
      statementBalances.beginningBalance
    );

    if (evaluation.needsConflictStep && choice) {
      setBalanceConflictChoice(choice);
      if (choice === 'update' && statementBalances.beginningBalance != null) {
        setBalanceInfoMessage(
          `ℹ️ Starting balance set to ${CalculationService.formatCurrency(statementBalances.beginningBalance)} from statement`
        );
      } else {
        setBalanceInfoMessage(
          `ℹ️ Beginning balance of ${CalculationService.formatCurrency(statementBalances.beginningBalance ?? 0)} excluded from import (already set on your account)`
        );
      }
      return;
    }

    setBalanceInfoMessage(evaluation.infoMessage);
    if (evaluation.shouldUpdateStartingBalance && selectedAccount) {
      const updatedAccounts = checkingAccounts.map((a) =>
        a.id === selectedCheckingAccountId
          ? { ...a, startingBalance: evaluation.resolvedStartingBalance }
          : a
      );
      setCheckingAccounts(updatedAccounts);
      StorageService.saveCheckingAccounts(updatedAccounts);
    }
  };

  const goToCheckingPreview = (parsed: ParsedTransaction[], meta: StatementBalanceMeta) => {
    setStatementBalances(meta);
    setTransactions(parsed);
    const account =
      StorageService.getCheckingAccounts().find((a) => a.id === selectedCheckingAccountId) ||
      selectedAccount;
    const accountStartingBalance = account?.startingBalance ?? startingBalance;
    const evaluation = evaluateStartingBalanceConflict(accountStartingBalance, meta.beginningBalance);

    if (evaluation.needsConflictStep) {
      setStep('balance_conflict');
      return;
    }

    if (evaluation.shouldUpdateStartingBalance && account) {
      const updatedAccounts = checkingAccounts.map((a) =>
        a.id === selectedCheckingAccountId
          ? { ...a, startingBalance: evaluation.resolvedStartingBalance }
          : a
      );
      setCheckingAccounts(updatedAccounts);
      StorageService.saveCheckingAccounts(updatedAccounts);
    }
    setBalanceInfoMessage(evaluation.infoMessage);
    resolveStepForAccount(selectedCheckingAccountId);
  };

  const resolveStepForAccount = (accountId: string) => {
    if (!accountId) {
      setStep('preview');
      return;
    }

    setSelectedCheckingAccountId(accountId);
    const existing = StorageService.getCheckingTransactionsForAccount(accountId);
    if (existing.length > 0) {
      setExistingTransactionCount(existing.length);
      setStep('import_choice');
      return;
    }

    setStep('preview');
  };

  const handleAccountSelect = (accountId: string) => {
    resolveStepForAccount(accountId);
  };

  const handleFile = async (file: File) => {
    setError(null);
    setLoading(true);
    setFileName(file.name);

    try {
      if (!file.name.endsWith('.csv') && !file.name.endsWith('.pdf')) {
        throw new Error('Please upload a CSV or PDF file.');
      }

      let base64 = '';
      if (file.name.endsWith('.pdf')) {
        base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve((reader.result as string).split(',')[1]);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
      }

      setLoadingMessage('Identifying statement type...');
      const detection = await detectStatementType(file, base64);

      setLoadingMessage(detection.type === 'credit_card' ? 'Reading credit card transactions...' : 'Reading transactions...');

      let parsed: ParsedTransaction[] = [];
      if (file.name.endsWith('.csv')) {
        const text = await file.text();
        parsed = parseCSV(text);
      } else {
        parsed = await parsePDFWithAI(file);
      }

      const analyzed = analyzeStatementBalanceEntries(parsed, {
        summaryBeginningBalance: detection.beginningBalance,
        summaryEndingBalance: detection.endingBalance,
        statementStartDate: detection.statementStartDate ?? undefined,
      });
      parsed = analyzed.transactions;

      if (parsed.length === 0) {
        throw new Error('No transactions found. Check that the file contains transaction data.');
      }

      if (detection.type === 'credit_card') {
        const debts = StorageService.getDebts().filter(d => d.category === 'Credit Card' && !d.isPaidOff);
        const matched = findMatchingDebt(detection, debts);
        setDetectionResult(detection);
        setNewDebtName(detection.accountName || '');
        setNewDebtBalance(detection.statementBalance?.toString() || '');
        setNewDebtMinPayment(detection.minimumPayment?.toString() || '');
        setMatchedDebt(matched);
        setCreditCardDebts(debts);
        setSelectedDebtId(matched?.id || '');
        setTransactions(parsed);
        setStatementBalances(analyzed.meta);
        setStep('credit_card_confirm');
      } else {
        setDetectionResult(detection);
        goToCheckingPreview(parsed, analyzed.meta);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse file');
    } finally {
      setLoading(false);
      setLoadingMessage('');
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const performImport = (
    transactionsToImport: ParsedTransaction[],
    options: {
      mode: ImportMode;
      duplicateFlags?: ImportDuplicateFlag[];
      closeOnComplete?: boolean;
    }
  ) => {
    const batchId = `import_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const batchTimestamp = new Date().toISOString();
    if (!selectedCheckingAccountId) {
      alert('Please select a checking account to import into');
      return;
    }

    setStep('importing');

    const account = checkingAccounts.find((a) => a.id === selectedCheckingAccountId);
    let accountStartingBalance = account?.startingBalance ?? startingBalance;

    if (options.mode === 'replace') {
      StorageService.clearCheckingTransactionsForAccount(selectedCheckingAccountId);
    }

    if (statementBalances.beginningBalance != null) {
      const evaluation = evaluateStartingBalanceConflict(
        accountStartingBalance,
        statementBalances.beginningBalance
      );
      const shouldUpdate =
        evaluation.shouldUpdateStartingBalance ||
        balanceConflictChoice === 'update';

      if (shouldUpdate && account) {
        const updatedAccounts = checkingAccounts.map((a) =>
          a.id === selectedCheckingAccountId
            ? { ...a, startingBalance: statementBalances.beginningBalance! }
            : a
        );
        setCheckingAccounts(updatedAccounts);
        StorageService.saveCheckingAccounts(updatedAccounts);
        accountStartingBalance = statementBalances.beginningBalance!;
      }
    }

    const approvedWithBatch = transactionsToImport.map((t) => ({
      ...t,
      originalDescription: t.originalDescription || t.description,
      source: 'import' as const,
      batchId,
      batchTimestamp,
    }));

    const existing =
      options.mode === 'replace'
        ? []
        : StorageService.getCheckingTransactionsForAccount(selectedCheckingAccountId);
    const combined = recalculateImportedBalances(existing, approvedWithBatch, accountStartingBalance);
    const withAccountId = combined.map((t: { accountId?: string; isReconciled?: boolean }) => ({
      ...t,
      accountId: selectedCheckingAccountId,
      isReconciled: t.isReconciled ?? false,
    }));
    StorageService.saveCheckingTransactionsForAccount(selectedCheckingAccountId, withAccountId);
    const updatedAccounts = saveImportedAccountCurrentBalance(
      selectedCheckingAccountId,
      accountStartingBalance,
      withAccountId as CheckingTransaction[]
    );
    setCheckingAccounts(updatedAccounts);

    if (options.duplicateFlags && options.duplicateFlags.length > 0) {
      StorageService.addImportDuplicateFlags(selectedCheckingAccountId, options.duplicateFlags);
    }

    const importedDates = approvedWithBatch.map((t) => t.date).sort();
    const totalDebits = approvedWithBatch
      .filter((t) => t.type !== 'deposit')
      .reduce((sum, t) => sum + t.amount, 0);
    const totalCredits = approvedWithBatch
      .filter((t) => t.type === 'deposit')
      .reduce((sum, t) => sum + t.amount, 0);
    StorageService.saveBatchRecord({
      batchId,
      accountId: selectedCheckingAccountId,
      accountName: account?.name || 'Checking Account',
      importedAt: batchTimestamp,
      transactionCount: approvedWithBatch.length,
      dateRangeStart: importedDates[0],
      dateRangeEnd: importedDates[importedDates.length - 1],
      totalDebits,
      totalCredits,
      status: 'active',
    });

    let mismatchWarning = '';
    if (
      statementBalances.beginningBalance != null &&
      statementBalances.endingBalance != null
    ) {
      const added = approvedWithBatch
        .filter((t) => t.type === 'deposit')
        .reduce((sum, t) => sum + t.amount, 0);
      const subtracted = approvedWithBatch
        .filter((t) => t.type !== 'deposit')
        .reduce((sum, t) => sum + t.amount, 0);
      const projectedEnding = statementBalances.beginningBalance + added - subtracted;
      if (Math.abs(projectedEnding - statementBalances.endingBalance) > 0.02) {
        mismatchWarning = ' Balance mismatch detected — please verify your transactions.';
      }
    }

    const importedCount = approvedWithBatch.length;
    const message = `✓ Imported ${importedCount} transaction${importedCount === 1 ? '' : 's'} from ${fileName}.${mismatchWarning}`;

    if (options.closeOnComplete === false) {
      setStep('smart_review');
      return message;
    }

    onSuccess(message);
  };

  const importSmartNewTransactions = () => {
    const approved = getApprovedTransactions();
    const newTransactions = approved.filter((tx) => {
      const match = smartClassifications.find((c) => c.parsedId === tx.id);
      return match?.level === 'none';
    });

    if (newTransactions.length > 0) {
      performImport(newTransactions, { mode: 'smart', closeOnComplete: false });
    }

    const flaggedCount = smartClassifications.filter(
      (c) => c.level === 'probable' || c.level === 'possible'
    ).length;

    if (flaggedCount > 0) {
      setStep('smart_review');
      return;
    }

    onSuccess(
      `✓ Imported ${newTransactions.length} transaction${newTransactions.length === 1 ? '' : 's'} from ${fileName}.`
    );
  };

  const importAllFlaggedTransactions = () => {
    const approved = getApprovedTransactions();
    const flaggedParsed = approved.filter((tx) => {
      const match = smartClassifications.find((c) => c.parsedId === tx.id);
      return match?.level === 'probable' || match?.level === 'possible';
    });

    const toImport = flaggedParsed.map((tx) => ({
      ...tx,
      id: `import_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    }));

    const flags: ImportDuplicateFlag[] = flaggedParsed
      .map((tx, index) => {
        const match = smartClassifications.find((c) => c.parsedId === tx.id);
        if (
          !match?.existingTransactionId ||
          (match.level !== 'probable' && match.level !== 'possible')
        ) {
          return null;
        }
        return {
          importedTransactionId: toImport[index].id,
          existingTransactionId: match.existingTransactionId,
          level: match.level,
        };
      })
      .filter((flag): flag is ImportDuplicateFlag => flag !== null);

    performImport(toImport, {
      mode: 'smart',
      duplicateFlags: flags,
      closeOnComplete: true,
    });
  };

  const startSmartImport = () => {
    const existing = StorageService.getCheckingTransactionsForAccount(selectedCheckingAccountId);
    const approved = getApprovedTransactions();
    const classifications = StorageService.classifyImportTransactions(
      approved.map((t) => ({
        id: t.id,
        date: t.date,
        description: t.description,
        amount: t.amount,
        type: t.type,
      })),
      existing
    );
    setSmartClassifications(classifications);
    setImportMode('smart');
    setStep('smart_summary');
  };

  const requestImport = () => {
    if (!selectedCheckingAccountId) {
      alert('Please select a checking account to import into');
      return;
    }

    setImportMode('normal');
    performImport(getApprovedTransactions(), { mode: 'normal' });
  };

  const handleImport = requestImport;

  const toggleApproved = (id: string) => {
    setTransactions(prev => prev.map(t => t.id === id ? { ...t, approved: !t.approved } : t));
  };

  const updateCategory = (id: string, category: string) => {
    setTransactions(prev => prev.map(t => {
      if (t.id !== id) return t;
      const type: 'deposit' | 'withdrawal' | 'debt_payment' =
        category === 'deposit' ? 'deposit' :
        category === 'Debt Payment' ? 'debt_payment' : 'withdrawal';
      return { ...t, category: category === 'deposit' || category === 'Debt Payment' ? undefined : category, type };
    }));
  };

  const approvedCount = transactions.filter(t => t.approved).length;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h3 className="text-xl font-bold text-gray-900">Import Bank Statement</h3>
            <p className="text-sm text-gray-500 mt-0.5">CSV or PDF — we handle both</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="p-6">
          {step === 'upload' && (
            <div className="space-y-4">
              <div
                onDrop={handleDrop}
                onDragOver={e => e.preventDefault()}
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-gray-300 rounded-xl p-10 text-center cursor-pointer hover:border-brand-orange hover:bg-orange-50 transition-colors"
              >
                {loading ? (
                  <div className="flex flex-col items-center gap-3">
                    <Loader2 className="w-10 h-10 text-brand-orange animate-spin" />
                    <p className="text-gray-600 font-medium">{loadingMessage || 'Reading your statement...'}</p>
                    <p className="text-xs text-gray-500">PDF files take a few seconds</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-3">
                    <Upload className="w-10 h-10 text-gray-400" />
                    <p className="text-gray-700 font-semibold">Drop your statement here or click to browse</p>
                    <p className="text-sm text-gray-500">Supports Chase, BofA, Wells Fargo, and most major banks</p>
                    <div className="flex gap-2 mt-1">
                      <span className="px-3 py-1 bg-gray-100 rounded-full text-xs font-medium text-gray-600">CSV</span>
                      <span className="px-3 py-1 bg-gray-100 rounded-full text-xs font-medium text-gray-600">PDF</span>
                    </div>
                  </div>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.pdf"
                  className="hidden"
                  onChange={e => { if (e.target.files?.[0]) handleFile(e.target.files[0]); }}
                />
              </div>

              {error && (
                <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-lg p-4">
                  <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm font-semibold text-blue-900 mb-1">How to export your statement</p>
                <ul className="text-xs text-blue-800 space-y-1">
                  <li><strong>Chase:</strong> Accounts → Download → CSV or PDF</li>
                  <li><strong>Bank of America:</strong> Statements → Download → CSV</li>
                  <li><strong>Wells Fargo:</strong> Statements → Download Statement (PDF)</li>
                  <li><strong>Most banks:</strong> Look for Download or Export in your statements section</li>
                </ul>
              </div>
            </div>
          )}

          {step === 'credit_card_confirm' && (
            <div className="space-y-4">
              <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 flex items-start gap-3">
                <div className="text-2xl">💳</div>
                <div>
                  <p className="font-bold text-purple-900 text-sm">Credit Card Statement Detected</p>
                  <p className="text-purple-800 text-sm mt-0.5">
                    {detectionResult?.accountName || 'Credit card statement'}
                    {detectionResult?.lastFourDigits ? ` ending in ${detectionResult.lastFourDigits}` : ''}
                  </p>
                  {detectionResult?.statementBalance != null && (
                    <p className="text-purple-700 text-xs mt-1">
                      Statement balance: <strong>{CalculationService.formatCurrency(detectionResult.statementBalance)}</strong>
                      {detectionResult.minimumPayment ? ` · Min payment: ${CalculationService.formatCurrency(detectionResult.minimumPayment)}` : ''}
                      {detectionResult.dueDate ? ` · Due: ${new Date(detectionResult.dueDate + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : ''}
                    </p>
                  )}
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-2">
                <p className="text-sm font-bold text-blue-900">Here is what NOVO will do with this statement:</p>
                <ul className="space-y-1.5">
                  <li className="flex items-start gap-2 text-sm text-blue-800">
                    <span className="text-blue-500 mt-0.5">✓</span>
                    {detectionResult?.statementBalance != null
                      ? `Update your debt balance to ${CalculationService.formatCurrency(detectionResult.statementBalance)}`
                      : 'Update your debt balance from the statement'}
                  </li>
                  <li className="flex items-start gap-2 text-sm text-blue-800">
                    <span className="text-blue-500 mt-0.5">✓</span>
                    Log any payments made to this card in your Tracker
                  </li>
                  <li className="flex items-start gap-2 text-sm text-blue-800">
                    <span className="text-blue-500 mt-0.5">✗</span>
                    Individual purchases will NOT be imported into your Checking Tracker
                  </li>
                </ul>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Which debt in NOVO is this card?
                </label>
                {creditCardDebts.length === 0 ? (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                    <p className="text-sm text-amber-800 font-medium">No credit cards found in My Debts yet.</p>
                    <p className="text-xs text-amber-700 mt-1">You can create this debt directly from the statement below.</p>
                  </div>
                ) : (
                  <select
                    value={selectedDebtId || matchedDebt?.id || ''}
                    onChange={e => setSelectedDebtId(e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
                  >
                    <option value="">Select the matching debt...</option>
                    {creditCardDebts.map(d => (
                      <option key={d.id} value={d.id}>
                        {d.accountName} — {CalculationService.formatCurrency(d.currentBalance)} current balance
                      </option>
                    ))}
                  </select>
                )}

                {!showCreateDebt ? (
                  <button
                    type="button"
                    onClick={() => setShowCreateDebt(true)}
                    className="mt-2 text-sm text-purple-600 hover:text-purple-800 font-medium underline"
                  >
                    + This debt isn&apos;t in NOVO yet — create it from this statement
                  </button>
                ) : (
                  <div className="mt-3 bg-white border border-purple-200 rounded-lg p-4 space-y-3">
                    <p className="text-sm font-bold text-gray-800">Create new debt from statement</p>

                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">Account Name</label>
                      <input
                        type="text"
                        value={newDebtName}
                        onChange={e => setNewDebtName(e.target.value)}
                        placeholder={detectionResult?.accountName || 'e.g. Chase Sapphire Visa'}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">Current Balance</label>
                        <div className="relative">
                          <span className="absolute left-3 top-2 text-gray-500 text-sm">$</span>
                          <input
                            type="number"
                            value={newDebtBalance}
                            onChange={e => setNewDebtBalance(e.target.value)}
                            placeholder={detectionResult?.statementBalance?.toString() || '0'}
                            className="w-full pl-7 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">Min Payment</label>
                        <div className="relative">
                          <span className="absolute left-3 top-2 text-gray-500 text-sm">$</span>
                          <input
                            type="number"
                            value={newDebtMinPayment}
                            onChange={e => setNewDebtMinPayment(e.target.value)}
                            placeholder={detectionResult?.minimumPayment?.toString() || '0'}
                            className="w-full pl-7 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                          />
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">Interest Rate %</label>
                      <input
                        type="number"
                        value={newDebtRate}
                        onChange={e => setNewDebtRate(e.target.value)}
                        placeholder="e.g. 22.99"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        step="0.01"
                      />
                    </div>

                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                      <p className="text-xs text-blue-800">
                        💡 NOVO will pre-fill balance and minimum payment from your statement where available. Add the interest rate to unlock accurate payoff projections.
                      </p>
                    </div>

                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setShowCreateDebt(false)}
                        className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold py-2 rounded-lg text-sm transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (!newDebtName.trim()) {
                            alert('Please enter an account name');
                            return;
                          }
                          const balance = parseFloat(newDebtBalance) || detectionResult?.statementBalance || 0;
                          const minPayment = parseFloat(newDebtMinPayment) || detectionResult?.minimumPayment || 0;
                          const rate = parseFloat(newDebtRate) || 0;

                          const newDebt: Debt = {
                            id: `debt_${Date.now()}`,
                            accountName: newDebtName.trim(),
                            category: 'Credit Card',
                            currentBalance: balance,
                            startingBalance: balance,
                            interestRate: rate,
                            minimumPayment: minPayment,
                            isPaidOff: false,
                            createdAt: new Date().toISOString(),
                          };

                          const allDebts = StorageService.getDebts();
                          allDebts.push(newDebt);
                          StorageService.saveDebts(allDebts);

                          setSelectedDebtId(newDebt.id);
                          setCreditCardDebts(prev => [...prev, newDebt]);
                          setShowCreateDebt(false);
                          setNewDebtName('');
                          setNewDebtBalance('');
                          setNewDebtMinPayment('');
                          setNewDebtRate('');
                        }}
                        className="flex-1 bg-purple-600 hover:bg-purple-700 text-white font-semibold py-2 rounded-lg text-sm transition-colors"
                      >
                        Create Debt
                      </button>
                    </div>
                  </div>
                )}
                {matchedDebt && (selectedDebtId === matchedDebt.id) && (
                  <p className="text-xs text-purple-600 mt-1.5 font-medium">
                    ✓ NOVO matched this to <strong>{matchedDebt.accountName}</strong> — confirm or change above
                  </p>
                )}
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setStep('upload');
                    setTransactions([]);
                    setDetectionResult(null);
                    setMatchedDebt(null);
                    setSelectedDebtId('');
                    setShowCreateDebt(false);
                  }}
                  className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-800 font-semibold py-3 rounded-lg transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={async () => {
                    const debtId = selectedDebtId || matchedDebt?.id;
                    if (!debtId) {
                      alert('Please select which debt this statement belongs to');
                      return;
                    }
                    const debt = creditCardDebts.find(d => d.id === debtId);
                    if (!debt || !detectionResult) return;
                    setStep('importing');
                    await importCreditCardStatement(transactions, debt, detectionResult);
                    const balanceMsg = detectionResult.statementBalance != null
                      ? ` Balance updated to ${CalculationService.formatCurrency(detectionResult.statementBalance)}.`
                      : '';
                    onSuccess(`✓ ${debt.accountName} statement imported.${balanceMsg} Payment history logged in Tracker.`);
                  }}
                  disabled={!selectedDebtId && !matchedDebt?.id}
                  className="flex-1 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-semibold py-3 rounded-lg transition-colors"
                >
                  Import Credit Card Statement
                </button>
              </div>
            </div>
          )}

          {step === 'balance_conflict' && (
            <div className="space-y-4">
              <div className="border border-amber-200 bg-amber-50 rounded-lg p-4">
                <p className="text-sm font-bold text-brand-navy mb-2">⚠️ Balance conflict detected</p>
                <p className="text-sm text-brand-gray">
                  Your account starting balance:{' '}
                  <strong>{CalculationService.formatCurrency(selectedAccount?.startingBalance ?? startingBalance)}</strong>
                </p>
                <p className="text-sm text-brand-gray mt-1">
                  This statement&apos;s beginning balance:{' '}
                  <strong>{CalculationService.formatCurrency(statementBalances.beginningBalance ?? 0)}</strong>
                </p>
                <p className="text-sm text-brand-gray mt-3">Which should we use?</p>
              </div>
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  type="button"
                  onClick={() => {
                    applyBalanceResolution('keep');
                    resolveStepForAccount(selectedCheckingAccountId);
                  }}
                  className="flex-1 bg-white border border-brand-gray-border hover:border-brand-navy text-brand-navy font-semibold py-3 rounded-lg transition-colors"
                >
                  Keep my existing balance
                </button>
                <button
                  type="button"
                  onClick={() => {
                    applyBalanceResolution('update');
                    if (statementBalances.beginningBalance != null && selectedAccount) {
                      const updatedAccounts = checkingAccounts.map((a) =>
                        a.id === selectedCheckingAccountId
                          ? { ...a, startingBalance: statementBalances.beginningBalance! }
                          : a
                      );
                      setCheckingAccounts(updatedAccounts);
                      StorageService.saveCheckingAccounts(updatedAccounts);
                    }
                    resolveStepForAccount(selectedCheckingAccountId);
                  }}
                  className="flex-1 bg-brand-navy hover:bg-brand-navy-dark text-white font-semibold py-3 rounded-lg transition-colors"
                >
                  Update to statement balance
                </button>
              </div>
            </div>
          )}

          {step === 'import_choice' && (
            <div className="space-y-4">
              <div>
                <h4 className="text-lg font-bold text-brand-navy">This account already has transactions</h4>
                <p className="text-sm text-brand-gray mt-1">
                  We found {existingTransactionCount} existing transaction
                  {existingTransactionCount === 1 ? '' : 's'} in {accountName}. How would you like to handle the import?
                </p>
              </div>

              <div className="border-2 border-brand-navy rounded-xl p-4 space-y-3 bg-brand-gray-light/30">
                <div className="flex items-start gap-3">
                  <span className="text-2xl">🔄</span>
                  <div>
                    <p className="font-semibold text-brand-navy">Smart Import</p>
                    <p className="text-sm text-brand-gray mt-1">
                      We&apos;ll compare the statement against your existing entries and only add what&apos;s missing.
                      Duplicates are flagged for your review.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={startSmartImport}
                  className="w-full bg-brand-navy hover:bg-brand-navy-dark text-white font-semibold py-2.5 rounded-lg transition-colors"
                >
                  Smart Import
                </button>
              </div>

              <div className="border border-brand-gray-border rounded-xl p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <span className="text-2xl">🗑️</span>
                  <div>
                    <p className="font-semibold text-brand-navy">Replace All</p>
                    <p className="text-sm text-brand-gray mt-1">
                      Clear all existing transactions for this account and start fresh with this statement.
                      Your other accounts are not affected.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setStep('replace_confirm')}
                  className="w-full border border-brand-orange text-brand-orange hover:bg-orange-50 font-semibold py-2.5 rounded-lg transition-colors"
                >
                  Replace &amp; Import
                </button>
              </div>

              <div className="border border-brand-gray-border rounded-xl p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <span className="text-2xl">➕</span>
                  <div>
                    <p className="font-semibold text-brand-navy">Add Anyway</p>
                    <p className="text-sm text-brand-gray mt-1">
                      Import everything as-is. This may create duplicates if you&apos;ve already entered these
                      transactions manually.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setImportMode('add_anyway');
                    performImport(getApprovedTransactions(), { mode: 'add_anyway' });
                  }}
                  className="w-full border border-brand-gray-border text-brand-gray hover:bg-brand-gray-light font-semibold py-2.5 rounded-lg transition-colors"
                >
                  Add Anyway
                </button>
              </div>

              <button
                type="button"
                onClick={() => setStep('preview')}
                className="w-full bg-gray-100 hover:bg-gray-200 text-gray-800 font-semibold py-2.5 rounded-lg transition-colors"
              >
                Back
              </button>
            </div>
          )}

          {step === 'replace_confirm' && (
            <div className="space-y-4">
              <div className="border border-red-200 bg-red-50 rounded-lg p-4">
                <p className="text-sm font-semibold text-red-800">
                  This will permanently delete {existingTransactionCount} existing transaction
                  {existingTransactionCount === 1 ? '' : 's'}. Are you sure?
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setStep('import_choice')}
                  className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-800 font-semibold py-3 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setImportMode('replace');
                    performImport(getApprovedTransactions(), { mode: 'replace' });
                  }}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white font-semibold py-3 rounded-lg transition-colors"
                >
                  Yes, Replace All
                </button>
              </div>
            </div>
          )}

          {step === 'smart_summary' && (
            <div className="space-y-4">
              <div>
                <h4 className="text-lg font-bold text-brand-navy">Smart Import Summary</h4>
                {balanceInfoMessage && (
                  <p className="text-sm text-brand-gray mt-2">{balanceInfoMessage}</p>
                )}
              </div>

              <div className="space-y-2">
                <p className="text-sm text-green-700 font-medium">
                  ✅ {getSmartCounts().definite} transaction{getSmartCounts().definite === 1 ? '' : 's'} already in NOVO — will be skipped
                </p>
                <p className="text-sm text-brand-navy font-medium">
                  ➕ {getSmartCounts().fresh} new transaction{getSmartCounts().fresh === 1 ? '' : 's'} to add
                </p>
                <p className="text-sm text-amber-700 font-medium">
                  ⚠️ {getSmartCounts().flagged} need your review
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  type="button"
                  onClick={importSmartNewTransactions}
                  disabled={getSmartCounts().fresh === 0}
                  className="flex-1 bg-brand-navy hover:bg-brand-navy-dark disabled:opacity-50 text-white font-semibold py-3 rounded-lg transition-colors"
                >
                  Import {getSmartCounts().fresh} New Transaction{getSmartCounts().fresh === 1 ? '' : 's'}
                </button>
                {getSmartCounts().flagged > 0 && (
                  <button
                    type="button"
                    onClick={() => setStep('smart_review')}
                    className="flex-1 border border-brand-orange text-brand-orange hover:bg-orange-50 font-semibold py-3 rounded-lg transition-colors"
                  >
                    Review {getSmartCounts().flagged} flagged items first
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={() => setStep('import_choice')}
                className="w-full bg-gray-100 hover:bg-gray-200 text-gray-800 font-semibold py-2.5 rounded-lg transition-colors"
              >
                Back
              </button>
            </div>
          )}

          {step === 'smart_review' && (
            <div className="space-y-4">
              <div>
                <h4 className="text-lg font-bold text-brand-navy">Review Flagged Items</h4>
                <p className="text-sm text-brand-gray mt-1">
                  These transactions may duplicate existing entries. Import them to review inline in your transaction list.
                </p>
              </div>

              <div className="border border-gray-200 rounded-lg overflow-hidden max-h-[40vh] overflow-y-auto">
                {getApprovedTransactions()
                  .filter((tx) => {
                    const match = smartClassifications.find((c) => c.parsedId === tx.id);
                    return match?.level === 'probable' || match?.level === 'possible';
                  })
                  .map((tx) => {
                    const match = smartClassifications.find((c) => c.parsedId === tx.id);
                    return (
                      <div key={tx.id} className="px-4 py-3 border-b border-gray-100 last:border-b-0">
                        <p className="text-sm font-medium text-brand-navy">{tx.description}</p>
                        <p className="text-xs text-brand-gray mt-0.5">
                          {CalculationService.formatLocalDateShort(tx.date)} ·{' '}
                          {CalculationService.formatCurrency(tx.amount)} ·{' '}
                          {match?.level === 'probable' ? 'Probable duplicate' : 'Possible duplicate'}
                        </p>
                      </div>
                    );
                  })}
              </div>

              <button
                type="button"
                onClick={importAllFlaggedTransactions}
                className="w-full bg-brand-orange hover:bg-brand-orange-dark text-white font-semibold py-3 rounded-lg transition-colors"
              >
                Import All Flagged for Review
              </button>

              <button
                type="button"
                onClick={() => onSuccess(`✓ Smart import complete for ${fileName}.`)}
                className="w-full bg-gray-100 hover:bg-gray-200 text-gray-800 font-semibold py-2.5 rounded-lg transition-colors"
              >
                Done
              </button>
            </div>
          )}

          {step === 'preview' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-gray-900">{transactions.length} transactions found</p>
                    {detectionResult && (
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                        detectionResult.type === 'checking' ? 'bg-green-100 text-green-700' :
                        detectionResult.type === 'savings' ? 'bg-blue-100 text-blue-700' :
                        'bg-gray-100 text-gray-600'
                      }`}>
                        {detectionResult.type === 'checking' ? '🏦 Checking' :
                         detectionResult.type === 'savings' ? '💰 Savings' : '📄 Statement'}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-500">Review and uncheck any you don&apos;t want to import</p>
                </div>
                <span className="text-sm font-medium text-brand-orange">{approvedCount} selected</span>
              </div>

              {balanceInfoMessage && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <p className="text-sm text-blue-900">{balanceInfoMessage}</p>
                </div>
              )}

              {detectionResult?.type !== 'credit_card' && (
                <div className="mb-4">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Import into which account?</label>
                  <div className="flex gap-2 flex-wrap">
                    {checkingAccounts.map(account => (
                      <button
                        key={account.id}
                        type="button"
                        onClick={() => handleAccountSelect(account.id)}
                        className={`px-4 py-2 rounded-xl text-sm font-semibold border transition-all ${
                          selectedCheckingAccountId === account.id
                            ? 'bg-brand-navy text-white border-brand-navy'
                            : 'bg-white text-brand-navy border-brand-cream-border hover:border-brand-navy'
                        }`}
                      >
                        {account.accountType === 'checking' ? '🏦' : '💰'} {account.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="py-3 px-3 text-left text-xs font-semibold text-gray-600 w-8"></th>
                      <th className="py-3 px-3 text-left text-xs font-semibold text-gray-600">Date</th>
                      <th className="py-3 px-3 text-left text-xs font-semibold text-gray-600">Description</th>
                      <th className="py-3 px-3 text-left text-xs font-semibold text-gray-600">Category</th>
                      <th className="py-3 px-3 text-right text-xs font-semibold text-gray-600">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {transactions.map(t => (
                      <tr key={t.id} className={`${!t.approved ? 'opacity-40' : ''} hover:bg-gray-50`}>
                        <td className="py-2 px-3">
                          <input
                            type="checkbox"
                            checked={t.approved}
                            onChange={() => toggleApproved(t.id)}
                            className="w-4 h-4 rounded text-brand-orange"
                          />
                        </td>
                        <td className="py-2 px-3 text-gray-700 whitespace-nowrap">
                          {new Date(t.date + 'T12:00:00').toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: '2-digit' })}
                        </td>
                        <td className="py-2 px-3 text-gray-800 max-w-[180px] truncate">{t.description}</td>
                        <td className="py-2 px-3">
                          <select
                            value={t.type === 'deposit' ? 'deposit' : t.type === 'debt_payment' ? 'Debt Payment' : (t.category || 'Essential Expense')}
                            onChange={e => updateCategory(t.id, e.target.value)}
                            className="text-xs border border-gray-200 rounded px-2 py-1 w-full"
                          >
                            {CATEGORY_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                          </select>
                        </td>
                        <td className={`py-2 px-3 text-right font-semibold ${t.type === 'deposit' ? 'text-green-600' : 'text-red-600'}`}>
                          {t.type === 'deposit' ? '+' : '-'}{CalculationService.formatCurrency(t.amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => { setStep('upload'); setTransactions([]); }}
                  className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-800 font-semibold py-3 rounded-lg transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={handleImport}
                  disabled={approvedCount === 0}
                  className="flex-1 bg-brand-orange hover:bg-brand-orange-dark disabled:opacity-50 text-white font-semibold py-3 rounded-lg transition-colors"
                >
                  Import {approvedCount} Transactions
                </button>
              </div>
            </div>
          )}

          {step === 'importing' && (
            <div className="flex flex-col items-center gap-4 py-10">
              <CheckCircle2 className="w-16 h-16 text-emerald-500" />
              <p className="text-lg font-bold text-gray-900">Importing...</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
