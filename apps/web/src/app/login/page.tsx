'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/store/authStore';
import { supabaseResetPassword, supabaseAuthConfigured } from '@/lib/supabaseClient';

export default function LoginPage() {
  const router = useRouter();
  const { login, isLoading } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  // Password reset (Supabase-backed). Hidden in dev mode — there is no
  // provider to send the reset email through.
  const [showReset, setShowReset] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetError, setResetError] = useState('');
  const [resetSent, setResetSent] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email || !password) {
      setError('Please fill in all fields');
      return;
    }

    try {
      await login(email, password);
      router.push('/');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Login failed. Please try again.');
    }
  };

  const handleResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetError('');
    setResetSent(false);

    if (!resetEmail) {
      setResetError('Enter your account email');
      return;
    }

    try {
      setIsResetting(true);
      await supabaseResetPassword(resetEmail);
      setResetSent(true);
    } catch (err: unknown) {
      setResetError(err instanceof Error ? err.message : 'Could not send the reset link. Please try again.');
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-mv-dark p-6">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="mb-8 text-center">
          <Link href="/" className="text-2xl font-bold tracking-tight text-mv-accent">
            Manga<span className="text-mv-purple">Verse</span>
          </Link>
          <p className="mt-2 text-sm text-mv-text-secondary">Welcome back, reader</p>
        </div>

        {/* Card */}
        <div className="rounded-xl border border-mv-border bg-mv-darker p-6">
          <h1 className="mb-6 text-lg font-semibold text-white">Sign In</h1>

          {error && (
            <div className="mb-4 rounded-lg bg-red-900/30 border border-red-800/40 px-4 py-3 text-xs text-red-400">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="mb-1 block text-[11px] font-medium text-mv-text-secondary">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full rounded-lg border border-mv-border-light bg-mv-surface px-4 py-2.5 text-sm text-mv-text outline-none transition-colors placeholder:text-mv-text-dim focus:border-mv-accent/50"
                autoComplete="email"
              />
            </div>

            <div>
              <div className="mb-1 flex items-center justify-between">
                <label htmlFor="password" className="block text-[11px] font-medium text-mv-text-secondary">
                  Password
                </label>
                {supabaseAuthConfigured() && (
                  <button
                    type="button"
                    onClick={() => {
                      setShowReset((v) => !v);
                      setResetError('');
                      setResetSent(false);
                    }}
                    className="text-[11px] text-mv-text-muted transition-colors hover:text-mv-accent"
                  >
                    Forgot password?
                  </button>
                )}
              </div>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-lg border border-mv-border-light bg-mv-surface px-4 py-2.5 text-sm text-mv-text outline-none transition-colors placeholder:text-mv-text-dim focus:border-mv-accent/50"
                autoComplete="current-password"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full rounded-lg bg-mv-accent py-2.5 text-sm font-medium text-white transition-all hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          {/* Password reset panel — intentionally OUTSIDE the main form:
              a nested <form> is invalid HTML (the parser drops the inner
              tag and the stray </form> closes the outer one, breaking the
              Sign In button). */}
          {showReset && supabaseAuthConfigured() && (
            <div className="mt-4 rounded-lg border border-mv-border bg-mv-surface/50 p-4">
              {resetSent ? (
                <p className="text-xs text-mv-text-secondary">
                  If an account exists for <span className="text-mv-text">{resetEmail}</span>, a
                  reset link is on its way. Check your inbox (and spam folder).
                </p>
              ) : (
                <form onSubmit={handleResetSubmit} className="space-y-3">
                  <p className="text-xs text-mv-text-secondary">
                    Enter your email and we&apos;ll send a link to reset your password.
                  </p>
                  {resetError && (
                    <p className="rounded-md bg-red-900/30 border border-red-800/40 px-3 py-2 text-[11px] text-red-400">
                      {resetError}
                    </p>
                  )}
                  <input
                    type="email"
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full rounded-lg border border-mv-border-light bg-mv-surface px-3 py-2 text-sm text-mv-text outline-none transition-colors placeholder:text-mv-text-dim focus:border-mv-accent/50"
                    autoComplete="email"
                  />
                  <button
                    type="submit"
                    disabled={isResetting}
                    className="w-full rounded-lg border border-mv-accent/40 py-2 text-xs font-medium text-mv-accent transition-all hover:bg-mv-accent/10 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isResetting ? 'Sending…' : 'Send reset link'}
                  </button>
                </form>
              )}
            </div>
          )}

          <div className="mt-6 text-center">
            <p className="text-xs text-mv-text-muted">
              Don&apos;t have an account?{' '}
              <Link href="/signup" className="text-mv-accent hover:underline">
                Sign up
              </Link>
            </p>
          </div>
        </div>

        <p className="mt-4 text-center text-[10px] text-mv-text-dim">
          {process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
            ? 'Secure sign-in powered by Supabase'
            : process.env.NODE_ENV === 'production'
              ? 'Sign-ups are disabled in this deployment — the auth provider is not configured'
              : 'Dev mode: enter any email to sign in (first registered user)'}
        </p>
      </div>
    </main>
  );
}
