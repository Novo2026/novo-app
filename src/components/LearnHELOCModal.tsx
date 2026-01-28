import { X, Home, TrendingUp, DollarSign, CheckCircle2, XCircle, Mail, Phone } from 'lucide-react';

interface LearnHELOCModalProps {
  isOpen: boolean;
  onClose: () => void;
  onEnableHELOC?: () => void;
  showEnableButton?: boolean;
}

function LearnHELOCModal({ isOpen, onClose, onEnableHELOC, showEnableButton = false }: LearnHELOCModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-6 py-4 flex items-center justify-between rounded-t-lg">
          <div className="flex items-center space-x-3">
            <Home className="w-6 h-6" />
            <h2 className="text-2xl font-bold">What is HELOC Velocity Banking?</h2>
          </div>
          <button
            onClick={onClose}
            className="text-white hover:text-gray-200 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-r">
            <p className="text-gray-800 leading-relaxed">
              A <strong>Home Equity Line of Credit (HELOC)</strong> is a revolving credit line secured by your home equity.
              If you're a homeowner, you can use it strategically to eliminate high-interest debt faster.
            </p>
          </div>

          <div>
            <h3 className="text-xl font-bold text-gray-900 mb-3 flex items-center space-x-2">
              <TrendingUp className="w-6 h-6 text-green-600" />
              <span>How It Works:</span>
            </h3>
            <div className="space-y-3">
              <div className="bg-white border-l-4 border-green-500 p-4 rounded-r shadow-sm">
                <p className="font-semibold text-green-900 mb-1">Step 1: Trade Expensive Debt for Cheap Debt</p>
                <p className="text-gray-700 text-sm">
                  Draw from HELOC to pay off high-interest debt (e.g., credit cards at 20% → HELOC at 8%)
                </p>
              </div>
              <div className="bg-white border-l-4 border-blue-500 p-4 rounded-r shadow-sm">
                <p className="font-semibold text-blue-900 mb-1">Step 2: Immediate Interest Savings</p>
                <p className="text-gray-700 text-sm">
                  Trade expensive interest rates for lower HELOC rate - save money every single day
                </p>
              </div>
              <div className="bg-white border-l-4 border-purple-500 p-4 rounded-r shadow-sm">
                <p className="font-semibold text-purple-900 mb-1">Step 3: Aggressive Paydown</p>
                <p className="text-gray-700 text-sm">
                  Use all your cash flow to pay down HELOC aggressively
                </p>
              </div>
              <div className="bg-white border-l-4 border-orange-500 p-4 rounded-r shadow-sm">
                <p className="font-semibold text-orange-900 mb-1">Step 4: Repeat the Cycle</p>
                <p className="text-gray-700 text-sm">
                  Once HELOC is paid off, repeat the cycle or attack next debt
                </p>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-300 rounded-lg p-5">
            <h3 className="text-lg font-bold text-green-900 mb-3 flex items-center space-x-2">
              <DollarSign className="w-6 h-6" />
              <span>Real Example:</span>
            </h3>
            <div className="space-y-2 text-gray-800">
              <div className="flex items-start space-x-2">
                <span className="text-red-600 font-bold">❌</span>
                <p><strong>Credit card:</strong> $10,000 at 22% = <span className="text-red-700 font-bold">$2,200/year</span> in interest</p>
              </div>
              <div className="flex items-start space-x-2">
                <span className="text-green-600 font-bold">✓</span>
                <p><strong>Pay it off with HELOC at 8%:</strong> <span className="text-green-700 font-bold">$800/year</span> in interest</p>
              </div>
              <div className="bg-green-100 border border-green-400 rounded-lg p-3 mt-3">
                <p className="font-bold text-green-900 text-lg">
                  💰 Savings: $1,400/year while you pay it off!
                </p>
              </div>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="bg-green-50 border-2 border-green-300 rounded-lg p-4">
              <h3 className="text-lg font-bold text-green-900 mb-3 flex items-center space-x-2">
                <CheckCircle2 className="w-5 h-5" />
                <span>Is This Right for You?</span>
              </h3>
              <ul className="space-y-2 text-sm text-gray-800">
                <li className="flex items-start space-x-2">
                  <span className="text-green-600 font-bold mt-0.5">✓</span>
                  <span>You're a homeowner with equity</span>
                </li>
                <li className="flex items-start space-x-2">
                  <span className="text-green-600 font-bold mt-0.5">✓</span>
                  <span>You have stable income</span>
                </li>
                <li className="flex items-start space-x-2">
                  <span className="text-green-600 font-bold mt-0.5">✓</span>
                  <span>You have high-interest debt (credit cards, personal loans)</span>
                </li>
                <li className="flex items-start space-x-2">
                  <span className="text-green-600 font-bold mt-0.5">✓</span>
                  <span>You're disciplined (won't use paid-off credit cards)</span>
                </li>
                <li className="flex items-start space-x-2">
                  <span className="text-green-600 font-bold mt-0.5">✓</span>
                  <span>You have emergency fund</span>
                </li>
              </ul>
            </div>

            <div className="bg-red-50 border-2 border-red-300 rounded-lg p-4">
              <h3 className="text-lg font-bold text-red-900 mb-3 flex items-center space-x-2">
                <XCircle className="w-5 h-5" />
                <span>Not Right If:</span>
              </h3>
              <ul className="space-y-2 text-sm text-gray-800">
                <li className="flex items-start space-x-2">
                  <span className="text-red-600 font-bold mt-0.5">✗</span>
                  <span>You're not a homeowner</span>
                </li>
                <li className="flex items-start space-x-2">
                  <span className="text-red-600 font-bold mt-0.5">✗</span>
                  <span>You have unstable income</span>
                </li>
                <li className="flex items-start space-x-2">
                  <span className="text-red-600 font-bold mt-0.5">✗</span>
                  <span>You struggle with spending discipline</span>
                </li>
                <li className="flex items-start space-x-2">
                  <span className="text-red-600 font-bold mt-0.5">✗</span>
                  <span>Your mortgage rate is already very low (under 4%)</span>
                </li>
                <li className="flex items-start space-x-2">
                  <span className="text-red-600 font-bold mt-0.5">✗</span>
                  <span>No emergency fund</span>
                </li>
              </ul>
            </div>
          </div>

          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-300 rounded-lg p-5">
            <h3 className="text-lg font-bold text-blue-900 mb-3">Want to Explore This?</h3>
            <p className="text-gray-800 mb-4">
              Contact Ben Hulshof for personalized HELOC strategy guidance and to see if this approach is right for your situation.
            </p>
            <div className="bg-white rounded-lg p-4 border border-blue-200">
              <p className="font-bold text-gray-900 text-lg mb-2">Ben Hulshof</p>
              <p className="text-gray-700 mb-3">Windmill Mortgage</p>
              <div className="space-y-2">
                <a
                  href="mailto:ben@windmillmortgage.com"
                  className="flex items-center space-x-2 text-blue-600 hover:text-blue-800 transition-colors"
                >
                  <Mail className="w-4 h-4" />
                  <span className="font-medium">ben@windmillmortgage.com</span>
                </a>
                <a
                  href="tel:614-327-2213"
                  className="flex items-center space-x-2 text-blue-600 hover:text-blue-800 transition-colors"
                >
                  <Phone className="w-4 h-4" />
                  <span className="font-medium">614-327-2213</span>
                </a>
              </div>
            </div>
          </div>
        </div>

        <div className="sticky bottom-0 bg-gray-50 px-6 py-4 border-t border-gray-200 rounded-b-lg flex justify-end space-x-3">
          {showEnableButton && onEnableHELOC && (
            <button
              onClick={() => {
                onEnableHELOC();
                onClose();
              }}
              className="px-6 py-2 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-lg transition-colors shadow-sm"
            >
              Enable HELOC Features
            </button>
          )}
          <button
            onClick={onClose}
            className="px-6 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold rounded-lg transition-colors"
          >
            {showEnableButton ? 'Maybe Later' : 'Close'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default LearnHELOCModal;
