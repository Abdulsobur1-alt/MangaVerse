'use client';

import { ProtectedRoute } from '@/components/ProtectedRoute';
import { TopBar } from '@/components/TopBar';
import Link from 'next/link';

const LISTS = [
  { name: 'Reading', count: 8 },
  { name: 'Plan to Read', count: 12 },
  { name: 'Completed', count: 5 },
  { name: 'On Hold', count: 3 },
  { name: 'Dropped', count: 1 },
];

const LIBRARY_ITEMS = [
  { slug: 'solo-leveling-ragnarok', title: 'Solo Leveling: Ragnarök', type: 'Manhwa', progress: 72, chapters: '44/62', color: '#2d1b69' },
  { slug: 'omniscient-reader', title: "Omniscient Reader's Viewpoint", type: 'Manhwa', progress: 45, chapters: '198/551', color: '#5e1b2d' },
  { slug: 'blue-lock', title: 'Blue Lock', type: 'Manga', progress: 88, chapters: '289/...', color: '#1b5e3d' },
  { slug: 'chainsaw-man', title: 'Chainsaw Man', type: 'Manga', progress: 60, chapters: '168/...', color: '#5e1b3a' },
];

export default function LibraryPage() {
  return (
    <ProtectedRoute>
      <main className="min-h-screen bg-mv-dark">
        <TopBar />
        <div className="mx-auto max-w-7xl p-6">
          <h1 className="mb-6 text-xl font-semibold text-white">My Library</h1>

          {/* List tabs */}
          <div className="mb-6 flex flex-wrap gap-2">
            {LISTS.map((list) => (
              <button
                key={list.name}
                className={`rounded-full px-4 py-1.5 text-xs transition-colors ${
                  list.name === 'Reading'
                    ? 'bg-mv-accent text-white'
                    : 'bg-mv-surface text-mv-text-secondary hover:bg-mv-border-light'
                }`}
              >
                {list.name}
                <span className="ml-1.5 text-[10px] opacity-70">({list.count})</span>
              </button>
            ))}
          </div>

          {/* Items */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {LIBRARY_ITEMS.map((item) => (
              <Link
                key={item.slug}
                href={`/title/${item.slug}`}
                className="group flex gap-4 rounded-xl border border-mv-border bg-mv-darker p-4 transition-all hover:border-mv-border-light hover:bg-mv-surface"
              >
                <div
                  className="h-20 w-14 flex-shrink-0 rounded-lg overflow-hidden"
                  style={{ background: item.color }}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-mv-text group-hover:text-mv-accent transition-colors line-clamp-2">
                    {item.title}
                  </p>
                  <p className="mt-0.5 text-[10px] text-mv-text-muted">{item.type}</p>
                  <div className="mt-2">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] text-mv-text-muted">{item.chapters}</span>
                      <span className="text-[10px] text-mv-accent">{item.progress}%</span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-mv-surface overflow-hidden">
                      <div
                        className="h-full rounded-full bg-mv-accent transition-all duration-500"
                        style={{ width: `${item.progress}%` }}
                      />
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>

          {LIBRARY_ITEMS.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16">
              <svg className="mb-4 h-12 w-12 text-mv-text-dim" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
              </svg>
              <p className="text-sm text-mv-text-muted">Your library is empty</p>
              <Link
                href="/browse"
                className="mt-3 rounded-md bg-mv-accent px-4 py-2 text-xs font-medium text-white hover:bg-red-500 transition-colors"
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
