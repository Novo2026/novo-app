import { useState, useRef } from 'react';
import { Upload, X, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { CalculationService } from '../services/calculations';
import { StorageService } from '../services/storage';
import type { Debt, CheckingTransaction } from '../types';

interface ParsedTransaction {
  id: string;
  date: string;
  description: string;
  originalDescription: string;
  amount: number;
  type: 'deposit' | 'withdrawal' | 'debt_payment';
  category?: string;
  approved: boolean;
}

interface StatementBalanceMeta {
  beginningBalance?: number;
  endingBalance?: number;
}

type StatementType = 'checking' | 'credit_card' | 'savings' | 'unknown';

interface StatementDetectionResult {
  type: StatementType;
  accountName: string;
  lastFourDigits?: string;
  statementBalance?: number;
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

function parseCSV(text: string): ParsedTransaction[] {
  const lines = text.trim().split('\n');
  const results: ParsedTransaction[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',').map(c => c.replace(/"/g, '').trim());
    if (cols.length < 3) continue;

    const date = cols[0];
    const description = cols[1];
    let amount = 0;

    if (cols.length >= 4 && (cols[2] !== '' || cols[3] !== '')) {
      const debit = parseFloat(cols[2].replace(/[^0-9.-]/g, '')) || 0;
      const credit = parseFloat(cols[3].replace(/[^0-9.-]/g, '')) || 0;
      amount = credit > 0 ? credit : -debit;
    } else {
      amount = parseFloat(cols[2].replace(/[^0-9.-]/g, '')) || 0;
    }

    if (!date || !description || amount === 0) continue;

    const dateObj = new Date(date);
    if (isNaN(dateObj.getTime())) continue;
    const normalizedDate = dateObj.toISOString().split('T')[0];

    const type = detectType(description, amount);

    results.push({
      id: `import_${Date.now()}_${i}`,
      date: normalizedDate,
      description,
      originalDescription: description,
      amount: Math.abs(amount),
      type,
      category: type === 'withdrawal' ? 'Essential Expense' : undefined,
      approved: true,
    });
  }

  return results;
}

function analyzeStatementBalanceEntries(
  parsedTransactions: ParsedTransaction[]
): { transactions: ParsedTransaction[]; meta: StatementBalanceMeta } {
  let beginningBalance: number | undefined;
  let endingBalance: number | undefined;

  const filtered = parsedTransactions.filter((tx, index) => {
    const lower = tx.description.toLowerCase();
    const isBeginning =
      lower.includes('beginning balance') ||
      lower.includes('starting balance') ||
      lower.includes('opening balance') ||
      lower.includes('balance forward') ||
      lower.includes('prior balance');
    const isEnding =
      lower.includes('ending balance') ||
      lower.includes('closing balance') ||
      lower.includes('new balance');

    // Some statements emit the opening balance as the first ledger row.
    const isFirstRowOpeningBalance =
      index === 0 &&
      lower.includes('balance') &&
      (lower.includes('opening') || lower.includes('beginning') || lower.includes('starting'));

    if (isBeginning || isFirstRowOpeningBalance) {
      beginningBalance = tx.amount;
      return false;
    }

    if (isEnding) {
      endingBalance = tx.amount;
      return false;
    }

    return true;
  });

  return {
    transactions: filtered,
    meta: { beginningBalance, endingBalance },
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
            text: `Extract all transactions from this bank statement. Return ONLY a JSON array, no other text, no markdown, no explanation. Each item must have these exact fields:
{
  "date": "YYYY-MM-DD",
  "description": "merchant or transaction name",
  "amount": 123.45,
  "isDeposit": true or false
}
Amount should always be a positive number. isDeposit is true for credits/deposits, false for debits/withdrawals. Include every transaction you can find.`,
          },
        ],
      }],
    }),
  });

  if (!response.ok) throw new Error('Failed to parse PDF');

  const data = await response.json();
  const text = data.content?.[0]?.text || '';

  let parsed: { date: string; description: string; amount: number; isDeposit: boolean }[] = [];
  try {
    const clean = text.replace(/```json|```/g, '').trim();
    parsed = JSON.parse(clean);
  } catch {
    throw new Error('Could not read transactions from PDF. Try uploading a CSV instead.');
  }

  return parsed.map((item, i) => {
    const type = detectType(item.description, item.isDeposit ? 1 : -1);
    return {
      id: `import_pdf_${Date.now()}_${i}`,
      date: item.date,
      description: item.description,
      originalDescription: item.description,
      amount: Math.abs(item.amount),
      type,
      category: type === 'withdrawal' ? 'Essential Expense' : undefined,
      approved: true,
    };
  });
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
    if (tx.type === 'deposit') {
      running += tx.amount;
    } else {
      running -= tx.amount;
    }
    running = Math.max(0, running);
    tx.balance = Math.round(running * 100) / 100;
  });

  return combined;
}

export default function StatementUploadModal({
  onClose,
  onSuccess,
  startingBalance,
  defaultCheckingAccountId,
}: StatementUploadModalProps) {
  const [step, setStep] = useState<'upload' | 'preview' | 'credit_card_confirm' | 'importing'>('upload');
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
  const fileInputRef = useRef<HTMLInputElement>(null);

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

      const analyzed = analyzeStatementBalanceEntries(parsed);
      parsed = analyzed.transactions;
      setStatementBalances(analyzed.meta);

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
        setStep('credit_card_confirm');
      } else {
        setDetectionResult(detection);
        setTransactions(parsed);
        setStep('preview');
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

  const handleImport = () => {
    const batchId = `import_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const batchTimestamp = new Date().toISOString();
    if (!selectedCheckingAccountId) {
      alert('Please select a checking account to import into');
      return;
    }
    setStep('importing');
    const approved = transactions.filter(t => t.approved);
    const approvedWithBatch = approved.map((t) => ({
      ...t,
      originalDescription: t.originalDescription || t.description,
      source: 'import' as const,
      batchId,
      batchTimestamp,
    }));
    const account = checkingAccounts.find(a => a.id === selectedCheckingAccountId);
    let accountStartingBalance = account?.startingBalance ?? startingBalance;
    const statementBeginningBalance = statementBalances.beginningBalance;

    if (statementBeginningBalance != null) {
      const hasExistingStartingBalance = Math.abs(accountStartingBalance) > 0.001;
      const shouldUpdateStartingBalance = !hasExistingStartingBalance || confirm(
        `Update starting balance to ${CalculationService.formatCurrency(statementBeginningBalance)} from this statement?`
      );

      if (shouldUpdateStartingBalance && account) {
        const updatedAccounts = checkingAccounts.map((a) =>
          a.id === selectedCheckingAccountId
            ? { ...a, startingBalance: statementBeginningBalance }
            : a
        );
        setCheckingAccounts(updatedAccounts);
        StorageService.saveCheckingAccounts(updatedAccounts);
        accountStartingBalance = statementBeginningBalance;
      }
    }

    const existing = StorageService.getCheckingTransactionsForAccount(selectedCheckingAccountId);
    const combined = recalculateImportedBalances(existing, approvedWithBatch, accountStartingBalance);
    const withAccountId = combined.map((t: { accountId?: string; isReconciled?: boolean }) => ({
      ...t,
      accountId: selectedCheckingAccountId,
      isReconciled: t.isReconciled ?? false,
    }));
    StorageService.saveCheckingTransactionsForAccount(selectedCheckingAccountId, withAccountId);
    StorageService.syncCheckingAccountBalance(selectedCheckingAccountId, withAccountId as CheckingTransaction[]);
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

    onSuccess(`✓ Imported ${approved.length} transactions from ${fileName}.${mismatchWarning}`);
  };

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

              {detectionResult?.type !== 'credit_card' && (
                <div className="mb-4">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Import into which account?</label>
                  <div className="flex gap-2 flex-wrap">
                    {checkingAccounts.map(account => (
                      <button
                        key={account.id}
                        type="button"
                        onClick={() => setSelectedCheckingAccountId(account.id)}
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
