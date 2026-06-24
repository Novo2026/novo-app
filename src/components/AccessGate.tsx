import { useState } from 'react';
import { Lock, Unlock, ArrowRight, CheckCircle2 } from 'lucide-react';
import { activateCode, isPro, PRO_FEATURES, FREE_FEATURES } from '../services/accessControl';

interface AccessGateProps {
  featureName: string;
  children: React.ReactNode;
}

export function ProFeatureGate({ featureName, children }: AccessGateProps) {
  const [showUpgrade, setShowUpgrade] = useState(false);

  if (isPro()) return <>{children}</>;

  return (
    <>
      <div
        className="relative cursor-pointer"
        onClick={() => setShowUpgrade(true)}
      >
        <div className="pointer-events-none select-none opacity-30 blur-sm">
          {children}
        </div>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="bg-white border-2 border-brand-orange rounded-xl p-6 text-center shadow-lg max-w-sm mx-4">
            <Lock className="w-8 h-8 text-brand-orange mx-auto mb-3" />
            <p className="font-bold text-gray-900 text-lg mb-1">NOVO Pro Feature</p>
            <p className="text-sm text-gray-600 mb-4">
              {featureName} is available on NOVO Pro. Enter an access code or attend a free homebuyer webinar to unlock.
            </p>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setShowUpgrade(true); }}
              className="bg-brand-orange hover:bg-brand-orange-dark text-white font-bold py-2.5 px-6 rounded-lg transition-colors text-sm"
            >
              Enter Access Code
            </button>
          </div>
        </div>
      </div>

      {showUpgrade && (
        <UpgradeModal onClose={() => setShowUpgrade(false)} />
      )}
    </>
  );
}

export function UpgradeModal({ onClose }: { onClose: () => void }) {
  const [code, setCode] = useState('');
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);
  const [loading, setLoading] = useState(false);

  const handleActivate = () => {
    if (!code.trim()) return;
    setLoading(true);
    setTimeout(() => {
      const res = activateCode(code);
      setResult(res);
      setLoading(false);
      if (res.success) {
        setTimeout(() => {
          onClose();
          window.location.reload();
        }, 2000);
      }
    }, 600);
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl">
        <div className="text-center mb-6">
          <div className="w-14 h-14 bg-brand-orange rounded-full flex items-center justify-center mx-auto mb-3">
            <Unlock className="w-7 h-7 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900">Unlock NOVO Pro</h2>
          <p className="text-gray-500 text-sm mt-1">Enter your access code to unlock all features</p>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-5">
          <p className="text-sm font-bold text-blue-900 mb-2">How to get an access code:</p>
          <ul className="space-y-1.5 text-sm text-blue-800">
            <li className="flex items-start gap-2">
              <span className="text-blue-500 mt-0.5 flex-shrink-0">→</span>
              <span><strong>Past Windmill client?</strong> Contact Ben for your free permanent code</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-500 mt-0.5 flex-shrink-0">→</span>
              <span><strong>Webinar attendee?</strong> Check your confirmation email for your 90-day code</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-500 mt-0.5 flex-shrink-0">→</span>
              <span><strong>Want to attend a webinar?</strong>{' '}
                <a
                  href="https://api.leadconnectorhq.com/widget/booking/Ms28gTzPwpR5BbzeU0Dc"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline font-semibold"
                >
                  Book a session with Ben
                </a>
              </span>
            </li>
          </ul>
        </div>

        {!result?.success && (
          <div className="space-y-3">
            <input
              type="text"
              value={code}
              onChange={e => setCode(e.target.value.toUpperCase())}
              onKeyDown={e => e.key === 'Enter' && handleActivate()}
              placeholder="Enter your access code"
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-center text-lg font-mono font-bold tracking-widest focus:border-brand-orange focus:outline-none uppercase"
              autoFocus
            />
            {result && !result.success && (
              <p className="text-red-600 text-sm text-center font-medium">{result.message}</p>
            )}
            <button
              type="button"
              onClick={handleActivate}
              disabled={!code.trim() || loading}
              className="w-full bg-brand-orange hover:bg-brand-orange-dark disabled:opacity-50 text-white font-bold py-3 rounded-xl transition-colors text-base"
            >
              {loading ? 'Activating...' : 'Activate Code'}
            </button>
          </div>
        )}

        {result?.success && (
          <div className="text-center space-y-3">
            <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
            <p className="font-bold text-gray-900 text-lg">Pro Access Activated!</p>
            <p className="text-gray-600 text-sm">{result.message}</p>
            <p className="text-gray-400 text-xs">Reloading to unlock all features...</p>
          </div>
        )}

        <div className="mt-5 pt-5 border-t border-gray-100">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-bold text-gray-500 mb-2 uppercase tracking-wide">Free includes</p>
              <ul className="space-y-1">
                {FREE_FEATURES.map(f => (
                  <li key={f} className="text-xs text-gray-600 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3 h-3 text-gray-400 flex-shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-xs font-bold text-brand-orange mb-2 uppercase tracking-wide">Pro unlocks</p>
              <ul className="space-y-1">
                {PRO_FEATURES.map(f => (
                  <li key={f} className="text-xs text-gray-700 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3 h-3 text-brand-orange flex-shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="mt-4 w-full text-gray-400 hover:text-gray-600 text-sm py-2 transition-colors"
        >
          Maybe later — stay on Free
        </button>
      </div>
    </div>
  );
}

export function UpgradeButton() {
  const [show, setShow] = useState(false);
  if (isPro()) return null;
  return (
    <>
      <button
        type="button"
        onClick={() => setShow(true)}
        className="flex items-center gap-1.5 bg-brand-orange hover:bg-brand-orange-dark text-white text-xs font-bold px-3 py-1.5 rounded-lg transition-colors"
      >
        <ArrowRight className="w-3.5 h-3.5" />
        Unlock Pro
      </button>
      {show && <UpgradeModal onClose={() => setShow(false)} />}
    </>
  );
}
