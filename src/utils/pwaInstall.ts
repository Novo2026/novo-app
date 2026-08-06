/**
 * PWA install helpers — Chromium beforeinstallprompt + standalone detection.
 * iOS Safari never fires beforeinstallprompt; use manual Share → Add to Home Screen UI there.
 */

export type BeforeInstallPromptEventLike = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
};

const PWA_INSTALLED_KEY = 'novo_pwa_installed';

let deferredPrompt: BeforeInstallPromptEventLike | null = null;
let listenersInitialized = false;
const subscribers = new Set<() => void>();

function notify() {
  subscribers.forEach((cb) => cb());
}

export function isNovoRunningStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  const displayStandalone = window.matchMedia('(display-mode: standalone)').matches;
  const iosStandalone = (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
  return displayStandalone || iosStandalone;
}

export function isIosSafariLike(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  const iOS =
    /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  // Chrome/Firefox/Edge on iOS still use WebKit and lack beforeinstallprompt
  return iOS;
}

export function hasDeferredInstallPrompt(): boolean {
  return deferredPrompt != null;
}

export function isPwaInstallComplete(): boolean {
  if (isNovoRunningStandalone()) return true;
  try {
    return localStorage.getItem(PWA_INSTALLED_KEY) === 'true';
  } catch {
    return false;
  }
}

export function markPwaInstallComplete(): void {
  try {
    localStorage.setItem(PWA_INSTALLED_KEY, 'true');
  } catch {
    /* ignore */
  }
  notify();
}

/** Call once from App (or root) so the deferred prompt is captured early. */
export function initPwaInstallListeners(): void {
  if (typeof window === 'undefined' || listenersInitialized) return;
  listenersInitialized = true;

  if (isNovoRunningStandalone()) {
    markPwaInstallComplete();
  }

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredPrompt = event as BeforeInstallPromptEventLike;
    notify();
  });

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    markPwaInstallComplete();
  });
}

/**
 * Triggers the native Chromium install UI.
 * Returns outcome, or null if no deferred prompt was available.
 */
export async function promptNovoInstall(): Promise<'accepted' | 'dismissed' | null> {
  if (!deferredPrompt) return null;
  const promptEvent = deferredPrompt;
  deferredPrompt = null;
  notify();
  await promptEvent.prompt();
  const { outcome } = await promptEvent.userChoice;
  if (outcome === 'accepted') {
    markPwaInstallComplete();
  }
  return outcome;
}

/** Subscribe to prompt availability / install-complete changes (for Setup Guide re-render). */
export function subscribePwaInstall(callback: () => void): () => void {
  subscribers.add(callback);
  return () => {
    subscribers.delete(callback);
  };
}
