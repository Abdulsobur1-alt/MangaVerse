'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/store/authStore';

export default function SignupPage() {
  const router = useRouter();
  const { register, isLoading } = useAuthStore();
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!displayName || !email || !password || !confirmPassword) {
      setError('Please fill in all fields');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    try {
      await register(email, password, displayName);
      router.push('/');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Registration failed. Please try again.');
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
          <p className="mt-2 text-sm text-mv-text-secondary">Start your reading journey</p>
        </div>

        {/* Card */}
        <div className="rounded-xl border border-mv-border bg-mv-darker p-6">
          <h1 className="mb-6 text-lg font-semibold text-white">Create Account</h1>

          {error && (
            <div className="mb-4 rounded-lg bg-red-900/30 border border-red-800/40 px-4 py-3 text-xs text-red-400">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="displayName" className="mb-1 block text-[11px] font-medium text-mv-text-secondary">
                Display Name
              </label>
              <input
                id="displayName"
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="ReaderOne"
                className="w-full rounded-lg border border-mv-border-light bg-mv-surface px-4 py-2.5 text-sm text-mv-text outline-none transition-colors placeholder:text-mv-text-dim focus:border-mv-accent/50"
                autoComplete="name"
              />
            </div>

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
              <label htmlFor="password" className="mb-1 block text-[11px] font-medium text-mv-text-secondary">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 8 characters"
                className="w-full rounded-lg border border-mv-border-light bg-mv-surface px-4 py-2.5 text-sm text-mv-text outline-none transition-colors placeholder:text-mv-text-dim focus:border-mv-accent/50"
                autoComplete="new-password"
              />
            </div>

            <div>
              <label htmlFor="confirmPassword" className="mb-1 block text-[11px] font-medium text-mv-text-secondary">
                Confirm Password
              </label>
              <input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-lg border border-mv-border-light bg-mv-surface px-4 py-2.5 text-sm text-mv-text outline-none transition-colors placeholder:text-mv-text-dim focus:border-mv-accent/50"
                autoComplete="new-password"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full rounded-lg bg-mv-accent py-2.5 text-sm font-medium text-white transition-all hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Creating account...' : 'Create Account'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-xs text-mv-text-muted">
              Already have an account?{' '}
              <Link href="/login" className="text-mv-accent hover:underline">
                Sign in
              </Link>
            </p>
          </div>
        </div>

        <p className="mt-4 text-center text-[10px] text-mv-text-dim">
          By signing up, you agree to our Terms of Service
        </p>
      </div>
    </main>
  );
}
