import { useState } from 'react';
import { X } from 'lucide-react';

const DISMISS_KEY = 'novo_ben_welcome_dismissed';

/**
 * One-time Dashboard note after onboarding. Placeholder copy — replace with Ben's text later.
 */
export default function BenWelcomeNote() {
  const [dismissed, setDismissed] = useState(
    () => localStorage.getItem(DISMISS_KEY) === 'true'
  );

  const onboardingComplete = localStorage.getItem('novo_onboarding_complete') === 'true';
  const hasUserName = !!localStorage.getItem('userName');

  if (dismissed || !onboardingComplete || !hasUserName) return null;

  const handleDismiss = () => {
    localStorage.setItem(DISMISS_KEY, 'true');
    setDismissed(true);
  };

  return (
    <div className="bg-white border border-brand-gray-border rounded-lg overflow-hidden mb-5">
      <div className="relative px-4 py-3 pr-10 bg-brand-navy text-white">
        <p className="text-sm font-medium">A note from Ben</p>
        <p className="text-[13px] text-white/80 mt-1 leading-relaxed">
          Placeholder: a short, genuine welcome will go here. You&apos;re in the right place — we&apos;ll take this one step at a time.
        </p>
        <button
          type="button"
          onClick={handleDismiss}
          className="absolute right-3 top-3 text-white/75 hover:text-white p-1 rounded"
          aria-label="Dismiss welcome note"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
