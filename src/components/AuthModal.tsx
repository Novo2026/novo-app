import { useState } from 'react';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { pullRemoteToLocalStorage, pushLocalStorageToCloud } from '../services/cloudSync';

type AuthMode = 'login' | 'signup';
type AuthView = 'auth' | 'forgot' | 'forgot-success';

interface AuthModalProps {
  onAuthenticated: () => void;
}

const inputClassName =
  'w-full rounded-md border border-brand-gray-border px-3 py-2.5 text-brand-navy outline-none focus:border-brand-navy disabled:opacity-60';

const labelClassName = 'block text-xs font-medium text-brand-gray mb-1.5';

const primaryButtonClassName =
  'w-full flex items-center justify-center gap-2 rounded-lg bg-brand-orange hover:bg-brand-orange-dark text-white font-medium py-3 text-[13px] transition-colors disabled:opacity-60';

const PASSWORD_RESET_REDIRECT = 'https://novo.windmillmortgage.com';

export default function AuthModal({ onAuthenticated }: AuthModalProps) {
  const [mode, setMode] = useState<AuthMode>('login');
  const [view, setView] = useState<AuthView>('auth');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resetEmail, setResetEmail] = useState('');

  const ensureProfileRow = async (userId: string, userEmail: string | undefined) => {
    const { error: upsertError } = await supabase.from('users').upsert(
      { id: userId, email: userEmail ?? email.trim() },
      { onConflict: 'id' }
    );
    if (upsertError) throw upsertError;
  };

  const mergeCloudThenUpload = async (userId: string) => {
    await pullRemoteToLocalStorage(userId);
    await pushLocalStorageToCloud(userId);
  };

  const goToLogin = () => {
    setView('auth');
    setMode('login');
    setError(null);
    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const trimmed = email.trim();
    if (!trimmed || !password) {
      setError('Please enter your email and password.');
      return;
    }
    setLoading(true);
    try {
      if (mode === 'signup') {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email: trimmed,
          password,
        });
        if (signUpError) throw signUpError;
        const user = data.user;
        const session = data.session;
        if (!user) {
          setError('Could not create your account. Please try again.');
          return;
        }
        if (session?.user?.id) {
          await ensureProfileRow(session.user.id, session.user.email ?? trimmed);
          await mergeCloudThenUpload(session.user.id);
        }
        if (!session) {
          setError(
            'Check your email to confirm your account, then sign in. If confirmation is disabled, try logging in.'
          );
          setMode('login');
          return;
        }
      } else {
        const { data, error: signInError } = await supabase.auth.signInWithPassword({
          email: trimmed,
          password,
        });
        if (signInError) throw signInError;
        const user = data.user;
        if (!user) {
          setError('Sign-in failed. Please try again.');
          return;
        }
        await ensureProfileRow(user.id, user.email ?? trimmed);
        await mergeCloudThenUpload(user.id);
      }
      onAuthenticated();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Something went wrong.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const trimmed = email.trim();
    if (!trimmed) {
      setError('Please enter your email address.');
      return;
    }

    setLoading(true);
    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(trimmed, {
        redirectTo: PASSWORD_RESET_REDIRECT,
      });
      if (resetError) throw resetError;
      setResetEmail(trimmed);
      setView('forgot-success');
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const openForgotPassword = () => {
    setError(null);
    setView('forgot');
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4">
      <div
        className="w-full max-w-md bg-white shadow-2xl border border-brand-gray-border overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-modal-title"
      >
        <div className="bg-brand-navy px-6 py-5 text-center">
          <img src="/novo_primary.png" alt="NOVO" className="h-9 w-auto mx-auto" />
          {view === 'auth' && (
            <p id="auth-modal-title" className="text-white text-[13px] mt-3 leading-snug">
              Sign in to sync your NOVO data across devices.
            </p>
          )}
        </div>

        {view === 'auth' && (
          <form onSubmit={handleSubmit} className="px-6 py-6 space-y-4 bg-white">
            <div>
              <h2 className="text-base font-medium text-brand-navy mb-4">
                {mode === 'login' ? 'Welcome back' : 'Create your account'}
              </h2>
            </div>

            <div>
              <label htmlFor="auth-email" className={labelClassName}>
                Email
              </label>
              <input
                id="auth-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputClassName}
                disabled={loading}
              />
            </div>

            <div>
              <label htmlFor="auth-password" className={labelClassName}>
                Password
              </label>
              <input
                id="auth-password"
                type="password"
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={inputClassName}
                disabled={loading}
              />
              {mode === 'login' && (
                <div className="mt-2 text-right">
                  <button
                    type="button"
                    onClick={openForgotPassword}
                    className="text-xs text-brand-blue hover:underline cursor-pointer"
                    disabled={loading}
                  >
                    Forgot password?
                  </button>
                </div>
              )}
            </div>

            {error && <p className="text-xs text-brand-red">{error}</p>}

            <button type="submit" disabled={loading} className={primaryButtonClassName}>
              {loading && <Loader2 className="w-5 h-5 animate-spin" />}
              {mode === 'login' ? 'Log in' : 'Sign up'}
            </button>

            <p className="text-center text-xs text-brand-gray">
              {mode === 'login' ? (
                <>
                  Need an account?{' '}
                  <button
                    type="button"
                    className="text-brand-blue hover:underline"
                    onClick={() => {
                      setMode('signup');
                      setError(null);
                    }}
                    disabled={loading}
                  >
                    Sign up
                  </button>
                </>
              ) : (
                <>
                  Already have an account?{' '}
                  <button
                    type="button"
                    className="text-brand-blue hover:underline"
                    onClick={() => {
                      setMode('login');
                      setError(null);
                    }}
                    disabled={loading}
                  >
                    Log in
                  </button>
                </>
              )}
            </p>
          </form>
        )}

        {view === 'forgot' && (
          <form onSubmit={handleForgotSubmit} className="px-6 py-6 space-y-4 bg-white">
            <div>
              <h2 className="text-base font-medium text-brand-navy">Reset your password</h2>
              <p className="text-xs text-brand-gray mt-2">
                Enter your email address and we&apos;ll send you a reset link.
              </p>
            </div>

            <div>
              <label htmlFor="forgot-email" className={labelClassName}>
                Email
              </label>
              <input
                id="forgot-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputClassName}
                disabled={loading}
              />
            </div>

            {error && <p className="text-xs text-brand-red">{error}</p>}

            <button type="submit" disabled={loading} className={primaryButtonClassName}>
              {loading && <Loader2 className="w-5 h-5 animate-spin" />}
              Send Reset Link
            </button>

            <p className="text-center">
              <button
                type="button"
                onClick={goToLogin}
                className="text-xs text-brand-blue hover:underline"
                disabled={loading}
              >
                Back to login
              </button>
            </p>
          </form>
        )}

        {view === 'forgot-success' && (
          <div className="px-6 py-6 space-y-4 bg-white text-center">
            <CheckCircle2 className="w-6 h-6 text-brand-green mx-auto" aria-hidden />
            <h2 className="text-base font-medium text-brand-navy">Check your email</h2>
            <p className="text-xs text-brand-gray leading-relaxed">
              We sent a reset link to <span className="font-medium text-brand-navy">{resetEmail}</span>. Check your
              inbox and spam folder.
            </p>
            <p>
              <button
                type="button"
                onClick={goToLogin}
                className="text-xs text-brand-blue hover:underline"
              >
                Back to login
              </button>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
