import { useState } from 'react';
import { ChevronDown, ChevronUp, BookOpen, Play, TrendingUp, Repeat, DollarSign, PiggyBank, BarChart3, AlertCircle, HelpCircle, ArrowUp, Wallet, Zap, LineChart, Bot, Settings as SettingsIcon, Target } from 'lucide-react';

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

  const expandAll = () => {
    setExpandedSections(new Set(sections.map(s => s.id)));
  };

  const collapseAll = () => {
    setExpandedSections(new Set());
  };

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const sections: GuideSection[] = [
    {
      id: 'who-is-novo-for',
      title: '0. Who Is NOVO For?',
      icon: HelpCircle,
      color: 'bg-[#FF6B35]',
      content: (
        <div className="space-y-6">
          <div className="bg-gradient-to-br from-emerald-50 to-teal-50 border-2 border-emerald-300 rounded-xl p-6">
            <h4 className="font-bold text-emerald-900 text-2xl mb-3">NOVO Helps ANYONE Eliminate Debt Faster</h4>
            <p className="text-emerald-800 text-lg leading-relaxed">
              Whether you're a renter, homeowner, have a HELOC, or just have extra cash flow - NOVO creates a personalized strategy to accelerate your debt-free journey.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6 mt-6">
            <div className="bg-white border-2 border-blue-300 rounded-xl p-6 shadow-sm">
              <div className="flex items-center space-x-3 mb-4">
                <div className="bg-blue-500 text-white p-3 rounded-lg">
                  <DollarSign className="w-7 h-7" />
                </div>
                <div>
                  <h4 className="font-bold text-blue-900 text-xl">1. Cash Flow Strategy</h4>
                  <p className="text-blue-700 text-sm font-semibold">(For Everyone)</p>
                </div>
              </div>

              <p className="text-gray-700 mb-4 leading-relaxed">
                Use NOVO to track debts, follow the debt avalanche method (highest interest first), and watch the snowball effect accelerate your payoff. <strong>No HELOC required.</strong>
              </p>

              <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-r mb-4">
                <p className="font-semibold text-blue-900 mb-2">What You Get:</p>
                <ul className="space-y-1 text-blue-800 text-sm">
                  <li>• Debt avalanche strategy (mathematically optimal)</li>
                  <li>• Payment tracking and progress monitoring</li>
                  <li>• Snowball effect automation</li>
                  <li>• Interest savings calculations</li>
                  <li>• Debt-free date projections</li>
                  <li>• Savings tracker for emergency fund</li>
                  <li>• 24/7 AI coaching</li>
                </ul>
              </div>

              <div className="bg-green-50 border border-green-300 rounded-lg p-3">
                <p className="font-bold text-green-900 text-sm mb-1">Best For:</p>
                <p className="text-green-800 text-sm">
                  Anyone with debt who wants to become debt-free faster using proven strategies. Renters, homeowners, students - everyone!
                </p>
              </div>
            </div>

            <div className="bg-white border-2 border-purple-300 rounded-xl p-6 shadow-sm">
              <div className="flex items-center space-x-3 mb-4">
                <div className="bg-purple-600 text-white p-3 rounded-lg">
                  <Repeat className="w-7 h-7" />
                </div>
                <div>
                  <h4 className="font-bold text-purple-900 text-xl">2. HELOC Velocity Banking</h4>
                  <p className="text-purple-700 text-sm font-semibold">(Homeowners - Advanced)</p>
                </div>
              </div>

              <p className="text-gray-700 mb-4 leading-relaxed">
                If you have a Home Equity Line of Credit, NOVO helps you use it strategically to eliminate high-interest debt by trading expensive rates for lower HELOC rates.
              </p>

              <div className="bg-purple-50 border-l-4 border-purple-500 p-4 rounded-r mb-4">
                <p className="font-semibold text-purple-900 mb-2">Additional Features:</p>
                <ul className="space-y-1 text-purple-800 text-sm">
                  <li>• Everything from Cash Flow Strategy, PLUS:</li>
                  <li>• Smart chunking calculator</li>
                  <li>• HELOC tracker with daily interest</li>
                  <li>• Rate arbitrage analysis</li>
                  <li>• Velocity banking cycle guidance</li>
                  <li>• Advanced cash flow routing strategies</li>
                  <li>• Chunking readiness quiz</li>
                </ul>
              </div>

              <div className="bg-amber-50 border border-amber-400 rounded-lg p-3">
                <p className="font-bold text-amber-900 text-sm mb-1">Best For:</p>
                <p className="text-amber-800 text-sm">
                  Homeowners with equity, stable income, and discipline to execute velocity banking strategies.
                </p>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-r from-cyan-50 to-blue-50 border-2 border-cyan-300 rounded-xl p-6 mt-6">
            <div className="flex items-start space-x-3">
              <Zap className="w-8 h-8 text-cyan-600 flex-shrink-0 mt-1" />
              <div>
                <h4 className="font-bold text-cyan-900 text-xl mb-2">Start Simple, Scale Up When Ready</h4>
                <p className="text-cyan-800 leading-relaxed">
                  You can start with Cash Flow Strategy and enable HELOC features later if your situation changes. Many users pay off thousands in debt using just the cash flow approach before ever considering a HELOC. <strong>The choice is yours!</strong>
                </p>
              </div>
            </div>
          </div>

          <div className="bg-gray-50 border border-gray-300 rounded-lg p-4 mt-4">
            <p className="text-gray-700 text-sm italic">
              <strong>Note:</strong> Throughout this guide, sections marked with <span className="inline-block bg-purple-100 text-purple-800 px-2 py-0.5 rounded text-xs font-bold">HELOC FEATURE</span> require a HELOC. All other features work for everyone regardless of homeownership status.
            </p>
          </div>
        </div>
      )
    },
    {
      id: 'getting-started',
      title: '1. Getting Started',
      icon: Play,
      color: 'bg-blue-500',
      content: (
        <div className="space-y-4">
          <div>
            <h4 className="font-semibold text-gray-900 mb-2">Welcome to NOVO</h4>
            <p className="text-gray-700 leading-relaxed">
              NOVO is your debt payoff tool with AI coaching designed to help you eliminate debt faster and smarter. Whether you're tackling credit cards, student loans, or a mortgage, NOVO creates a personalized strategy to accelerate your journey to financial freedom.
            </p>
          </div>

          <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-r">
            <h4 className="font-semibold text-blue-900 mb-2">Getting Started:</h4>
            <ol className="space-y-1 text-blue-800 list-decimal ml-4">
              <li>Complete the 4-step onboarding process</li>
              <li>Review your personalized payoff strategy</li>
              <li>Start logging payments as you make them</li>
              <li>Track your progress on the dashboard</li>
            </ol>
          </div>

          <div>
            <h4 className="font-semibold text-gray-900 mb-2">What You'll Need:</h4>
            <ul className="space-y-1 text-gray-700 ml-4">
              <li>• Recent loan statements for all your debts</li>
              <li>• Pay stubs showing gross and net income</li>
              <li>• Monthly expense breakdown</li>
              <li>• HELOC details (optional - only if you have one)</li>
            </ul>
          </div>
        </div>
      )
    },
    {
      id: 'daily-use',
      title: '2. Daily Use - How to Use NOVO Every Day',
      icon: Repeat,
      color: 'bg-teal-500',
      content: (
        <div className="space-y-6">
          <div className="bg-gradient-to-r from-teal-50 to-cyan-50 border-l-4 border-teal-500 p-6 rounded-r">
            <h4 className="font-semibold text-teal-900 text-lg mb-2">Your Daily Workflow</h4>
            <p className="text-teal-800">
              NOVO is designed to fit seamlessly into your life. Here's how to use it effectively on a day-to-day basis.
            </p>
          </div>

          <div>
            <h4 className="font-bold text-gray-900 text-xl mb-4">Logging Debt Payments - 3 Methods</h4>
            <p className="text-gray-700 mb-4">
              There are three ways to log debt payments in NOVO. Choose whichever method is most convenient for you:
            </p>

            <div className="space-y-4">
              <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-r">
                <h5 className="font-semibold text-blue-900 mb-2">Method 1: Quick Log from Dashboard (Fastest)</h5>
                <ol className="space-y-1 text-blue-800 ml-4 list-decimal">
                  <li>Go to the Dashboard tab</li>
                  <li>Find the debt you just paid in the "Active Debts" section</li>
                  <li>Click the "Log Payment" button on that debt card</li>
                  <li>The payment amount auto-fills with the minimum payment</li>
                  <li>Adjust the amount if you paid more (or less)</li>
                  <li>Click "Log Payment" to save</li>
                </ol>
                <p className="text-blue-800 mt-2 text-sm italic">
                  <strong>Best for:</strong> Logging regular monthly payments quickly
                </p>
              </div>

              <div className="bg-green-50 border-l-4 border-green-500 p-4 rounded-r">
                <h5 className="font-semibold text-green-900 mb-2">Method 2: From My Debts Tab (Most Detailed)</h5>
                <ol className="space-y-1 text-green-800 ml-4 list-decimal">
                  <li>Go to the "My Debts" tab</li>
                  <li>Find the debt card you want to log a payment for</li>
                  <li>Click "Log Payment" button</li>
                  <li>Enter payment amount and date</li>
                  <li>Add notes if needed (optional - e.g., "Extra $200 from bonus")</li>
                  <li>System automatically calculates interest vs. principal</li>
                  <li>Click "Log Payment" to save</li>
                </ol>
                <p className="text-green-800 mt-2 text-sm italic">
                  <strong>Best for:</strong> When you want to see full debt details and add notes
                </p>
              </div>

              <div className="bg-purple-50 border-l-4 border-purple-500 p-4 rounded-r">
                <h5 className="font-semibold text-purple-900 mb-2">Method 3: Bulk Update via Settings (End of Month)</h5>
                <ol className="space-y-1 text-purple-800 ml-4 list-decimal">
                  <li>Go to the "Settings" tab</li>
                  <li>Scroll to "Edit Debt Balances"</li>
                  <li>Update all current balances from your statements</li>
                  <li>NOVO calculates the payment based on balance change</li>
                  <li>Click "Save Changes"</li>
                </ol>
                <p className="text-purple-800 mt-2 text-sm italic">
                  <strong>Best for:</strong> Monthly reconciliation when you have all statements
                </p>
              </div>
            </div>
          </div>

          <div>
            <h4 className="font-bold text-gray-900 text-xl mb-4">Using the Checking Register</h4>
            <p className="text-gray-700 mb-3">
              The Checking Register (found in the "Tracker" tab) helps you track your available cash flow for debt payoff.
            </p>

            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-3">
              <h5 className="font-semibold text-gray-900 mb-2">How to Use It:</h5>
              <ol className="space-y-2 text-gray-700 ml-4 list-decimal">
                <li><strong>Select "Checking/Cash Flow Account"</strong> from the tracking dropdown</li>
                <li><strong>Set your starting balance</strong> - Enter your current checking account balance</li>
                <li><strong>Log income deposits:</strong>
                  <ul className="ml-4 mt-1 space-y-1">
                    <li>• Paychecks</li>
                    <li>• Side income</li>
                    <li>• Tax refunds</li>
                    <li>• Bonuses</li>
                  </ul>
                </li>
                <li><strong>Log extra debt payments:</strong> Record any payments beyond minimums</li>
                <li><strong>Track windfalls:</strong> Gifts, rebates, unexpected income</li>
              </ol>
            </div>

            <div className="bg-cyan-50 border-l-4 border-cyan-500 p-4 rounded-r">
              <h5 className="font-semibold text-cyan-900 mb-2">Why Track Checking?</h5>
              <p className="text-cyan-800">
                This gives you visibility into your debt payoff reserve. You can see exactly how much cash you have available to throw at debt, and track how your windfalls and bonuses accelerate your progress.
              </p>
            </div>
          </div>

          <div className="bg-purple-50 border-2 border-purple-300 rounded-lg p-4">
            <div className="flex items-center space-x-2 mb-2">
              <span className="inline-block bg-purple-100 text-purple-800 px-3 py-1 rounded-full text-xs font-bold">HELOC FEATURE</span>
            </div>
            <h4 className="font-bold text-gray-900 text-lg mb-3">Using the HELOC Tracker (HELOC Owners Only)</h4>
            <p className="text-gray-700 mb-3">
              If you have a HELOC, the tracker becomes your command center for velocity banking.
            </p>

            <div className="bg-white border border-purple-200 rounded-lg p-4 mb-3">
              <h5 className="font-semibold text-gray-900 mb-2">Select "HELOC Account" from tracking dropdown</h5>
              <p className="text-gray-700 mb-3">Then use these transaction types:</p>

              <div className="space-y-3">
                <div>
                  <p className="font-semibold text-red-700">Record Draw (Increases Balance)</p>
                  <p className="text-gray-600 text-sm">When you pull money from HELOC to pay off a high-interest debt</p>
                  <p className="text-gray-600 text-sm mt-1"><strong>Example:</strong> Draw $5,000 to pay off a 24% credit card</p>
                </div>

                <div>
                  <p className="font-semibold text-green-700">Record Payment (Decreases Balance)</p>
                  <p className="text-gray-600 text-sm">When you pay down your HELOC balance with your cash flow</p>
                  <p className="text-gray-600 text-sm mt-1"><strong>Example:</strong> Pay $2,000 from your paycheck toward HELOC</p>
                </div>

                <div>
                  <p className="font-semibold text-orange-700">Record Interest (Increases Balance)</p>
                  <p className="text-gray-600 text-sm">Monthly interest charge from your lender (check your statement)</p>
                  <p className="text-gray-600 text-sm mt-1"><strong>Example:</strong> $169 interest charged in August</p>
                </div>
              </div>
            </div>

            <div className="bg-orange-50 border border-orange-300 rounded-lg p-3">
              <p className="text-orange-900 font-semibold mb-1">Important:</p>
              <p className="text-orange-800 text-sm">
                Log interest charges monthly when you receive your HELOC statement. This keeps your balance accurate and helps you see the true cost of HELOC usage.
              </p>
            </div>
          </div>

          <div className="bg-amber-50 border-l-4 border-amber-500 p-4 rounded-r">
            <h4 className="font-semibold text-amber-900 mb-2">Pro Tip: Set a Monthly Routine</h4>
            <p className="text-amber-800 mb-2">Create a consistent habit for maximum results:</p>
            <ul className="space-y-1 text-amber-800 ml-4">
              <li>• <strong>Weekly:</strong> Log any payments you made</li>
              <li>• <strong>Mid-Month:</strong> Check progress on dashboard</li>
              <li>• <strong>End of Month:</strong> Reconcile all balances with statements</li>
              <li>• <strong>Monthly:</strong> Review Progress Reports for motivation</li>
            </ul>
          </div>
        </div>
      )
    },
    {
      id: 'income-expenses',
      title: '3. Understanding Your Income & Expenses',
      icon: Wallet,
      color: 'bg-emerald-500',
      content: (
        <div className="space-y-4">
          <div>
            <h4 className="font-semibold text-gray-900 mb-2">Gross vs Net Income</h4>
            <p className="text-gray-700 mb-2">
              <strong>Gross Income:</strong> Your total earnings before any deductions (taxes, insurance, retirement contributions)
            </p>
            <p className="text-gray-700">
              <strong>Net Income:</strong> Your take-home pay after all deductions - this is what actually hits your bank account
            </p>
            <p className="text-gray-700 mt-2">
              NOVO asks for both to give you the complete picture, but uses your net income for cash flow calculations.
            </p>
          </div>

          <div>
            <h4 className="font-semibold text-gray-900 mb-2">Essential Expenses</h4>
            <p className="text-gray-700 mb-2">
              Fixed costs you can't easily reduce:
            </p>
            <ul className="space-y-1 text-gray-700 ml-4">
              <li>• Rent or mortgage (P&I + escrow)</li>
              <li>• Utilities (electric, gas, water)</li>
              <li>• Groceries and basic food</li>
              <li>• Insurance (health, home, auto)</li>
              <li>• Childcare</li>
              <li>• Transportation (gas, car maintenance, public transit)</li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold text-gray-900 mb-2">Discretionary Expenses</h4>
            <p className="text-gray-700 mb-2">
              Flexible spending you could reduce:
            </p>
            <ul className="space-y-1 text-gray-700 ml-4">
              <li>• Dining out and takeout</li>
              <li>• Entertainment and hobbies</li>
              <li>• Subscriptions (streaming, gym, apps)</li>
              <li>• Shopping and non-essentials</li>
              <li>• Travel and vacations</li>
            </ul>
          </div>

          <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-r">
            <h4 className="font-semibold text-red-900 mb-2">IMPORTANT:</h4>
            <p className="text-red-800">
              Do NOT include debt payments in your expenses - NOVO adds those separately! Only enter living expenses like housing, food, utilities, insurance, and other costs.
            </p>
          </div>

          <div className="bg-emerald-50 border-l-4 border-emerald-500 p-4 rounded-r">
            <h4 className="font-semibold text-emerald-900 mb-2">The Power of Reducing Discretionary Spending</h4>
            <p className="text-emerald-800">
              Every dollar you reduce in discretionary expenses becomes a dollar that can attack your debt. Cutting just $100/month from discretionary spending can eliminate debt months or even years faster!
            </p>
          </div>
        </div>
      )
    },
    {
      id: 'adding-debts',
      title: '4. Adding Your Debts',
      icon: DollarSign,
      color: 'bg-orange-500',
      content: (
        <div className="space-y-4">
          <div>
            <h4 className="font-semibold text-gray-900 mb-2">Choosing Debt Type</h4>
            <p className="text-gray-700 mb-2">Select from the dropdown menu:</p>
            <ul className="space-y-2 text-gray-700 ml-4">
              <li><strong>Credit Card:</strong> Revolving credit from banks or stores</li>
              <li><strong>Mortgage:</strong> Home loan (triggers special amortization fields)</li>
              <li><strong>Auto Loan:</strong> Vehicle financing</li>
              <li><strong>Student Loan:</strong> Federal or private education loans</li>
              <li><strong>Personal Loan:</strong> Fixed installment loans</li>
              <li><strong>HELOC:</strong> Home equity line of credit</li>
              <li><strong>Other:</strong> Any other debt type</li>
            </ul>
          </div>

          <div className="bg-amber-50 border-l-4 border-amber-500 p-4 rounded-r">
            <h4 className="font-semibold text-amber-900 mb-2">For Mortgages:</h4>
            <p className="text-amber-800 mb-2">
              When you select "Mortgage," NOVO asks for additional details:
            </p>
            <ul className="space-y-1 text-amber-800 ml-4">
              <li>• <strong>Original loan amount</strong> - Total amount borrowed at closing</li>
              <li>• <strong>Start date</strong> - When your mortgage began</li>
              <li>• <strong>Current balance</strong> - What you owe now</li>
              <li>• <strong>Interest rate</strong> - Your current APR</li>
              <li>• <strong>P&I payment</strong> - Principal and interest ONLY</li>
              <li>• <strong>Loan term</strong> - Choose 10, 15, 20, 25, or 30 years</li>
            </ul>
          </div>

          <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-r">
            <h4 className="font-semibold text-red-900 mb-2">CRITICAL: Mortgage Payment Should Be P&I Only</h4>
            <p className="text-red-800 mb-2">
              Enter ONLY your Principal & Interest payment. DO NOT include:
            </p>
            <ul className="space-y-1 text-red-800 ml-4">
              <li>• Property taxes</li>
              <li>• Homeowners insurance</li>
              <li>• HOA fees</li>
              <li>• PMI (Private Mortgage Insurance)</li>
            </ul>
            <p className="text-red-800 mt-2">
              These items should go in your monthly expenses instead. This prevents double-counting and ensures accurate payoff calculations.
            </p>
          </div>

          <div>
            <h4 className="font-semibold text-gray-900 mb-2">For Other Debts:</h4>
            <p className="text-gray-700 mb-2">Simply enter:</p>
            <ul className="space-y-1 text-gray-700 ml-4">
              <li>• Current balance</li>
              <li>• Interest rate (APR)</li>
              <li>• Minimum monthly payment</li>
            </ul>
          </div>

          <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-r">
            <div className="flex items-center space-x-2 mb-2">
              <span className="inline-block bg-purple-100 text-purple-800 px-2 py-0.5 rounded text-xs font-bold">HELOC FEATURE</span>
              <span className="text-blue-900 font-semibold text-sm">(Optional)</span>
            </div>
            <h4 className="font-semibold text-blue-900 mb-2">HELOC Setup</h4>
            <p className="text-blue-800 mb-2">
              <strong>Only if you have a HELOC:</strong> Check the HELOC box and enter:
            </p>
            <ul className="space-y-1 text-blue-800 ml-4">
              <li>• Credit limit</li>
              <li>• Current balance</li>
              <li>• Interest rate</li>
              <li>• Minimum payment (if any)</li>
            </ul>
            <p className="text-blue-800 mt-2">
              This unlocks HELOC velocity banking features and the HELOC tracker. <strong>If you don't have a HELOC, simply skip this step!</strong>
            </p>
          </div>

          <div>
            <h4 className="font-semibold text-gray-900 mb-2">Editing or Deleting Debts</h4>
            <p className="text-gray-700">
              Use the pencil icon on any debt card to edit details, or the trash icon to delete. Changes automatically update your strategy and projections.
            </p>
          </div>
        </div>
      )
    },
    {
      id: 'payoff-strategy',
      title: '5. Understanding Your Payoff Strategy',
      icon: TrendingUp,
      color: 'bg-purple-500',
      content: (
        <div className="space-y-4">
          <div>
            <h4 className="font-semibold text-gray-900 mb-2">NOVO Uses the Debt Avalanche Method</h4>
            <p className="text-gray-700">
              This mathematically optimal strategy pays minimum payments on all debts, then directs all extra cash flow to the debt with the <strong>highest interest rate first</strong>. This saves you the most money in interest over time.
            </p>
          </div>

          <div className="bg-purple-50 border-l-4 border-purple-500 p-4 rounded-r">
            <div className="flex items-center space-x-2 mb-2">
              <span className="inline-block bg-purple-100 text-purple-800 px-2 py-0.5 rounded text-xs font-bold">HELOC FEATURE</span>
            </div>
            <h4 className="font-semibold text-purple-900 mb-2">Rate Arbitrage Check (For HELOC Users)</h4>
            <p className="text-purple-800 mb-2">
              If you have a HELOC, NOVO analyzes whether using it makes financial sense:
            </p>
            <ul className="space-y-1 text-purple-800 ml-4">
              <li>• <strong className="text-green-700">Green debts:</strong> Higher rate than HELOC - good candidates for chunking</li>
              <li>• <strong className="text-red-700">Red debts:</strong> Lower rate than HELOC - not recommended for chunking</li>
            </ul>
            <p className="text-purple-800 mt-2 text-sm">
              <strong>Note:</strong> If you don't have a HELOC, ignore this feature and focus on the debt avalanche method instead!
            </p>
          </div>

          <div>
            <h4 className="font-semibold text-gray-900 mb-2">Payment Priority</h4>
            <p className="text-gray-700">
              NOVO automatically allocates your extra cash flow to the highest-rate debt. You don't have to think about it - just follow the plan and log your payments.
            </p>
          </div>

          <div>
            <h4 className="font-semibold text-gray-900 mb-2">Reading Your Strategy Results:</h4>
            <ul className="space-y-2 text-gray-700 ml-4">
              <li>• <strong>Payoff Order:</strong> The sequence debts will be eliminated</li>
              <li>• <strong>Monthly Payment:</strong> Minimum + extra cash flow per debt</li>
              <li>• <strong>Months to Payoff:</strong> Timeline for each debt elimination</li>
              <li>• <strong>Projected Debt-Free Date:</strong> When you'll be completely free</li>
              <li>• <strong>Total Interest Saved:</strong> How much you save vs minimum payments</li>
            </ul>
          </div>
        </div>
      )
    },
    {
      id: 'debt-snowball-effect',
      title: '6. The Debt Snowball Effect',
      icon: Zap,
      color: 'bg-cyan-500',
      content: (
        <div className="space-y-4">
          <div>
            <h4 className="font-semibold text-gray-900 mb-2">How the Snowball Works</h4>
            <p className="text-gray-700 leading-relaxed">
              When you pay off a debt completely, its minimum payment is freed from your monthly obligations. NOVO automatically adds this freed payment to your available cash flow, accelerating payoff of your remaining debts.
            </p>
          </div>

          <div className="bg-cyan-50 border-l-4 border-cyan-500 p-4 rounded-r">
            <h4 className="font-semibold text-cyan-900 mb-2">Real Example:</h4>
            <div className="text-cyan-800 space-y-2">
              <p>1. You pay off Credit Card A with a $150 minimum payment</p>
              <p>2. That $150 is now freed and added to your cash flow</p>
              <p>3. NOVO automatically adds that $150 to your next target debt</p>
              <p>4. Each debt you eliminate makes the next one faster</p>
            </div>
          </div>

          <div>
            <h4 className="font-semibold text-gray-900 mb-2">Dashboard Shows Freed Payments</h4>
            <p className="text-gray-700">
              Look for the "Freed from paid-off debts" amount on your dashboard. This shows the cumulative minimum payments you've liberated through successful debt elimination.
            </p>
          </div>

          <div>
            <h4 className="font-semibold text-gray-900 mb-2">Building Momentum</h4>
            <p className="text-gray-700">
              The snowball effect creates exponential acceleration. Your first debt might take 12 months, but your last debt might take only 2-3 months because you have so much freed cash flow attacking it!
            </p>
          </div>
        </div>
      )
    },
    {
      id: 'using-tracker',
      title: '7. Using the Tracker (Optional)',
      icon: Repeat,
      color: 'bg-teal-500',
      content: (
        <div className="space-y-4">
          <div>
            <h4 className="font-semibold text-gray-900 mb-2">Located in Tracker Tab</h4>
            <p className="text-gray-700 mb-2">
              The Tracker is your flexible ledger for monitoring cash flow. Use the dropdown to choose what to track:
            </p>
            <ul className="space-y-2 text-gray-700 ml-4">
              <li><strong className="inline-block bg-purple-100 text-purple-800 px-2 py-0.5 rounded text-xs mr-2">HELOC FEATURE</strong><strong>HELOC Account:</strong> Track draws, payments, and interest for velocity banking</li>
              <li><strong>Checking/Cash Flow Account:</strong> Monitor income deposits, extra payments, bonuses, windfalls (Available to everyone)</li>
              <li><strong className="inline-block bg-purple-100 text-purple-800 px-2 py-0.5 rounded text-xs mr-2">HELOC FEATURE</strong><strong>Both:</strong> Advanced velocity banking - route income through HELOC to minimize interest</li>
            </ul>
          </div>

          <div className="bg-teal-50 border-l-4 border-teal-500 p-4 rounded-r">
            <h4 className="font-semibold text-teal-900 mb-2">HELOC Tracking</h4>
            <p className="text-teal-800 mb-2">Log these transaction types:</p>
            <ul className="space-y-1 text-teal-800 ml-4">
              <li>• <strong>Draws:</strong> When you pull from HELOC to pay debt</li>
              <li>• <strong>Payments:</strong> When you pay down the HELOC balance</li>
              <li>• <strong>Interest Charges:</strong> Monthly interest from your lender</li>
            </ul>
            <p className="text-teal-800 mt-2">
              View transaction history, balance over time chart, and export to CSV. Daily interest display shows today's interest charge on your HELOC balance.
            </p>
          </div>

          <div className="bg-green-50 border-l-4 border-green-500 p-4 rounded-r">
            <h4 className="font-semibold text-green-900 mb-2">Checking Account Tracking</h4>
            <p className="text-green-800 mb-2">Log these transactions:</p>
            <ul className="space-y-1 text-green-800 ml-4">
              <li>• <strong>Income Deposits:</strong> Paychecks, side income</li>
              <li>• <strong>Extra Debt Payments:</strong> When you make payments beyond minimums</li>
              <li>• <strong>Bonuses & Windfalls:</strong> Tax refunds, gifts, raises</li>
            </ul>
            <p className="text-green-800 mt-2">
              Perfect for tracking your debt payoff reserve fund and irregular extra payments.
            </p>
          </div>
        </div>
      )
    },
    {
      id: 'heloc-velocity',
      title: '8. HELOC Velocity Banking Explained (HELOC Only)',
      icon: Repeat,
      color: 'bg-indigo-600',
      content: (
        <div className="space-y-4">
          <div className="bg-purple-50 border-2 border-purple-300 rounded-lg p-4 mb-4">
            <div className="flex items-center space-x-2 mb-2">
              <span className="inline-block bg-purple-100 text-purple-800 px-3 py-1 rounded-full text-xs font-bold">HELOC FEATURE</span>
            </div>
            <p className="text-purple-900 font-semibold">
              This section is for homeowners with a HELOC. If you don't have a HELOC, skip to the next section - you can still eliminate debt effectively using the cash flow strategy!
            </p>
          </div>

          <div>
            <h4 className="font-semibold text-gray-900 mb-2">The 3-Step Velocity Banking Cycle</h4>
            <div className="space-y-3">
              <div className="bg-blue-50 border-l-4 border-blue-500 p-3 rounded-r">
                <p className="font-semibold text-blue-900">Step 1: Chunk (Pay Debt with HELOC)</p>
                <p className="text-blue-800 text-sm">
                  Use your HELOC to completely pay off a high-interest debt. This immediately stops expensive interest charges and transfers the balance to your lower-rate HELOC.
                </p>
              </div>

              <div className="bg-green-50 border-l-4 border-green-500 p-3 rounded-r">
                <p className="font-semibold text-green-900">Step 2: Paydown (Use Cash Flow to Pay HELOC)</p>
                <p className="text-green-800 text-sm">
                  Direct your monthly cash flow toward paying down the HELOC balance. Since HELOCs typically have lower rates (8-10% vs 20%+ credit cards), you save money on interest every month.
                </p>
              </div>

              <div className="bg-purple-50 border-l-4 border-purple-500 p-3 rounded-r">
                <p className="font-semibold text-purple-900">Step 3: Repeat</p>
                <p className="text-purple-800 text-sm">
                  Once you've paid down the HELOC enough to free up space, chunk the next high-interest debt and repeat the cycle. Each cycle builds momentum toward debt freedom.
                </p>
              </div>
            </div>
          </div>

          <div>
            <h4 className="font-semibold text-gray-900 mb-2">When It Makes Sense</h4>
            <p className="text-gray-700">
              Velocity banking works best when your HELOC rate is lower than your debt rate. You save money on interest and potentially pay off debt faster by replacing high-rate debt with lower-rate HELOC debt.
            </p>
          </div>

          <div>
            <h4 className="font-semibold text-gray-900 mb-2">When It Doesn't Make Sense</h4>
            <p className="text-gray-700">
              If your HELOC rate is higher than a debt's rate, chunking that debt costs you more money. NOVO warns you with red color-coding when rate arbitrage doesn't favor HELOC use.
            </p>
          </div>

          <div className="bg-amber-50 border-l-4 border-amber-500 p-4 rounded-r">
            <h4 className="font-semibold text-amber-900 mb-2">Advanced Strategy: HELOC as Checking Account</h4>
            <p className="text-amber-800">
              Some users route all income through their HELOC to minimize daily interest charges. Every dollar sitting in the HELOC reduces your balance and interest. Ask NOVO AI Coach about this advanced technique.
            </p>
          </div>

          <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-r">
            <h4 className="font-semibold text-red-900 mb-2">Common Mistakes to Avoid:</h4>
            <ul className="space-y-2 text-red-800">
              <li><strong>1. Chunking more than you can pay back in 6-12 months:</strong> Only chunk amounts you can realistically pay down quickly with your cash flow</li>
              <li><strong>2. Ignoring interest charges:</strong> HELOC interest calculates daily - track it monthly</li>
              <li><strong>3. Using HELOC for lifestyle inflation:</strong> Don't use freed HELOC space for vacations or purchases - stay focused on debt elimination</li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold text-gray-900 mb-2">HELOC Interest Calculates Daily</h4>
            <p className="text-gray-700">
              Unlike credit cards that calculate interest monthly, HELOCs calculate interest daily. This means faster paydown saves you more interest immediately - every payment reduces tomorrow's interest charge.
            </p>
          </div>
        </div>
      )
    },
    {
      id: 'smart-chunking-calculator',
      title: '9. Using the Smart Chunking Calculator (HELOC Only - Advanced)',
      icon: Target,
      color: 'bg-purple-600',
      content: (
        <div className="space-y-4">
          <div className="bg-purple-50 border-2 border-purple-300 rounded-lg p-4 mb-4">
            <div className="flex items-center space-x-2 mb-2">
              <span className="inline-block bg-purple-100 text-purple-800 px-3 py-1 rounded-full text-xs font-bold">HELOC FEATURE</span>
            </div>
            <p className="text-purple-900 font-semibold">
              This section is for homeowners with a HELOC who want to use advanced chunking strategies. If you don't have a HELOC, focus on the cash flow strategy and other sections instead!
            </p>
          </div>

          <div>
            <h4 className="font-semibold text-gray-900 mb-2">What Is the Smart Chunking Calculator?</h4>
            <p className="text-gray-700">
              The Smart Chunking Calculator helps you determine optimal chunk sizes and shows why HELOC chunking beats direct mortgage payments. It's a powerful tool for advanced HELOC velocity banking users.
            </p>
          </div>

          <div>
            <h4 className="font-semibold text-gray-900 mb-2">Finding the Calculator:</h4>
            <ol className="space-y-1 text-gray-700 ml-4 list-decimal">
              <li>Go to Payment Strategies tab</li>
              <li>Expand "Smart Chunking Calculator" section (accordion)</li>
              <li>Complete qualification quiz to access recommendations</li>
            </ol>
          </div>

          <div className="bg-amber-50 border-l-4 border-amber-500 p-4 rounded-r">
            <h4 className="font-semibold text-amber-900 mb-2">Qualification Requirements:</h4>
            <p className="text-amber-800 mb-2">Before using chunking strategies, you must have:</p>
            <ul className="space-y-1 text-amber-800 ml-4">
              <li>• At least $1,000 in emergency savings</li>
              <li>• Stable income for 3+ months</li>
              <li>• No missed payments in last 6 months</li>
              <li>• Willingness to track HELOC balance regularly</li>
              <li>• Commitment to financial discipline</li>
            </ul>
            <p className="text-amber-800 mt-2 font-semibold">
              If you don't qualify yet, focus on building emergency fund and payment consistency first.
            </p>
          </div>

          <div>
            <h4 className="font-semibold text-gray-900 mb-2">What the Calculator Shows:</h4>
            <ol className="space-y-2 text-gray-700 ml-4 list-decimal">
              <li><strong>Recommended Chunk Size:</strong> Based on your monthly cash flow (typically 2-3x)</li>
              <li><strong>Comparison:</strong> Direct payment vs HELOC chunking (shows why chunking wins)</li>
              <li><strong>Payback Timeline:</strong> Month-by-month projection of HELOC payback</li>
              <li><strong>Advanced Strategy:</strong> How to use HELOC as checking account</li>
              <li><strong>Risk Warnings:</strong> What could go wrong and safety rules</li>
            </ol>
          </div>

          <div>
            <h4 className="font-semibold text-gray-900 mb-2">Understanding the Math:</h4>
            <p className="text-gray-700 mb-2">
              The calculator shows why chunking is more powerful than direct extra payments.
            </p>
            <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-r">
              <p className="font-semibold text-blue-900 mb-2">Example: $10,000 extra toward mortgage</p>
              <ul className="space-y-2 text-blue-800">
                <li><strong>Direct payment:</strong> Cash is gone, locked in mortgage forever</li>
                <li><strong>HELOC chunking:</strong> Same mortgage savings, but you pay back HELOC in 2-4 months for ~$200 interest cost, keeping cash flow intact</li>
              </ul>
              <p className="text-blue-800 mt-2">
                You "rent" the HELOC for a small cost to gain massive mortgage interest savings, then repeat the cycle.
              </p>
            </div>
          </div>

          <div className="bg-purple-50 border-l-4 border-purple-500 p-4 rounded-r">
            <h4 className="font-semibold text-purple-900 mb-2">Advanced Strategy: HELOC as Checking</h4>
            <p className="text-purple-800 mb-2">
              Experienced users can route all income through HELOC to minimize average daily balance:
            </p>
            <ul className="space-y-1 text-purple-800 ml-4">
              <li>• Paychecks deposit to HELOC (drops balance)</li>
              <li>• Bills pay from HELOC (raises balance slightly)</li>
              <li>• Net effect: HELOC drops faster due to lower average balance</li>
            </ul>
            <p className="text-purple-800 mt-2 font-semibold">
              This requires extreme discipline and daily tracking. Only attempt if you're confident in your spending control.
            </p>
          </div>

          <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-r">
            <h4 className="font-semibold text-red-900 mb-2">Safety Rules:</h4>
            <ol className="space-y-1 text-red-800 ml-4 list-decimal">
              <li>Never chunk more than 3x your monthly cash flow</li>
              <li>Keep at least $5,000 available on HELOC for emergencies</li>
              <li>Track your HELOC balance weekly minimum</li>
              <li>If balance isn't dropping, stop and reassess</li>
              <li>Build 3-6 months emergency fund before aggressive chunking</li>
            </ol>
          </div>

          <div>
            <h4 className="font-semibold text-gray-900 mb-2">When to Ask for Help:</h4>
            <ul className="space-y-2 text-gray-700 ml-4">
              <li>• <strong>Not sure if chunking is right for you?</strong> Ask NOVO AI Coach</li>
              <li>• <strong>Want personalized guidance?</strong> Contact Ben Hulshof at <a href="mailto:ben@windmillmortgage.com" className="text-blue-600 underline hover:text-blue-800">ben@windmillmortgage.com</a> or <a href="tel:614-327-2213" className="text-blue-600 underline hover:text-blue-800">614-327-2213</a></li>
              <li>• <strong>Confused about rate arbitrage?</strong> Expand "HELOC Strategy Guidance" section</li>
            </ul>
          </div>

          <div className="bg-orange-50 border-l-4 border-orange-500 p-4 rounded-r">
            <h4 className="font-semibold text-orange-900 mb-2">Common Mistakes to Avoid:</h4>
            <ul className="space-y-2 text-orange-800">
              <li>• <strong>Chunking more than you can pay back in 6 months</strong> (too risky)</li>
              <li>• <strong>Using HELOC for lifestyle spending</strong> instead of debt elimination</li>
              <li>• <strong>Ignoring HELOC interest charges</strong> (they add up)</li>
              <li>• <strong>Not tracking balance regularly</strong> (surprises happen)</li>
              <li>• <strong>Chunking when HELOC rate is higher than debt rate</strong> (loses money)</li>
            </ul>
          </div>
        </div>
      )
    },
    {
      id: 'logging-payments',
      title: '10. Logging Payments',
      icon: DollarSign,
      color: 'bg-pink-500',
      content: (
        <div className="space-y-4">
          <div>
            <h4 className="font-semibold text-gray-900 mb-2">Click "Log Payment" Button</h4>
            <p className="text-gray-700">
              Found on the dashboard or on individual debt cards. When you click it, NOVO opens the payment logging modal.
            </p>
          </div>

          <div>
            <h4 className="font-semibold text-gray-900 mb-2">Payment Auto-Populates</h4>
            <p className="text-gray-700">
              The modal automatically fills in the minimum payment for that debt. You can adjust the amount if you paid more (or less).
            </p>
          </div>

          <div>
            <h4 className="font-semibold text-gray-900 mb-2">System Calculates Interest</h4>
            <p className="text-gray-700">
              When you enter the payment amount, NOVO calculates how much went to interest vs principal based on the debt's balance and interest rate. This gives you accurate tracking of debt reduction.
            </p>
          </div>

          <div className="bg-pink-50 border-l-4 border-pink-500 p-4 rounded-r">
            <h4 className="font-semibold text-pink-900 mb-2">Full Payoff Celebration</h4>
            <p className="text-pink-800 mb-2">
              When you log a payment that pays off a debt completely, NOVO:
            </p>
            <ul className="space-y-1 text-pink-800 ml-4">
              <li>• Shows a celebration modal with fireworks</li>
              <li>• Automatically frees the minimum payment to your cash flow</li>
              <li>• Updates your strategy to accelerate remaining debts</li>
              <li>• Records a milestone in your progress history</li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold text-gray-900 mb-2">Editing Payments</h4>
            <p className="text-gray-700">
              Use the pencil icon in transaction history to edit payment details. NOVO recalculates your current balance automatically.
            </p>
          </div>

          <div>
            <h4 className="font-semibold text-gray-900 mb-2">Deleting Payments</h4>
            <p className="text-gray-700">
              Use the trash icon with confirmation to remove incorrect payments. Your balance and progress update immediately.
            </p>
          </div>

          <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-r">
            <h4 className="font-semibold text-blue-900 mb-2">Quick Edit Debt Feature</h4>
            <p className="text-blue-800">
              When logging a payment, if you realize the debt balance is wrong, click the "Need to update this debt? Edit Debt" link to quickly fix it without leaving the payment flow.
            </p>
          </div>
        </div>
      )
    },
    {
      id: 'dashboard',
      title: '11. Reading Your Dashboard',
      icon: BarChart3,
      color: 'bg-blue-600',
      content: (
        <div className="space-y-4">
          <div>
            <h4 className="font-semibold text-gray-900 mb-2">Total Debt Progress</h4>
            <p className="text-gray-700">
              The large progress bar at the top shows your overall debt elimination journey. It displays the percentage paid off and your remaining balance.
            </p>
          </div>

          <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-r">
            <h4 className="font-semibold text-blue-900 mb-2">"You've paid off $X from cash flow"</h4>
            <p className="text-blue-800">
              This shows actual principal payments made from your cash flow - it does NOT include HELOC transfers. This represents real debt you've eliminated with your income.
            </p>
          </div>

          <div>
            <h4 className="font-semibold text-gray-900 mb-2">Monthly Cash Flow Card</h4>
            <p className="text-gray-700 mb-2">Shows your total available cash flow, broken down into:</p>
            <ul className="space-y-1 text-gray-700 ml-4">
              <li>• <strong>Minimum payments:</strong> Required payments on all debts</li>
              <li>• <strong>Extra available:</strong> Cash flow for aggressive debt payoff</li>
              <li>• <strong>Freed from paid-off debts:</strong> The snowball effect in action</li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold text-gray-900 mb-2">Active Debts Section</h4>
            <p className="text-gray-700">
              Shows all debts you're currently paying with current balances, interest rates, progress bars, and quick payment logging buttons.
            </p>
          </div>

          <div>
            <h4 className="font-semibold text-gray-900 mb-2">Paid Off Debts Section</h4>
            <p className="text-gray-700">
              Celebrates your victories! Debts marked as paid off show with green badges and remain visible as motivation reminders.
            </p>
          </div>

          <div>
            <h4 className="font-semibold text-gray-900 mb-2">Recent Activity Timeline</h4>
            <p className="text-gray-700">
              Shows your latest payments across all accounts in chronological order. Quick way to verify all transactions were logged correctly.
            </p>
          </div>
        </div>
      )
    },
    {
      id: 'savings-tracker',
      title: '12. Using the Savings Tracker',
      icon: PiggyBank,
      color: 'bg-green-600',
      content: (
        <div className="space-y-4">
          <div>
            <h4 className="font-semibold text-gray-900 mb-2">Add Multiple Accounts</h4>
            <p className="text-gray-700 mb-2">Click "Add Savings Account" and choose from:</p>
            <ul className="space-y-1 text-gray-700 ml-4">
              <li>• High-Yield Savings</li>
              <li>• Money Market Account</li>
              <li>• CD (Certificate of Deposit)</li>
              <li>• Regular Checking</li>
              <li>• Other</li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold text-gray-900 mb-2">Set Goals for Each Account</h4>
            <p className="text-gray-700">
              Optionally set target amounts for each savings account (e.g., $10,000 emergency fund, $30,000 house down payment). NOVO shows progress toward each goal as a percentage.
            </p>
          </div>

          <div>
            <h4 className="font-semibold text-gray-900 mb-2">Log Transactions</h4>
            <p className="text-gray-700 mb-2">Track all savings activity:</p>
            <ul className="space-y-1 text-gray-700 ml-4">
              <li>• <strong>Deposits:</strong> Money added to savings</li>
              <li>• <strong>Withdrawals:</strong> Money taken out</li>
              <li>• <strong>Interest Earned:</strong> Interest from your bank</li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold text-gray-900 mb-2">Track Total Savings & Monthly Rate</h4>
            <p className="text-gray-700">
              Dashboard shows your total savings across all accounts and your monthly savings rate (how much you're adding to savings each month on average).
            </p>
          </div>

          <div>
            <h4 className="font-semibold text-gray-900 mb-2">View Savings Growth Chart</h4>
            <p className="text-gray-700">
              Visualize your savings growing over time with interactive charts. Watch your emergency fund and other goals progress month by month.
            </p>
          </div>

          <div>
            <h4 className="font-semibold text-gray-900 mb-2">Export Transaction History</h4>
            <p className="text-gray-700">
              Download your savings transactions to CSV for tax purposes, financial planning, or detailed analysis.
            </p>
          </div>
        </div>
      )
    },
    {
      id: 'progress-reports',
      title: '13. Progress Reports & Charts',
      icon: LineChart,
      color: 'bg-purple-600',
      content: (
        <div className="space-y-4">
          <div>
            <h4 className="font-semibold text-gray-900 mb-2">View Debt Payoff Timeline</h4>
            <p className="text-gray-700">
              Interactive timeline showing when each debt will be eliminated based on your current strategy and payment history.
            </p>
          </div>

          <div>
            <h4 className="font-semibold text-gray-900 mb-2">Compare Strategies</h4>
            <p className="text-gray-700 mb-2">
              Side-by-side comparison of:
            </p>
            <ul className="space-y-1 text-gray-700 ml-4">
              <li>• <strong>Baseline:</strong> Minimum payments only (the slow path)</li>
              <li>• <strong>Your Strategy:</strong> Avalanche method with your cash flow (the fast path)</li>
            </ul>
            <p className="text-gray-700 mt-2">
              See exactly how much time and money you're saving with your aggressive approach.
            </p>
          </div>

          <div>
            <h4 className="font-semibold text-gray-900 mb-2">Interest Savings Visualization</h4>
            <p className="text-gray-700">
              Charts showing total interest paid under each scenario. Watch your interest savings grow as you stick to the plan.
            </p>
          </div>

          <div>
            <h4 className="font-semibold text-gray-900 mb-2">Debt-Free Date Projection</h4>
            <p className="text-gray-700">
              Based on your payment history and current strategy, NOVO projects your debt-free date. This updates dynamically as you log payments and adjust your plan.
            </p>
          </div>

          <div>
            <h4 className="font-semibold text-gray-900 mb-2">Payment History & Trends</h4>
            <p className="text-gray-700">
              View all logged payments across time with charts showing your payment patterns, extra payment frequency, and debt reduction trends.
            </p>
          </div>
        </div>
      )
    },
    {
      id: 'ask-novo-ai',
      title: '14. Ask NOVO AI Coach',
      icon: Bot,
      color: 'bg-indigo-500',
      content: (
        <div className="space-y-4">
          <div className="bg-gradient-to-r from-indigo-50 to-purple-50 border-l-4 border-indigo-500 p-6 rounded-r">
            <h4 className="font-semibold text-indigo-900 mb-2">24/7 Personalized Coaching</h4>
            <p className="text-indigo-800">
              Click the "Ask NOVO" button in the top-right corner to chat with NOVO's AI assistant. Get personalized guidance based on your actual debts, income, and strategy.
            </p>
          </div>

          <div>
            <h4 className="font-semibold text-gray-900 mb-2">What You Can Ask NOVO About:</h4>
            <ul className="space-y-2 text-gray-700 ml-4">
              <li>• <strong>HELOC Velocity Banking:</strong> How to implement it, when it makes sense, advanced techniques</li>
              <li>• <strong>Chunking Strategies:</strong> Which debts to chunk first, how much to chunk, timing</li>
              <li>• <strong>Reducing Expenses:</strong> Where to cut spending, prioritizing expenses</li>
              <li>• <strong>Handling Windfalls:</strong> What to do with bonuses, tax refunds, gifts</li>
              <li>• <strong>Emergency Scenarios:</strong> Job loss, medical bills, income disruption</li>
              <li>• <strong>Debt Payoff Concepts:</strong> Explaining avalanche vs snowball, interest calculations, amortization</li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold text-gray-900 mb-2">Get Encouragement</h4>
            <p className="text-gray-700">
              NOVO AI Coach celebrates your milestones, provides motivation during tough months, and helps you stay focused on your debt-free goal.
            </p>
          </div>

          <div>
            <h4 className="font-semibold text-gray-900 mb-2">Educational Explanations</h4>
            <p className="text-gray-700">
              Don't understand something? Ask NOVO to explain any debt payoff concept, financial term, or strategy in simple language.
            </p>
          </div>
        </div>
      )
    },
    {
      id: 'updating-info',
      title: '15. Updating Your Information',
      icon: SettingsIcon,
      color: 'bg-gray-600',
      content: (
        <div className="space-y-4">
          <div>
            <h4 className="font-semibold text-gray-900 mb-2">Go to Settings Tab</h4>
            <p className="text-gray-700">
              Access all your profile and debt information in one place. Make updates anytime your financial situation changes.
            </p>
          </div>

          <div>
            <h4 className="font-semibold text-gray-900 mb-2">Update Income & Expenses</h4>
            <p className="text-gray-700 mb-2">
              Adjust these values when you get a raise, change jobs, or modify your spending:
            </p>
            <ul className="space-y-1 text-gray-700 ml-4">
              <li>• Monthly gross income</li>
              <li>• Monthly net income</li>
              <li>• Monthly essential expenses</li>
              <li>• Monthly discretionary expenses</li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold text-gray-900 mb-2">Update Debt Information</h4>
            <p className="text-gray-700">
              Edit debt balances, interest rates, or minimum payments when they change. NOVO automatically recalculates your strategy.
            </p>
          </div>

          <div>
            <h4 className="font-semibold text-gray-900 mb-2">Changes Automatically Recalculate Strategy</h4>
            <p className="text-gray-700">
              Every update triggers a new strategy calculation. Your debt-free date, payment order, and projections update immediately to reflect your new reality.
            </p>
          </div>

          <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-r">
            <h4 className="font-semibold text-red-900 mb-2">Clear All Data</h4>
            <p className="text-red-800">
              Use this option with caution! Clearing all data permanently deletes your debts, payment history, and settings. Only use this if you want to start completely fresh.
            </p>
          </div>
        </div>
      )
    },
    {
      id: 'troubleshooting',
      title: '16. Common Scenarios - How to Use NOVO for Your Situation',
      icon: AlertCircle,
      color: 'bg-orange-500',
      content: (
        <div className="space-y-6">
          <div className="bg-gradient-to-r from-cyan-50 to-blue-50 border-l-4 border-cyan-500 p-6 rounded-r">
            <p className="text-cyan-900 font-semibold text-lg">
              Everyone's debt situation is different. Here's how to use NOVO based on YOUR specific circumstances.
            </p>
          </div>

          <div className="bg-blue-50 border-2 border-blue-300 rounded-xl p-6">
            <h4 className="font-bold text-blue-900 text-xl mb-3">Scenario 1: Cash Flow Only (No HELOC)</h4>
            <p className="text-blue-800 mb-3 font-semibold">
              Best for: Renters, homeowners without HELOCs, anyone building emergency fund first
            </p>

            <div className="bg-white border border-blue-200 rounded-lg p-4 mb-3">
              <h5 className="font-semibold text-gray-900 mb-2">Your Workflow:</h5>
              <ol className="space-y-2 text-gray-700 ml-4 list-decimal">
                <li><strong>Complete onboarding</strong> without enabling HELOC features</li>
                <li><strong>Focus on Dashboard:</strong> Your command center for debt payoff</li>
                <li><strong>Follow the avalanche strategy:</strong> NOVO shows you which debt to attack first</li>
                <li><strong>Log payments monthly:</strong> Use Method 1 (Quick Log from Dashboard)</li>
                <li><strong>Celebrate snowball effect:</strong> Watch freed payments accelerate your progress</li>
                <li><strong>Build emergency fund:</strong> Use Savings Tracker to reach 3-6 months expenses</li>
              </ol>
            </div>

            <div className="bg-green-50 border-l-4 border-green-500 p-4 rounded-r">
              <h5 className="font-semibold text-green-900 mb-2">Key Features to Use:</h5>
              <ul className="space-y-1 text-green-800 ml-4">
                <li>• Dashboard - Track all active debts</li>
                <li>• Payment Strategies - See your avalanche plan</li>
                <li>• Savings Tracker - Build emergency fund</li>
                <li>• Progress Reports - Visualize your journey</li>
                <li>• Ask NOVO AI - Get personalized coaching</li>
              </ul>
            </div>

            <div className="bg-cyan-50 border border-cyan-300 rounded-lg p-3 mt-3">
              <p className="text-cyan-900 font-semibold mb-1">Expected Results:</p>
              <p className="text-cyan-800 text-sm">
                With consistent extra payments of $500/month, most users eliminate all non-mortgage debt in 2-4 years and save thousands in interest compared to minimum payments.
              </p>
            </div>
          </div>

          <div className="bg-purple-50 border-2 border-purple-300 rounded-xl p-6">
            <div className="flex items-center space-x-2 mb-3">
              <span className="inline-block bg-purple-100 text-purple-800 px-3 py-1 rounded-full text-xs font-bold">HELOC FEATURE</span>
            </div>
            <h4 className="font-bold text-purple-900 text-xl mb-3">Scenario 2: HELOC Only (For Specific High-Rate Debts)</h4>
            <p className="text-purple-800 mb-3 font-semibold">
              Best for: Homeowners with HELOCs who want to tackle 1-2 high-interest debts strategically
            </p>

            <div className="bg-white border border-purple-200 rounded-lg p-4 mb-3">
              <h5 className="font-semibold text-gray-900 mb-2">Your Workflow:</h5>
              <ol className="space-y-2 text-gray-700 ml-4 list-decimal">
                <li><strong>Complete onboarding</strong> and enable HELOC features</li>
                <li><strong>Review rate arbitrage:</strong> NOVO highlights debts where HELOC chunking makes sense (green debts)</li>
                <li><strong>Take Chunking Quiz:</strong> Make sure you're ready before chunking</li>
                <li><strong>Chunk ONE high-rate debt:</strong> Start with smallest favorable debt</li>
                <li><strong>Track HELOC aggressively:</strong> Switch Tracker to "HELOC Account"</li>
                <li><strong>Pay down HELOC fast:</strong> Aim to clear chunk in 3-6 months</li>
                <li><strong>Repeat cycle:</strong> Once HELOC is clear, chunk next target</li>
              </ol>
            </div>

            <div className="bg-amber-50 border-l-4 border-amber-500 p-4 rounded-r">
              <h5 className="font-semibold text-amber-900 mb-2">Key Features to Use:</h5>
              <ul className="space-y-1 text-amber-800 ml-4">
                <li>• Payment Strategies - See rate arbitrage analysis</li>
                <li>• Smart Chunking Calculator - Determine optimal chunk size</li>
                <li>• HELOC Tracker - Monitor draws, payments, interest</li>
                <li>• Dashboard - Track overall progress</li>
                <li>• Progress Reports - Compare HELOC strategy vs baseline</li>
              </ul>
            </div>

            <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-r mt-3">
              <p className="text-red-900 font-semibold mb-1">Safety Rule:</p>
              <p className="text-red-800 text-sm">
                Only chunk debts with interest rates HIGHER than your HELOC rate. NOVO warns you with red color-coding if chunking doesn't make financial sense.
              </p>
            </div>
          </div>

          <div className="bg-gradient-to-br from-purple-50 to-indigo-50 border-2 border-indigo-400 rounded-xl p-6">
            <div className="flex items-center space-x-2 mb-3">
              <span className="inline-block bg-purple-100 text-purple-800 px-3 py-1 rounded-full text-xs font-bold">HELOC FEATURE - ADVANCED</span>
            </div>
            <h4 className="font-bold text-indigo-900 text-xl mb-3">Scenario 3: Combined Strategy (HELOC + Cash Flow)</h4>
            <p className="text-indigo-800 mb-3 font-semibold">
              Best for: Experienced HELOC users with strong discipline and cash flow
            </p>

            <div className="bg-white border border-indigo-200 rounded-lg p-4 mb-3">
              <h5 className="font-semibold text-gray-900 mb-2">Your Workflow:</h5>
              <ol className="space-y-2 text-gray-700 ml-4 list-decimal">
                <li><strong>Complete onboarding</strong> with full HELOC setup</li>
                <li><strong>Set Tracker to "Both":</strong> Track HELOC AND Checking simultaneously</li>
                <li><strong>Route income through HELOC:</strong> Deposit paychecks to HELOC to reduce average daily balance</li>
                <li><strong>Pay bills from HELOC:</strong> Track all draws for expenses</li>
                <li><strong>Chunk aggressively:</strong> Use freed cash flow to take larger chunks</li>
                <li><strong>Monitor DAILY:</strong> This strategy requires constant tracking</li>
                <li><strong>Use velocity banking cycle:</strong> Chunk → Paydown → Repeat</li>
              </ol>
            </div>

            <div className="bg-orange-50 border-l-4 border-orange-500 p-4 rounded-r">
              <h5 className="font-semibold text-orange-900 mb-2">Key Features to Use:</h5>
              <ul className="space-y-1 text-orange-800 ml-4">
                <li>• HELOC Tracker with "Both" selected</li>
                <li>• Smart Chunking Calculator - Advanced strategies</li>
                <li>• Daily interest monitoring in HELOC overview</li>
                <li>• Checking Register - Track all cash flow</li>
                <li>• Ask NOVO AI - Get guidance on complex scenarios</li>
              </ul>
            </div>

            <div className="bg-red-50 border-2 border-red-400 rounded-lg p-4 mt-3">
              <p className="text-red-900 font-bold mb-2">WARNING - Advanced Users Only:</p>
              <p className="text-red-800 text-sm mb-2">
                This strategy requires exceptional financial discipline. You're essentially using your HELOC as your checking account. One mistake can spiral into increased debt.
              </p>
              <p className="text-red-800 text-sm font-semibold">
                Only attempt if you have: 6+ months emergency fund, perfect payment history, strong spending control, and commitment to daily tracking.
              </p>
            </div>
          </div>

          <div className="bg-gradient-to-r from-green-50 to-emerald-50 border-l-4 border-green-500 p-6 rounded-r">
            <h4 className="font-semibold text-green-900 mb-2">Not Sure Which Scenario Fits You?</h4>
            <p className="text-green-800 mb-3">
              Start with Scenario 1 (Cash Flow Only) regardless of whether you have a HELOC. Master the basics, build an emergency fund, and get comfortable with NOVO's core features.
            </p>
            <p className="text-green-800 font-semibold">
              You can always enable HELOC features later when you're ready. There's no rush!
            </p>
          </div>
        </div>
      )
    },
    {
      id: 'troubleshooting',
      title: '17. Troubleshooting Common Issues',
      icon: AlertCircle,
      color: 'bg-red-500',
      content: (
        <div className="space-y-4">
          <div className="bg-red-50 border-l-4 border-red-500 p-6 rounded-r">
            <h4 className="font-semibold text-red-900 text-lg mb-2">Running Into Problems? Here's How to Fix Them</h4>
            <p className="text-red-800">
              Most issues have simple solutions. Work through these common problems and their fixes.
            </p>
          </div>

          <div>
            <h4 className="font-semibold text-gray-900 mb-2">My mortgage payoff date seems impossibly far away</h4>
            <div className="bg-gray-50 border border-gray-300 rounded-lg p-4">
              <p className="text-gray-800 font-semibold mb-2">Problem:</p>
              <p className="text-gray-700 mb-3">NOVO shows you won't pay off mortgage for 40+ years</p>

              <p className="text-gray-800 font-semibold mb-2">Solution:</p>
              <ol className="space-y-1 text-gray-700 ml-4 list-decimal">
                <li>Go to Settings and edit your mortgage</li>
                <li>Make sure you entered ONLY P&I (Principal & Interest) payment</li>
                <li>Remove taxes, insurance, HOA, and PMI from the payment amount</li>
                <li>Add those items to your monthly expenses instead</li>
                <li>Save and refresh - your timeline should now be accurate</li>
              </ol>
            </div>
          </div>

          <div>
            <h4 className="font-semibold text-gray-900 mb-2">NOVO says not to use my HELOC for certain debts</h4>
            <div className="bg-gray-50 border border-gray-300 rounded-lg p-4">
              <p className="text-gray-800 font-semibold mb-2">Problem:</p>
              <p className="text-gray-700 mb-3">Some debts show red and NOVO warns against chunking</p>

              <p className="text-gray-800 font-semibold mb-2">Explanation:</p>
              <p className="text-gray-700 mb-2">
                This is actually PROTECTING you from a costly mistake! If a debt's interest rate is lower than your HELOC rate, chunking it would INCREASE your interest costs.
              </p>
              <p className="text-gray-700">
                <strong>Solution:</strong> Leave those debts alone and pay them with cash flow. Only chunk debts that show GREEN (higher rate than HELOC).
              </p>
            </div>
          </div>

          <div>
            <h4 className="font-semibold text-gray-900 mb-2">My HELOC balance isn't going down (or it's going up!)</h4>
            <div className="bg-gray-50 border border-gray-300 rounded-lg p-4">
              <p className="text-gray-800 font-semibold mb-2">Possible Causes:</p>
              <ul className="space-y-2 text-gray-700 ml-4">
                <li>• <strong>Forgetting to log interest charges:</strong> Check your statement and record monthly interest</li>
                <li>• <strong>Making new draws without logging them:</strong> Every HELOC draw must be tracked</li>
                <li>• <strong>Not making payments:</strong> HELOC won't pay itself - you need cash flow payments</li>
                <li>• <strong>Spending problem:</strong> If you're using HELOC for lifestyle instead of debt elimination</li>
              </ul>

              <p className="text-gray-800 font-semibold mt-3 mb-2">Solution:</p>
              <ol className="space-y-1 text-gray-700 ml-4 list-decimal">
                <li>Review your HELOC transaction history - are all draws and payments recorded?</li>
                <li>Add any missing interest charges from statements</li>
                <li>Stop making new draws until balance decreases</li>
                <li>Increase your monthly HELOC payments if possible</li>
                <li>If balance keeps rising, consider stopping HELOC strategy temporarily</li>
              </ol>
            </div>
          </div>

          <div>
            <h4 className="font-semibold text-gray-900 mb-2">I logged a payment but my balance didn't update</h4>
            <div className="bg-gray-50 border border-gray-300 rounded-lg p-4">
              <p className="text-gray-800 font-semibold mb-2">Try These Steps:</p>
              <ol className="space-y-1 text-gray-700 ml-4 list-decimal">
                <li>Refresh your browser (Ctrl+R or Cmd+R)</li>
                <li>Check that payment actually saved - go to My Debts and view transaction history</li>
                <li>If payment is missing, log it again</li>
                <li>If payment exists but balance wrong, edit the payment amount</li>
                <li>Last resort: Go to Settings and manually update the debt balance</li>
              </ol>
            </div>
          </div>

          <div>
            <h4 className="font-semibold text-gray-900 mb-2">My debt-free date isn't changing even though I'm making payments</h4>
            <div className="bg-gray-50 border border-gray-300 rounded-lg p-4">
              <p className="text-gray-800 font-semibold mb-2">Explanation:</p>
              <p className="text-gray-700 mb-3">
                If you're only making minimum payments, your debt-free date stays the same because that's what NOVO originally calculated. The date only improves if you pay MORE than minimums.
              </p>

              <p className="text-gray-800 font-semibold mb-2">Solution:</p>
              <ul className="space-y-1 text-gray-700 ml-4">
                <li>• Log extra payments beyond minimums</li>
                <li>• Increase your monthly cash flow by reducing expenses</li>
                <li>• Add side income to accelerate payoff</li>
                <li>• Use windfalls (bonuses, tax refunds) for lump sum payments</li>
              </ul>
            </div>
          </div>

          <div>
            <h4 className="font-semibold text-gray-900 mb-2">I accidentally deleted a payment or debt</h4>
            <div className="bg-gray-50 border border-gray-300 rounded-lg p-4">
              <p className="text-gray-800 font-semibold mb-2">Solution:</p>
              <ul className="space-y-2 text-gray-700 ml-4">
                <li>• <strong>Deleted payment:</strong> Simply log it again with correct date and amount</li>
                <li>• <strong>Deleted debt:</strong> Go to My Debts and add it back with current balance and details</li>
                <li>• <strong>Cleared all data by accident:</strong> Unfortunately this is permanent - you'll need to re-enter everything</li>
              </ul>
              <p className="text-gray-700 mt-2 italic text-sm">
                Tip: Export your data to CSV periodically as a backup!
              </p>
            </div>
          </div>

          <div>
            <h4 className="font-semibold text-gray-900 mb-2">The numbers don't match my bank statements exactly</h4>
            <div className="bg-gray-50 border border-gray-300 rounded-lg p-4">
              <p className="text-gray-800 font-semibold mb-2">Common Causes:</p>
              <ul className="space-y-2 text-gray-700 ml-4">
                <li>• <strong>Interest calculation differences:</strong> NOVO uses simple daily interest - some lenders use different methods</li>
                <li>• <strong>Fees not logged:</strong> Late fees, annual fees, or other charges need to be recorded</li>
                <li>• <strong>Payment timing:</strong> Payments logged on different dates than when they posted</li>
                <li>• <strong>Purchases on credit cards:</strong> New charges increase balance</li>
              </ul>

              <p className="text-gray-800 font-semibold mt-3 mb-2">Solution:</p>
              <p className="text-gray-700 mb-2">
                Do a monthly reconciliation: Update all debt balances in Settings to match your statements exactly. This keeps NOVO accurate even if calculations differ slightly.
              </p>
            </div>
          </div>

          <div>
            <h4 className="font-semibold text-gray-900 mb-2">I'm not sure if I'm using NOVO correctly</h4>
            <div className="bg-gray-50 border border-gray-300 rounded-lg p-4">
              <p className="text-gray-800 font-semibold mb-2">You're probably doing fine! But here's a quick checklist:</p>
              <ul className="space-y-2 text-gray-700 ml-4">
                <li>✓ All debts entered with current balances</li>
                <li>✓ Logging payments monthly as you make them</li>
                <li>✓ Following the suggested payment order from Payment Strategies</li>
                <li>✓ Dashboard shows your progress growing over time</li>
                <li>✓ Debt-free date is getting closer as you pay down debt</li>
              </ul>
              <p className="text-gray-700 mt-3">
                If all of these are true, you're using NOVO effectively! If unsure, click "Ask NOVO" for personalized guidance.
              </p>
            </div>
          </div>

          <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-r">
            <h4 className="font-semibold text-blue-900 mb-2">Still Stuck?</h4>
            <p className="text-blue-800">
              Contact Ben Hulshof for personalized troubleshooting. Email: <a href="mailto:ben@windmillmortgage.com" className="underline hover:text-blue-900">ben@windmillmortgage.com</a> or call 614-327-2213.
            </p>
          </div>
        </div>
      )
    },
    {
      id: 'tips-for-success',
      title: '18. Tips for Success',
      icon: Target,
      color: 'bg-emerald-600',
      content: (
        <div className="space-y-6">
          <div className="bg-gradient-to-r from-emerald-50 to-green-50 border-l-4 border-emerald-500 p-6 rounded-r">
            <h4 className="font-semibold text-emerald-900 text-lg mb-2">Make Debt Freedom Inevitable</h4>
            <p className="text-emerald-800">
              Success isn't about perfection - it's about consistency. These tips will help you stay on track and accelerate your progress.
            </p>
          </div>

          <div className="bg-blue-50 border-2 border-blue-300 rounded-xl p-6">
            <h4 className="font-bold text-blue-900 text-xl mb-4">Cash Flow Strategy Tips (Everyone)</h4>

            <div className="space-y-3">
              <div className="bg-white border-l-4 border-blue-500 p-4 rounded-r">
                <p className="font-semibold text-blue-900 mb-1">1. Log Payments Immediately</p>
                <p className="text-blue-800 text-sm">
                  Don't wait until end of month. Log each payment right after you make it. Takes 30 seconds and keeps your dashboard accurate.
                </p>
              </div>

              <div className="bg-white border-l-4 border-blue-500 p-4 rounded-r">
                <p className="font-semibold text-blue-900 mb-1">2. Review Progress Monthly</p>
                <p className="text-blue-800 text-sm">
                  Check Progress Reports at least once per month. Seeing your progress builds momentum and motivation. Celebrate small wins!
                </p>
              </div>

              <div className="bg-white border-l-4 border-blue-500 p-4 rounded-r">
                <p className="font-semibold text-blue-900 mb-1">3. Attack Windfalls Strategically</p>
                <p className="text-blue-800 text-sm">
                  Tax refunds, bonuses, gifts - throw 100% at debt (after covering any immediate needs). A $2,000 windfall can eliminate months of interest charges.
                </p>
              </div>

              <div className="bg-white border-l-4 border-blue-500 p-4 rounded-r">
                <p className="font-semibold text-blue-900 mb-1">4. Find $100/Month to Cut</p>
                <p className="text-blue-800 text-sm">
                  Review discretionary expenses. $100/month extra = $1,200/year toward debt. Common places: subscriptions, dining out, entertainment. Small cuts compound fast.
                </p>
              </div>

              <div className="bg-white border-l-4 border-blue-500 p-4 rounded-r">
                <p className="font-semibold text-blue-900 mb-1">5. Update NOVO When Life Changes</p>
                <p className="text-blue-800 text-sm">
                  Got a raise? Cut an expense? Change jobs? Update your income and expenses in Settings immediately so NOVO gives you accurate projections.
                </p>
              </div>

              <div className="bg-white border-l-4 border-blue-500 p-4 rounded-r">
                <p className="font-semibold text-blue-900 mb-1">6. Build Emergency Fund FIRST</p>
                <p className="text-blue-800 text-sm">
                  Save $1,000 minimum before aggressive debt payoff. Use Savings Tracker. This prevents you from going deeper into debt when emergencies hit.
                </p>
              </div>

              <div className="bg-white border-l-4 border-blue-500 p-4 rounded-r">
                <p className="font-semibold text-blue-900 mb-1">7. Trust the Avalanche Method</p>
                <p className="text-blue-800 text-sm">
                  Don't overthink it. NOVO's avalanche strategy (highest rate first) is mathematically optimal. Follow the plan even if other debts "feel" more urgent.
                </p>
              </div>

              <div className="bg-white border-l-4 border-blue-500 p-4 rounded-r">
                <p className="font-semibold text-blue-900 mb-1">8. Ask NOVO AI When Uncertain</p>
                <p className="text-blue-800 text-sm">
                  Got a question? Unsure about a decision? Click "Ask NOVO" for instant personalized guidance. Don't let confusion slow your progress.
                </p>
              </div>
            </div>
          </div>

          <div className="bg-purple-50 border-2 border-purple-300 rounded-xl p-6">
            <div className="flex items-center space-x-2 mb-4">
              <span className="inline-block bg-purple-100 text-purple-800 px-3 py-1 rounded-full text-xs font-bold">HELOC FEATURE</span>
            </div>
            <h4 className="font-bold text-purple-900 text-xl mb-4">HELOC Strategy Tips (HELOC Users Only)</h4>

            <div className="space-y-3">
              <div className="bg-white border-l-4 border-purple-500 p-4 rounded-r">
                <p className="font-semibold text-purple-900 mb-1">1. Start Small with Chunking</p>
                <p className="text-purple-800 text-sm">
                  Chunk your SMALLEST favorable debt first (not largest). Build confidence and prove to yourself you can pay down the HELOC quickly before tackling bigger chunks.
                </p>
              </div>

              <div className="bg-white border-l-4 border-purple-500 p-4 rounded-r">
                <p className="font-semibold text-purple-900 mb-1">2. Track HELOC Balance Weekly</p>
                <p className="text-purple-800 text-sm">
                  Don't wait for monthly statements. Check HELOC balance every week. If it's not dropping, investigate immediately before it becomes a problem.
                </p>
              </div>

              <div className="bg-white border-l-4 border-purple-500 p-4 rounded-r">
                <p className="font-semibold text-purple-900 mb-1">3. Log Interest Charges Religiously</p>
                <p className="text-purple-800 text-sm">
                  Set a monthly reminder to record HELOC interest when you get your statement. Missing this makes your balance inaccurate and hides the true cost of HELOC usage.
                </p>
              </div>

              <div className="bg-white border-l-4 border-purple-500 p-4 rounded-r">
                <p className="font-semibold text-purple-900 mb-1">4. Only Chunk What You Can Payback in 6 Months</p>
                <p className="text-purple-800 text-sm">
                  Rule of thumb: Don't chunk more than 3x your monthly cash flow. If you have $2,000/month cash flow, max chunk is $6,000. This ensures fast payback.
                </p>
              </div>

              <div className="bg-white border-l-4 border-purple-500 p-4 rounded-r">
                <p className="font-semibold text-purple-900 mb-1">5. Keep $5,000 HELOC Space for Emergencies</p>
                <p className="text-purple-800 text-sm">
                  Never max out your HELOC. Always maintain at least $5,000 available credit for true emergencies. Prevents forced draws at bad times.
                </p>
              </div>

              <div className="bg-white border-l-4 border-purple-500 p-4 rounded-r">
                <p className="font-semibold text-purple-900 mb-1">6. Don't Use HELOC for Lifestyle</p>
                <p className="text-purple-800 text-sm">
                  HELOC is a debt elimination tool, not a credit card. No vacations, no new cars, no home improvements. Stay laser-focused on debt payoff.
                </p>
              </div>

              <div className="bg-white border-l-4 border-purple-500 p-4 rounded-r">
                <p className="font-semibold text-purple-900 mb-1">7. Pause Chunking If Cash Flow Drops</p>
                <p className="text-purple-800 text-sm">
                  Job change? Income reduction? Pause chunking immediately and focus on paying down existing HELOC balance. Don't take new draws during uncertainty.
                </p>
              </div>

              <div className="bg-white border-l-4 border-purple-500 p-4 rounded-r">
                <p className="font-semibold text-purple-900 mb-1">8. Celebrate Each Chunk Payback</p>
                <p className="text-purple-800 text-sm">
                  When you pay off a chunk completely, celebrate! You just eliminated a high-interest debt AND freed up your HELOC for the next target. That's a double win.
                </p>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-r from-amber-50 to-orange-50 border-l-4 border-amber-500 p-6 rounded-r">
            <h4 className="font-semibold text-amber-900 mb-3">Universal Truth About Debt Freedom:</h4>
            <p className="text-amber-800 text-lg leading-relaxed">
              <strong>Consistency beats intensity.</strong> Making $200 extra payments every single month for 3 years eliminates more debt than sporadic $1,000 payments. Show up consistently, trust the process, and debt freedom becomes inevitable.
            </p>
          </div>

          <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-300 rounded-lg p-6">
            <p className="text-center text-gray-800 font-bold text-xl mb-2">
              You've got this.
            </p>
            <p className="text-center text-gray-700 text-lg">
              Every payment is progress. Every month you're closer. NOVO is here to guide you every step of the way.
            </p>
          </div>
        </div>
      )
    },
    {
      id: 'getting-help',
      title: '19. Getting Help',
      icon: HelpCircle,
      color: 'bg-blue-700',
      content: (
        <div className="space-y-4">
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-l-4 border-blue-500 p-6 rounded-r">
            <h4 className="font-semibold text-blue-900 mb-3">Need Questions Answered?</h4>
            <p className="text-blue-800 mb-3">
              Contact Ben Hulshof for personalized help with your debt elimination journey.
            </p>
            <div className="bg-white p-4 rounded-lg border border-blue-200">
              <p className="font-semibold text-blue-900 text-lg">Ben Hulshof</p>
              <p className="text-blue-800">Windmill Mortgage</p>
              <p className="text-blue-700 mt-2">
                <strong>Email:</strong> <a href="mailto:ben@windmillmortgage.com" className="underline hover:text-blue-900">ben@windmillmortgage.com</a>
              </p>
              <p className="text-blue-700">
                <strong>Phone:</strong> <a href="tel:614-327-2213" className="underline hover:text-blue-900">614-327-2213</a>
              </p>
            </div>
          </div>

          <div className="bg-indigo-50 border-l-4 border-indigo-500 p-4 rounded-r">
            <h4 className="font-semibold text-indigo-900 mb-2">Use "Ask NOVO" AI Coach</h4>
            <p className="text-indigo-800">
              For instant guidance on debt strategies, payment decisions, and financial questions, click the "Ask NOVO" button in the top-right corner. Available 24/7 with personalized answers based on your situation.
            </p>
          </div>

          <div>
            <h4 className="font-semibold text-gray-900 mb-2">Coming Soon:</h4>
            <ul className="space-y-2 text-gray-700 ml-4">
              <li>• <strong>Community Forum:</strong> Connect with others on the same debt-free journey</li>
              <li>• <strong>Video Tutorials:</strong> Step-by-step guides for all features</li>
              <li>• <strong>NOVO Blog:</strong> Debt payoff tips, success stories, and financial education</li>
            </ul>
          </div>

          <div className="bg-gradient-to-r from-green-50 to-emerald-50 p-6 rounded-lg border border-green-200 mt-6">
            <p className="text-center text-gray-800 font-semibold text-lg">
              You're not alone on this journey.
            </p>
            <p className="text-center text-gray-700 mt-2">
              NOVO is here to guide you every step of the way toward financial freedom!
            </p>
          </div>
        </div>
      )
    }
  ];

  const filteredSections = searchTerm
    ? sections.filter(section =>
        section.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        section.content.toString().toLowerCase().includes(searchTerm.toLowerCase())
      )
    : sections;

  return (
    <div className="max-w-5xl mx-auto">
      <div className="bg-white rounded-lg shadow-sm p-8 mb-6">
        <div className="flex items-center space-x-3 mb-4">
          <div className="bg-[#FF6B35] text-white p-3 rounded-lg">
            <BookOpen className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">How to Use NOVO</h1>
            <p className="text-gray-600 mt-1">Your complete guide to debt-free living</p>
          </div>
        </div>

        <p className="text-gray-700 leading-relaxed mb-6">
          Welcome to your comprehensive guide! This page contains everything you need to know about using NOVO effectively.
          Click any section below to expand and learn more. Use the search bar to quickly find specific topics.
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

        <div className="flex space-x-3 mb-6">
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

      <div className="space-y-4">
        {filteredSections.map((section) => {
          const Icon = section.icon;
          const isExpanded = expandedSections.has(section.id);

          return (
            <div key={section.id} className="bg-white rounded-lg shadow-sm overflow-hidden">
              <button
                onClick={() => toggleSection(section.id)}
                className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center space-x-3">
                  <div className={`${section.color} text-white p-2 rounded-lg`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <h2 className="text-xl font-semibold text-gray-900">{section.title}</h2>
                </div>
                <div className="text-gray-400">
                  {isExpanded ? <ChevronUp className="w-6 h-6" /> : <ChevronDown className="w-6 h-6" />}
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
        <div className="bg-white rounded-lg shadow-sm p-8 text-center">
          <p className="text-gray-500">No sections found matching "{searchTerm}"</p>
        </div>
      )}

      <div className="mt-8 flex justify-center">
        <button
          onClick={scrollToTop}
          className="flex items-center space-x-2 px-6 py-3 bg-[#FF6B35] hover:bg-[#E55A2B] text-white font-semibold rounded-lg transition-colors shadow-md"
        >
          <ArrowUp className="w-5 h-5" />
          <span>Back to Top</span>
        </button>
      </div>
    </div>
  );
}

export default Guide;
