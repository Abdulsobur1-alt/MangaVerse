'use client';

import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useChapter } from '@/lib/hooks/useChapters';
import { useAuthStore } from '@/store/authStore';
import { TopBar } from '@/components/TopBar';
import { useUnlockChapter, useCoinBalance } from '@/lib/hooks/useCoins';
import { COIN_UNLOCK_COST } from '@mangaverse/shared';

type ReaderMode = 'page' | 'strip' | 'prose';
type ProseTheme = 'dark' | 'sepia' | 'light';

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

interface ReaderPrefs {
  rtl: boolean;             // manga: read right-to-left
  zoomed: boolean;          // strip: fit-width vs actual size
  fontFamily: 'serif' | 'sans';
  fontSize: number;
  lineHeight: number;
  theme: ProseTheme;
}

const READER_PREFS_KEY = 'mangaverse_reader_prefs';
const READING_WPM = 220;
const DEFAULT_PREFS: ReaderPrefs = {
  rtl: false,
  zoomed: false,
  fontFamily: 'serif',
  fontSize: 18,
  lineHeight: 1.9,
  theme: 'dark',
};

function loadPrefs(): ReaderPrefs {
  if (typeof window === 'undefined') return DEFAULT_PREFS;
  try {
    const raw = localStorage.getItem(READER_PREFS_KEY);
    if (raw) return { ...DEFAULT_PREFS, ...JSON.parse(raw) };
  } catch {
    // ignore corrupt prefs
  }
  return DEFAULT_PREFS;
}

function wordsIn(text: string | null | undefined): number {
  if (!text) return 0;
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export default function ReaderPage() {
  const { chapterId } = useParams<{ chapterId: string }>();
  const router = useRouter();
  const { data: chapter, isLoading, error } = useChapter(chapterId || '');
  const { token } = useAuthStore();
  const unlockChapter = useUnlockChapter();
  const { data: coinData } = useCoinBalance();

  const [pages, setPages] = useState<PageData[]>([]);
  const [currentPage, setCurrentPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [adjacentInfo, setAdjacentInfo] = useState<{ prevChapter: AdjacentChapter | null; nextChapter: AdjacentChapter | null }>({ prevChapter: null, nextChapter: null });
  const [pagesLoading, setPagesLoading] = useState(true);
  const [unlockError, setUnlockError] = useState<string | null>(null);
  const [showSidebar, setShowSidebar] = useState(false);
  const [pageLoading, setPageLoading] = useState<Record<number, boolean>>({});
  const [pageError, setPageError] = useState<Record<number, boolean>>({});
  const [autoScrollActive, setAutoScrollActive] = useState(false);
  const [autoScrollSpeed, setAutoScrollSpeed] = useState<1 | 2 | 3>(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  // Reader prefs (format-aware behavior)
  const [prefs, setPrefs] = useState<ReaderPrefs>(DEFAULT_PREFS);
  const [prefsLoaded, setPrefsLoaded] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const readerRef = useRef<HTMLElement>(null);
  const programmaticScrollRef = useRef(false);
  const currentPageRef = useRef(0);

  // Load persisted reader prefs once on mount
  useEffect(() => {
    setPrefs(loadPrefs());
    setPrefsLoaded(true);
  }, []);

  // Persist prefs on change (once loaded)
  useEffect(() => {
    if (!prefsLoaded) return;
    try {
      localStorage.setItem(READER_PREFS_KEY, JSON.stringify(prefs));
    } catch {
      // ignore quota errors
    }
  }, [prefs, prefsLoaded]);

  // ─── Format detection ───────────────────────────────
  // MANGA → page-flip · MANHWA/MANHUA → vertical scroll · LIGHT_NOVEL → prose
  // The DB stores type lowercase ('manga', 'light_novel', …) — normalize once
  // so every comparison below is case-insensitive.
  const format = chapter?.series?.type;
  const formatKey = (format || '').toUpperCase();
  const isLightNovel = formatKey === 'LIGHT_NOVEL';
  const hasProse = isLightNovel && !!chapter?.contentText;
  // Effective mode = persisted user override when set, else format default
  const [mode, setMode] = useState<ReaderMode | null>(null); // null = format default

  const effectiveMode: ReaderMode =
    mode ?? (isLightNovel ? (hasProse ? 'prose' : 'strip') : formatKey === 'MANGA' ? 'page' : 'strip');

  // Reset reading state when navigating to a different chapter
  useEffect(() => {
    setPages([]);
    setPagesLoading(true);
    setCurrentPage(0);
    setTotalPages(0);
    setScrollProgressPct(0);
    setAdjacentInfo({ prevChapter: null, nextChapter: null });
    setPageLoading({});
    setPageError({});
    setAutoScrollActive(false);
    setMode(null); // re-derive format default for the new chapter
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  }, [chapterId]);

  // Fetch pages and adjacent chapters
  useEffect(() => {
    if (!chapterId) return;
    setPagesLoading(true);
    setCurrentPage(0);
    // Guard against races when the user switches chapters quickly — a stale
    // response from a superseded fetch must not clobber the current chapter.
    let cancelled = false;
    const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
    Promise.all([
      fetch(`/api/chapters/${chapterId}/pages`, { headers }).then(r => r.json()),
      fetch(`/api/chapters/${chapterId}/adjacent`, { headers }).then(r => r.json()),
    ])
      .then(([pagesRes, adjRes]) => {
        if (cancelled) return;
        if (pagesRes.success) {
          setPages(pagesRes.data.pages);
          setTotalPages(pagesRes.data.total);
        }
        if (adjRes.success) {
          setAdjacentInfo(adjRes.data);
        }
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setPagesLoading(false); });
    return () => { cancelled = true; };
  }, [chapterId, token, chapter?.unlocked, chapter?.locked]);

  // ─── Progress tracking (mode-aware) ─────────────────
  // page mode: currentPage · strip/prose: derived from scroll position
  const [scrollProgressPct, setScrollProgressPct] = useState(0);

  const activePageNumber = effectiveMode === 'page'
    ? currentPage
    : totalPages > 0
      ? Math.min(totalPages - 1, Math.round((scrollProgressPct / 100) * (totalPages - 1)))
      : 0;

  // Save reading progress — debounced, fires when the reader position changes
  useEffect(() => {
    if (!token || !chapterId) return;
    const timer = setTimeout(async () => {
      try {
        // Page mode derives pct from the current page; strip/prose from the
        // scroll position (works even for prose chapters with no /pages rows).
        let pct: number;
        if (effectiveMode === 'page') {
          if (!totalPages) return;
          pct = ((currentPage + 1) / totalPages) * 100;
        } else {
          pct = scrollProgressPct;
        }
        await fetch('/api/reading/progress', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            chapterId,
            pageNumber: activePageNumber,
            completed: pct >= 95,
          }),
        });
      } catch {
        // Silently fail
      }
    }, 2000);
    return () => clearTimeout(timer);
  }, [token, chapterId, totalPages, currentPage, scrollProgressPct, activePageNumber, effectiveMode]);

  // ─── Auto-scroll / auto-play (page + strip only) ────
  useEffect(() => {
    currentPageRef.current = currentPage;
  }, [currentPage]);

  useEffect(() => {
    if (!autoScrollActive) return;
    const speed = autoScrollSpeed;

    if (effectiveMode === 'strip') {
      const tick = () => {
        const el = scrollRef.current;
        if (!el) return;
        const nearBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 8;
        if (nearBottom) {
          setAutoScrollActive(false);
          if (adjacentInfo.nextChapter) router.push(`/reader/${adjacentInfo.nextChapter.id}`);
          return;
        }
        programmaticScrollRef.current = true;
        el.scrollBy({ top: 3 * speed, behavior: 'auto' });
        window.setTimeout(() => { programmaticScrollRef.current = false; }, 120);
      };
      const id = window.setInterval(tick, 50);
      return () => window.clearInterval(id);
    }

    // Page mode — advance every ~4s (scaled by speed), only once pages exist
    const id = window.setInterval(() => {
      if (totalPages <= 0) return;
      if (currentPageRef.current >= totalPages - 1) {
        setAutoScrollActive(false);
        if (adjacentInfo.nextChapter) router.push(`/reader/${adjacentInfo.nextChapter.id}`);
        return;
      }
      setCurrentPage((p) => p + 1);
    }, 4000 / speed);
    return () => window.clearInterval(id);
  }, [autoScrollActive, autoScrollSpeed, effectiveMode, totalPages, adjacentInfo, router]);

  // Stop auto-scroll when the user manually scrolls (strip/prose)
  useEffect(() => {
    if (!autoScrollActive || effectiveMode === 'page') return;
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => {
      if (programmaticScrollRef.current) {
        programmaticScrollRef.current = false;
        return;
      }
      setAutoScrollActive(false);
    };
    el.addEventListener('scroll', onScroll);
    return () => el.removeEventListener('scroll', onScroll);
  }, [autoScrollActive, effectiveMode]);

  // ─── Scroll-position progress (strip/prose) ─────────
  useEffect(() => {
    if (effectiveMode === 'page') return;
    const el = scrollRef.current;
    if (!el) return;
    let rafId = 0;
    const onScroll = () => {
      if (rafId) return;
      rafId = requestAnimationFrame(() => {
        rafId = 0;
        const max = el.scrollHeight - el.clientHeight;
        const pct = max > 0 ? Math.min(100, Math.max(0, (el.scrollTop / max) * 100)) : 0;
        setScrollProgressPct(pct);
      });
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      el.removeEventListener('scroll', onScroll);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [effectiveMode, totalPages]);

  // When page changes in page mode, scroll to top
  useEffect(() => {
    if (effectiveMode !== 'page') return;
    scrollRef.current?.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  }, [currentPage, effectiveMode]);

  // ─── Full-screen mode ───────────────────────────────
  const toggleFullscreen = useCallback(() => {
    const el = readerRef.current;
    if (!el) return;
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    } else {
      el.requestFullscreen().catch(() => {});
    }
  }, []);

  useEffect(() => {
    const onFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  // ─── Keyboard navigation ────────────────────────────
  const goNext = useCallback(() => {
    if (effectiveMode === 'strip') {
      scrollRef.current?.scrollBy({ top: window.innerHeight * 0.8, behavior: 'smooth' });
    } else if (effectiveMode === 'prose') {
      scrollRef.current?.scrollBy({ top: window.innerHeight * 0.7, behavior: 'smooth' });
    } else if (currentPage < totalPages - 1) {
      setCurrentPage(p => p + 1);
    } else if (adjacentInfo.nextChapter) {
      router.push(`/reader/${adjacentInfo.nextChapter.id}`);
    }
  }, [currentPage, totalPages, effectiveMode, adjacentInfo, router]);

  const goPrev = useCallback(() => {
    if (effectiveMode === 'strip') {
      scrollRef.current?.scrollBy({ top: -window.innerHeight * 0.8, behavior: 'smooth' });
    } else if (effectiveMode === 'prose') {
      scrollRef.current?.scrollBy({ top: -window.innerHeight * 0.7, behavior: 'smooth' });
    } else if (currentPage > 0) {
      setCurrentPage(p => p - 1);
    } else if (adjacentInfo.prevChapter) {
      router.push(`/reader/${adjacentInfo.prevChapter.id}`);
    }
  }, [currentPage, effectiveMode, adjacentInfo, router]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        setAutoScrollActive(false);
        goPrev();
      } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === ' ') {
        e.preventDefault();
        setAutoScrollActive(false);
        goNext();
      } else if (e.key === 'f' || e.key === 'F') {
        setMode(m => (m === 'strip' ? (formatKey === 'MANGA' ? 'page' : 'strip') : 'strip'));
      } else if (e.key === 'm' || e.key === 'M') {
        // Toggle prose reading (matches the "M Prose" hint shown in the UI)
        if (hasProse) setMode(m => (m === 'prose' ? null : 'prose'));
      } else if (e.key === 'c' || e.key === 'C') {
        setShowSidebar(s => !s);
      } else if (e.key === 'a' || e.key === 'A') {
        setAutoScrollActive(a => !a);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [goNext, goPrev, formatKey, hasProse]);

  // Loading / error / lock states (unchanged behavior)
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
            <Link href="/browse" className="inline-block rounded-md bg-mv-accent px-4 py-2 text-xs font-medium text-white hover:brightness-110 transition-colors">
              Browse titles
            </Link>
          </div>
        </div>
      </main>
    );
  }

  // ─── Coin-locked gate ─────────────────────────────
  if (chapter.locked && !chapter.unlocked) {
    const cost = chapter.unlockCost ?? COIN_UNLOCK_COST;
    const balance = coinData?.balance ?? 0;
    const canAfford = balance >= cost;

    const handleUnlock = async () => {
      setUnlockError(null);
      try {
        await unlockChapter.mutateAsync(chapter.id);
      } catch {
        setUnlockError('Could not unlock this chapter. You may need more coins.');
      }
    };

    return (
      <main className="min-h-screen bg-black flex flex-col">
        <TopBar />
        <div className="flex flex-1 items-center justify-center px-6">
          <div className="w-full max-w-sm rounded-2xl border border-mv-border bg-mv-darker p-8 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-mv-gold/10">
              <span className="text-2xl">🔒</span>
            </div>
            <h1 className="text-lg font-semibold text-white">Chapter Locked</h1>
            <p className="mt-1 text-xs text-mv-text-muted">
              Ch. {chapter.number} · {chapter.series.title}
            </p>
            <p className="mt-3 text-xs leading-relaxed text-mv-text-secondary">
              This chapter requires coins to unlock. Your balance:
              <span className="mx-1 font-medium text-mv-gold">{balance} 🪙</span>
            </p>

            <button
              onClick={handleUnlock}
              disabled={!canAfford || unlockChapter.isPending}
              className={`mt-6 w-full rounded-lg py-2.5 text-xs font-medium text-white transition-colors ${
                canAfford && !unlockChapter.isPending
                  ? 'bg-mv-accent hover:brightness-110'
                  : 'bg-mv-surface text-mv-text-dim cursor-not-allowed'
              }`}
            >
              {unlockChapter.isPending
                ? 'Unlocking...'
                : canAfford
                ? `Unlock for ${cost} 🪙`
                : `Need ${cost - balance} more coins`}
            </button>

            {!token && (
              <Link href="/login" className="mt-3 inline-block text-[10px] text-mv-accent hover:underline">
                Sign in to unlock with coins
              </Link>
            )}

            {unlockError && (
              <p className="mt-3 text-[10px] text-red-400">{unlockError}</p>
            )}

            <Link
              href={`/title/${chapter.series.slug}`}
              className="mt-4 inline-block text-[10px] text-mv-text-muted hover:text-mv-text transition-colors"
            >
              ← Back to chapter list
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const progressPct = totalPages > 0
    ? Math.round(effectiveMode === 'page' ? ((currentPage + 1) / totalPages) * 100 : scrollProgressPct)
    : 0;
  const chapterListHref = `/title/${chapter.series.slug}`;
  const isRTL = effectiveMode === 'page' && prefs.rtl;

  // Prose reading estimate
  const wordCount = wordsIn(chapter.contentText);
  const totalMinutes = wordCount > 0 ? Math.max(1, Math.round(wordCount / READING_WPM)) : 0;
  const minutesLeft = totalMinutes > 0 ? Math.max(1, Math.round(totalMinutes * (1 - scrollProgressPct / 100))) : 0;

  const modeLabel =
    effectiveMode === 'prose' ? '📕 Prose' :
    effectiveMode === 'strip' ? (formatKey === 'MANGA' ? '📜 Strip' : '📜 Scroll') : '📄 Page';

  const themeStyles: Record<ProseTheme, { bg: string; text: string; muted: string }> = {
    dark: { bg: 'var(--reader-bg-dark)', text: 'var(--reader-text-dark)', muted: 'var(--reader-muted-dark)' },
    sepia: { bg: 'var(--reader-bg-sepia)', text: 'var(--reader-text-sepia)', muted: 'var(--reader-muted-sepia)' },
    light: { bg: 'var(--reader-bg-light)', text: 'var(--reader-text-light)', muted: 'var(--reader-muted-light)' },
  };
  const t = themeStyles[prefs.theme];

  return (
    <main ref={readerRef} className="min-h-screen bg-black flex flex-col">
      {/* Reader Top Bar */}
      <div className="flex h-11 items-center border-b border-mv-border bg-mv-darker px-4 gap-3 flex-shrink-0">
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
          {/* Mode label */}
          <span className="hidden md:inline rounded border border-mv-border-light bg-mv-surface px-2 py-1 text-[10px] text-mv-text-secondary">
            {modeLabel}
          </span>

          {/* Format-aware controls */}
          {effectiveMode === 'page' && formatKey === 'MANGA' && (
            <button
              onClick={() => setPrefs(p => ({ ...p, rtl: !p.rtl }))}
              className={`rounded border px-2.5 py-1 text-[10px] transition-colors ${
                prefs.rtl
                  ? 'border-mv-accent bg-mv-accent/20 text-mv-accent'
                  : 'border-mv-border-light bg-mv-surface text-mv-text-secondary hover:text-mv-text'
              }`}
              title="Toggle right-to-left reading direction"
            >
              {isRTL ? '↩ RTL' : '↪ LTR'}
            </button>
          )}

          {effectiveMode === 'strip' && (
            <button
              onClick={() => setPrefs(p => ({ ...p, zoomed: !p.zoomed }))}
              className={`rounded border px-2.5 py-1 text-[10px] transition-colors ${
                prefs.zoomed
                  ? 'border-mv-accent bg-mv-accent/20 text-mv-accent'
                  : 'border-mv-border-light bg-mv-surface text-mv-text-secondary hover:text-mv-text'
              }`}
              title="Toggle fit-width / actual size"
            >
              {prefs.zoomed ? '🔍 Actual' : '📐 Fit'}
            </button>
          )}

          {/* Mode switcher */}
          <div className="flex overflow-hidden rounded border border-mv-border-light">
            <button
              onClick={() => setMode('page')}
              className={`px-2 py-1 text-[10px] transition-colors ${
                effectiveMode === 'page' ? 'bg-mv-accent/20 text-mv-accent' : 'bg-mv-surface text-mv-text-secondary hover:text-mv-text'
              }`}
              title="Page-flip mode"
            >
              Page
            </button>
            <button
              onClick={() => setMode('strip')}
              className={`border-l border-mv-border-light px-2 py-1 text-[10px] transition-colors ${
                effectiveMode === 'strip' ? 'bg-mv-accent/20 text-mv-accent' : 'bg-mv-surface text-mv-text-secondary hover:text-mv-text'
              }`}
              title="Continuous scroll mode"
            >
              Strip
            </button>
            {hasProse && (
              <button
                onClick={() => setMode('prose')}
                className={`border-l border-mv-border-light px-2 py-1 text-[10px] transition-colors ${
                  effectiveMode === 'prose' ? 'bg-mv-accent/20 text-mv-accent' : 'bg-mv-surface text-mv-text-secondary hover:text-mv-text'
                }`}
                title="Prose reading mode"
              >
                Prose
              </button>
            )}
          </div>

          {/* Auto-scroll toggle (page + strip) */}
          {effectiveMode !== 'prose' && (
            <button
              onClick={() => setAutoScrollActive(a => !a)}
              className={`rounded border px-2.5 py-1 text-[10px] transition-colors ${
                autoScrollActive
                  ? 'border-mv-accent bg-mv-accent/20 text-mv-accent'
                  : 'border-mv-border-light bg-mv-surface text-mv-text-secondary hover:text-mv-text'
              }`}
              title="Auto-play (A)"
            >
              {autoScrollActive ? '⏸ Pause' : '▶ Play'}
            </button>
          )}

          {/* Auto-scroll speed */}
          {autoScrollActive && effectiveMode !== 'prose' && (
            <button
              onClick={() => setAutoScrollSpeed(s => (s === 3 ? 1 : ((s + 1) as 1 | 2 | 3)))}
              className="rounded border border-mv-border-light bg-mv-surface px-2.5 py-1 text-[10px] text-mv-text-secondary hover:text-mv-text transition-colors"
              title="Auto-play speed"
            >
              {autoScrollSpeed}x
            </button>
          )}

          {/* Full-screen toggle */}
          <button
            onClick={toggleFullscreen}
            className="rounded border border-mv-border-light bg-mv-surface px-2.5 py-1 text-[10px] text-mv-text-secondary hover:text-mv-text transition-colors"
            title="Toggle full-screen"
          >
            {isFullscreen ? '⛶ Exit' : '⛶ Full'}
          </button>

          {/* Chapter selector toggle */}
          {effectiveMode !== 'prose' && (
            <button
              onClick={() => setShowSidebar(s => !s)}
              className="rounded border border-mv-border-light bg-mv-surface px-2.5 py-1 text-[10px] text-mv-text-secondary hover:text-mv-text transition-colors"
              title="Chapter list (C)"
            >
              Ch. Select
            </button>
          )}
        </div>
      </div>

      {/* Prose typography controls (light novels) */}
      {effectiveMode === 'prose' && (
        <div className="flex flex-wrap items-center gap-2 border-b border-mv-border bg-mv-darker px-4 py-2">
          <div className="flex items-center gap-1">
            <span className="text-[9px] uppercase tracking-wider text-mv-text-muted">Font</span>
            <button
              onClick={() => setPrefs(p => ({ ...p, fontFamily: p.fontFamily === 'serif' ? 'sans' : 'serif' }))}
              className={`rounded border px-2 py-1 text-[10px] transition-colors ${
                prefs.fontFamily === 'serif' ? 'border-mv-accent text-mv-accent' : 'border-mv-border-light text-mv-text-secondary'
              }`}
              style={{ fontFamily: prefs.fontFamily === 'serif' ? 'Georgia, serif' : 'inherit' }}
            >
              {prefs.fontFamily === 'serif' ? 'Serif' : 'Sans'}
            </button>
          </div>

          <div className="flex items-center gap-1">
            <span className="text-[9px] uppercase tracking-wider text-mv-text-muted">Size</span>
            <button
              onClick={() => setPrefs(p => ({ ...p, fontSize: Math.max(14, p.fontSize - 2) }))}
              className="rounded border border-mv-border-light px-2 py-1 text-[10px] text-mv-text-secondary hover:text-mv-text"
              aria-label="Decrease font size"
            >
              A−
            </button>
            <span className="w-8 text-center text-[10px] text-mv-text-secondary">{prefs.fontSize}</span>
            <button
              onClick={() => setPrefs(p => ({ ...p, fontSize: Math.min(28, p.fontSize + 2) }))}
              className="rounded border border-mv-border-light px-2 py-1 text-[10px] text-mv-text-secondary hover:text-mv-text"
              aria-label="Increase font size"
            >
              A+
            </button>
          </div>

          <div className="flex items-center gap-1">
            <span className="text-[9px] uppercase tracking-wider text-mv-text-muted">Theme</span>
            {(['dark', 'sepia', 'light'] as ProseTheme[]).map(theme => (
              <button
                key={theme}
                onClick={() => setPrefs(p => ({ ...p, theme }))}
                className={`rounded border px-2 py-1 text-[10px] capitalize transition-colors ${
                  prefs.theme === theme ? 'border-mv-accent text-mv-accent' : 'border-mv-border-light text-mv-text-secondary'
                }`}
              >
                {theme}
              </button>
            ))}
          </div>

          {totalMinutes > 0 && (
            <span className="ml-auto text-[10px] text-mv-text-muted">
              ≈ {totalMinutes} min read{scrollProgressPct > 1 ? ` · ${minutesLeft} min left` : ''}
            </span>
          )}
        </div>
      )}

      {/* Chapter Sidebar */}
      {showSidebar && effectiveMode !== 'prose' && (
        <div className="absolute right-0 top-11 z-40 h-[calc(100vh-44px)] w-60 border-l border-mv-border bg-mv-darker overflow-y-auto animate-fade-in">
          <div className="p-3 border-b border-mv-border">
            <p className="text-xs font-medium text-mv-text">{chapter.series.title}</p>
            <p className="text-[10px] text-mv-text-muted mt-0.5">Select Page</p>
          </div>
          <div className="p-2 space-y-0.5">
            {Array.from({ length: Math.min(totalPages, 30) }).map((_, i) => (
              <button
                key={i}
                onClick={() => { setCurrentPage(i); setShowSidebar(false); if (effectiveMode === 'strip') { setMode('page'); } }}
                className={`w-full text-left px-3 py-2 rounded text-xs transition-colors ${
                  i === currentPage && effectiveMode === 'page'
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
        className={`flex-1 overflow-y-auto ${effectiveMode === 'page' ? 'flex items-start justify-center' : ''}`}
        onClick={(e) => {
          // Click left/right to navigate (page mode only)
          if (effectiveMode !== 'page') return;
          const rect = e.currentTarget.getBoundingClientRect();
          const x = e.clientX - rect.left;
          if (isRTL) {
            if (x > rect.width * 0.7) goPrev();
            else if (x < rect.width * 0.3) goNext();
          } else {
            if (x < rect.width * 0.3) goPrev();
            else if (x > rect.width * 0.7) goNext();
          }
        }}
      >
        {pagesLoading ? (
          <div className="flex items-center justify-center h-[80vh]">
            <div className="flex flex-col items-center gap-3">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-mv-accent border-t-transparent" />
              <p className="text-xs text-mv-text-muted">Loading pages...</p>
            </div>
          </div>
        ) : effectiveMode === 'prose' && hasProse ? (
          /* ── Prose Reader (light novels) ─────────── */
          <div
            className="mx-auto min-h-full px-5 py-10 transition-colors duration-300"
            style={{
              backgroundColor: t.bg,
              color: t.text,
              fontFamily: prefs.fontFamily === 'serif' ? 'Georgia, "Times New Roman", serif' : 'inherit',
            }}
          >
            <div className="mx-auto max-w-[42rem]">
              <p className="mb-6 text-center text-[10px] uppercase tracking-[0.25em]" style={{ color: t.muted }}>
                {chapter.series.title} — Ch. {chapter.number}
              </p>
              <div
                className="whitespace-pre-wrap leading-relaxed"
                style={{ fontSize: `${prefs.fontSize}px`, lineHeight: prefs.lineHeight }}
              >
                {chapter.contentText}
              </div>
              <div className="mt-10 flex items-center justify-center gap-3">
                <button
                  onClick={goPrev}
                  className="rounded-lg border border-white/10 px-4 py-2 text-xs transition-colors hover:border-mv-accent/50"
                  style={{ color: t.muted }}
                >
                  ← Prev
                </button>
                {adjacentInfo.nextChapter && (
                  <button
                    onClick={() => adjacentInfo.nextChapter && router.push(`/reader/${adjacentInfo.nextChapter.id}`)}
                    className="rounded-lg bg-mv-accent px-4 py-2 text-xs font-medium text-white transition-colors hover:brightness-110"
                  >
                    Next Chapter →
                  </button>
                )}
              </div>
            </div>
          </div>
        ) : effectiveMode === 'strip' ? (
          /* ── Long Strip Mode (manhwa/manhua) ─────── */
          <div className={`mx-auto ${prefs.zoomed ? 'max-w-none' : 'max-w-[700px]'}`}>
            {pages.map((p, i) => {
              const isLoading = pageLoading[i] !== false;
              const hasError = pageError[i];
              return (
                <div key={i} className="w-full">
                  <div className="w-full min-h-[400px] bg-mv-darker flex items-center justify-center relative">
                    {hasError || isLoading ? (
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
                      className={`w-full h-auto ${prefs.zoomed ? '' : 'max-h-[90vh] object-contain'} ${isLoading || hasError ? 'absolute opacity-0' : ''}`}
                      onLoad={() => setPageLoading(prev => ({ ...prev, [i]: false }))}
                      onError={() => { setPageLoading(prev => ({ ...prev, [i]: false })); setPageError(prev => ({ ...prev, [i]: true })); }}
                      loading={i < 3 ? 'eager' : 'lazy'}
                      onClick={() => setPrefs(p => ({ ...p, zoomed: !p.zoomed }))}
                    />
                  </div>
                  <p className="text-center text-[10px] text-mv-text-dim py-2">— Page {i + 1} —</p>
                </div>
              );
            })}
          </div>
        ) : (
          /* ── Single Page Mode (manga page-flip) ──── */
          <div className={`relative w-full ${isRTL ? '' : 'max-w-[700px]'}`}>
            {/* Left/Right nav hints (RTL-aware) */}
            {currentPage > 0 && (
              <div className="absolute left-2 top-1/2 -translate-y-1/2 z-10 opacity-0 hover:opacity-100 transition-opacity">
                <button
                  onClick={(e) => { e.stopPropagation(); if (isRTL) goNext(); else goPrev(); }}
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-black/60 text-white/70 hover:bg-black/80 hover:text-white"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={isRTL ? 'M9 5l7 7-7 7' : 'M15 19l-7-7 7-7'} /></svg>
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

            {/* Next page hint (RTL-aware) */}
            {currentPage < totalPages - 1 && (
              <div className="absolute right-2 top-1/2 -translate-y-1/2 z-10 opacity-0 hover:opacity-100 transition-opacity">
                <button
                  onClick={(e) => { e.stopPropagation(); if (isRTL) goPrev(); else goNext(); }}
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-black/60 text-white/70 hover:bg-black/80 hover:text-white"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={isRTL ? 'M15 19l-7-7 7-7' : 'M9 5l7 7-7 7'} /></svg>
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Reader Bottom Bar (page mode only) */}
      {effectiveMode === 'page' && (
        <div className="flex h-10 items-center border-t border-mv-border bg-mv-darker px-4 gap-3 flex-shrink-0">
          {/* Previous Chapter */}
          <button
            onClick={isRTL ? goNext : goPrev}
            disabled={isRTL ? (currentPage >= totalPages - 1 && !adjacentInfo.nextChapter) : (currentPage === 0 && !adjacentInfo.prevChapter)}
            className={`rounded border px-3 py-1 text-[10px] transition-colors ${
              isRTL
                ? currentPage >= totalPages - 1 && !adjacentInfo.nextChapter
                  ? 'border-mv-border-light/30 text-mv-text-dim cursor-not-allowed'
                  : 'border-mv-border-light bg-mv-surface text-mv-text-secondary hover:text-white'
                : currentPage === 0 && !adjacentInfo.prevChapter
                ? 'border-mv-border-light/30 text-mv-text-dim cursor-not-allowed'
                : 'border-mv-border-light bg-mv-surface text-mv-text-secondary hover:text-white'
            }`}
          >
            {isRTL ? (adjacentInfo.nextChapter && currentPage >= totalPages - 1 ? `Ch. ${adjacentInfo.nextChapter.number}` : 'Next') : (adjacentInfo.prevChapter && currentPage === 0 ? `Ch. ${adjacentInfo.prevChapter.number}` : 'Prev')} {isRTL ? '→' : '←'}
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
            onClick={isRTL ? goPrev : goNext}
            disabled={isRTL ? (currentPage === 0 && !adjacentInfo.prevChapter) : (currentPage >= totalPages - 1 && !adjacentInfo.nextChapter)}
            className={`rounded border px-3 py-1 text-[10px] transition-colors ${
              isRTL
                ? currentPage === 0 && !adjacentInfo.prevChapter
                  ? 'border-mv-border-light/30 text-mv-text-dim cursor-not-allowed'
                  : 'border-mv-border-light bg-mv-surface text-mv-text-secondary hover:text-white'
                : currentPage >= totalPages - 1 && !adjacentInfo.nextChapter
                ? 'border-mv-border-light/30 text-mv-text-dim cursor-not-allowed'
                : 'border-mv-border-light bg-mv-surface text-mv-text-secondary hover:text-white'
            }`}
          >
            {isRTL ? (adjacentInfo.prevChapter && currentPage === 0 ? `Ch. ${adjacentInfo.prevChapter.number}` : 'Prev') : (adjacentInfo.nextChapter && currentPage >= totalPages - 1 ? `Ch. ${adjacentInfo.nextChapter.number}` : 'Next')} {isRTL ? '←' : '→'}
          </button>
        </div>
      )}

      {/* Scroll progress hint for strip/prose */}
      {effectiveMode !== 'page' && (
        <div className="flex h-10 items-center border-t border-mv-border bg-mv-darker px-4 gap-3 flex-shrink-0">
          <button
            onClick={goPrev}
            disabled={scrollProgressPct < 2 && !adjacentInfo.prevChapter}
            className={`rounded border px-3 py-1 text-[10px] transition-colors ${
              scrollProgressPct < 2 && !adjacentInfo.prevChapter
                ? 'border-mv-border-light/30 text-mv-text-dim cursor-not-allowed'
                : 'border-mv-border-light bg-mv-surface text-mv-text-secondary hover:text-white'
            }`}
          >
            {scrollProgressPct < 2 && adjacentInfo.prevChapter ? `Ch. ${adjacentInfo.prevChapter.number}` : 'Prev'} ←
          </button>
          <span className="text-[10px] text-mv-text-muted whitespace-nowrap">{Math.round(scrollProgressPct)}%</span>
          <div className="flex-1 h-1 bg-mv-surface rounded-full overflow-hidden max-w-[300px]">
            <div className="h-full rounded-full bg-mv-accent transition-all duration-300" style={{ width: `${scrollProgressPct}%` }} />
          </div>
          <span className="text-[10px] text-mv-text-muted hidden sm:block">Ch. {chapter.number}</span>
          <button
            onClick={goNext}
            disabled={scrollProgressPct >= 98 && !adjacentInfo.nextChapter}
            className={`rounded border px-3 py-1 text-[10px] transition-colors ${
              scrollProgressPct >= 98 && !adjacentInfo.nextChapter
                ? 'border-mv-border-light/30 text-mv-text-dim cursor-not-allowed'
                : 'border-mv-border-light bg-mv-surface text-mv-text-secondary hover:text-white'
            }`}
          >
            {scrollProgressPct >= 98 && adjacentInfo.nextChapter ? `Ch. ${adjacentInfo.nextChapter.number}` : 'Next'} →
          </button>
        </div>
      )}

      {/* Keyboard hints */}
      <div className="fixed bottom-12 right-3 z-30 hidden md:block">
        <div className="rounded-lg border border-mv-border bg-mv-darker/90 px-3 py-2 text-[9px] text-mv-text-dim backdrop-blur-sm">
          <p>
            ← → Navigate · <span className="text-mv-accent">A</span> Auto-play · <span className="text-mv-accent">F</span> Strip · <span className="text-mv-accent">C</span> Pages
            {hasProse && <> · <span className="text-mv-accent">M</span> Prose</>}
          </p>
        </div>
      </div>
    </main>
  );
}
