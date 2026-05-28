import { useState, useRef } from 'react';
import { Upload, X, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { CalculationService } from '../services/calculations';

interface ParsedTransaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  type: 'deposit' | 'withdrawal' | 'debt_payment';
  category?: string;
  approved: boolean;
}

interface StatementUploadModalProps {
  onClose: () => void;
  onSuccess: (message: string) => void;
  startingBalance: number;
  currentBalance: number;
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
      amount: Math.abs(amount),
      type,
      category: type === 'withdrawal' ? 'Essential Expense' : undefined,
      approved: true,
    });
  }

  return results;
}

async function parsePDFWithAI(file: File): Promise<ParsedTransaction[]> {
  const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('API key not configured');

  const base64 = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(',')[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
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
    balance: number;
    category?: string;
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
      balance: 0,
      category: t.category,
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
}: StatementUploadModalProps) {
  const [step, setStep] = useState<'upload' | 'preview' | 'importing'>('upload');
  const [transactions, setTransactions] = useState<ParsedTransaction[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [fileName, setFileName] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    setError(null);
    setLoading(true);
    setFileName(file.name);

    try {
      let parsed: ParsedTransaction[] = [];

      if (file.name.endsWith('.csv')) {
        const text = await file.text();
        parsed = parseCSV(text);
      } else if (file.name.endsWith('.pdf')) {
        parsed = await parsePDFWithAI(file);
      } else {
        throw new Error('Please upload a CSV or PDF file.');
      }

      if (parsed.length === 0) {
        throw new Error('No transactions found. Check that the file contains transaction data.');
      }

      setTransactions(parsed);
      setStep('preview');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse file');
    } finally {
      setLoading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleImport = () => {
    setStep('importing');
    const approved = transactions.filter(t => t.approved);
    const existing = JSON.parse(localStorage.getItem('novo_checking_transactions') || '[]');
    const combined = recalculateImportedBalances(existing, approved, startingBalance);
    localStorage.setItem('novo_checking_transactions', JSON.stringify(combined));
    onSuccess(`✓ Imported ${approved.length} transactions from ${fileName}`);
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
                className="border-2 border-dashed border-gray-300 rounded-xl p-10 text-center cursor-pointer hover:border-[#FF6B35] hover:bg-orange-50 transition-colors"
              >
                {loading ? (
                  <div className="flex flex-col items-center gap-3">
                    <Loader2 className="w-10 h-10 text-[#FF6B35] animate-spin" />
                    <p className="text-gray-600 font-medium">Reading your statement...</p>
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

          {step === 'preview' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-gray-900">{transactions.length} transactions found</p>
                  <p className="text-sm text-gray-500">Review and uncheck any you don&apos;t want to import</p>
                </div>
                <span className="text-sm font-medium text-[#FF6B35]">{approvedCount} selected</span>
              </div>

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
                            className="w-4 h-4 rounded text-[#FF6B35]"
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
                  className="flex-1 bg-[#FF6B35] hover:bg-[#e55a25] disabled:opacity-50 text-white font-semibold py-3 rounded-lg transition-colors"
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
