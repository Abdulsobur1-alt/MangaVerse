'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { TopBar } from '@/components/TopBar';
import { useTitle } from '@/lib/hooks/useTitles';
import { useAddBookmark, useRemoveBookmark } from '@/lib/hooks/useLibrary';
import { useAuthStore } from '@/store/authStore';
import { formatLabel } from '@mangaverse/shared';

export default function TitleDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const { data: title, isLoading, error } = useTitle(slug);
  const { token } = useAuthStore();
  const addBookmark = useAddBookmark();
  const removeBookmark = useRemoveBookmark();
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [bookmarkLoading, setBookmarkLoading] = useState(false);

  // Check if already bookmarked (from localStorage cache)
  useEffect(() => {
    if (title && token) {
      const cached = localStorage.getItem(`bookmark_${title.id}`);
      if (cached === 'true') setIsBookmarked(true);
    }
  }, [title, token]);

  const handleBookmark = async () => {
    if (!title || !token) return;
    setBookmarkLoading(true);
    try {
      if (isBookmarked) {
        await removeBookmark.mutateAsync(title.id);
        setIsBookmarked(false);
        localStorage.setItem(`bookmark_${title.id}`, 'false');
      } else {
        await addBookmark.mutateAsync({ titleId: title.id, listName: 'Reading' });
        setIsBookmarked(true);
        localStorage.setItem(`bookmark_${title.id}`, 'true');
      }
    } catch {
      // Silently fail — user can retry
    }
    setBookmarkLoading(false);
  };

  if (isLoading) {
    return (
      <main className="min-h-screen bg-mv-dark">
        <TopBar />
        <div className="mx-auto max-w-5xl p-6 animate-pulse">
          <div className="flex gap-8">
            <div className="h-[400px] w-[280px] rounded-lg bg-mv-surface flex-shrink-0" />
            <div className="flex-1 space-y-4">
              <div className="h-8 w-3/4 rounded bg-mv-surface" />
              <div className="h-4 w-1/2 rounded bg-mv-surface" />
              <div className="h-20 rounded bg-mv-surface" />
            </div>
          </div>
        </div>
      </main>
    );
  }

  if (error || !title) {
    return (
      <main className="min-h-screen bg-mv-dark">
        <TopBar />
        <div className="mx-auto max-w-5xl p-6 text-center">
          <p className="text-mv-text-muted">Title not found</p>
          <Link href="/browse" className="mt-4 inline-block text-sm text-mv-accent hover:underline">Browse titles</Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-mv-dark">
      <TopBar />

      <div className="mx-auto max-w-5xl p-6">
        {/* Back link */}
        <Link href="/browse" className="mb-6 inline-flex items-center gap-1 text-xs text-mv-text-muted hover:text-mv-text transition-colors">
          ← Back to Browse
        </Link>

        <div className="flex flex-col gap-8 md:flex-row">
          {/* Cover */}
          <div className="w-full md:w-[280px] flex-shrink-0">
            <div className="aspect-[3/4] w-full rounded-xl bg-gradient-to-br from-mv-darker to-mv-surface flex items-center justify-center shadow-lg">
              <span className="text-sm text-mv-text-muted text-center px-4">{title.title}</span>
            </div>

            {/* Quick Actions */}
            <div className="mt-4 flex gap-2">
              <Link
                href={title.chapters?.[0] ? `/reader/${title.chapters[0].id}` : '#'}
                className={`flex-1 rounded-lg bg-mv-accent py-2.5 text-xs font-medium text-white transition-colors hover:bg-red-500 text-center ${
                  !title.chapters?.[0] ? 'opacity-50 pointer-events-none' : ''
                }`}
              >
                {title.chapters?.[0] ? 'Start Reading' : 'No Chapters'}
              </Link>
              <button
                onClick={handleBookmark}
                disabled={bookmarkLoading || !token}
                className={`rounded-lg border px-4 py-2.5 text-xs font-medium transition-colors ${
                  isBookmarked
                    ? 'border-mv-accent bg-mv-accent/20 text-mv-accent'
                    : 'border-mv-border-light bg-mv-surface text-mv-text-secondary hover:border-mv-accent hover:text-mv-accent'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {bookmarkLoading ? '...' : isBookmarked ? '✓ In Library' : '+ Library'}
              </button>
            </div>
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold text-white">{title.title}</h1>
            {title.alternativeTitles && (
              <p className="mt-1 text-xs text-mv-text-muted">{title.alternativeTitles}</p>
            )}

            {/* Meta Tags */}
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className="rounded-md bg-mv-accent/20 px-2.5 py-1 text-[10px] font-medium text-mv-accent">
                {formatLabel(title.type as any)}
              </span>
              <span className={`rounded-md px-2.5 py-1 text-[10px] font-medium ${
                title.status === 'ongoing' ? 'bg-green-900/30 text-green-400' :
                title.status === 'completed' ? 'bg-blue-900/30 text-blue-400' :
                'bg-yellow-900/30 text-yellow-400'
              }`}>
                {title.status.charAt(0).toUpperCase() + title.status.slice(1)}
              </span>
              {title.rating && (
                <span className="rounded-md bg-mv-gold/10 px-2.5 py-1 text-[10px] font-medium text-mv-gold">
                  ⭐ {title.rating.toFixed(1)}
                </span>
              )}
              <span className="rounded-md bg-mv-surface px-2.5 py-1 text-[10px] text-mv-text-muted">
                {title._count?.chapters || 0} chapters
              </span>
            </div>

            {/* Genre Tags */}
            <div className="mt-3 flex flex-wrap gap-1.5">
              {title.genres?.map((genre) => (
                <Link
                  key={genre}
                  href={`/browse?genre=${genre}`}
                  className="rounded-full border border-mv-border-light bg-mv-surface px-3 py-1 text-[10px] text-mv-text-secondary transition-colors hover:border-mv-accent hover:text-mv-accent"
                >
                  {genre.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                </Link>
              ))}
            </div>

            {/* Author / Artist */}
            <div className="mt-4 flex gap-6 text-xs text-mv-text-muted">
              {title.author && <p>Author: <span className="text-mv-text-secondary">{title.author}</span></p>}
              {title.artist && <p>Artist: <span className="text-mv-text-secondary">{title.artist}</span></p>}
              {title.releaseYear && <p>Year: <span className="text-mv-text-secondary">{title.releaseYear}</span></p>}
            </div>

            {/* Synopsis */}
            {title.synopsis && (
              <div className="mt-5">
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-mv-text-muted">Synopsis</h3>
                <p className="text-sm leading-relaxed text-mv-text-secondary">{title.synopsis}</p>
              </div>
            )}
          </div>
        </div>

        {/* Chapters List */}
        <div className="mt-10">
          <h2 className="mb-4 text-base font-medium text-white">Chapters</h2>
          {title.chapters && title.chapters.length > 0 ? (
            <div className="space-y-0.5">
              {title.chapters.map((ch) => (
                <Link
                  key={ch.id}
                  href={`/reader/${ch.id}`}
                  className="flex items-center justify-between rounded-lg px-4 py-3 transition-colors hover:bg-mv-surface group"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-mv-text group-hover:text-white transition-colors">
                      Ch. {ch.number}
                    </span>
                    {ch.title && (
                      <span className="text-xs text-mv-text-muted">{ch.title}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-mv-text-dim">
                    <span>{ch.pageCount || '?'} pages</span>
                    {ch.createdAt && (
                      <span>{new Date(ch.createdAt).toLocaleDateString()}</span>
                    )}
                    <svg className="h-4 w-4 text-mv-text-dim" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-sm text-mv-text-muted">No chapters available yet</p>
          )}
        </div>
      </div>
    </main>
  );
}
