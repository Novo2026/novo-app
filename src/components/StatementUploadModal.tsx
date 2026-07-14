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
  | 'unified_review'
  | 'import_complete'
  | 'credit_card_confirm'
  | 'importing';

type ImportMode = 'normal' | 'smart' | 'replace' | 'add_anyway';

type BalanceConflictChoice = 'keep' | 'update';

type BalanceBanner = {
  tone: 'info' | 'warning';
  message: string;
} | null;

type ImportResultSummary = {
  added: number;
  skipped: number;
  message: string;
};

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

function buildBalanceBanner(
  accountStartingBalance: number,
  statementBeginningBalance: number | undefined,
  currentComputedBalance: number
): BalanceBanner {
  if (statementBeginningBalance == null) return null;
  if (Math.abs(accountStartingBalance) <= 0.001) return null;
  if (Math.abs(accountStartingBalance - statementBeginningBalance) <= 0.02) return null;

  // Statement beginning is higher than stored starting — account grew since setup (common/safe).
  if (statementBeginningBalance > accountStartingBalance + 0.02) {
    return {
      tone: 'info',
      message:
        'Your account balance has grown since it was first set up — this is expected and no action is needed',
    };
  }

  // Statement beginning is lower than the current computed balance — may indicate a real problem.
  if (statementBeginningBalance < currentComputedBalance - 0.02) {
    return {
      tone: 'warning',
      message: `This statement's beginning balance (${CalculationService.formatCurrency(statementBeginningBalance)}) is lower than your current balance in NOVO (${CalculationService.formatCurrency(currentComputedBalance)}). That can mean a missed transaction or the wrong statement — double-check before importing.`,
    };
  }

  return {
    tone: 'info',
    message: `Statement beginning balance (${CalculationService.formatCurrency(statementBeginningBalance)}) differs from your account starting balance (${CalculationService.formatCurrency(accountStartingBalance)}). Import will keep your existing starting balance.`,
  };
}

function formatDuplicateFlagReason(
  match: SmartImportMatch,
  existingById: Record<string, CheckingTransaction>
): string {
  const existing = match.existingTransactionId
    ? existingById[match.existingTransactionId]
    : undefined;
  if (existing) {
    const dateLabel = CalculationService.formatLocalDateShort(existing.date);
    return `Similar to existing transaction on ${dateLabel} for ${CalculationService.formatCurrency(existing.amount)}`;
  }
  return match.level === 'probable'
    ? 'Likely duplicate of an existing transaction'
    : 'Similar to an existing transaction';
}

function getComputedAccountBalance(
  accountId: string,
  accountStartingBalance: number,
  accountCurrentBalance?: number
): number {
  const txs = StorageService.getCheckingTransactionsForAccount(accountId);
  if (txs.length === 0) {
    return accountCurrentBalance ?? accountStartingBalance;
  }
  const sorted = [...txs].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );
  return sorted[sorted.length - 1].balance;
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
    console.log('[PDF import] Raw Claude text before JSON.parse:', text);
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
  currentBalance,
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
  const [balanceBanner, setBalanceBanner] = useState<BalanceBanner>(null);
  const [balanceConflictChoice, setBalanceConflictChoice] = useState<BalanceConflictChoice | null>(null);
  const [importMode, setImportMode] = useState<ImportMode>('normal');
  const [smartClassifications, setSmartClassifications] = useState<SmartImportMatch[]>([]);
  const [existingTxById, setExistingTxById] = useState<Record<string, CheckingTransaction>>({});
  const [existingTransactionCount, setExistingTransactionCount] = useState(0);
  const [showImportOptions, setShowImportOptions] = useState(false);
  const [confirmReplace, setConfirmReplace] = useState(false);
  const [importResult, setImportResult] = useState<ImportResultSummary | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const selectedAccount = checkingAccounts.find((a) => a.id === selectedCheckingAccountId);
  const accountName = selectedAccount?.name || 'Checking Account';

  const getMatchLevel = (parsedId: string) =>
    smartClassifications.find((c) => c.parsedId === parsedId)?.level ?? 'none';

  const checkedImportCount = transactions.filter((t) => {
    if (getMatchLevel(t.id) === 'definite') return false;
    return t.approved;
  }).length;

  const prepareUnifiedReview = (accountId: string, parsed: ParsedTransaction[]) => {
    setSelectedCheckingAccountId(accountId);
    setConfirmReplace(false);
    setShowImportOptions(false);

    const existing = accountId
      ? StorageService.getCheckingTransactionsForAccount(accountId)
      : [];
    setExistingTransactionCount(existing.length);

    const byId: Record<string, CheckingTransaction> = {};
    for (const tx of existing) {
      byId[tx.id] = tx;
    }
    setExistingTxById(byId);

    const classifications = StorageService.classifyImportTransactions(
      parsed.map((t) => ({
        id: t.id,
        date: t.date,
        description: t.description,
        amount: t.amount,
        type: t.type,
      })),
      existing
    );
    setSmartClassifications(classifications);

    setTransactions(
      parsed.map((t) => {
        const level = classifications.find((c) => c.parsedId === t.id)?.level ?? 'none';
        return {
          ...t,
          // New → checked; uncertain/matched → unchecked
          approved: level === 'none',
        };
      })
    );

    setImportMode(existing.length > 0 ? 'smart' : 'normal');
    setStep('unified_review');
  };

  const refreshBalanceBanner = (accountId: string, beginningBalance?: number) => {
    const account =
      StorageService.getCheckingAccounts().find((a) => a.id === accountId) ||
      checkingAccounts.find((a) => a.id === accountId);
    const accountStarting = account?.startingBalance ?? startingBalance;
    const computed = getComputedAccountBalance(
      accountId,
      accountStarting,
      accountId === selectedCheckingAccountId ? currentBalance : account?.currentBalance
    );
    setBalanceBanner(buildBalanceBanner(accountStarting, beginningBalance, computed));
  };

  const goToCheckingPreview = (parsed: ParsedTransaction[], meta: StatementBalanceMeta) => {
    setStatementBalances(meta);
    const account =
      StorageService.getCheckingAccounts().find((a) => a.id === selectedCheckingAccountId) ||
      selectedAccount;
    const accountStartingBalance = account?.startingBalance ?? startingBalance;
    const evaluation = evaluateStartingBalanceConflict(accountStartingBalance, meta.beginningBalance);

    // Auto-set starting balance only when the account had none (non-blocking path).
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
    setBalanceConflictChoice(null);

    const computed = getComputedAccountBalance(
      selectedCheckingAccountId,
      account?.startingBalance ?? startingBalance,
      currentBalance
    );
    setBalanceBanner(
      buildBalanceBanner(
        evaluation.shouldUpdateStartingBalance
          ? evaluation.resolvedStartingBalance
          : accountStartingBalance,
        meta.beginningBalance,
        computed
      )
    );

    prepareUnifiedReview(selectedCheckingAccountId, parsed);
  };

  const handleAccountSelect = (accountId: string) => {
    refreshBalanceBanner(accountId, statementBalances.beginningBalance);
    prepareUnifiedReview(accountId, transactions);
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
      skippedCount?: number;
      showConfirmation?: boolean;
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
    const skippedCount =
      options.skippedCount ?? Math.max(0, transactions.length - importedCount);
    const message = `✓ Added ${importedCount} transaction${importedCount === 1 ? '' : 's'}. Skipped ${skippedCount} duplicate${skippedCount === 1 ? '' : 's'}.${mismatchWarning}`;

    if (options.showConfirmation !== false) {
      setImportResult({
        added: importedCount,
        skipped: skippedCount,
        message,
      });
      setStep('import_complete');
      return;
    }

    onSuccess(message);
  };

  const handleUnifiedImport = () => {
    if (!selectedCheckingAccountId) {
      alert('Please select a checking account to import into');
      return;
    }

    const toImport: ParsedTransaction[] = [];
    const flags: ImportDuplicateFlag[] = [];

    for (const tx of transactions) {
      const match = smartClassifications.find((c) => c.parsedId === tx.id);
      const level = match?.level ?? 'none';
      if (level === 'definite' || !tx.approved) continue;

      if (level === 'probable' || level === 'possible') {
        const newId = `import_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        toImport.push({ ...tx, id: newId });
        if (match?.existingTransactionId) {
          flags.push({
            importedTransactionId: newId,
            existingTransactionId: match.existingTransactionId,
            level,
          });
        }
      } else {
        toImport.push(tx);
      }
    }

    if (toImport.length === 0) return;

    const skipped = transactions.length - toImport.length;
    setImportMode(existingTransactionCount > 0 ? 'smart' : 'normal');
    performImport(toImport, {
      mode: existingTransactionCount > 0 ? 'smart' : 'normal',
      duplicateFlags: flags.length > 0 ? flags : undefined,
      skippedCount: skipped,
      showConfirmation: true,
    });
  };

  const handleAddAnyway = () => {
    setImportMode('add_anyway');
    performImport(
      transactions.map((t) => ({ ...t, approved: true })),
      {
        mode: 'add_anyway',
        skippedCount: 0,
        showConfirmation: true,
      }
    );
  };

  const handleReplaceAll = () => {
    setImportMode('replace');
    performImport(
      transactions.map((t) => ({ ...t, approved: true })),
      {
        mode: 'replace',
        skippedCount: 0,
        showConfirmation: true,
      }
    );
  };

  const toggleApproved = (id: string) => {
    if (getMatchLevel(id) === 'definite') return;
    setTransactions((prev) =>
      prev.map((t) => (t.id === id ? { ...t, approved: !t.approved } : t))
    );
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

          {step === 'unified_review' && (
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-gray-900">
                      Review {transactions.length} transaction{transactions.length === 1 ? '' : 's'}
                    </p>
                    {detectionResult && (
                      <span
                        className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                          detectionResult.type === 'checking'
                            ? 'bg-green-100 text-green-700'
                            : detectionResult.type === 'savings'
                              ? 'bg-blue-100 text-blue-700'
                              : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {detectionResult.type === 'checking'
                          ? '🏦 Checking'
                          : detectionResult.type === 'savings'
                            ? '💰 Savings'
                            : '📄 Statement'}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-500 mt-0.5">
                    New items are selected. Possible duplicates stay unchecked until you decide.
                  </p>
                </div>
                <span className="text-sm font-medium text-brand-orange whitespace-nowrap">
                  {checkedImportCount} selected
                </span>
              </div>

              {balanceBanner && (
                <div
                  className={`rounded-lg p-3 border ${
                    balanceBanner.tone === 'warning'
                      ? 'bg-amber-50 border-amber-200'
                      : 'bg-blue-50 border-blue-200'
                  }`}
                >
                  <p
                    className={`text-sm ${
                      balanceBanner.tone === 'warning' ? 'text-amber-900' : 'text-blue-900'
                    }`}
                  >
                    {balanceBanner.tone === 'warning' ? '⚠️ ' : ''}
                    {balanceBanner.message}
                  </p>
                </div>
              )}

              {balanceInfoMessage && !balanceBanner && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <p className="text-sm text-blue-900">{balanceInfoMessage}</p>
                </div>
              )}

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Import into which account?
                </label>
                <div className="flex gap-2 flex-wrap">
                  {checkingAccounts.map((account) => (
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

              {existingTransactionCount > 0 && (
                <div>
                  <button
                    type="button"
                    onClick={() => {
                      setShowImportOptions((v) => !v);
                      setConfirmReplace(false);
                    }}
                    className="text-xs font-medium text-gray-500 hover:text-brand-navy underline"
                  >
                    {showImportOptions ? 'Hide import options' : 'Import options'}
                  </button>
                  {showImportOptions && (
                    <div className="mt-2 border border-gray-200 rounded-lg p-3 space-y-3 bg-gray-50">
                      <p className="text-xs text-gray-600">
                        Edge-case actions for {accountName} ({existingTransactionCount} existing
                        transaction{existingTransactionCount === 1 ? '' : 's'}).
                      </p>
                      {!confirmReplace ? (
                        <div className="flex flex-col sm:flex-row gap-2">
                          <button
                            type="button"
                            onClick={() => setConfirmReplace(true)}
                            className="flex-1 border border-brand-orange text-brand-orange hover:bg-orange-50 font-semibold py-2 rounded-lg text-sm transition-colors"
                          >
                            Replace All
                          </button>
                          <button
                            type="button"
                            onClick={handleAddAnyway}
                            className="flex-1 border border-gray-300 text-gray-700 hover:bg-white font-semibold py-2 rounded-lg text-sm transition-colors"
                          >
                            Add Anyway
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <p className="text-xs text-red-700 font-medium">
                            This permanently deletes {existingTransactionCount} existing transaction
                            {existingTransactionCount === 1 ? '' : 's'} in {accountName}. Continue?
                          </p>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => setConfirmReplace(false)}
                              className="flex-1 bg-white border border-gray-300 text-gray-700 font-semibold py-2 rounded-lg text-sm"
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              onClick={handleReplaceAll}
                              className="flex-1 bg-red-600 hover:bg-red-700 text-white font-semibold py-2 rounded-lg text-sm"
                            >
                              Yes, Replace All
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              <div className="border border-gray-200 rounded-lg overflow-hidden max-h-[42vh] overflow-y-auto">
                <ul className="divide-y divide-gray-100">
                  {transactions.map((t) => {
                    const match = smartClassifications.find((c) => c.parsedId === t.id);
                    const level = match?.level ?? 'none';
                    const isMatched = level === 'definite';
                    const isUncertain = level === 'probable' || level === 'possible';

                    let rowClass = 'bg-white border-l-4 border-l-emerald-500';
                    let tagClass = 'bg-emerald-100 text-emerald-800';
                    let tagLabel = 'New';
                    if (isMatched) {
                      rowClass = 'bg-gray-50 border-l-4 border-l-gray-300 opacity-60';
                      tagClass = 'bg-gray-200 text-gray-600';
                      tagLabel = 'Already in NOVO';
                    } else if (isUncertain) {
                      rowClass = 'bg-white border-l-4 border-l-amber-400';
                      tagClass = 'bg-amber-100 text-amber-800';
                      tagLabel = 'Possible duplicate';
                    }

                    return (
                      <li key={t.id} className={`px-3 py-3 ${rowClass}`}>
                        <div className="flex items-start gap-3">
                          <input
                            type="checkbox"
                            checked={isMatched ? false : t.approved}
                            disabled={isMatched}
                            onChange={() => toggleApproved(t.id)}
                            className="mt-1 w-4 h-4 rounded text-brand-orange disabled:cursor-not-allowed"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span
                                className={`text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded ${tagClass}`}
                              >
                                {tagLabel}
                              </span>
                              <span className="text-xs text-gray-500 whitespace-nowrap">
                                {new Date(t.date + 'T12:00:00').toLocaleDateString('en-US', {
                                  month: '2-digit',
                                  day: '2-digit',
                                  year: '2-digit',
                                })}
                              </span>
                            </div>
                            <p className="text-sm font-medium text-gray-900 truncate mt-0.5">
                              {t.description}
                            </p>
                            {isUncertain && match && (
                              <p className="text-xs text-amber-700 mt-1">
                                {formatDuplicateFlagReason(match, existingTxById)}
                              </p>
                            )}
                            {isMatched && (
                              <p className="text-xs text-gray-500 mt-1">Already in NOVO</p>
                            )}
                            {!isMatched && (
                              <select
                                value={
                                  t.type === 'deposit'
                                    ? 'deposit'
                                    : t.type === 'debt_payment'
                                      ? 'Debt Payment'
                                      : t.category || 'Essential Expense'
                                }
                                onChange={(e) => updateCategory(t.id, e.target.value)}
                                className="mt-2 text-xs border border-gray-200 rounded px-2 py-1 max-w-full"
                              >
                                {CATEGORY_OPTIONS.map((o) => (
                                  <option key={o} value={o}>
                                    {o}
                                  </option>
                                ))}
                              </select>
                            )}
                          </div>
                          <span
                            className={`text-sm font-semibold whitespace-nowrap ${
                              t.type === 'deposit' ? 'text-green-600' : 'text-red-600'
                            }`}
                          >
                            {t.type === 'deposit' ? '+' : '-'}
                            {CalculationService.formatCurrency(t.amount)}
                          </span>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setStep('upload');
                    setTransactions([]);
                    setSmartClassifications([]);
                    setBalanceBanner(null);
                    setImportResult(null);
                  }}
                  className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-800 font-semibold py-3 rounded-lg transition-colors"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={handleUnifiedImport}
                  disabled={checkedImportCount === 0}
                  className="flex-1 bg-brand-orange hover:bg-brand-orange-dark disabled:opacity-50 text-white font-semibold py-3 rounded-lg transition-colors"
                >
                  Add {checkedImportCount} New Transaction{checkedImportCount === 1 ? '' : 's'}
                </button>
              </div>
            </div>
          )}

          {step === 'import_complete' && importResult && (
            <div className="flex flex-col items-center gap-4 py-8 text-center">
              <CheckCircle2 className="w-16 h-16 text-emerald-500" />
              <div>
                <p className="text-lg font-bold text-gray-900">
                  ✓ Added {importResult.added} transaction{importResult.added === 1 ? '' : 's'}.
                </p>
                <p className="text-sm text-gray-600 mt-1">
                  Skipped {importResult.skipped} duplicate{importResult.skipped === 1 ? '' : 's'}.
                </p>
              </div>
              <button
                type="button"
                onClick={() => onSuccess(importResult.message)}
                className="w-full max-w-xs bg-brand-navy hover:bg-brand-navy-dark text-white font-semibold py-3 rounded-lg transition-colors"
              >
                Done
              </button>
            </div>
          )}

          {step === 'importing' && (
            <div className="flex flex-col items-center gap-4 py-10">
              <Loader2 className="w-12 h-12 text-brand-orange animate-spin" />
              <p className="text-lg font-bold text-gray-900">Importing...</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
