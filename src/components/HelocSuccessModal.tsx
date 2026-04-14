import { useState } from 'react';
import { CheckCircle, X, Home, TrendingUp, BookOpen, Zap, DollarSign, ChevronRight } from 'lucide-react';

interface HelocSuccessModalProps {
  onClose: () => void;
  onNavigate: (section: 'tracker' | 'strategies' | 'guide') => void;
}

export default function HelocSuccessModal({ onClose, onNavigate }: HelocSuccessModalProps) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  const handleDismiss = () => {
    setDismissed(true);
    onClose();
  };

  const handleNavigate = (section: 'tracker' | 'strategies' | 'guide') => {
    setDismissed(true);
    onClose();
    onNavigate(section);
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden">
        <div className="bg-gradient-to-r from-emerald-500 to-teal-600 px-6 py-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
                <CheckCircle className="w-7 h-7 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">HELOC Features Enabled!</h2>
                <p className="text-emerald-100 text-sm">Your HELOC is now active in NOVO</p>
              </div>
            </div>
            <button
              onClick={handleDismiss}
              className="text-white/70 hover:text-white transition-colors"
              aria-label="Close"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        <div className="px-6 py-5">
          <p className="text-gray-600 text-sm mb-5">
            Here's what you can do with your HELOC in NOVO:
          </p>

          <div className="space-y-3 mb-6">
            <button
              onClick={() => handleNavigate('tracker')}
              className="w-full flex items-center gap-4 p-4 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 hover:border-emerald-300 rounded-xl transition-all group"
            >
              <div className="w-10 h-10 bg-emerald-500 rounded-lg flex items-center justify-center flex-shrink-0">
                <Home className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1 text-left">
                <p className="font-semibold text-gray-800 text-sm">HELOC Tracker</p>
                <p className="text-xs text-gray-500">Track draws, deposits, and balance</p>
              </div>
              <ChevronRight className="w-4 h-4 text-emerald-500 group-hover:translate-x-0.5 transition-transform flex-shrink-0" />
            </button>

            <button
              onClick={() => handleNavigate('strategies')}
              className="w-full flex items-center gap-4 p-4 bg-blue-50 hover:bg-blue-100 border border-blue-200 hover:border-blue-300 rounded-xl transition-all group"
            >
              <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center flex-shrink-0">
                <TrendingUp className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1 text-left">
                <p className="font-semibold text-gray-800 text-sm">HELOC Acceleration Strategies</p>
                <p className="text-xs text-gray-500">Velocity banking and chunking payment methods</p>
              </div>
              <ChevronRight className="w-4 h-4 text-blue-500 group-hover:translate-x-0.5 transition-transform flex-shrink-0" />
            </button>

            <button
              onClick={() => handleNavigate('strategies')}
              className="w-full flex items-center gap-4 p-4 bg-amber-50 hover:bg-amber-100 border border-amber-200 hover:border-amber-300 rounded-xl transition-all group"
            >
              <div className="w-10 h-10 bg-amber-500 rounded-lg flex items-center justify-center flex-shrink-0">
                <DollarSign className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1 text-left">
                <p className="font-semibold text-gray-800 text-sm">Chunking Calculator</p>
                <p className="text-xs text-gray-500">Make large principal payments to your mortgage</p>
              </div>
              <ChevronRight className="w-4 h-4 text-amber-500 group-hover:translate-x-0.5 transition-transform flex-shrink-0" />
            </button>

            <button
              onClick={() => handleNavigate('guide')}
              className="w-full flex items-center gap-4 p-4 bg-gray-50 hover:bg-gray-100 border border-gray-200 hover:border-gray-300 rounded-xl transition-all group"
            >
              <div className="w-10 h-10 bg-gray-600 rounded-lg flex items-center justify-center flex-shrink-0">
                <BookOpen className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1 text-left">
                <p className="font-semibold text-gray-800 text-sm">How to Use Guide</p>
                <p className="text-xs text-gray-500">HELOC velocity banking explained step-by-step</p>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-500 group-hover:translate-x-0.5 transition-transform flex-shrink-0" />
            </button>
          </div>

          <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-xl p-4 mb-5">
            <div className="flex items-start gap-3">
              <Zap className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-emerald-900 mb-1">Pro tip: Start with the HELOC Tracker</p>
                <p className="text-xs text-emerald-700 leading-relaxed">
                  Head to the "Tracker" tab in the navigation to log your first HELOC transaction and start velocity banking.
                </p>
              </div>
            </div>
          </div>

          <button
            onClick={handleDismiss}
            className="w-full text-center text-sm text-gray-500 hover:text-gray-700 font-medium py-2 transition-colors"
          >
            Close - I'll explore on my own
          </button>
        </div>
      </div>
    </div>
  );
}
