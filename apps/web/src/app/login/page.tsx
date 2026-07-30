'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/store/authStore';

export default function LoginPage() {
  const router = useRouter();
  const { login, isLoading } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

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
              <label htmlFor="password" className="mb-1 block text-[11px] font-medium text-mv-text-secondary">
                Password
              </label>
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
              className="w-full rounded-lg bg-mv-accent py-2.5 text-sm font-medium text-white transition-all hover:bg-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-xs text-mv-text-muted">
              Don&apos;t have an account?{' '}
              <Link href="/signup" className="text-mv-accent hover:underline">
                Sign up
              </Link>
            </p>
          </div>
        </div>

        {/* Dev hint */}
        <p className="mt-4 text-center text-[10px] text-mv-text-dim">
          Dev mode: enter any email to sign in (first registered user)
        </p>
      </div>
    </main>
  );
}
