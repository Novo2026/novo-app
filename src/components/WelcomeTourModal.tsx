import { useState } from 'react';
import { TrendingUp, Home, MessageCircle, Building2, X } from 'lucide-react';

interface WelcomeTourModalProps {
  userName: string;
  hasHELOC: boolean;
  onNavigate: (section: 'dashboard' | 'strategies', scrollTo?: string) => void;
  onAskNovo: () => void;
  onClose: () => void;
}

export default function WelcomeTourModal({ userName, hasHELOC, onNavigate, onAskNovo, onClose }: WelcomeTourModalProps) {
  const [dontShowAgain, setDontShowAgain] = useState(false);

  const handleClose = (action?: () => void) => {
    if (dontShowAgain) {
      localStorage.setItem('welcomeTourCompleted', 'true');
    }
    if (action) {
      action();
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-gradient-to-br from-white to-gray-50 rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-8">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-gray-800 mb-2">
              🎉 Welcome to NOVO, {userName}!
            </h2>
            <p className="text-lg text-gray-600">
              You're all set up! Here's how to get started:
            </p>
          </div>

          <div className="space-y-4 mb-8">
            <button
              onClick={() => handleClose(() => onNavigate('strategies', 'strategy-comparison'))}
              className="group w-full bg-white hover:bg-gradient-to-br hover:from-emerald-50 hover:to-white border-2 border-gray-200 hover:border-emerald-500 rounded-xl p-6 transition-all duration-300 transform hover:scale-[1.02] hover:shadow-xl text-left"
            >
              <div className="flex items-start space-x-4">
                <div className="flex-shrink-0 w-12 h-12 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-lg flex items-center justify-center text-white text-xl font-bold shadow-lg">
                  1
                </div>
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-2">
                    <TrendingUp className="w-5 h-5 text-emerald-600" />
                    <h3 className="text-xl font-bold text-gray-800">
                      Review Your Debt Freedom Strategy
                    </h3>
                  </div>
                  <p className="text-gray-600 mb-3">
                    See your personalized payoff plan, timeline, and how much interest you'll save
                  </p>
                  <p className="text-sm font-semibold text-emerald-600">
                    This is your roadmap to debt freedom!
                  </p>
                  <div className="mt-4 inline-flex items-center text-emerald-600 font-semibold group-hover:translate-x-2 transition-transform">
                    View My Strategy →
                  </div>
                </div>
              </div>
            </button>

            <button
              onClick={() => handleClose(() => onNavigate('dashboard'))}
              className="group w-full bg-white hover:bg-gradient-to-br hover:from-blue-50 hover:to-white border-2 border-gray-200 hover:border-blue-500 rounded-xl p-6 transition-all duration-300 transform hover:scale-[1.02] hover:shadow-xl text-left"
            >
              <div className="flex items-start space-x-4">
                <div className="flex-shrink-0 w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center text-white text-xl font-bold shadow-lg">
                  2
                </div>
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-2">
                    <Home className="w-5 h-5 text-blue-600" />
                    <h3 className="text-xl font-bold text-gray-800">
                      Start Tracking Your Progress
                    </h3>
                  </div>
                  <p className="text-gray-600 mb-3">
                    Log debt payments and watch your balances drop in real-time
                  </p>
                  <p className="text-sm font-semibold text-blue-600">
                    Your Dashboard is your command center
                  </p>
                  <div className="mt-4 inline-flex items-center text-blue-600 font-semibold group-hover:translate-x-2 transition-transform">
                    Go to Dashboard →
                  </div>
                </div>
              </div>
            </button>

            <button
              onClick={() => handleClose(onAskNovo)}
              className="group w-full bg-white hover:bg-gradient-to-br hover:from-cyan-50 hover:to-white border-2 border-gray-200 hover:border-cyan-500 rounded-xl p-6 transition-all duration-300 transform hover:scale-[1.02] hover:shadow-xl text-left"
            >
              <div className="flex items-start space-x-4">
                <div className="flex-shrink-0 w-12 h-12 bg-gradient-to-br from-cyan-500 to-cyan-600 rounded-lg flex items-center justify-center text-white text-xl font-bold shadow-lg">
                  3
                </div>
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-2">
                    <MessageCircle className="w-5 h-5 text-cyan-600" />
                    <h3 className="text-xl font-bold text-gray-800">
                      Get Help Anytime with Ask NOVO
                    </h3>
                  </div>
                  <p className="text-gray-600 mb-3">
                    Have questions? Click "Ask NOVO" (top right) for instant AI-powered coaching
                  </p>
                  <p className="text-sm font-semibold text-cyan-600">
                    Available 24/7 to guide you!
                  </p>
                  <div className="mt-4 inline-flex items-center text-cyan-600 font-semibold group-hover:translate-x-2 transition-transform">
                    Ask a Question →
                  </div>
                </div>
              </div>
            </button>

            {hasHELOC && (
              <button
                onClick={() => handleClose(() => onNavigate('strategies', 'heloc-section'))}
                className="group w-full bg-gradient-to-br from-amber-50 to-white hover:from-amber-100 hover:to-white border-2 border-amber-300 hover:border-amber-500 rounded-xl p-6 transition-all duration-300 transform hover:scale-[1.02] hover:shadow-xl text-left"
              >
                <div className="flex items-start space-x-4">
                  <div className="flex-shrink-0 w-12 h-12 bg-gradient-to-br from-amber-500 to-amber-600 rounded-lg flex items-center justify-center text-white shadow-lg">
                    <Building2 className="w-6 h-6" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-2">
                      <h3 className="text-xl font-bold text-gray-800">
                        🏠 Optional: Explore HELOC Strategies
                      </h3>
                    </div>
                    <p className="text-gray-600 mb-3">
                      Learn about velocity banking and when it makes sense for your situation
                    </p>
                    <p className="text-sm font-semibold text-amber-700">
                      Note: This is optional - start with your debt strategy first!
                    </p>
                    <div className="mt-4 inline-flex items-center text-amber-600 font-semibold group-hover:translate-x-2 transition-transform">
                      Learn About HELOC →
                    </div>
                  </div>
                </div>
              </button>
            )}
          </div>

          <div className="bg-blue-50 border-l-4 border-blue-500 rounded-lg p-4 mb-6">
            <p className="text-sm text-blue-800">
              <span className="font-bold">💡 Quick Tip:</span> Start by clicking "View My Strategy" to see your personalized debt payoff plan!
            </p>
          </div>

          <div className="flex items-center justify-between pt-6 border-t border-gray-200">
            <label className="flex items-center space-x-2 cursor-pointer group">
              <input
                type="checkbox"
                checked={dontShowAgain}
                onChange={(e) => setDontShowAgain(e.target.checked)}
                className="w-4 h-4 text-emerald-600 border-gray-300 rounded focus:ring-emerald-500"
              />
              <span className="text-sm text-gray-600 group-hover:text-gray-800">
                Don't show this welcome screen again
              </span>
            </label>

            <button
              onClick={() => handleClose(() => onNavigate('dashboard'))}
              className="px-6 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold rounded-lg transition-colors"
            >
              Skip Tour - Go to Dashboard
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
