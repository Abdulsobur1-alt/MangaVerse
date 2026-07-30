'use client';

import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useChapter } from '@/lib/hooks/useChapters';
import { useAuthStore } from '@/store/authStore';
import { TopBar } from '@/components/TopBar';

interface PageData {
  index: number;
  url: string;
  width: number;
  height: number;
}

interface AdjacentChapter {
  id: string;
  number: number;
}

export default function ReaderPage() {
  const { chapterId } = useParams<{ chapterId: string }>();
  const router = useRouter();
  const { data: chapter, isLoading, error } = useChapter(chapterId || '');
  const { token } = useAuthStore();

  const [pages, setPages] = useState<PageData[]>([]);
  const [currentPage, setCurrentPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [adjacentInfo, setAdjacentInfo] = useState<{ prevChapter: AdjacentChapter | null; nextChapter: AdjacentChapter | null }>({ prevChapter: null, nextChapter: null });
  const [pagesLoading, setPagesLoading] = useState(true);
  const [showSidebar, setShowSidebar] = useState(false);
  const [longStripMode, setLongStripMode] = useState(false);
  const [pageLoading, setPageLoading] = useState<Record<number, boolean>>({});
  const [pageError, setPageError] = useState<Record<number, boolean>>({});
  const scrollRef = useRef<HTMLDivElement>(null);

  // Fetch pages and adjacent chapters
  useEffect(() => {
    if (!chapterId) return;
    setPagesLoading(true);
    setCurrentPage(0);
    Promise.all([
      fetch(`/api/chapters/${chapterId}/pages`).then(r => r.json()),
      fetch(`/api/chapters/${chapterId}/adjacent`).then(r => r.json()),
    ])
      .then(([pagesRes, adjRes]) => {
        if (pagesRes.success) {
          setPages(pagesRes.data.pages);
          setTotalPages(pagesRes.data.total);
        }
        if (adjRes.success) {
          setAdjacentInfo(adjRes.data);
        }
      })
      .catch(() => {})
      .finally(() => setPagesLoading(false));
  }, [chapterId]);

  // Save reading progress — debounced, fires when user lingers on a page
  useEffect(() => {
    if (!token || !chapterId || !totalPages) return;
    const timer = setTimeout(async () => {
      try {
        await fetch('/api/reading/progress', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ chapterId, pageNumber: currentPage, completed: currentPage >= totalPages - 1 }),
        });
      } catch {
        // Silently fail
      }
    }, 2000);
    return () => clearTimeout(timer);
  }, [token, chapterId, totalPages, currentPage]);

  // Keyboard navigation
  const goNext = useCallback(() => {
    if (longStripMode) {
      // In long strip mode, scroll down by viewport height
      scrollRef.current?.scrollBy({ top: window.innerHeight * 0.8, behavior: 'smooth' });
    } else if (currentPage < totalPages - 1) {
      setCurrentPage(p => p + 1);
    } else if (adjacentInfo.nextChapter) {
      router.push(`/reader/${adjacentInfo.nextChapter.id}`);
    }
  }, [currentPage, totalPages, longStripMode, adjacentInfo, router]);

  const goPrev = useCallback(() => {
    if (longStripMode) {
      scrollRef.current?.scrollBy({ top: -window.innerHeight * 0.8, behavior: 'smooth' });
    } else if (currentPage > 0) {
      setCurrentPage(p => p - 1);
    } else if (adjacentInfo.prevChapter) {
      router.push(`/reader/${adjacentInfo.prevChapter.id}`);
    }
  }, [currentPage, longStripMode, adjacentInfo, router]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        goPrev();
      } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === ' ') {
        e.preventDefault();
        goNext();
      } else if (e.key === 'f' || e.key === 'F') {
        setLongStripMode(m => !m);
      } else if (e.key === 'c' || e.key === 'C') {
        setShowSidebar(s => !s);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [goNext, goPrev]);

  // When page changes in page mode, scroll to top
  useEffect(() => {
    if (!longStripMode) {
      scrollRef.current?.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
    }
  }, [currentPage, longStripMode]);

  if (isLoading) {
    return (
      <main className="min-h-screen bg-black">
        <TopBar />
        <div className="flex items-center justify-center h-[80vh]">
          <div className="flex flex-col items-center gap-3">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-mv-accent border-t-transparent" />
            <p className="text-xs text-mv-text-muted animate-pulse">Loading chapter...</p>
          </div>
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
            <svg className="mx-auto mb-4 h-12 w-12 text-mv-text-dim" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            <p className="text-sm text-mv-text-muted mb-2">Chapter not found</p>
            <p className="text-xs text-mv-text-dim mb-4">It may have been removed or the link is invalid</p>
            <Link href="/browse" className="inline-block rounded-md bg-mv-accent px-4 py-2 text-xs font-medium text-white hover:bg-red-500 transition-colors">
              Browse titles
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const progressPct = totalPages > 0 ? Math.round(((currentPage + 1) / totalPages) * 100) : 0;
  const chapterListHref = `/title/${chapter.series.slug}`;

  return (
    <main className="min-h-screen bg-black flex flex-col">
      {/* Reader Top Bar */}
      <div className={`flex h-11 items-center border-b border-mv-border bg-mv-darker px-4 gap-3 flex-shrink-0 ${longStripMode ? 'hidden' : ''}`}>
        <Link href={chapterListHref} className="text-xs text-mv-text-muted hover:text-mv-text transition-colors whitespace-nowrap">
          ← {chapter.series.title}
        </Link>
        <span className="text-xs text-mv-text-dim whitespace-nowrap">Ch. {chapter.number}</span>
        {chapter.title && <span className="text-xs text-mv-text-muted hidden sm:block truncate">— {chapter.title}</span>}

        {/* Progress bar */}
        <div className="flex-1 h-1 bg-mv-surface rounded-full overflow-hidden max-w-[200px] hidden sm:block">
          <div className="h-full rounded-full bg-mv-accent transition-all duration-300" style={{ width: `${progressPct}%` }} />
        </div>

        <div className="ml-auto flex items-center gap-2">
          {/* Strip/Page toggle */}
          <button
            onClick={() => setLongStripMode(m => !m)}
            className={`rounded border px-2.5 py-1 text-[10px] transition-colors ${
              longStripMode
                ? 'border-mv-accent bg-mv-accent/20 text-mv-accent'
                : 'border-mv-border-light bg-mv-surface text-mv-text-secondary hover:text-mv-text'
            }`}
            title="Toggle long-strip mode (F)"
          >
            {longStripMode ? 'Page' : 'Strip'}
          </button>

          {/* Chapter selector toggle */}
          <button
            onClick={() => setShowSidebar(s => !s)}
            className="rounded border border-mv-border-light bg-mv-surface px-2.5 py-1 text-[10px] text-mv-text-secondary hover:text-mv-text transition-colors"
            title="Chapter list (C)"
          >
            Ch. Select
          </button>
        </div>
      </div>

      {/* Chapter Sidebar */}
      {showSidebar && (
        <div className="absolute right-0 top-11 z-40 h-[calc(100vh-44px)] w-60 border-l border-mv-border bg-mv-darker overflow-y-auto animate-fade-in">
          <div className="p-3 border-b border-mv-border">
            <p className="text-xs font-medium text-mv-text">{chapter.series.title}</p>
            <p className="text-[10px] text-mv-text-muted mt-0.5">Select Chapter</p>
          </div>
          <div className="p-2 space-y-0.5">
            {Array.from({ length: Math.min(totalPages, 20) }).map((_, i) => (
              <button
                key={i}
                onClick={() => { setCurrentPage(i); setShowSidebar(false); }}
                className={`w-full text-left px-3 py-2 rounded text-xs transition-colors ${
                  i === currentPage
                    ? 'bg-mv-accent/20 text-mv-accent'
                    : 'text-mv-text-secondary hover:bg-mv-surface hover:text-mv-text'
                }`}
              >
                Page {i + 1}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Reader Content */}
      <div
        ref={scrollRef}
        className={`flex-1 overflow-y-auto ${longStripMode ? '' : 'flex items-start justify-center'}`}
        onClick={(e) => {
          // Click left/right to navigate (only in page mode)
          if (longStripMode) return;
          const rect = e.currentTarget.getBoundingClientRect();
          const x = e.clientX - rect.left;
          if (x < rect.width * 0.3) goPrev();
          else if (x > rect.width * 0.7) goNext();
        }}
      >
        {pagesLoading ? (
          <div className="flex items-center justify-center h-[80vh]">
            <div className="flex flex-col items-center gap-3">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-mv-accent border-t-transparent" />
              <p className="text-xs text-mv-text-muted">Loading pages...</p>
            </div>
          </div>
        ) : longStripMode ? (
          /* Long Strip Mode: All pages in a vertical scroll with real images */
          <div className="mx-auto max-w-[700px]">
            {pages.map((p, i) => {
              const isLoading = pageLoading[i] !== false;
              const hasError = pageError[i];
              return (
                <div key={i} className="w-full">
                  <div className="w-full min-h-[400px] bg-mv-darker flex items-center justify-center relative">
                    {hasError || isLoading ? (
                      /* Fallback SVG while image loads or on error */
                      <svg width="100%" height="auto" viewBox="0 0 800 1200" preserveAspectRatio="xMidYMid meet" className="max-h-[90vh] mx-auto">
                        <rect width="800" height="1200" fill={['#1a1a2e','#16213e','#0f3460','#1a1a3e','#2d1b69','#1b3a5e','#3d1b69','#1b5e3d','#5e1b3a','#3a5e1b','#1b3a2d','#4e2d1a'][i % 12]} />
                        <text x="400" y="500" textAnchor="middle" fill="#e9456060" fontFamily="sans-serif" fontSize="24">Ch. {chapter.number}</text>
                        <text x="400" y="540" textAnchor="middle" fill="#e9456040" fontFamily="sans-serif" fontSize="16">Page {i + 1} of {totalPages}</text>
                        {hasError && <text x="400" y="580" textAnchor="middle" fill="#ff444460" fontFamily="sans-serif" fontSize="12">Image failed to load</text>}
                        {isLoading && !hasError && (
                          <g>
                            <rect x="375" y="570" width="50" height="4" rx="2" fill="#e9456060" />
                            <rect x="375" y="570" width="50" height="4" rx="2" fill="#e94560" className="animate-pulse" />
                          </g>
                        )}
                      </svg>
                    ) : null}
                    <img
                      src={p.url}
                      alt={`Page ${i + 1} of Ch. ${chapter.number}`}
                      className={`w-full h-auto max-h-[90vh] object-contain ${isLoading || hasError ? 'absolute opacity-0' : ''}`}
                      onLoad={() => setPageLoading(prev => ({ ...prev, [i]: false }))}
                      onError={() => { setPageLoading(prev => ({ ...prev, [i]: false })); setPageError(prev => ({ ...prev, [i]: true })); }}
                      loading={i < 3 ? 'eager' : 'lazy'}
                    />
                  </div>
                  <p className="text-center text-[10px] text-mv-text-dim py-2">— Page {i + 1} —</p>
                </div>
              );
            })}
          </div>
        ) : (
          /* Single Page Mode — real images with SVG fallback */
          <div className="relative w-full max-w-[700px]">
            {/* Left/Right nav hints */}
            {currentPage > 0 && (
              <div className="absolute left-2 top-1/2 -translate-y-1/2 z-10 opacity-0 hover:opacity-100 transition-opacity">
                <button onClick={goPrev} className="flex h-10 w-10 items-center justify-center rounded-full bg-black/60 text-white/70 hover:bg-black/80 hover:text-white">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                </button>
              </div>
            )}

            {/* Page image with loading/error fallback */}
            <div className="min-h-[85vh] flex items-center justify-center bg-mv-darker relative">
              {(!pages[currentPage] || pageLoading[currentPage] !== false || pageError[currentPage]) ? (
                <svg width="100%" height="auto" viewBox="0 0 800 1200" preserveAspectRatio="xMidYMid meet" className="max-h-[85vh] w-full">
                  <rect width="800" height="1200" fill={['#1a1a2e','#16213e','#0f3460','#1a1a3e','#2d1b69','#1b3a5e','#3d1b69','#1b5e3d','#5e1b3a','#3a5e1b','#1b3a2d','#4e2d1a'][currentPage % 12]} />
                  <rect x="50" y="50" width="700" height="1100" rx="4" fill="none" stroke="#e9456020" strokeWidth="1" />
                  <text x="400" y="500" textAnchor="middle" fill="#e9456060" fontFamily="sans-serif" fontSize="24" fontWeight="300">Ch. {chapter.number}</text>
                  <text x="400" y="540" textAnchor="middle" fill="#e9456040" fontFamily="sans-serif" fontSize="16" fontWeight="300">Page {currentPage + 1} of {totalPages}</text>
                  <rect x="300" y="580" width="200" height="4" rx="2" fill="#e9456030" />
                  <rect x="300" y="580" width={progressPct * 2} height="4" rx="2" fill="#e94560" />
                  {pageLoading[currentPage] === undefined && (
                    <>
                      <rect x="50" y="850" width="700" height="200" rx="8" fill="#e9456008" />
                      <text x="400" y="920" textAnchor="middle" fill="#e9456030" fontFamily="sans-serif" fontSize="12">Loading image...</text>
                      <rect x="100" y="940" width="180" height="80" rx="4" fill="#e9456010" />
                      <rect x="310" y="940" width="180" height="80" rx="4" fill="#e9456010" />
                      <rect x="520" y="940" width="180" height="80" rx="4" fill="#e9456010" />
                    </>
                  )}
                  {pageError[currentPage] && (
                    <text x="400" y="620" textAnchor="middle" fill="#ff444460" fontFamily="sans-serif" fontSize="14">Image failed to load</text>
                  )}
                </svg>
              ) : null}
              {pages[currentPage] && (
                <img
                  src={pages[currentPage].url}
                  alt={`Page ${currentPage + 1} of Ch. ${chapter.number}`}
                  className={`w-full h-auto max-h-[85vh] object-contain ${pageLoading[currentPage] === false && !pageError[currentPage] ? '' : 'absolute opacity-0'}`}
                  onLoad={() => setPageLoading(prev => ({ ...prev, [currentPage]: false }))}
                  onError={() => { setPageLoading(prev => ({ ...prev, [currentPage]: false })); setPageError(prev => ({ ...prev, [currentPage]: true })); }}
                />
              )}
            </div>

            {/* Next page hint */}
            {currentPage < totalPages - 1 && (
              <div className="absolute right-2 top-1/2 -translate-y-1/2 z-10 opacity-0 hover:opacity-100 transition-opacity">
                <button onClick={goNext} className="flex h-10 w-10 items-center justify-center rounded-full bg-black/60 text-white/70 hover:bg-black/80 hover:text-white">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Reader Bottom Bar */}
      <div className={`flex h-10 items-center border-t border-mv-border bg-mv-darker px-4 gap-3 flex-shrink-0 ${longStripMode ? 'hidden' : ''}`}>
        {/* Previous Chapter */}
        <button
          onClick={goPrev}
          disabled={currentPage === 0 && !adjacentInfo.prevChapter}
          className={`rounded border px-3 py-1 text-[10px] transition-colors ${
            currentPage === 0 && !adjacentInfo.prevChapter
              ? 'border-mv-border-light/30 text-mv-text-dim cursor-not-allowed'
              : 'border-mv-border-light bg-mv-surface text-mv-text-secondary hover:text-white'
          }`}
        >
          ← {adjacentInfo.prevChapter && currentPage === 0 ? `Ch. ${adjacentInfo.prevChapter.number}` : 'Prev'}
        </button>

        {/* Page counter */}
        <span className="text-[10px] text-mv-text-muted whitespace-nowrap">
          {currentPage + 1} / {totalPages || '?'}
        </span>

        {/* Progress bar */}
        <div className="flex-1 h-1 bg-mv-surface rounded-full overflow-hidden max-w-[300px]">
          <div className="h-full rounded-full bg-mv-accent transition-all duration-300" style={{ width: `${progressPct}%` }} />
        </div>

        {/* Chapter info */}
        <span className="text-[10px] text-mv-text-muted hidden sm:block">Ch. {chapter.number}</span>

        {/* Next Chapter */}
        <button
          onClick={goNext}
          disabled={currentPage >= totalPages - 1 && !adjacentInfo.nextChapter}
          className={`rounded border px-3 py-1 text-[10px] transition-colors ${
            currentPage >= totalPages - 1 && !adjacentInfo.nextChapter
              ? 'border-mv-border-light/30 text-mv-text-dim cursor-not-allowed'
              : 'border-mv-border-light bg-mv-surface text-mv-text-secondary hover:text-white'
          }`}
        >
          {adjacentInfo.nextChapter && currentPage >= totalPages - 1 ? `Ch. ${adjacentInfo.nextChapter.number}` : 'Next'} →
        </button>
      </div>

      {/* Keyboard hints */}
      <div className="fixed bottom-12 right-3 z-30 hidden md:block">
        <div className="rounded-lg border border-mv-border bg-mv-darker/90 px-3 py-2 text-[9px] text-mv-text-dim backdrop-blur-sm">
          <p>← → Navigate · <span className="text-mv-accent">F</span> Strip/Page · <span className="text-mv-accent">C</span> Chapter</p>
        </div>
      </div>
    </main>
  );
}
