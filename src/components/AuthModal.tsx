import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { pullRemoteToLocalStorage, pushLocalStorageToCloud } from '../services/cloudSync';

interface AuthModalProps {
  onAuthenticated: () => void;
}

export default function AuthModal({ onAuthenticated }: AuthModalProps) {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4">
      <div
        className="w-full max-w-md rounded-2xl bg-white shadow-2xl border border-gray-100 overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-modal-title"
      >
        <div className="bg-[#1E3A5F] px-6 py-5 text-white">
          <img src="/novo_primary.png" alt="NOVO" className="h-9 w-auto mb-3" />
          <h1 id="auth-modal-title" className="text-xl font-bold">
            {mode === 'login' ? 'Welcome back' : 'Create your account'}
          </h1>
          <p className="text-sm text-blue-100 mt-1">
            Sign in to sync your NOVO data across devices.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-6 space-y-4">
          <div>
            <label htmlFor="auth-email" className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <input
              id="auth-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-gray-900 focus:ring-2 focus:ring-[#FF6B35] focus:border-[#FF6B35] outline-none"
              disabled={loading}
            />
          </div>
          <div>
            <label htmlFor="auth-password" className="block text-sm font-medium text-gray-700 mb-1">
              Password
            </label>
            <input
              id="auth-password"
              type="password"
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-gray-900 focus:ring-2 focus:ring-[#FF6B35] focus:border-[#FF6B35] outline-none"
              disabled={loading}
            />
          </div>

          {error && (
            <div className="rounded-lg bg-red-50 text-red-800 text-sm px-3 py-2 border border-red-100">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 rounded-lg bg-[#FF6B35] hover:bg-[#e85a28] text-white font-semibold py-3 transition-colors disabled:opacity-60"
          >
            {loading && <Loader2 className="w-5 h-5 animate-spin" />}
            {mode === 'login' ? 'Log in' : 'Sign up'}
          </button>

          <p className="text-center text-sm text-gray-600">
            {mode === 'login' ? (
              <>
                Need an account?{' '}
                <button
                  type="button"
                  className="text-[#1E3A5F] font-semibold hover:underline"
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
                  className="text-[#1E3A5F] font-semibold hover:underline"
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
      </div>
    </div>
  );
}
