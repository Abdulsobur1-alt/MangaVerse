'use client';

import { useState } from 'react';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { TopBar } from '@/components/TopBar';
import Link from 'next/link';
import { useLibrary, useRemoveBookmark, type BookmarkItem } from '@/lib/hooks/useLibrary';
import { useReadingProgress } from '@/lib/hooks/useReading';

const LIST_NAMES = ['Reading', 'Plan to Read', 'Completed', 'On Hold', 'Dropped'];

function getProgressPercent(titleId: string, progress: Record<string, { chaptersRead: number; totalChapters: number; completed: boolean }>): number {
  const p = progress[titleId];
  if (!p || p.totalChapters === 0) return 0;
  return Math.min(Math.round((p.chaptersRead / p.totalChapters) * 100), 100);
}

export default function LibraryPage() {
  const [activeList, setActiveList] = useState('Reading');
  const { data: libraryData, isLoading } = useLibrary();
  const { data: readingData } = useReadingProgress();
  const removeBookmark = useRemoveBookmark();
  const [removing, setRemoving] = useState<string | null>(null);

  // Build a progress lookup from reading data
  const progressMap: Record<string, { chaptersRead: number; totalChapters: number; completed: boolean }> = {};
  if (readingData) {
    const data = readingData as { chapter: { id: string; number: number; series: { id: string; slug: string } }; pageNumber: number; completed: boolean }[];
    data.forEach((entry: { chapter: { id: string; number: number; series: { id: string; slug: string } }; pageNumber: number; completed: boolean }) => {
      const titleId = entry.chapter.series.id;
      if (!progressMap[titleId]) {
        progressMap[titleId] = { chaptersRead: 0, totalChapters: 0, completed: false };
      }
      progressMap[titleId].chaptersRead = Math.max(progressMap[titleId].chaptersRead, entry.chapter.number);
      if (entry.completed) progressMap[titleId].completed = true;
    });
  }

  const items: BookmarkItem[] = libraryData?.items || [];
  const filtered = activeList === 'Reading'
    ? items
    : items.filter((b: BookmarkItem) => b.listName === activeList);

  const handleRemove = async (titleId: string) => {
    setRemoving(titleId);
    try {
      await removeBookmark.mutateAsync(titleId);
    } catch {
      // Error handled silently
    }
    setRemoving(null);
  };

  // Count items per list
  const counts: Record<string, number> = {};
  items.forEach((b: BookmarkItem) => { counts[b.listName] = (counts[b.listName] || 0) + 1; });

  return (
    <ProtectedRoute>
      <main className="min-h-screen bg-mv-dark">
        <TopBar />
        <div className="mx-auto max-w-7xl p-6">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-xl font-semibold text-white">My Library</h1>
            {!isLoading && <span className="text-xs text-mv-text-muted">{libraryData?.total || 0} titles</span>}
          </div>

          {/* List tabs */}
          <div className="mb-6 flex flex-wrap gap-2">
            <button
              onClick={() => setActiveList('Reading')}
              className={`rounded-full px-4 py-1.5 text-xs transition-colors ${
                activeList === 'Reading'
                  ? 'bg-mv-accent text-white'
                  : 'bg-mv-surface text-mv-text-secondary hover:bg-mv-border-light'
              }`}
            >
              All
              <span className="ml-1.5 text-[10px] opacity-70">({items.length})</span>
            </button>
            {LIST_NAMES.map((name) => {
              const c = counts[name] || 0;
              if (c === 0) return null;
              return (
                <button
                  key={name}
                  onClick={() => setActiveList(name)}
                  className={`rounded-full px-4 py-1.5 text-xs transition-colors ${
                    activeList === name
                      ? 'bg-mv-accent text-white'
                      : 'bg-mv-surface text-mv-text-secondary hover:bg-mv-border-light'
                  }`}
                >
                  {name}
                  <span className="ml-1.5 text-[10px] opacity-70">({c})</span>
                </button>
              );
            })}
          </div>

          {/* Loading */}
          {isLoading && (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="animate-pulse flex gap-4 rounded-xl border border-mv-border bg-mv-darker p-4">
                  <div className="h-20 w-14 rounded-lg bg-mv-surface flex-shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-3/4 rounded bg-mv-surface" />
                    <div className="h-3 w-1/2 rounded bg-mv-surface" />
                    <div className="h-2 w-full rounded bg-mv-surface" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Items */}
          {!isLoading && (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((bookmark: BookmarkItem) => {
                const progress = getProgressPercent(bookmark.titleId, progressMap);
                const isBookmarkProcessing = removing === bookmark.titleId;
                return (
                  <div
                    key={bookmark.id}
                    className={`group flex gap-4 rounded-xl border border-mv-border bg-mv-darker p-4 transition-all hover:border-mv-border-light hover:bg-mv-surface ${isBookmarkProcessing ? 'opacity-50' : ''}`}
                  >
                    <Link href={`/title/${bookmark.title.slug}`} className="flex gap-4 flex-1 min-w-0">
                      <div
                        className="h-20 w-14 flex-shrink-0 rounded-lg overflow-hidden bg-mv-surface"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-mv-text group-hover:text-mv-accent transition-colors line-clamp-2">
                          {bookmark.title.title}
                        </p>
                        <p className="mt-0.5 text-[10px] text-mv-text-muted">
                          {bookmark.title.type} · {bookmark.listName}
                        </p>
                        <div className="mt-2">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[10px] text-mv-text-muted">{progress}% complete</span>
                          </div>
                          <div className="h-1.5 w-full rounded-full bg-mv-surface overflow-hidden">
                            <div
                              className="h-full rounded-full bg-mv-accent transition-all duration-500"
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    </Link>
                    <button
                      onClick={() => handleRemove(bookmark.titleId)}
                      className="self-start text-mv-text-dim hover:text-mv-accent transition-colors p-1"
                      title="Remove from library"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* Empty state */}
          {!isLoading && filtered.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16">
              <svg className="mb-4 h-12 w-12 text-mv-text-dim" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
              </svg>
              <p className="text-sm text-mv-text-muted mb-1">
                {activeList === 'Reading' ? 'Your library is empty' : `No titles in "${activeList}"`}
              </p>
              <p className="text-xs text-mv-text-muted mb-4">Start exploring and add titles to your library</p>
              <Link
                href="/browse"
                className="rounded-md bg-mv-accent px-4 py-2 text-xs font-medium text-white hover:bg-red-500 transition-colors"
              >
                Browse Manga
              </Link>
            </div>
          )}
        </div>
      </main>
    </ProtectedRoute>
  );
}
