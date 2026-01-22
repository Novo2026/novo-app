import { useState } from 'react';
import { ChevronDown, ChevronUp, BookOpen, Play, TrendingUp, Repeat, DollarSign, PiggyBank, BarChart3, AlertCircle, HelpCircle, ArrowUp } from 'lucide-react';

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
      id: 'getting-started',
      title: 'Getting Started',
      icon: Play,
      color: 'bg-blue-500',
      content: (
        <div className="space-y-4">
          <p className="text-gray-700 leading-relaxed">
            Welcome to NOVO! This app is designed to help you eliminate debt faster using proven strategies like the debt avalanche method and HELOC velocity banking. By consolidating all your debts in one place and tracking your progress, you'll stay motivated and see real results.
          </p>

          <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-r">
            <h4 className="font-semibold text-blue-900 mb-2">What You'll Need:</h4>
            <ul className="space-y-1 text-blue-800">
              <li>• Recent loan statements for all your debts</li>
              <li>• Pay stubs or income records</li>
              <li>• Monthly expense information</li>
              <li>• Banking and HELOC details (if applicable)</li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold text-gray-900 mb-2">Completing Onboarding Accurately:</h4>
            <p className="text-gray-700 mb-2">The onboarding wizard collects essential information to create your personalized debt payoff plan:</p>
            <ul className="space-y-2 text-gray-700 ml-4">
              <li><strong>Your Name:</strong> Personalizes your experience</li>
              <li><strong>Monthly Income:</strong> Enter your take-home pay (after taxes)</li>
              <li><strong>Monthly Expenses:</strong> Include rent/mortgage, utilities, food, insurance, transportation, etc.</li>
              <li><strong>Your Debts:</strong> Add each debt with current balance, interest rate, and minimum payment</li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold text-gray-900 mb-2">Understanding Monthly Cash Flow:</h4>
            <p className="text-gray-700">
              NOVO calculates your available cash flow as: <strong>Monthly Income - Monthly Expenses - All Minimum Payments</strong>. This shows how much extra money you can put toward debt elimination each month. The more cash flow you have, the faster you'll become debt-free!
            </p>
          </div>
        </div>
      )
    },
    {
      id: 'adding-debts',
      title: 'Adding Your Debts',
      icon: DollarSign,
      color: 'bg-green-500',
      content: (
        <div className="space-y-4">
          <div>
            <h4 className="font-semibold text-gray-900 mb-2">How to Choose Debt Type:</h4>
            <p className="text-gray-700 mb-2">Select the category that best matches your debt:</p>
            <ul className="space-y-2 text-gray-700 ml-4">
              <li><strong>Credit Card:</strong> Revolving credit from banks, stores, or credit unions</li>
              <li><strong>Personal Loan:</strong> Fixed installment loans from banks or online lenders</li>
              <li><strong>Auto Loan:</strong> Car, truck, or vehicle financing</li>
              <li><strong>Student Loan:</strong> Federal or private education loans</li>
              <li><strong>Medical Debt:</strong> Hospital bills or medical payment plans</li>
              <li><strong>Mortgage:</strong> Home loans (triggers additional fields - see below)</li>
              <li><strong>Other:</strong> Any other debt not listed above</li>
            </ul>
          </div>

          <div className="bg-amber-50 border-l-4 border-amber-500 p-4 rounded-r">
            <h4 className="font-semibold text-amber-900 mb-2">When to Select "Mortgage":</h4>
            <p className="text-amber-800 mb-2">
              Choosing "Mortgage" unlocks special fields for amortized loans:
            </p>
            <ul className="space-y-1 text-amber-800 ml-4">
              <li><strong>Original Loan Amount:</strong> The total amount you borrowed when you got the mortgage</li>
              <li><strong>Loan Start Date:</strong> When your mortgage began (MM/YYYY format)</li>
            </ul>
            <p className="text-amber-800 mt-2">
              <strong>Why it matters:</strong> NOVO uses this data to calculate your exact amortization schedule, showing how much of each payment goes to principal vs. interest. This gives you a more accurate payoff timeline.
            </p>
          </div>

          <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-r">
            <h4 className="font-semibold text-blue-900 mb-2">Important: Mortgage Payments</h4>
            <p className="text-blue-800 mb-2">
              When entering your mortgage payment, use only the <strong>Principal & Interest (P&I)</strong> portion. Do NOT include:
            </p>
            <ul className="space-y-1 text-blue-800 ml-4">
              <li>Property taxes</li>
              <li>Homeowners insurance</li>
              <li>PMI (Private Mortgage Insurance)</li>
              <li>HOA fees</li>
            </ul>
            <p className="text-blue-800 mt-2">
              <strong>Why?</strong> These items should be included in your Monthly Expenses instead. Check your loan statement to find your P&I amount - it's typically listed separately from escrow items. This ensures NOVO calculates your debt payoff accurately and doesn't double-count your housing costs.
            </p>
          </div>

          <div>
            <h4 className="font-semibold text-gray-900 mb-2">HELOC: Two Ways to Track It</h4>
            <p className="text-gray-700 mb-2"><strong>Option 1: Add HELOC as a regular debt</strong></p>
            <p className="text-gray-700 mb-2 ml-4">
              If you're treating your HELOC like any other debt (making minimum payments until it's paid off), add it to your debt list. Choose "Other" or "Personal Loan" as the type, enter the current balance, rate, and minimum payment.
            </p>
            <p className="text-gray-700 mb-2"><strong>Option 2: Enable HELOC Velocity Banking</strong></p>
            <p className="text-gray-700 ml-4">
              If you want to use HELOC velocity banking strategy, check the "I have a HELOC" box during onboarding or in Settings. This unlocks the HELOC tracker and velocity banking features. Enter your HELOC limit, current balance, interest rate, and minimum payment.
            </p>
          </div>

          <div className="bg-green-50 border-l-4 border-green-500 p-4 rounded-r">
            <h4 className="font-semibold text-green-900 mb-2">If HELOC Has an Existing Balance:</h4>
            <p className="text-green-800">
              Enter the minimum payment required by your lender in the "Minimum Payment" field. NOVO will include this in your monthly obligation calculations and track your HELOC paydown alongside your other debts.
            </p>
          </div>
        </div>
      )
    },
    {
      id: 'payoff-strategy',
      title: 'Understanding Your Payoff Strategy',
      icon: TrendingUp,
      color: 'bg-purple-500',
      content: (
        <div className="space-y-4">
          <div>
            <h4 className="font-semibold text-gray-900 mb-2">What is the Debt Avalanche Method?</h4>
            <p className="text-gray-700">
              The debt avalanche is a mathematically optimal strategy where you pay minimum payments on all debts, then put all extra money toward the debt with the <strong>highest interest rate first</strong>. Once that's paid off, you roll that payment into the next highest rate debt, creating an "avalanche" effect that saves you the most money in interest.
            </p>
          </div>

          <div>
            <h4 className="font-semibold text-gray-900 mb-2">Why NOVO Prioritizes Highest Interest Rate First:</h4>
            <p className="text-gray-700">
              Interest is the cost of borrowing money. By eliminating high-interest debt first, you stop the most expensive bleeding. For example, paying off a 22% credit card before a 4% auto loan saves you significantly more money over time, even if the auto loan has a higher balance.
            </p>
          </div>

          <div>
            <h4 className="font-semibold text-gray-900 mb-2">Reading Your Payoff Timeline:</h4>
            <p className="text-gray-700 mb-2">Your strategy results show:</p>
            <ul className="space-y-2 text-gray-700 ml-4">
              <li><strong>Payoff Order:</strong> The sequence in which debts will be eliminated</li>
              <li><strong>Monthly Payment:</strong> Your minimum payment + extra cash flow allocated to each debt</li>
              <li><strong>Months to Payoff:</strong> How long until each debt is eliminated</li>
              <li><strong>Projected Debt-Free Date:</strong> When you'll be completely debt-free</li>
              <li><strong>Total Interest Paid:</strong> How much interest you'll pay with this strategy</li>
            </ul>
          </div>

          <div className="bg-purple-50 border-l-4 border-purple-500 p-4 rounded-r">
            <h4 className="font-semibold text-purple-900 mb-2">What "You'll Save $XXX" Means:</h4>
            <p className="text-purple-800">
              This number shows how much interest you'll save compared to just paying minimum payments forever. It's real money that stays in your pocket instead of going to banks. The avalanche method maximizes these savings by attacking high-interest debt first.
            </p>
          </div>

          <div>
            <h4 className="font-semibold text-gray-900 mb-2">Strategy Comparison:</h4>
            <p className="text-gray-700">
              NOVO compares two scenarios side by side:
            </p>
            <ul className="space-y-2 text-gray-700 ml-4 mt-2">
              <li><strong>Your Strategy (Avalanche):</strong> Aggressive payoff using your extra cash flow</li>
              <li><strong>Minimum Payments Only:</strong> Making only required payments with no extra</li>
            </ul>
            <p className="text-gray-700 mt-2">
              The comparison reveals how much faster and cheaper your strategy is versus the minimum payment trap.
            </p>
          </div>
        </div>
      )
    },
    {
      id: 'heloc-velocity',
      title: 'HELOC Velocity Banking Explained',
      icon: Repeat,
      color: 'bg-teal-500',
      content: (
        <div className="space-y-4">
          <div>
            <h4 className="font-semibold text-gray-900 mb-2">What is HELOC Velocity Banking?</h4>
            <p className="text-gray-700">
              HELOC velocity banking is an advanced debt elimination strategy that uses your Home Equity Line of Credit as a financial tool to save on interest. It works by leveraging the lower interest rate on your HELOC (typically 8-10%) to pay off higher-interest debts (like credit cards at 20%+), then rapidly paying down the HELOC with your cash flow.
            </p>
          </div>

          <div className="bg-teal-50 border-l-4 border-teal-500 p-4 rounded-r">
            <h4 className="font-semibold text-teal-900 mb-3">The 3-Step Cycle: Chunk → Paydown → Repeat</h4>

            <div className="space-y-3">
              <div>
                <p className="font-semibold text-teal-800">Step 1: Chunk a Debt</p>
                <p className="text-teal-700 text-sm">
                  Use your HELOC to completely pay off a high-interest debt (called "chunking"). This immediately stops the expensive interest on that debt.
                </p>
              </div>

              <div>
                <p className="font-semibold text-teal-800">Step 2: Paydown the HELOC</p>
                <p className="text-teal-700 text-sm">
                  Direct your monthly cash flow (income minus expenses) toward paying down the HELOC balance. Since HELOCs typically have lower rates, you're saving money on interest every month.
                </p>
              </div>

              <div>
                <p className="font-semibold text-teal-800">Step 3: Repeat</p>
                <p className="text-teal-700 text-sm">
                  Once you've paid down the HELOC enough to free up space, chunk the next high-interest debt and repeat the cycle. Each cycle builds momentum toward debt freedom.
                </p>
              </div>
            </div>
          </div>

          <div>
            <h4 className="font-semibold text-gray-900 mb-2">When to Chunk a Debt:</h4>
            <p className="text-gray-700 mb-2">NOVO's HELOC tracker shows you when to chunk based on:</p>
            <ul className="space-y-1 text-gray-700 ml-4">
              <li>• Available HELOC space (limit minus current balance)</li>
              <li>• Interest rate arbitrage (is the debt's rate higher than HELOC?)</li>
              <li>• Your debt payoff order (chunk in avalanche sequence)</li>
            </ul>
            <p className="text-gray-700 mt-2">
              In the HELOC Tracker, click "Chunk" next to any debt when you have enough available space to pay it off completely.
            </p>
          </div>

          <div>
            <h4 className="font-semibold text-gray-900 mb-2">How to Pay Down the HELOC:</h4>
            <p className="text-gray-700 mb-2">
              Log HELOC payments in the HELOC Tracker tab. Your strategy is to put as much cash flow as possible toward the HELOC each month:
            </p>
            <ul className="space-y-1 text-gray-700 ml-4">
              <li>• Minimum payment (required by lender)</li>
              <li>• Plus any extra cash flow you have</li>
              <li>• Plus payments freed up from debts you've already paid off</li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold text-gray-900 mb-2">Why This Saves You Money:</h4>
            <p className="text-gray-700">
              <strong>Interest rate arbitrage:</strong> You're replacing expensive debt (e.g., 22% credit card) with cheaper debt (e.g., 8% HELOC). The difference in interest rates is pure savings. Plus, HELOCs calculate interest daily on the average daily balance, so every dollar you pay down immediately reduces your interest cost.
            </p>
          </div>

          <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-r">
            <h4 className="font-semibold text-red-900 mb-2">Common Mistakes to Avoid:</h4>
            <ul className="space-y-2 text-red-800">
              <li><strong>1. Running up paid-off debts again:</strong> After chunking a credit card, don't use it! Close it or freeze it to avoid re-accumulating debt.</li>
              <li><strong>2. Not paying down the HELOC aggressively:</strong> The strategy only works if you rapidly pay down the HELOC after chunking. Treat it like an emergency.</li>
              <li><strong>3. Chunking too much at once:</strong> Leave yourself some breathing room on your HELOC for emergencies.</li>
              <li><strong>4. Ignoring the HELOC minimum payment:</strong> Always pay at least the minimum required by your lender to avoid penalties.</li>
            </ul>
          </div>
        </div>
      )
    },
    {
      id: 'logging-payments',
      title: 'Logging Payments',
      icon: DollarSign,
      color: 'bg-indigo-500',
      content: (
        <div className="space-y-4">
          <div>
            <h4 className="font-semibold text-gray-900 mb-2">When to Log Payments:</h4>
            <p className="text-gray-700">
              Log payments monthly after you've made them. This keeps your progress accurate and motivates you as you see balances decrease. Set a recurring reminder (like the 1st of each month) to review statements and log all payments from the previous month.
            </p>
          </div>

          <div>
            <h4 className="font-semibold text-gray-900 mb-2">How Minimum Payments Auto-Populate:</h4>
            <p className="text-gray-700">
              When you click "Log Payment" on any debt, NOVO pre-fills the payment amount with that debt's minimum payment. This saves time and ensures you're meeting minimum requirements. You can adjust the amount if you paid more (or less).
            </p>
          </div>

          <div>
            <h4 className="font-semibold text-gray-900 mb-2">Logging Extra Payments:</h4>
            <p className="text-gray-700 mb-2">
              If you made an extra payment or paid more than the minimum:
            </p>
            <ol className="space-y-1 text-gray-700 ml-4 list-decimal">
              <li>Click "Log Payment" for that debt</li>
              <li>Update the "Payment Amount" to reflect what you actually paid</li>
              <li>Optionally, split the amount into "Principal" and "Interest" if you know the breakdown</li>
              <li>Click "Log Payment" to save</li>
            </ol>
          </div>

          <div className="bg-indigo-50 border-l-4 border-indigo-500 p-4 rounded-r">
            <h4 className="font-semibold text-indigo-900 mb-2">Handling Interest from Your Statement:</h4>
            <p className="text-indigo-800 mb-2">
              Most loan statements show how much of your payment went to principal vs. interest. To log this accurately:
            </p>
            <ul className="space-y-1 text-indigo-800 ml-4">
              <li>• Enter the total payment amount</li>
              <li>• Fill in the "Interest Amount" field with the interest charged (from your statement)</li>
              <li>• NOVO automatically calculates principal as: Payment - Interest</li>
            </ul>
            <p className="text-indigo-800 mt-2 text-sm">
              <strong>Tip:</strong> Logging interest separately gives you a clearer picture of how much is going to actual debt reduction vs. interest costs.
            </p>
          </div>

          <div>
            <h4 className="font-semibold text-gray-900 mb-2">Logging HELOC Transactions:</h4>
            <p className="text-gray-700 mb-2">
              The HELOC Tracker has its own transaction logging. You can record:
            </p>
            <ul className="space-y-2 text-gray-700 ml-4">
              <li><strong>Draws:</strong> When you borrow from your HELOC (increases balance)</li>
              <li><strong>Payments:</strong> When you pay down your HELOC (decreases balance)</li>
              <li><strong>Interest Charges:</strong> Monthly interest added by your lender (increases balance)</li>
              <li><strong>Chunk Events:</strong> When you use HELOC to pay off another debt (tracked automatically when you click "Chunk")</li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold text-gray-900 mb-2">Editing or Deleting a Payment:</h4>
            <p className="text-gray-700 mb-2">
              Made a mistake? No problem:
            </p>
            <ol className="space-y-1 text-gray-700 ml-4 list-decimal">
              <li>Go to the debt's detail view (click on the debt card)</li>
              <li>Scroll to the "Payment History" section</li>
              <li>Find the payment you want to change</li>
              <li>Click "Edit" to modify details or "Delete" to remove it entirely</li>
            </ol>
            <p className="text-gray-700 mt-2">
              NOVO will automatically recalculate your current balance and progress based on the changes.
            </p>
          </div>
        </div>
      )
    },
    {
      id: 'savings-tracker',
      title: 'Using the Savings Tracker',
      icon: PiggyBank,
      color: 'bg-pink-500',
      content: (
        <div className="space-y-4">
          <div>
            <h4 className="font-semibold text-gray-900 mb-2">Why Track Savings Alongside Debt Elimination?</h4>
            <p className="text-gray-700">
              While crushing debt is critical, building savings creates financial security. The Savings Tracker helps you balance both goals: eliminate debt aggressively while maintaining an emergency fund. Even small amounts saved can prevent you from going into more debt when unexpected expenses arise.
            </p>
          </div>

          <div className="bg-pink-50 border-l-4 border-pink-500 p-4 rounded-r">
            <h4 className="font-semibold text-pink-900 mb-2">Recommended Strategy:</h4>
            <p className="text-pink-800">
              Financial experts recommend saving at least $1,000 for emergencies before attacking debt aggressively. Once you have that buffer, put most of your extra cash toward debt while continuing to build your emergency fund to 3-6 months of expenses over time.
            </p>
          </div>

          <div>
            <h4 className="font-semibold text-gray-900 mb-2">How to Add Multiple Savings Accounts:</h4>
            <ol className="space-y-2 text-gray-700 ml-4 list-decimal">
              <li>Go to the "Savings" tab</li>
              <li>Click "Add Savings Account"</li>
              <li>Enter account details:
                <ul className="ml-4 mt-1 space-y-1">
                  <li>• <strong>Account Name:</strong> E.g., "Emergency Fund" or "Down Payment"</li>
                  <li>• <strong>Account Type:</strong> Savings, Money Market, CD, etc.</li>
                  <li>• <strong>Current Balance:</strong> How much is in the account right now</li>
                  <li>• <strong>Interest Rate:</strong> APY (if applicable)</li>
                  <li>• <strong>Goal Amount:</strong> (Optional) Your target balance</li>
                </ul>
              </li>
              <li>Click "Add Account"</li>
            </ol>
          </div>

          <div>
            <h4 className="font-semibold text-gray-900 mb-2">Logging Deposits, Withdrawals, and Interest:</h4>
            <p className="text-gray-700 mb-2">
              Keep your savings balances accurate by logging all activity:
            </p>
            <ul className="space-y-2 text-gray-700 ml-4">
              <li><strong>Deposits:</strong> Money you add to savings (paychecks, bonuses, side income)</li>
              <li><strong>Withdrawals:</strong> Money you take out (emergency expenses, planned purchases)</li>
              <li><strong>Interest Earned:</strong> Monthly interest added by your bank (check your statement)</li>
            </ul>
            <p className="text-gray-700 mt-2">
              Each transaction includes a date, amount, and optional note to track what the money was for.
            </p>
          </div>

          <div>
            <h4 className="font-semibold text-gray-900 mb-2">Setting Savings Goals:</h4>
            <p className="text-gray-700">
              Goals are optional but powerful motivators. Set a target amount for each account (e.g., $10,000 emergency fund or $30,000 house down payment). NOVO shows your progress as a percentage and how close you are to reaching each goal.
            </p>
          </div>

          <div>
            <h4 className="font-semibold text-gray-900 mb-2">Viewing Your Transaction History:</h4>
            <p className="text-gray-700">
              Each savings account has a detailed transaction history showing all deposits, withdrawals, and interest earned over time. This helps you see savings patterns and understand where your money is going. You can edit or delete transactions if you made a mistake.
            </p>
          </div>
        </div>
      )
    },
    {
      id: 'dashboard',
      title: 'Reading Your Dashboard',
      icon: BarChart3,
      color: 'bg-blue-600',
      content: (
        <div className="space-y-4">
          <div>
            <h4 className="font-semibold text-gray-900 mb-2">Total Debt Progress Bar:</h4>
            <p className="text-gray-700">
              The horizontal progress bar at the top shows your overall debt elimination journey. The filled portion represents how much you've paid off compared to your starting total debt. Watching this bar grow is incredibly motivating!
            </p>
          </div>

          <div>
            <h4 className="font-semibold text-gray-900 mb-2">What "X% Paid Off" Means:</h4>
            <p className="text-gray-700">
              This percentage is calculated as: <strong>(Total Paid Off ÷ Total Starting Debt) × 100</strong>. It shows your progress toward complete debt freedom. Even small percentages represent real money you've reclaimed from lenders.
            </p>
          </div>

          <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-r">
            <h4 className="font-semibold text-blue-900 mb-2">Active Debts vs. Paid Off Debts:</h4>
            <p className="text-blue-800 mb-2">
              The dashboard separates your debts into two categories:
            </p>
            <ul className="space-y-1 text-blue-800 ml-4">
              <li><strong>Active Debts:</strong> Debts you're still paying. Each card shows current balance, interest rate, minimum payment, and a mini progress bar.</li>
              <li><strong>Paid Off Debts:</strong> Victories! These debts have a $0 balance and are marked with a green "Paid Off" badge. They stay visible to remind you of your progress.</li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold text-gray-900 mb-2">Understanding Your Projected Debt-Free Date:</h4>
            <p className="text-gray-700">
              Based on your current payment strategy and cash flow, NOVO calculates when you'll be completely debt-free. This date is dynamic—it updates as you log payments and adjust your strategy. The more aggressive your payments, the sooner this date arrives!
            </p>
          </div>

          <div>
            <h4 className="font-semibold text-gray-900 mb-2">Recent Activity Timeline:</h4>
            <p className="text-gray-700">
              The "Recent Activity" section shows your latest payments across all debts and savings accounts. It's a quick way to see what you've been working on and verify that all your transactions were logged correctly. Each entry shows the date, account name, and amount.
            </p>
          </div>

          <div>
            <h4 className="font-semibold text-gray-900 mb-2">Dashboard Metrics Summary:</h4>
            <p className="text-gray-700 mb-2">
              Key numbers displayed on your dashboard:
            </p>
            <ul className="space-y-1 text-gray-700 ml-4">
              <li>• <strong>Total Remaining Debt:</strong> Sum of all active debt balances</li>
              <li>• <strong>Total Starting Debt:</strong> Your original total when you started NOVO</li>
              <li>• <strong>Total Paid Off:</strong> How much debt you've eliminated</li>
              <li>• <strong>Monthly Cash Flow:</strong> Extra money available for debt payoff</li>
              <li>• <strong>Next Debt Focus:</strong> The debt getting your extra payments this month</li>
            </ul>
          </div>
        </div>
      )
    },
    {
      id: 'troubleshooting',
      title: 'Troubleshooting & FAQs',
      icon: AlertCircle,
      color: 'bg-orange-500',
      content: (
        <div className="space-y-4">
          <div>
            <h4 className="font-semibold text-gray-900 mb-2">My Numbers Don't Match My Loan Statement — What to Do?</h4>
            <p className="text-gray-700 mb-2">
              <strong>Common causes:</strong>
            </p>
            <ul className="space-y-2 text-gray-700 ml-4">
              <li><strong>Missing payments:</strong> Check if you forgot to log a recent payment in NOVO</li>
              <li><strong>Interest timing:</strong> Lenders add interest at different points in the billing cycle. Log interest charges when they appear on your statement.</li>
              <li><strong>Fees or adjustments:</strong> Late fees, annual fees, or payment adjustments might not be logged in NOVO yet</li>
              <li><strong>Starting balance was wrong:</strong> Go to Settings → View/Edit Debts and correct the starting balance if needed</li>
            </ul>
            <p className="text-gray-700 mt-2">
              <strong>Quick fix:</strong> You can manually adjust a debt's current balance in the debt detail view if you need to sync with your lender's statement.
            </p>
          </div>

          <div>
            <h4 className="font-semibold text-gray-900 mb-2">What If I Miss a Payment?</h4>
            <p className="text-gray-700">
              Life happens! If you miss a payment to a lender, pay it as soon as possible to avoid late fees and credit score damage. In NOVO, just log the payment when you make it (even if it's late). Your strategy will adjust automatically. Missing one payment doesn't ruin your plan—just get back on track next month.
            </p>
          </div>

          <div>
            <h4 className="font-semibold text-gray-900 mb-2">How Do I Adjust If My Income Changes?</h4>
            <p className="text-gray-700 mb-2">
              If you get a raise, lose a job, or have any income change:
            </p>
            <ol className="space-y-1 text-gray-700 ml-4 list-decimal">
              <li>Go to Settings</li>
              <li>Update your "Monthly Income" and/or "Monthly Expenses"</li>
              <li>NOVO will recalculate your available cash flow</li>
              <li>Re-run your payment strategy to see your new debt-free date</li>
            </ol>
            <p className="text-gray-700 mt-2">
              Your strategy adapts to your reality. If cash flow decreases, you'll take longer to pay off debt. If it increases, you'll accelerate toward freedom!
            </p>
          </div>

          <div className="bg-orange-50 border-l-4 border-orange-500 p-4 rounded-r">
            <h4 className="font-semibold text-orange-900 mb-2">Should I Re-Run My Strategy? When?</h4>
            <p className="text-orange-800 mb-2">
              Re-run your strategy whenever:
            </p>
            <ul className="space-y-1 text-orange-800 ml-4">
              <li>• Your income or expenses change significantly</li>
              <li>• You add a new debt</li>
              <li>• You pay off a debt completely</li>
              <li>• Interest rates change on variable-rate debts</li>
              <li>• You want to see updated projections</li>
            </ul>
            <p className="text-orange-800 mt-2">
              Running your strategy is instant and free—do it as often as you like to stay motivated and on track!
            </p>
          </div>

          <div>
            <h4 className="font-semibold text-gray-900 mb-2">What If I Get a Bonus — Where Should It Go?</h4>
            <p className="text-gray-700">
              Windfalls like bonuses, tax refunds, or gifts are powerful debt destroyers! Here's the priority order:
            </p>
            <ol className="space-y-1 text-gray-700 ml-4 list-decimal">
              <li><strong>Cover essentials:</strong> Make sure all minimum payments are covered</li>
              <li><strong>Emergency fund:</strong> If you don't have $1,000 saved, put some there first</li>
              <li><strong>Highest interest debt:</strong> Put the rest toward your highest-rate debt (following avalanche method)</li>
              <li><strong>Celebrate responsibly:</strong> It's okay to use 5-10% for something fun to stay motivated!</li>
            </ol>
          </div>

          <div>
            <h4 className="font-semibold text-gray-900 mb-2">Can I Pause My Plan If Life Gets Hard?</h4>
            <p className="text-gray-700">
              Absolutely. If you face job loss, medical emergency, or other hardship, your priority is survival, not aggressive debt payoff. Here's what to do:
            </p>
            <ul className="space-y-2 text-gray-700 ml-4">
              <li><strong>Keep paying minimums:</strong> Avoid defaulting on any loans if possible</li>
              <li><strong>Pause extra payments:</strong> Stop putting extra toward debt until you're stable</li>
              <li><strong>Update NOVO:</strong> Adjust your cash flow in Settings to reflect your new reality</li>
              <li><strong>Contact lenders:</strong> Many offer hardship programs with reduced payments or deferred interest</li>
              <li><strong>Restart when ready:</strong> NOVO will be here when you're ready to resume your journey</li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold text-gray-900 mb-2">Other Common Questions:</h4>
            <ul className="space-y-2 text-gray-700 ml-4">
              <li><strong>Can I track multiple people's debts?</strong> NOVO is designed for one person/household. If you want separate tracking, use different browsers or devices.</li>
              <li><strong>Is my data secure?</strong> All data is stored locally in your browser. NOVO doesn't send your financial information to any servers.</li>
              <li><strong>What if I want to switch from avalanche to snowball?</strong> Currently, NOVO focuses on the avalanche method. Snowball (smallest balance first) may be added in future updates.</li>
              <li><strong>Can I export my data?</strong> Not yet, but this feature is on the roadmap!</li>
            </ul>
          </div>
        </div>
      )
    },
    {
      id: 'getting-help',
      title: 'Getting Help',
      icon: HelpCircle,
      color: 'bg-gray-600',
      content: (
        <div className="space-y-4">
          <div className="bg-gradient-to-r from-blue-50 to-blue-100 border-l-4 border-blue-500 p-6 rounded-r">
            <div className="flex items-start space-x-3">
              <div className="bg-blue-500 text-white p-2 rounded-lg">
                <HelpCircle className="w-6 h-6" />
              </div>
              <div>
                <h4 className="font-semibold text-blue-900 mb-2">Ask NOVO AI Coach — Available 24/7</h4>
                <p className="text-blue-800 mb-3">
                  Click the "Ask NOVO" button in the top-right corner to chat with NOVO's AI assistant. Get personalized coaching, strategy advice, and answers to specific questions about your debt situation anytime.
                </p>
                <p className="text-blue-700 text-sm">
                  The AI coach understands debt payoff strategies, HELOC velocity banking, and can help you make smart financial decisions based on your unique circumstances.
                </p>
              </div>
            </div>
          </div>

          <div className="bg-green-50 border-l-4 border-green-500 p-4 rounded-r">
            <h4 className="font-semibold text-green-900 mb-2">Need Mortgage Advice?</h4>
            <p className="text-green-800 mb-3">
              For mortgage-specific questions, refinancing options, or HELOC setup assistance, contact:
            </p>
            <div className="bg-white p-3 rounded border border-green-200">
              <p className="font-semibold text-green-900">Ben Hulshof</p>
              <p className="text-green-800">Windmill Mortgage</p>
              <p className="text-green-700 text-sm mt-1">
                <strong>Email:</strong> <a href="mailto:ben@windmillmortgage.com" className="underline hover:text-green-900">ben@windmillmortgage.com</a>
              </p>
              <p className="text-green-700 text-sm">
                <strong>Phone:</strong> <a href="tel:614-327-2213" className="underline hover:text-green-900">614-327-2213</a>
              </p>
              <p className="text-green-700 text-sm mt-2">Mortgage expert specializing in HELOC strategies and debt optimization</p>
            </div>
          </div>

          <div>
            <h4 className="font-semibold text-gray-900 mb-2">Support & Feedback</h4>
            <p className="text-gray-700 mb-3">
              Have feedback, found a bug, or want to request a feature? We'd love to hear from you:
            </p>
            <ul className="space-y-2 text-gray-700 ml-4">
              <li>• <strong>Report a Bug:</strong> If something isn't working correctly, email <a href="mailto:ben@windmillmortgage.com" className="text-blue-600 underline hover:text-blue-800">ben@windmillmortgage.com</a> with details and screenshots</li>
              <li>• <strong>Request Features:</strong> Tell us what would make NOVO more useful for you — we're constantly improving based on user feedback</li>
              <li>• <strong>Ask NOVO AI Coach:</strong> Click the "Ask NOVO" button in the app for instant help with debt strategy questions, payment guidance, and app usage tips</li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold text-gray-900 mb-2">Community & Resources</h4>
            <p className="text-gray-700 mb-2">
              Looking to learn more about debt elimination strategies?
            </p>
            <ul className="space-y-2 text-gray-700 ml-4">
              <li>• <strong>NOVO Blog</strong> — Coming soon! Debt payoff tips and success stories</li>
              <li>• <strong>NOVO Community</strong> — Coming soon! Connect with others on the same journey</li>
              <li>• <strong>Recommended Reading:</strong>
                <ul className="ml-4 mt-1 space-y-1">
                  <li>- "The Total Money Makeover" by Dave Ramsey</li>
                  <li>- "Your Money or Your Life" by Vicki Robin</li>
                </ul>
              </li>
            </ul>
          </div>

          <div className="bg-gray-100 border border-gray-300 p-4 rounded-lg mt-6">
            <p className="text-center text-gray-700 font-medium">
              Remember: You're not alone on this journey. NOVO is here to guide you every step of the way toward financial freedom! 🎯
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

        {/* Search Bar */}
        <div className="mb-4">
          <input
            type="text"
            placeholder="Search guide topics..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF6B35] focus:border-transparent"
          />
        </div>

        {/* Expand/Collapse All Buttons */}
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

      {/* Accordion Sections */}
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

      {/* Back to Top Button */}
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
