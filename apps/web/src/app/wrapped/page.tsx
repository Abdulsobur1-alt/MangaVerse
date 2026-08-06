'use client';

import Link from 'next/link';
import { useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { WrappedCard } from '@/components/profile/WrappedCard';
import { useAuthStore } from '@/store/authStore';
import { useWrapped, useGenerateWrapped } from '@/lib/hooks/useIdentity';

/* ═══════════════════════════════════════════════════════════════
   Wrapped — the annual "MangaVerse Wrapped" (Phase 9).
   A shareable year-in-review: hours read, pages turned, top series,
   reading mood, badges, growth. Generated once per year and cached.
   ═══════════════════════════════════════════════════════════════ */

export default function WrappedPage() {
  const { user } = useAuthStore();
  const year = new Date().getFullYear();
  const { data: report, isLoading } = useWrapped(year);
  const generate = useGenerateWrapped();
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    setError(null);
    try {
      await generate.mutateAsync(year);
    } catch {
      setError('Could not generate your Wrapped right now — try again in a moment.');
    }
  };

  return (
    <ProtectedRoute>
      <AppShell>
        <div className="mx-auto max-w-4xl px-5 py-8 sm:px-6 md:px-8">
          <header className="mb-8 text-center">
            <p className="eyebrow mb-2">Your year in stories</p>
            <h1 className="text-3xl font-bold tracking-tight text-white md:text-4xl">
              <span className="text-gradient">MangaVerse Wrapped</span>
            </h1>
            <p className="mx-auto mt-2 max-w-md text-xs text-mv-text-muted">
              Every page you turned in {year}, gathered into one shareable story.
            </p>
          </header>

          {isLoading ? (
            <div className="space-y-4">
              <div className="skeleton h-64 rounded-3xl" />
              <div className="skeleton h-40 rounded-3xl" />
            </div>
          ) : report ? (
            <WrappedCard data={report} username={user?.displayName} />
          ) : (
            <div className="relative overflow-hidden rounded-3xl border border-mv-border bg-mv-darker p-10 text-center md:p-16">
              <div className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-mv-purple/15 blur-3xl" aria-hidden="true" />
              <div className="pointer-events-none absolute -bottom-24 left-1/4 h-48 w-48 rounded-full bg-mv-accent/10 blur-3xl" aria-hidden="true" />
              <div className="relative">
                <span className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-mv-purple to-mv-accent text-4xl shadow-glow-sm" aria-hidden="true">
                  🎁
                </span>
                <h2 className="mt-6 text-xl font-bold text-white">Your {year} Wrapped is ready to be written</h2>
                <p className="mx-auto mt-2 max-w-md text-xs leading-relaxed text-mv-text-muted">
                  We'll gather every chapter, page, streak, and badge from {year} into a beautiful, shareable snapshot.
                </p>
                <button
                  onClick={handleGenerate}
                  disabled={generate.isPending}
                  className="btn-primary mt-7 px-6 py-3 text-xs disabled:opacity-50"
                >
                  {generate.isPending ? 'Crunching your year…' : `Generate my ${year} Wrapped`}
                </button>
                {error && <p className="mt-3 text-[10px] text-mv-danger">{error}</p>}
                <p className="mt-6 text-[9px] text-mv-text-dim">
                  Wrapped is generated once per year and can be revisited anytime. <Link href="/dashboard" className="text-mv-violet hover:underline">← Back to dashboard</Link>
                </p>
              </div>
            </div>
          )}
        </div>
      </AppShell>
    </ProtectedRoute>
  );
}
