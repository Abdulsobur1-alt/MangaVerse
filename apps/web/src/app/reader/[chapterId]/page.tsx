'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { TopBar } from '@/components/TopBar';
import { useChapter } from '@/lib/hooks/useChapters';

export default function ReaderPage() {
  const { chapterId } = useParams<{ chapterId: string }>();
  const { data: chapter, isLoading, error } = useChapter(chapterId);

  if (isLoading) {
    return (
      <main className="min-h-screen bg-black">
        <TopBar />
        <div className="flex items-center justify-center h-[80vh]">
          <p className="text-mv-text-muted animate-pulse">Loading chapter...</p>
        </div>
      </main>
    );
  }

  if (error || !chapter) {
    return (
      <main className="min-h-screen bg-black">
        <TopBar />
        <div className="flex items-center justify-center h-[80vh]">
          <div className="text-center">
            <p className="text-mv-text-muted">Chapter not found</p>
            <Link href="/browse" className="mt-4 inline-block text-sm text-mv-accent hover:underline">Browse titles</Link>
          </div>
        </div>
      </main>
    );
  }

  // Generate mock page placeholders for the reading experience
  const pageCount = chapter.pageCount || 12;

  return (
    <main className="min-h-screen bg-black flex flex-col">
      {/* Reader Top Bar */}
      <div className="flex h-10 items-center border-b border-mv-border bg-mv-darker px-4 gap-3 flex-shrink-0">
        <Link href={`/title/${chapter.series.slug}`} className="text-xs text-mv-text-muted hover:text-mv-text transition-colors">
          ← {chapter.series.title}
        </Link>
        <span className="text-xs text-mv-text-dim">Ch. {chapter.number}</span>
        {chapter.title && <span className="text-xs text-mv-text-muted">— {chapter.title}</span>}
        <div className="ml-auto flex gap-2">
          <button className="rounded border border-mv-border-light bg-mv-surface px-2.5 py-1 text-[10px] text-mv-text-secondary hover:text-mv-text transition-colors">Night</button>
          <button className="rounded border border-mv-border-light bg-mv-surface px-2.5 py-1 text-[10px] text-mv-text-secondary hover:text-mv-text transition-colors">Zoom</button>
        </div>
      </div>

      {/* Reader Canvas */}
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto flex max-w-[700px] flex-col">
          {Array.from({ length: Math.min(pageCount, 8) }).map((_, i) => (
            <div key={i} className="w-full">
              <div
                className="flex h-[260px] items-center justify-center border-b border-mv-border/30"
                style={{ background: i % 2 === 0 ? '#0d0d14' : '#0a0a10' }}
              >
                <p className="text-xs text-mv-text-dim">
                  [Page {i + 1} — {['Full splash', 'Dialogue scene', 'Action panel', 'Close-up', 'Wide shot', 'Text page', 'Transition', 'Cliffhanger'][i] || 'Manga page'}]
                </p>
              </div>
            </div>
          ))}
          {/* Show remaining as placeholder */}
          {pageCount > 8 && (
            <div className="flex h-[200px] items-center justify-center">
              <p className="text-xs text-mv-text-dim">+ {pageCount - 8} more pages</p>
            </div>
          )}
        </div>
      </div>

      {/* Reader Bottom Bar */}
      <div className="flex h-10 items-center border-t border-mv-border bg-mv-darker px-4 gap-3 flex-shrink-0">
        <button className="rounded border border-mv-border-light bg-mv-surface px-3 py-1 text-[10px] text-mv-text-secondary hover:text-white transition-colors">
          ← Prev
        </button>
        <span className="text-[10px] text-mv-text-muted">Page 1 / {pageCount}</span>
        <div className="flex-1 h-1 bg-mv-surface rounded-full overflow-hidden">
          <div className="h-full w-[12%] rounded-full bg-mv-accent" />
        </div>
        <span className="text-[10px] text-mv-text-muted">Ch. {chapter.number}</span>
        <button className="rounded border border-mv-border-light bg-mv-surface px-3 py-1 text-[10px] text-mv-text-secondary hover:text-white transition-colors">
          Next →
        </button>
      </div>
    </main>
  );
}
