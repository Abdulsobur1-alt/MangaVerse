'use client';

import Link from 'next/link';
import { useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { useMyReviews, useDeleteReview } from '@/lib/hooks/useReviews';

const TYPE_ICONS: Record<string, string> = {
  MANGA: '📖',
  MANHWA: '🇰🇷',
  MANHUA: '🇨🇳',
  LIGHT_NOVEL: '📕',
  WEBTOON: '📱',
};

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function MyReviewsPage() {
  const { data: reviews, isLoading } = useMyReviews();
  const deleteReview = useDeleteReview();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await deleteReview.mutateAsync(id);
    } catch {
      // Silently fail
    }
    setDeletingId(null);
  };

  return (
    <ProtectedRoute>
      <AppShell>
        <div className="mx-auto max-w-4xl px-5 py-8 sm:px-6 md:px-8">
          <div className="mb-8 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="eyebrow mb-2">Your Voice</p>
              <h1 className="text-3xl font-bold tracking-tight text-white md:text-4xl">
                My <span className="text-gradient">Reviews</span>
              </h1>
              <p className="mt-1 text-xs text-mv-text-muted">
                {reviews?.length || 0} review{reviews?.length !== 1 ? 's' : ''} written
              </p>
            </div>
            <Link href="/browse" className="btn-ghost px-5 py-2.5 text-xs">
              Browse & Review
            </Link>
          </div>

          {isLoading ? (
            <div className="space-y-3 animate-pulse">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="rounded-xl bg-mv-darker border border-mv-border p-5">
                  <div className="h-4 w-48 rounded bg-mv-surface mb-3" />
                  <div className="h-3 w-full rounded bg-mv-surface mb-2" />
                  <div className="h-3 w-3/4 rounded bg-mv-surface" />
                </div>
              ))}
            </div>
          ) : !reviews || reviews.length === 0 ? (
            <div className="rounded-xl border border-mv-border bg-mv-darker p-12 text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-mv-surface">
                <svg className="h-7 w-7 text-mv-text-dim" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                </svg>
              </div>
              <h3 className="text-sm font-medium text-mv-text mb-1">No reviews yet</h3>
              <p className="text-xs text-mv-text-muted mb-4">
                You haven&apos;t written any reviews. Start reviewing titles you&apos;ve read!
              </p>
              <Link
                href="/browse"
                className="btn-primary px-5 py-2.5 text-xs"
              >
                Browse Titles
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {reviews.map((review) => (
                <div
                  key={review.id}
                  className="rounded-xl border border-mv-border bg-mv-darker p-5 transition-all hover:border-mv-border-light"
                >
                  <div className="flex items-start justify-between mb-3">
                    <Link
                      href={`/title/${review.title.slug}`}
                      className="flex items-center gap-3 group"
                    >
                      <div className="flex h-10 w-8 items-center justify-center rounded bg-mv-surface text-xs">
                        {TYPE_ICONS[review.title.type] || '📖'}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-white group-hover:text-mv-accent transition-colors">
                          {review.title.title}
                        </p>
                        <p className="text-[9px] text-mv-text-dim">{review.title.type}</p>
                      </div>
                    </Link>
                    <div className="flex items-center gap-1">
                      <div className="flex gap-0.5">
                        {Array.from({ length: 10 }, (_, i) => i + 1).map((r) => (
                          <span
                            key={r}
                            className={`text-[9px] ${r <= review.rating ? 'text-mv-gold' : 'text-mv-text-dim'}`}
                          >
                            ★
                          </span>
                        ))}
                      </div>
                      <span className="ml-1 text-xs font-bold text-mv-gold">{review.rating}</span>
                    </div>
                  </div>

                  {review.headline && (
                    <h3 className="mb-1 text-sm font-semibold text-white">{review.headline}</h3>
                  )}

                  {review.body && (
                    <p className="text-xs text-mv-text-secondary leading-relaxed mb-3 line-clamp-3">{review.body}</p>
                  )}

                  {review.spoiler && (
                    <span className="mb-2 inline-flex items-center gap-1 rounded-full border border-mv-warning/30 bg-mv-warning/10 px-2 py-0.5 text-[8px] font-medium text-mv-warning">
                      <svg className="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                      </svg>
                      Contains spoilers
                    </span>
                  )}

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 text-[9px] text-mv-text-dim">
                      <span>{formatDate(review.createdAt)}</span>
                      <span>·</span>
                      <span className="flex items-center gap-1">
                        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" />
                        </svg>
                        {review.helpfulCount}
                      </span>
                    </div>
                    <button
                      onClick={() => handleDelete(review.id)}
                      disabled={deletingId === review.id}
                      className="rounded-md border border-red-900/30 px-2.5 py-1 text-[9px] text-red-400/70 transition-colors hover:bg-red-900/20 hover:text-red-400 disabled:opacity-50"
                    >
                      {deletingId === review.id ? 'Deleting...' : 'Delete'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </AppShell>
    </ProtectedRoute>
  );
}
