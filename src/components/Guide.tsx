import { useState } from 'react';
import {
  ChevronDown, ChevronUp, BookOpen, Play, TrendingUp, Repeat, DollarSign,
  PiggyBank, BarChart3, HelpCircle, ArrowUp, Wallet, Zap, Bot,
  Settings as SettingsIcon, Target, Lightbulb, Home, CreditCard, RefreshCw,
  MessageCircle, CheckCircle, AlertCircle
} from 'lucide-react';

interface GuideSection {
  id: string;
  title: string;
  icon: any;
  color: string;
  content: React.ReactNode;
}

function Guide() {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');

  const toggleSection = (sectionId: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(sectionId)) {
      newExpanded.delete(sectionId);
    } else {
      newExpanded.add(sectionId);
    }
    setExpandedSections(newExpanded);
  };

  const expandAll = () => setExpandedSections(new Set(sections.map(s => s.id)));
  const collapseAll = () => setExpandedSections(new Set());
  const scrollToTop = () => window.scrollTo({ top: 0, behavior: 'smooth' });

  const sections: GuideSection[] = [
    {
      id: 'getting-started',
      title: '1. Getting Started',
      icon: Play,
      color: 'bg-blue-500',
      content: (
        <div className="space-y-6">
          <div className="bg-gradient-to-br from-blue-50 to-sky-50 border-l-4 border-blue-500 p-5 rounded-r-xl">
            <h4 className="font-bold text-blue-900 text-lg mb-2">Welcome to NOVO</h4>
            <p className="text-blue-800 leading-relaxed">
              NOVO (from the Latin word for "new") helps you create a new financial future by showing you the fastest path to debt freedom. Built by Ben Hulshof — a mortgage professional with 27 years of experience helping families eliminate debt.
            </p>
          </div>

          <div>
            <h4 className="font-bold text-gray-900 text-lg mb-3">Step-by-Step Onboarding</h4>
            <div className="space-y-3">
              {[
                { step: 1, label: 'Enter your name and monthly income', detail: 'Your net take-home pay — what actually lands in your bank account.' },
                { step: 2, label: 'Enter monthly expenses', detail: 'Housing, utilities, groceries, insurance, and other essentials.' },
                { step: 3, label: 'Choose your strategy approach', detail: 'Cash Flow Strategies (recommended for most) or Cash Flow + HELOC Strategies (advanced, for homeowners with a HELOC).' },
                { step: 4, label: 'Add your debts', detail: 'Mortgages, credit cards, auto loans, student loans, personal loans — all of them.' },
              ].map(({ step, label, detail }) => (
                <div key={step} className="flex gap-4 p-4 bg-white border border-gray-200 rounded-xl shadow-sm">
                  <div className="flex-shrink-0 w-8 h-8 bg-blue-500 text-white rounded-full flex items-center justify-center font-bold text-sm">
                    {step}
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">{label}</p>
                    <p className="text-gray-600 text-sm mt-0.5">{detail}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-emerald-50 border border-emerald-300 rounded-xl p-4">
            <p className="font-semibold text-emerald-900 mb-2">What You'll Need</p>
            <ul className="space-y-1 text-emerald-800 text-sm">
              <li>• Recent loan statements for all your debts</li>
              <li>• Pay stubs showing your net take-home income</li>
              <li>• Monthly expense estimates</li>
              <li>• HELOC details (optional — only if you have one and want the advanced strategy)</li>
            </ul>
          </div>

          <div className="bg-amber-50 border border-amber-300 rounded-xl p-4">
            <p className="font-semibold text-amber-900 mb-1">Do I need a HELOC?</p>
            <p className="text-amber-800 text-sm">No! Most NOVO users eliminate debt using cash flow strategies alone. Example: Sarah eliminated $38K in debt in 5 years vs. 14 years using the debt avalanche method — no HELOC required. HELOC is optional for homeowners who want advanced techniques.</p>
          </div>
        </div>
      )
    },
    {
      id: 'dashboard',
      title: '2. Dashboard — Your Command Center',
      icon: Target,
      color: 'bg-[#1E3A5F]',
      content: (
        <div className="space-y-6">
          <p className="text-gray-700 leading-relaxed">The Dashboard is the first thing you see each visit. It shows your complete debt picture at a glance.</p>

          <div className="space-y-4">
            <div className="bg-white border border-sky-200 rounded-xl p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-7 h-7 bg-sky-500 rounded-lg flex items-center justify-center">
                  <Lightbulb className="w-4 h-4 text-white" />
                </div>
                <p className="font-bold text-gray-900">Debt Payoff Tip of the Day</p>
              </div>
              <p className="text-gray-700 text-sm leading-relaxed">A fresh educational tip appears every day based on your specific debts. Click the arrows to read more tips anytime. Tips cover strategies, motivation, mortgage, credit cards, auto loans, student loans, and more. Every 10th tip includes a soft prompt about 1-on-1 coaching with Ben.</p>
            </div>

            <div className="bg-white border border-blue-200 rounded-xl p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-7 h-7 bg-[#1E3A5F] rounded-lg flex items-center justify-center">
                  <TrendingUp className="w-4 h-4 text-white" />
                </div>
                <p className="font-bold text-gray-900">Total Debt Progress</p>
              </div>
              <ul className="text-gray-700 text-sm space-y-1">
                <li>• Total amount owed across all debts</li>
                <li>• Total paid off so far (from cash flow)</li>
                <li>• Progress percentage and visual bar</li>
                <li>• Projected debt-free date</li>
              </ul>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
              <p className="font-bold text-gray-900 mb-2">Quick Actions</p>
              <ul className="text-gray-700 text-sm space-y-1">
                <li>• <strong>Log Payment</strong> — Record any debt payment in seconds</li>
                <li>• <strong>Add Debt</strong> — Track a new debt you haven't added yet</li>
                <li>• <strong>View Strategy</strong> — Jump to your optimized payoff plan</li>
              </ul>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
              <p className="font-bold text-gray-900 mb-2">Recent Activity</p>
              <p className="text-gray-700 text-sm">Shows your last 5–10 actions — payments logged, debts added, refinances recorded. A quick confirmation that NOVO is tracking your progress.</p>
            </div>
          </div>
        </div>
      )
    },
    {
      id: 'my-debts',
      title: '3. My Debts — Manage All Your Debts',
      icon: CreditCard,
      color: 'bg-rose-500',
      content: (
        <div className="space-y-6">
          <p className="text-gray-700 leading-relaxed">My Debts is where you view and manage every loan, card, and balance you're tracking. Each debt card shows name, type, current balance, interest rate, monthly payment, progress bar, and next due date.</p>

          <div>
            <h4 className="font-bold text-gray-900 text-lg mb-3">Actions Available on Each Debt</h4>
            <div className="space-y-4">

              <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
                <p className="font-semibold text-gray-900 mb-1">Log Payment</p>
                <p className="text-gray-700 text-sm leading-relaxed">Record any payment. Use quick-select dates (Today, Yesterday, 1 Week Ago, 1 Month Ago) or a custom date picker — perfect for backdating missed entries. Supports paying from your HELOC if enabled.</p>
              </div>

              <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
                <p className="font-semibold text-gray-900 mb-1">Edit Debt</p>
                <p className="text-gray-700 text-sm leading-relaxed">Update balance, interest rate, minimum payment, or due date whenever your loan terms change. Rename the debt too.</p>
              </div>

              <div className="bg-white border border-amber-200 rounded-xl p-4 shadow-sm">
                <div className="flex items-center gap-2 mb-1">
                  <RefreshCw className="w-4 h-4 text-amber-600" />
                  <p className="font-semibold text-gray-900">Refinance This Loan</p>
                  <span className="text-xs bg-amber-100 text-amber-700 font-semibold px-2 py-0.5 rounded-full">Mortgages, Auto, Student, Personal</span>
                </div>
                <p className="text-gray-700 text-sm leading-relaxed">Update your loan after refinancing — enter new rate, balance, payment, and term. All existing payment history is preserved. Shows a before/after comparison so you can see the impact instantly.</p>
              </div>

              <div className="bg-white border border-blue-200 rounded-xl p-4 shadow-sm">
                <p className="font-semibold text-gray-900 mb-1">Transfer Balance</p>
                <span className="text-xs bg-blue-100 text-blue-700 font-semibold px-2 py-0.5 rounded-full">Credit Cards</span>
                <p className="text-gray-700 text-sm leading-relaxed mt-2">Record balance transfers to new cards, track 0% promotional periods, and update rate and payment details. Keeps a complete transfer history.</p>
              </div>

              <div className="bg-white border border-emerald-200 rounded-xl p-4 shadow-sm">
                <div className="flex items-center gap-2 mb-1">
                  <Home className="w-4 h-4 text-emerald-600" />
                  <p className="font-semibold text-gray-900">Sold Home</p>
                  <span className="text-xs bg-emerald-100 text-emerald-700 font-semibold px-2 py-0.5 rounded-full">Mortgages Only</span>
                </div>
                <p className="text-gray-700 text-sm leading-relaxed">Special flow for when you sell your home. Record the sale date and final payoff. Optionally track the sale price and net proceeds. You can add a replacement mortgage with a single click — it links the old and new properties for a clean history.</p>
              </div>

              <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
                <div className="flex items-center gap-2 mb-1">
                  <CheckCircle className="w-4 h-4 text-green-600" />
                  <p className="font-semibold text-gray-900">Mark as Paid Off</p>
                </div>
                <p className="text-gray-700 text-sm">Celebrate when a debt reaches $0! Records the final payment date and moves the debt to the "Paid Off" section.</p>
              </div>

            </div>
          </div>
        </div>
      )
    },
    {
      id: 'strategies',
      title: '4. Payment Strategies — Your Roadmap',
      icon: TrendingUp,
      color: 'bg-teal-600',
      content: (
        <div className="space-y-6">
          <div className="bg-emerald-50 border-2 border-emerald-300 rounded-xl p-5">
            <p className="font-bold text-emerald-900 text-lg mb-1">You Don't Need a HELOC to Succeed</p>
            <p className="text-emerald-800 text-sm leading-relaxed">Most NOVO users eliminate debt using cash flow strategies alone. The debt avalanche method saves the most money of any approach — with nothing but disciplined payments.</p>
          </div>

          <div className="space-y-4">
            <div className="bg-white border-l-4 border-teal-500 rounded-r-xl p-4 shadow-sm">
              <p className="font-bold text-gray-900 mb-1">Debt Avalanche (Recommended)</p>
              <p className="text-gray-700 text-sm leading-relaxed">Attack the highest-interest debt first. Pay minimums on everything else and direct all extra money toward the target debt. Mathematically optimal — saves the most total interest. When the highest-rate debt is gone, roll that payment to the next highest.</p>
            </div>

            <div className="bg-white border-l-4 border-blue-400 rounded-r-xl p-4 shadow-sm">
              <p className="font-bold text-gray-900 mb-1">Debt Snowball (Alternative)</p>
              <p className="text-gray-700 text-sm leading-relaxed">Attack the smallest balance first for quick psychological wins. Slightly less optimal mathematically but powerful for motivation if you need early victories.</p>
            </div>

            <div className="bg-white border-l-4 border-gray-400 rounded-r-xl p-4 shadow-sm">
              <p className="font-bold text-gray-900 mb-1">Minimum Payments Only (Comparison)</p>
              <p className="text-gray-700 text-sm leading-relaxed">Shows what happens if you only ever pay minimums — a sobering baseline that makes the value of your strategy crystal clear.</p>
            </div>

            <div className="bg-white border-l-4 border-amber-400 rounded-r-xl p-4 shadow-sm">
              <p className="font-bold text-gray-900 mb-1">Your Custom Timeline</p>
              <p className="text-gray-700 text-sm leading-relaxed">Month-by-month breakdown showing which debts pay off when, total interest saved, and your projected debt-free date. Recalculates automatically as you log payments.</p>
            </div>

            <div className="bg-white border-l-4 border-violet-400 rounded-r-xl p-4 shadow-sm">
              <p className="font-bold text-gray-900 mb-1">HELOC Strategies <span className="text-xs bg-violet-100 text-violet-700 font-semibold px-2 py-0.5 rounded-full ml-1">If Enabled</span></p>
              <p className="text-gray-700 text-sm leading-relaxed">Advanced velocity banking techniques for homeowners with a HELOC. Only shown if you enabled HELOC in setup — entirely optional.</p>
            </div>
          </div>
        </div>
      )
    },
    {
      id: 'cash-flow',
      title: '5. Cash Flow Tracker',
      icon: Wallet,
      color: 'bg-green-600',
      content: (
        <div className="space-y-4">
          <p className="text-gray-700 leading-relaxed">Track your checking account to see your complete financial picture — income, expenses, and debt payments in one place.</p>
          <div className="space-y-3">
            {[
              { label: 'Deposit', desc: 'Log paychecks and other income. Categorize by source.' },
              { label: 'Withdrawal', desc: 'Track expenses and purchases to see spending patterns.' },
              { label: 'Debt Payment', desc: 'Links directly to your tracked debts and updates balances automatically.' },
              { label: 'Current Balance', desc: 'Real-time checking account balance to aid budgeting and planning.' },
            ].map(({ label, desc }) => (
              <div key={label} className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
                <p className="font-semibold text-gray-900 text-sm">{label}</p>
                <p className="text-gray-600 text-sm mt-0.5">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      )
    },
    {
      id: 'savings',
      title: '6. Savings Tracker',
      icon: PiggyBank,
      color: 'bg-sky-500',
      content: (
        <div className="space-y-4">
          <p className="text-gray-700 leading-relaxed">Track your emergency fund and savings goals alongside your debt payoff progress.</p>
          <div className="bg-amber-50 border border-amber-300 rounded-xl p-4">
            <p className="font-semibold text-amber-900 mb-1">Why This Matters</p>
            <p className="text-amber-800 text-sm">Build a $1,000 emergency fund before attacking debt aggressively. Without a buffer, one unexpected expense forces you back into debt — undoing months of progress.</p>
          </div>
          <ul className="space-y-2 text-gray-700 text-sm">
            <li className="flex items-start gap-2"><CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />Set savings targets for each account</li>
            <li className="flex items-start gap-2"><CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />Log deposits and withdrawals</li>
            <li className="flex items-start gap-2"><CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />Watch your safety net grow with visual progress bars</li>
            <li className="flex items-start gap-2"><CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />Multiple accounts supported (emergency fund, sinking funds, etc.)</li>
          </ul>
        </div>
      )
    },
    {
      id: 'progress-reports',
      title: '7. Progress Reports',
      icon: BarChart3,
      color: 'bg-indigo-500',
      content: (
        <div className="space-y-4">
          <p className="text-gray-700 leading-relaxed">Detailed analytics on your entire debt elimination journey.</p>
          <div className="grid sm:grid-cols-2 gap-3">
            {[
              { label: 'Payment History', desc: 'Complete record of every payment. Filter by debt or date range.' },
              { label: 'Debt Reduction Charts', desc: 'Visual progress over time — compare current vs. starting balances.' },
              { label: 'Interest Saved', desc: 'See exactly how much interest you\'ve avoided vs. the minimum-payment scenario.' },
              { label: 'Monthly Summaries', desc: 'Total paid each month, progress toward debt-free date, and trend analysis.' },
            ].map(({ label, desc }) => (
              <div key={label} className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
                <p className="font-semibold text-gray-900 text-sm mb-1">{label}</p>
                <p className="text-gray-600 text-sm">{desc}</p>
              </div>
            ))}
          </div>
          <div className="bg-sky-50 border border-sky-200 rounded-xl p-4">
            <p className="text-sky-800 text-sm">Data can be exported for your own records.</p>
          </div>
        </div>
      )
    },
    {
      id: 'ask-novo',
      title: '8. Ask NOVO — Your AI Coach',
      icon: Bot,
      color: 'bg-violet-600',
      content: (
        <div className="space-y-5">
          <div className="bg-gradient-to-br from-violet-50 to-blue-50 border border-violet-200 rounded-xl p-5">
            <p className="font-bold text-violet-900 text-lg mb-2">Available 24/7</p>
            <p className="text-violet-800 text-sm leading-relaxed">Click "Ask NOVO" (top right) for instant AI-powered guidance — like having a debt elimination coach in your pocket at all times.</p>
          </div>
          <div>
            <p className="font-semibold text-gray-900 mb-3">Ask NOVO Can Help With:</p>
            <div className="space-y-2">
              {[
                'Strategy questions — "Should I use avalanche or snowball?"',
                'Calculation questions — "How much will I save if I pay $X extra?"',
                'Feature questions — "How do I log a payment?"',
                'Motivation — "I\'m struggling to stay on track"',
                'What-if scenarios — "What if I refinance to 4%?"',
              ].map(q => (
                <div key={q} className="flex items-start gap-2">
                  <MessageCircle className="w-4 h-4 text-violet-500 mt-0.5 flex-shrink-0" />
                  <p className="text-gray-700 text-sm">{q}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )
    },
    {
      id: 'daily-tip',
      title: '9. Debt Payoff Tip of the Day',
      icon: Lightbulb,
      color: 'bg-sky-500',
      content: (
        <div className="space-y-4">
          <p className="text-gray-700 leading-relaxed">The Tip of the Day card sits at the top of your Dashboard, right below the greeting. It provides ongoing education and motivation to keep you engaged every visit.</p>

          <div className="space-y-3">
            <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
              <p className="font-semibold text-gray-900 mb-1">How Tips Are Selected</p>
              <p className="text-gray-700 text-sm leading-relaxed">Tips automatically rotate each day based on the calendar date — you'll see a fresh tip every morning without doing anything. Your specific debts determine which categories appear first (e.g., if you have a mortgage, mortgage tips surface more prominently).</p>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
              <p className="font-semibold text-gray-900 mb-1">Manual Navigation</p>
              <p className="text-gray-700 text-sm">Use the arrow buttons to browse all 36 tips anytime. Your position is saved so you pick up where you left off next visit.</p>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
              <p className="font-semibold text-gray-900 mb-1">Categories Covered</p>
              <div className="flex flex-wrap gap-2 mt-2">
                {['General', 'Mortgage', 'Credit Cards', 'Auto Loans', 'Student Loans', 'Mindset', 'HELOC'].map(c => (
                  <span key={c} className="text-xs bg-sky-100 text-sky-700 font-semibold px-2 py-0.5 rounded-full">{c}</span>
                ))}
              </div>
            </div>
          </div>
        </div>
      )
    },
    {
      id: 'settings',
      title: '10. Settings',
      icon: SettingsIcon,
      color: 'bg-gray-600',
      content: (
        <div className="space-y-4">
          <div className="space-y-3">
            {[
              { label: 'Personal Information', desc: 'Update your name, monthly income, and expense estimates anytime.' },
              { label: 'HELOC Options', desc: 'Enable or disable HELOC features. Update your HELOC balance, credit limit, and interest rate.' },
              { label: 'Report Issue', desc: 'Found a bug or have feedback? Use "Report Issue" to send a message directly to Ben.' },
              { label: 'Reset Data', desc: 'Start over completely. Warning: this permanently deletes all debts, payments, and history.' },
            ].map(({ label, desc }) => (
              <div key={label} className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
                <p className="font-semibold text-gray-900 text-sm">{label}</p>
                <p className="text-gray-600 text-sm mt-0.5">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      )
    },
    {
      id: 'common-scenarios',
      title: '11. Common Scenarios',
      icon: HelpCircle,
      color: 'bg-orange-500',
      content: (
        <div className="space-y-5">
          {[
            {
              q: 'I refinanced my mortgage — how do I update NOVO?',
              steps: ['Go to My Debts', 'Find your mortgage', 'Click "Refinance This Loan"', 'Enter new rate, balance, payment, and term', 'All payment history is preserved automatically'],
            },
            {
              q: 'I sold my home — what do I do?',
              steps: ['Go to My Debts', 'Find your mortgage', 'Click to pay it off', 'Select "Yes, sold home — final payoff"', 'Enter sale details (sale price, proceeds)', 'Optionally add your new mortgage with one click'],
            },
            {
              q: 'I transferred my credit card balance to a 0% card — how do I record this?',
              steps: ['Go to My Debts', 'Find your credit card', 'Click "Transfer Balance"', 'Enter new card details and 0% promotional period', 'NOVO tracks when the promo ends'],
            },
            {
              q: "I forgot to log payments from last month — can I backdate them?",
              steps: ['Yes! When logging a payment, use the date picker', 'Click "1 Month Ago" or use the custom date option', 'Enter all past payments to get accurate tracking', 'Balances update to reflect the correct history'],
            },
            {
              q: 'I want to see what happens if I pay extra — can NOVO show me?',
              steps: ['Ask NOVO: "What if I pay an extra $200/month on my highest debt?"', 'Or visit Payment Strategies to explore different scenarios'],
            },
          ].map(({ q, steps }) => (
            <div key={q} className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
              <p className="font-semibold text-gray-900 mb-3">"{q}"</p>
              <ol className="space-y-1.5">
                {steps.map((step, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                    <span className="flex-shrink-0 w-5 h-5 bg-orange-100 text-orange-700 rounded-full flex items-center justify-center text-xs font-bold">{i + 1}</span>
                    {step}
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </div>
      )
    },
    {
      id: 'tips-success',
      title: '12. Tips for Success',
      icon: Zap,
      color: 'bg-yellow-500',
      content: (
        <div className="space-y-3">
          {[
            { num: 1, tip: 'Log every payment', detail: 'Consistency is key. Track all debt payments to see real progress and stay motivated.' },
            { num: 2, tip: 'Check your tip daily', detail: 'The daily tip on your Dashboard provides ongoing education and fresh motivation.' },
            { num: 3, tip: 'Review your strategy monthly', detail: 'Visit Payment Strategies once a month to stay focused on the plan and see your debt-free date move closer.' },
            { num: 4, tip: 'Celebrate small wins', detail: 'Every $1,000 paid off is real progress — acknowledge your discipline and keep going.' },
            { num: 5, tip: 'Use Ask NOVO', detail: "Don't struggle alone. Ask NOVO is available 24/7 to answer questions and provide encouragement." },
            { num: 6, tip: 'Stay consistent', detail: 'Debt elimination is a marathon, not a sprint. Keep making progress even when it feels slow.' },
          ].map(({ num, tip, detail }) => (
            <div key={num} className="flex gap-4 p-4 bg-white border border-gray-200 rounded-xl shadow-sm">
              <div className="flex-shrink-0 w-8 h-8 bg-yellow-400 text-white rounded-full flex items-center justify-center font-bold text-sm">
                {num}
              </div>
              <div>
                <p className="font-semibold text-gray-900">{tip}</p>
                <p className="text-gray-600 text-sm mt-0.5">{detail}</p>
              </div>
            </div>
          ))}
        </div>
      )
    },
    {
      id: 'faq',
      title: '13. Frequently Asked Questions',
      icon: MessageCircle,
      color: 'bg-cyan-600',
      content: (
        <div className="space-y-4">
          {[
            { q: 'Do I need a HELOC to use NOVO?', a: 'No. Most NOVO users succeed with cash flow strategies alone. HELOC is an optional advanced feature for homeowners who want to use velocity banking techniques.' },
            { q: 'Is my financial data secure?', a: 'Yes. All data is stored locally on your device. NOVO does not send your debt details to any external server.' },
            { q: 'Can I use NOVO on multiple devices?', a: 'Currently data is stored per-device. Cloud sync is planned for a future update.' },
            { q: 'How accurate are the debt-free date projections?', a: 'Very accurate, assuming you maintain your payment plan. Results depend on consistency and any extra payments you make.' },
            { q: 'Can NOVO help with budgeting?', a: 'Yes. The Cash Flow Tracker lets you see income, expenses, and debt payments together in one place.' },
            { q: 'What if I have a setback — medical bill, car repair?', a: 'Life happens. Update your debts if needed, adjust your plan, and keep going. NOVO recalculates your timeline automatically.' },
            { q: 'Can I export my data?', a: 'Yes. Progress Reports can be exported for your own records.' },
            { q: 'What if I want personalized help beyond what Ask NOVO provides?', a: 'Ben offers 1-on-1 coaching for personalized debt elimination guidance. Contact him at ben@windmillmortgage.com or 614-327-2213.' },
          ].map(({ q, a }) => (
            <div key={q} className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
              <p className="font-semibold text-gray-900 text-sm mb-1.5">Q: {q}</p>
              <p className="text-gray-700 text-sm leading-relaxed">A: {a}</p>
            </div>
          ))}
        </div>
      )
    },
    {
      id: 'contact',
      title: '14. Need More Help?',
      icon: AlertCircle,
      color: 'bg-[#FF6B35]',
      content: (
        <div className="space-y-4">
          <div className="grid sm:grid-cols-3 gap-4">
            <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm text-center">
              <Bot className="w-8 h-8 text-violet-500 mx-auto mb-2" />
              <p className="font-semibold text-gray-900 text-sm">Ask NOVO</p>
              <p className="text-gray-600 text-xs mt-1">Instant AI assistance available 24/7 — top right corner of any screen</p>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm text-center">
              <AlertCircle className="w-8 h-8 text-orange-500 mx-auto mb-2" />
              <p className="font-semibold text-gray-900 text-sm">Report Issue</p>
              <p className="text-gray-600 text-xs mt-1">Found a bug? Use "Report Issue" in Settings to send feedback directly to Ben</p>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm text-center">
              <MessageCircle className="w-8 h-8 text-blue-500 mx-auto mb-2" />
              <p className="font-semibold text-gray-900 text-sm">Contact Ben</p>
              <p className="text-gray-600 text-xs mt-1">ben@windmillmortgage.com<br />614-327-2213</p>
            </div>
          </div>

          <div className="bg-gradient-to-br from-[#1E3A5F] to-[#2D5A8A] text-white rounded-xl p-6 text-center">
            <p className="font-bold text-xl mb-2">About NOVO</p>
            <p className="text-blue-100 text-sm leading-relaxed max-w-lg mx-auto">
              NOVO (from the Latin for "new") helps you create a new financial future. Built by Ben Hulshof — a mortgage professional with 27 years of experience helping families navigate debt and homeownership. NOVO combines proven debt elimination strategies with AI-powered coaching to guide you every step of the way.
            </p>
            <p className="text-blue-200 text-sm font-semibold mt-4">Your new path to debt freedom starts here.</p>
          </div>
        </div>
      )
    },
  ];

  const filteredSections = searchTerm
    ? sections.filter(s =>
        s.title.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : sections;

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white rounded-xl shadow-sm p-8 mb-6">
        <div className="flex items-center gap-4 mb-4">
          <div className="bg-[#FF6B35] text-white p-3 rounded-xl">
            <BookOpen className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">How to Use NOVO</h1>
            <p className="text-gray-500 mt-1">Your complete guide to debt-free living</p>
          </div>
        </div>

        <p className="text-gray-700 leading-relaxed mb-6">
          Everything you need to know about using NOVO effectively. Click any section to expand it. Use the search bar to jump to a specific topic.
        </p>

        <div className="mb-4">
          <input
            type="text"
            placeholder="Search guide topics..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF6B35] focus:border-transparent"
          />
        </div>

        <div className="flex gap-3">
          <button
            onClick={expandAll}
            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors text-sm font-medium"
          >
            Expand All
          </button>
          <button
            onClick={collapseAll}
            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors text-sm font-medium"
          >
            Collapse All
          </button>
        </div>
      </div>

      <div className="space-y-3">
        {filteredSections.map((section) => {
          const Icon = section.icon;
          const isExpanded = expandedSections.has(section.id);

          return (
            <div key={section.id} className="bg-white rounded-xl shadow-sm overflow-hidden">
              <button
                onClick={() => toggleSection(section.id)}
                className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className={`${section.color} text-white p-2 rounded-lg`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <h2 className="text-lg font-semibold text-gray-900 text-left">{section.title}</h2>
                </div>
                <div className="text-gray-400 flex-shrink-0">
                  {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                </div>
              </button>

              {isExpanded && (
                <div className="px-6 py-6 border-t border-gray-100 bg-gray-50">
                  {section.content}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {filteredSections.length === 0 && (
        <div className="bg-white rounded-xl shadow-sm p-8 text-center">
          <p className="text-gray-500">No sections found matching "{searchTerm}"</p>
        </div>
      )}

      <div className="mt-8 flex justify-center pb-4">
        <button
          onClick={scrollToTop}
          className="flex items-center gap-2 px-6 py-3 bg-[#FF6B35] hover:bg-[#E55A2B] text-white font-semibold rounded-lg transition-colors shadow-md"
        >
          <ArrowUp className="w-5 h-5" />
          Back to Top
        </button>
      </div>
    </div>
  );
}

export default Guide;
