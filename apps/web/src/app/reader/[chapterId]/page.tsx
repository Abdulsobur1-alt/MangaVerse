'use client';

import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useChapter } from '@/lib/hooks/useChapters';
import { useAuthStore } from '@/store/authStore';
import { TopBar } from '@/components/TopBar';
import { Icon } from '@/components/ui/Icon';
import { PageImage } from '@/components/reader/PageImage';
import { ControlCenter } from '@/components/reader/ControlCenter';
import { ShortcutHelp } from '@/components/reader/ShortcutHelp';
import { ChapterDrawer } from '@/components/reader/ChapterDrawer';
import {
  loadPrefs, savePrefs, loadChapterBookmarks, saveChapterBookmark, clearChapterBookmark,
  DEFAULT_PREFS, THEMES, type ReaderMode, type ProseTheme, type ReaderPrefs,
} from '@/components/reader/readerPrefs';
import { useUnlockChapter, useCoinBalance } from '@/lib/hooks/useCoins';
import { COIN_UNLOCK_COST } from '@mangaverse/shared';
import { cn } from '@/lib/cn';

/* ═══════════════════════════════════════════════════════════════
   Reader — MangaVerse's flagship. Phase 5.
   The story owns the screen; chrome floats and fades.
   • Modes: page-flip (manga) · strip/scroll (manhwa/manhua) · prose
   • Auto-hiding floating bars + Focus mode (Z)
   • Control center (brightness, zoom, theme, fonts, autoscroll)
   • Gestures: tap zones · swipe · double-tap · pinch via browser
   • Preload next page, blur-up fade, retry failed pages
   • Resume at saved page · bookmark pages (B) · offline badge
   • Keyboard: ←→↑↓ space PgUp/PgDn Home/End F B T C A M Z ? Esc
   ═══════════════════════════════════════════════════════════════ */

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

const READING_WPM = 220;
const CHROME_IDLE_MS = 3200;

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
  const [showDrawer, setShowDrawer] = useState(false);
  const [showControls, setShowControls] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [pageLoading, setPageLoading] = useState<Record<number, boolean>>({});
  const [pageError, setPageError] = useState<Record<number, boolean>>({});
  const [autoScrollActive, setAutoScrollActive] = useState(false);
  const [autoScrollSpeed, setAutoScrollSpeed] = useState<1 | 2 | 3>(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const [chromeVisible, setChromeVisible] = useState(true);
  const [online, setOnline] = useState(true);
  const [bookmarked, setBookmarked] = useState(false);

  const [prefs, setPrefs] = useState<ReaderPrefs>(DEFAULT_PREFS);
  const [prefsLoaded, setPrefsLoaded] = useState(false);
  const [mode, setMode] = useState<ReaderMode | null>(null);
  const [scrollProgressPct, setScrollProgressPct] = useState(0);

  const scrollRef = useRef<HTMLDivElement>(null);
  const readerRef = useRef<HTMLElement>(null);
  const programmaticScrollRef = useRef(false);
  const currentPageRef = useRef(0);
  const idleTimerRef = useRef<number | null>(null);
  const lastTapRef = useRef(0);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const resumeAppliedRef = useRef(false);
  const pendingProgressRef = useRef<{ chapterId: string; pageNumber: number; completed: boolean } | null>(null);

  // ─── Load prefs on mount (avoids SSR hydration mismatch), then persist ──
  useEffect(() => {
    setPrefs(loadPrefs());
    setPrefsLoaded(true);
  }, []);

  useEffect(() => {
    if (!prefsLoaded) return;
    savePrefs(prefs);
  }, [prefs, prefsLoaded]);

  // ─── Format detection ────────────────────────────────
  const formatKey = ((chapter?.series?.type || '').toUpperCase());
  const isLightNovel = formatKey === 'LIGHT_NOVEL';
  const hasProse = isLightNovel && !!chapter?.contentText;

  const effectiveMode: ReaderMode =
    mode ?? (isLightNovel ? (hasProse ? 'prose' : 'strip') : formatKey === 'MANGA' ? 'page' : 'strip');

  // Scroll-derived page number — meaningful in every mode (used by bookmarking)
  const activePageNumber = effectiveMode === 'page'
    ? currentPage
    : totalPages > 0
      ? Math.min(totalPages - 1, Math.round((scrollProgressPct / 100) * (totalPages - 1)))
      : 0;

  const t = THEMES[prefs.theme];

  // ─── Reset on chapter change ─────────────────────────
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
    setShowDrawer(false);
    setShowControls(false);
    setMode(null);
    resumeAppliedRef.current = false;
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  }, [chapterId]);

  // ─── Online / offline ────────────────────────────────
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    setOnline(navigator.onLine);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);

  // ─── Fetch pages + adjacent ──────────────────────────
  useEffect(() => {
    if (!chapterId) return;
    setPagesLoading(true);
    setCurrentPage(0);
    let cancelled = false;
    const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
    Promise.all([
      fetch(`/api/chapters/${chapterId}/pages`, { headers }).then((r) => r.json()),
      fetch(`/api/chapters/${chapterId}/adjacent`, { headers }).then((r) => r.json()),
    ])
      .then(([pagesRes, adjRes]) => {
        if (cancelled) return;
        if (pagesRes.success) {
          setPages(pagesRes.data.pages);
          setTotalPages(pagesRes.data.total);
        }
        if (adjRes.success) setAdjacentInfo(adjRes.data);
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setPagesLoading(false); });
    return () => { cancelled = true; };
  }, [chapterId, token, chapter?.unlocked, chapter?.locked]);

  // ─── Bookmark state ──────────────────────────────────
  useEffect(() => {
    setBookmarked(chapterId in loadChapterBookmarks());
  }, [chapterId]);

  const toggleBookmark = useCallback(() => {
    if (!chapterId) return;
    const all = loadChapterBookmarks();
    if (chapterId in all) {
      clearChapterBookmark(chapterId);
      setBookmarked(false);
    } else {
      // Use the scroll-derived page so strip/prose bookmarks aren't page 0
      saveChapterBookmark(chapterId, activePageNumber);
      setBookmarked(true);
    }
  }, [chapterId, activePageNumber]);

  // ─── Resume at saved page (page mode) ────────────────
  useEffect(() => {
    if (!pages.length || pagesLoading || resumeAppliedRef.current || effectiveMode !== 'page') return;
    resumeAppliedRef.current = true;
    const saved = loadChapterBookmarks()[chapterId];
    if (typeof saved === 'number' && saved > 0 && saved < totalPages) {
      setCurrentPage(saved);
    }
  }, [pages.length, pagesLoading, effectiveMode, chapterId, totalPages]);

  // ─── Auto-hide chrome ────────────────────────────────
  const pokeChrome = useCallback(() => {
    setChromeVisible(true);
    if (idleTimerRef.current) window.clearTimeout(idleTimerRef.current);
    if (prefs.autoHideChrome) {
      idleTimerRef.current = window.setTimeout(() => setChromeVisible(false), CHROME_IDLE_MS);
    }
  }, [prefs.autoHideChrome]);

  useEffect(() => () => { if (idleTimerRef.current) window.clearTimeout(idleTimerRef.current); }, []);

  // ─── Progress tracking ───────────────────────────────

  // Save progress — debounced; the pending position is flushed on unmount
  useEffect(() => {
    if (!token || !chapterId) return;
    const pct = effectiveMode === 'page'
      ? (totalPages ? ((currentPage + 1) / totalPages) * 100 : 0)
      : scrollProgressPct;
    const payload = { chapterId, pageNumber: activePageNumber, completed: pct >= 95 };
    pendingProgressRef.current = payload;
    const timer = setTimeout(async () => {
      pendingProgressRef.current = null;
      try {
        await fetch('/api/reading/progress', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify(payload),
        });
      } catch { /* silently fail offline */ }
    }, 2000);
    return () => clearTimeout(timer);
  }, [token, chapterId, totalPages, currentPage, scrollProgressPct, activePageNumber, effectiveMode]);

  // Flush the final position when leaving the chapter
  useEffect(() => {
    return () => {
      const payload = pendingProgressRef.current;
      if (!payload || !token) return;
      pendingProgressRef.current = null;
      fetch('/api/reading/progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      }).catch(() => {});
    };
  }, [token]);

  // ─── Auto-scroll ─────────────────────────────────────
  useEffect(() => { currentPageRef.current = currentPage; }, [currentPage]);

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

  // Stop auto-scroll on manual scroll
  useEffect(() => {
    if (!autoScrollActive || effectiveMode === 'page') return;
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => {
      if (programmaticScrollRef.current) { programmaticScrollRef.current = false; return; }
      setAutoScrollActive(false);
    };
    el.addEventListener('scroll', onScroll);
    return () => el.removeEventListener('scroll', onScroll);
  }, [autoScrollActive, effectiveMode]);

  // Scroll progress (strip/prose)
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
        setScrollProgressPct(max > 0 ? Math.min(100, Math.max(0, (el.scrollTop / max) * 100)) : 0);
      });
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => { el.removeEventListener('scroll', onScroll); if (rafId) cancelAnimationFrame(rafId); };
  }, [effectiveMode, totalPages]);

  // Scroll to top on page change (page mode)
  useEffect(() => {
    if (effectiveMode !== 'page') return;
    scrollRef.current?.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  }, [currentPage, effectiveMode]);

  // ─── Preload adjacent pages (page mode) ──────────────
  useEffect(() => {
    if (effectiveMode !== 'page' || !pages.length) return;
    [currentPage + 1, currentPage - 1].forEach((i) => {
      const p = pages[i];
      if (p) { const img = new Image(); img.src = p.url; }
    });
  }, [currentPage, effectiveMode, pages]);

  // ─── Fullscreen ──────────────────────────────────────
  const toggleFullscreen = useCallback(() => {
    const el = readerRef.current;
    if (!el) return;
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else el.requestFullscreen().catch(() => {});
  }, []);

  useEffect(() => {
    const onFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  // ─── Navigation ──────────────────────────────────────
  const goNext = useCallback(() => {
    if (effectiveMode === 'strip') {
      scrollRef.current?.scrollBy({ top: window.innerHeight * 0.8, behavior: 'smooth' });
    } else if (effectiveMode === 'prose') {
      scrollRef.current?.scrollBy({ top: window.innerHeight * 0.7, behavior: 'smooth' });
    } else if (currentPage < totalPages - 1) {
      setCurrentPage((p) => p + 1);
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
      setCurrentPage((p) => p - 1);
    } else if (adjacentInfo.prevChapter) {
      router.push(`/reader/${adjacentInfo.prevChapter.id}`);
    }
  }, [currentPage, effectiveMode, adjacentInfo, router]);

  // ─── Keyboard ────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      const tag = el?.tagName;
      const typing = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || !!el?.isContentEditable;
      // Don't double-fire Space/Enter when a reader control already has focus
      if (typing) return;
      if (tag === 'BUTTON' && (e.key === ' ' || e.key === 'Enter')) return;

      switch (e.key) {
        case 'ArrowLeft':
          if (e.shiftKey) return;
          e.preventDefault(); setAutoScrollActive(false); goPrev();
          break;
        case 'ArrowRight':
          e.preventDefault(); setAutoScrollActive(false); goNext();
          break;
        case 'ArrowUp':
          e.preventDefault(); setAutoScrollActive(false);
          if (effectiveMode === 'page') goPrev(); else scrollRef.current?.scrollBy({ top: -window.innerHeight * 0.7, behavior: 'smooth' });
          break;
        case 'ArrowDown':
          e.preventDefault(); setAutoScrollActive(false);
          if (effectiveMode === 'page') goNext(); else scrollRef.current?.scrollBy({ top: window.innerHeight * 0.7, behavior: 'smooth' });
          break;
        case ' ':
          e.preventDefault(); setAutoScrollActive(false); goNext();
          break;
        case 'PageUp':
          e.preventDefault();
          if (effectiveMode === 'page') setCurrentPage((p) => Math.max(0, p - 1));
          else scrollRef.current?.scrollBy({ top: -window.innerHeight * 0.9, behavior: 'smooth' });
          break;
        case 'PageDown':
          e.preventDefault();
          if (effectiveMode === 'page') setCurrentPage((p) => Math.min(totalPages - 1, p + 1));
          else scrollRef.current?.scrollBy({ top: window.innerHeight * 0.9, behavior: 'smooth' });
          break;
        case 'Home':
          e.preventDefault();
          if (effectiveMode === 'page') setCurrentPage(0);
          else scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
          break;
        case 'End':
          e.preventDefault();
          if (effectiveMode === 'page') setCurrentPage(Math.max(0, totalPages - 1));
          else scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
          break;
        case 'f': case 'F':
          e.preventDefault(); toggleFullscreen();
          break;
        case 'b': case 'B':
          e.preventDefault(); toggleBookmark();
          break;
        case 't': case 'T':
          e.preventDefault();
          if (effectiveMode === 'prose') {
            const order: ProseTheme[] = ['dark', 'black', 'sepia', 'paper', 'contrast'];
            const next = order[(order.indexOf(prefs.theme) + 1) % order.length];
            setPrefs((p) => ({ ...p, theme: next }));
          }
          break;
        case 'c': case 'C':
          e.preventDefault(); setShowDrawer((s) => !s); setShowControls(false);
          break;
        case 'a': case 'A':
          if (effectiveMode !== 'prose') { e.preventDefault(); setAutoScrollActive((a) => !a); }
          break;
        case 'm': case 'M':
          if (hasProse) { e.preventDefault(); setMode((m) => (m === 'prose' ? null : 'prose')); }
          break;
        case 'z': case 'Z':
          e.preventDefault(); setFocusMode((f) => !f);
          break;
        case '?':
          e.preventDefault(); setShowHelp((h) => !h);
          break;
        case 'Escape':
          e.preventDefault();
          if (showHelp) setShowHelp(false);
          else if (showDrawer) setShowDrawer(false);
          else if (showControls) setShowControls(false);
          else if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
          else if (focusMode) setFocusMode(false);
          else setChromeVisible(true);
          break;
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [goNext, goPrev, toggleFullscreen, toggleBookmark, effectiveMode, hasProse, prefs.theme, totalPages, showHelp, showDrawer, showControls, focusMode]);

  // ─── Touch gestures ──────────────────────────────────
  const onTouchStart = useCallback((e: React.TouchEvent) => {
    const t = e.touches[0];
    touchStartRef.current = { x: t.clientX, y: t.clientY };
  }, []);

  const onTouchEnd = useCallback((e: React.TouchEvent) => {
    const start = touchStartRef.current;
    touchStartRef.current = null;
    if (!start || !prefs.gestures) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;

    // Swipe (page mode) — swiping left advances, matching the tap zones in both directions
    if (effectiveMode === 'page' && Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      if (dx < 0) goNext();
      else goPrev();
      return;
    }
    // Double-tap: zoom (strip) / toggle UI (page)
    const now = Date.now();
    if (now - lastTapRef.current < 320) {
      lastTapRef.current = 0;
      if (effectiveMode === 'strip') setPrefs((p) => ({ ...p, zoomed: !p.zoomed }));
      else setChromeVisible((c) => !c);
      return;
    }
    lastTapRef.current = now;
  }, [prefs.gestures, effectiveMode, goNext, goPrev]);

  const onTapNav = useCallback((e: React.MouseEvent) => {
    if (effectiveMode !== 'page' || !prefs.gestures) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const third = rect.width / 3;
    if (prefs.rtl) {
      if (x > third * 2) goPrev();
      else if (x < third) goNext();
      else { e.stopPropagation(); setChromeVisible((c) => !c); }
    } else {
      if (x < third) goPrev();
      else if (x > third * 2) goNext();
      else { e.stopPropagation(); setChromeVisible((c) => !c); }
    }
  }, [effectiveMode, prefs.gestures, prefs.rtl, goNext, goPrev]);

  // ─── Loading / error / lock states ───────────────────
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
            <p className="mt-1 text-xs text-mv-text-muted">Ch. {chapter.number} · {chapter.series.title}</p>
            <p className="mt-3 text-xs leading-relaxed text-mv-text-secondary">
              This chapter requires coins to unlock. Your balance:
              <span className="mx-1 font-medium text-mv-gold">{balance} 🪙</span>
            </p>

            <button
              onClick={handleUnlock}
              disabled={!canAfford || unlockChapter.isPending}
              className={`mt-6 w-full rounded-lg py-2.5 text-xs font-medium text-white transition-colors ${
                canAfford && !unlockChapter.isPending ? 'bg-mv-accent hover:brightness-110' : 'bg-mv-surface text-mv-text-dim cursor-not-allowed'
              }`}
            >
              {unlockChapter.isPending ? 'Unlocking...' : canAfford ? `Unlock for ${cost} 🪙` : `Need ${cost - balance} more coins`}
            </button>

            {!token && (
              <Link href="/login" className="mt-3 inline-block text-[10px] text-mv-accent hover:underline">
                Sign in to unlock with coins
              </Link>
            )}
            {unlockError && <p className="mt-3 text-[10px] text-red-400">{unlockError}</p>}
            <Link href={`/title/${chapter.series.slug}`} className="mt-4 inline-block text-[10px] text-mv-text-muted hover:text-mv-text transition-colors">
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

  const wordCount = wordsIn(chapter.contentText);
  const totalMinutes = wordCount > 0 ? Math.max(1, Math.round(wordCount / READING_WPM)) : 0;
  const minutesLeft = totalMinutes > 0 ? Math.max(1, Math.round(totalMinutes * (1 - scrollProgressPct / 100))) : 0;

  const chrome = chromeVisible && !focusMode;
  const chromeStyle = { opacity: prefs.controlOpacity };

  return (
    <main
      ref={readerRef}
      onMouseMove={pokeChrome}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      className="relative flex h-screen flex-col overflow-hidden bg-black"
      style={{ filter: `brightness(${prefs.brightness})` }}
    >
      {/* ── Content ───────────────────────────────────── */}
      <div
        ref={scrollRef}
        onClick={onTapNav}
        className={cn('flex-1 overflow-y-auto', effectiveMode === 'page' && 'flex items-start justify-center')}
      >
        {pagesLoading ? (
          <div className="flex items-center justify-center h-[80vh]">
            <div className="flex flex-col items-center gap-3">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-mv-accent border-t-transparent" />
              <p className="text-xs text-mv-text-muted">Loading pages...</p>
            </div>
          </div>
        ) : effectiveMode === 'prose' && hasProse ? (
          /* ── Prose ─────────────────────────── */
          <div className="mx-auto min-h-full px-5 py-10 transition-colors duration-300" style={{ backgroundColor: t.bg, color: t.text }}>
            <div className="mx-auto max-w-[42rem]">
              <p className="mb-6 text-center text-[10px] uppercase tracking-[0.25em]" style={{ color: t.muted }}>
                {chapter.series.title} — Ch. {chapter.number}
              </p>
              <div className="whitespace-pre-wrap leading-relaxed" style={{ fontSize: `${prefs.fontSize}px`, lineHeight: prefs.lineHeight, fontFamily: prefs.fontFamily === 'serif' ? 'Georgia, "Times New Roman", serif' : 'inherit' }}>
                {chapter.contentText}
              </div>
              <div className="mt-10 flex items-center justify-center gap-3">
                <button onClick={goPrev} className="rounded-lg border border-white/10 px-4 py-2 text-xs transition-colors hover:border-mv-accent/50" style={{ color: t.muted }}>
                  ← Prev
                </button>
                {adjacentInfo.nextChapter && (
                  <button onClick={() => router.push(`/reader/${adjacentInfo.nextChapter?.id}`)} className="rounded-lg bg-mv-accent px-4 py-2 text-xs font-medium text-white transition-colors hover:brightness-110">
                    Next Chapter →
                  </button>
                )}
              </div>
            </div>
          </div>
        ) : effectiveMode === 'strip' ? (
          /* ── Strip ─────────────────────────── */
          <div className={cn('mx-auto', prefs.zoomed ? 'max-w-none' : 'max-w-[700px]')}>
            {pages.map((p, i) => (
              <div key={i} className="w-full">
                <PageImage
                  src={p.url}
                  alt={`Page ${i + 1} of Ch. ${chapter.number}`}
                  fadeIn={false}
                  eager={i < 2}
                  className="w-full"
                />
                <p className="py-1.5 text-center text-[9px] text-mv-text-dim">— {i + 1} —</p>
              </div>
            ))}
          </div>
        ) : (
          /* ── Single page ────────────────────── */
          <div className={cn('relative w-full', isRTL ? '' : 'max-w-[700px]')}>
            <div className="flex min-h-[85vh] items-center justify-center bg-mv-darker">
              {pages[currentPage] ? (
                <PageImage
                  src={pages[currentPage].url}
                  alt={`Page ${currentPage + 1} of Ch. ${chapter.number}`}
                  eager
                  className="w-full"
                />
              ) : (
                <p className="text-xs text-mv-text-muted">Preparing page…</p>
              )}
            </div>
            <p className="py-1.5 text-center text-[9px] text-mv-text-dim">— {currentPage + 1} —</p>
          </div>
        )}
      </div>

      {/* ── Floating top bar ──────────────────────────── */}
      <div
        className={cn(
          'absolute inset-x-0 top-0 z-30 flex h-12 items-center gap-2 border-b border-mv-border/70 bg-mv-darker/85 px-3 backdrop-blur-xl transition-all duration-300 sm:px-4',
          chrome ? 'translate-y-0 opacity-100' : '-translate-y-full opacity-0 pointer-events-none',
        )}
        style={chromeStyle}
      >
        <Link href={chapterListHref} className="flex min-w-0 items-center gap-1.5 text-xs text-mv-text-muted hover:text-mv-text transition-colors">
          <Icon name="arrowLeft" size={13} />
          <span className="truncate">{chapter.series.title}</span>
        </Link>
        <span className="shrink-0 text-[11px] text-mv-text-dim">Ch. {chapter.number}</span>

        <div className="mx-2 hidden h-1 flex-1 overflow-hidden rounded-full bg-white/10 sm:block">
          <div className="h-full rounded-full bg-gradient-to-r from-mv-purple to-mv-accent transition-all duration-300" style={{ width: `${progressPct}%` }} />
        </div>

        <div className="ml-auto flex items-center gap-1">
          {!online && (
            <span className="flex items-center gap-1 rounded-full border border-mv-warning/30 bg-mv-warning/10 px-2 py-0.5 text-[9px] font-medium text-mv-warning">
              <Icon name="info" size={9} /> Offline
            </span>
          )}
          <button
            onClick={toggleBookmark}
            aria-pressed={bookmarked}
            aria-label={bookmarked ? 'Remove bookmark' : 'Bookmark this page'}
            title="Bookmark (B)"
            className={cn('flex h-8 w-8 items-center justify-center rounded-lg transition-colors', bookmarked ? 'text-mv-gold' : 'text-mv-text-muted hover:bg-white/5 hover:text-white')}
          >
            <Icon name="bookmark" size={15} />
          </button>
          <button
            onClick={() => { setShowDrawer((s) => !s); setShowControls(false); }}
            aria-expanded={showDrawer}
            aria-label="Chapter list (C)"
            title="Chapter list (C)"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-mv-text-muted transition-colors hover:bg-white/5 hover:text-white"
          >
            <Icon name="list" size={15} />
          </button>
          <button
            onClick={() => setFocusMode((f) => !f)}
            aria-pressed={focusMode}
            aria-label="Focus mode (Z)"
            title="Focus mode (Z)"
            className={cn('flex h-8 w-8 items-center justify-center rounded-lg transition-colors', focusMode ? 'text-mv-accent' : 'text-mv-text-muted hover:bg-white/5 hover:text-white')}
          >
            <Icon name="expand" size={15} />
          </button>
        </div>
      </div>

      {/* ── Floating bottom bar ───────────────────────── */}
      <div
        className={cn(
          'absolute inset-x-0 bottom-0 z-30 flex h-12 items-center gap-2 border-t border-mv-border/70 bg-mv-darker/85 px-3 backdrop-blur-xl transition-all duration-300 sm:px-4',
          chrome ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0 pointer-events-none',
        )}
        style={chromeStyle}
      >
        <button
          onClick={effectiveMode === 'page' ? (isRTL ? goNext : goPrev) : goPrev}
          disabled={effectiveMode === 'page' ? (isRTL ? currentPage >= totalPages - 1 && !adjacentInfo.nextChapter : currentPage === 0 && !adjacentInfo.prevChapter) : scrollProgressPct < 2 && !adjacentInfo.prevChapter}
          className="flex items-center gap-1 rounded-lg border border-mv-border-light bg-mv-surface px-3 py-1.5 text-[10px] text-mv-text-secondary transition-colors hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <Icon name="chevronLeft" size={12} />
          {effectiveMode === 'page' && isRTL && currentPage >= totalPages - 1 && adjacentInfo.nextChapter ? `Ch. ${adjacentInfo.nextChapter.number}` : effectiveMode === 'page' && !isRTL && currentPage === 0 && adjacentInfo.prevChapter ? `Ch. ${adjacentInfo.prevChapter.number}` : 'Prev'}
        </button>

        <span className="shrink-0 text-[10px] text-mv-text-muted">
          {effectiveMode === 'page' ? `${currentPage + 1} / ${totalPages || '?'}` : `${Math.round(scrollProgressPct)}%`}
        </span>

        <div className="hidden h-1 max-w-[240px] flex-1 overflow-hidden rounded-full bg-white/10 sm:block">
          <div className="h-full rounded-full bg-gradient-to-r from-mv-purple to-mv-accent transition-all duration-300" style={{ width: `${progressPct}%` }} />
        </div>

        {effectiveMode === 'prose' && totalMinutes > 0 && (
          <span className="hidden shrink-0 text-[9px] text-mv-text-muted sm:block">≈ {minutesLeft} min left</span>
        )}

        <button
          onClick={() => { setShowControls((s) => !s); setShowDrawer(false); }}
          aria-expanded={showControls}
          aria-label="Reader controls"
          title="Controls"
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-mv-border-light bg-mv-surface text-mv-text-secondary transition-colors hover:border-mv-violet/40 hover:text-white"
        >
          <Icon name="settings" size={14} />
        </button>
        <button
          onClick={toggleFullscreen}
          aria-label={isFullscreen ? 'Exit fullscreen' : 'Fullscreen (F)'}
          title="Fullscreen (F)"
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-mv-border-light bg-mv-surface text-mv-text-secondary transition-colors hover:border-mv-violet/40 hover:text-white"
        >
          <Icon name="expand" size={14} />
        </button>
        <button
          onClick={effectiveMode === 'page' ? (isRTL ? goPrev : goNext) : goNext}
          disabled={effectiveMode === 'page' ? (isRTL ? currentPage === 0 && !adjacentInfo.prevChapter : currentPage >= totalPages - 1 && !adjacentInfo.nextChapter) : scrollProgressPct >= 98 && !adjacentInfo.nextChapter}
          className="flex items-center gap-1 rounded-lg border border-mv-border-light bg-mv-surface px-3 py-1.5 text-[10px] text-mv-text-secondary transition-colors hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
        >
          {effectiveMode === 'page' && !isRTL && currentPage >= totalPages - 1 && adjacentInfo.nextChapter ? `Ch. ${adjacentInfo.nextChapter.number}` : effectiveMode === 'page' && isRTL && currentPage === 0 && adjacentInfo.prevChapter ? `Ch. ${adjacentInfo.prevChapter.number}` : 'Next'}
          <Icon name="chevronRight" size={12} />
        </button>
      </div>

      {/* ── Overlays ──────────────────────────────────── */}
      <ControlCenter
        open={showControls}
        onClose={() => setShowControls(false)}
        prefs={prefs}
        setPrefs={setPrefs}
        effectiveMode={effectiveMode}
        setMode={setMode}
        hasProse={hasProse}
        formatKey={formatKey}
        isFullscreen={isFullscreen}
        toggleFullscreen={toggleFullscreen}
        autoScroll={autoScrollActive}
        autoScrollSpeed={autoScrollSpeed}
        setAutoScroll={setAutoScrollActive}
        setAutoScrollSpeed={setAutoScrollSpeed}
        onHelp={() => setShowHelp(true)}
      />

      <ChapterDrawer
        open={showDrawer}
        onClose={() => setShowDrawer(false)}
        seriesSlug={chapter.series.slug}
        seriesTitle={chapter.series.title}
        currentChapterId={chapter.id}
      />

      <ShortcutHelp open={showHelp} onClose={() => setShowHelp(false)} />

      {/* Focus mode hint */}
      {focusMode && !chromeVisible && (
        <button
          onClick={() => { setFocusMode(false); setChromeVisible(true); }}
          className="absolute bottom-16 left-1/2 z-30 -translate-x-1/2 rounded-full border border-white/10 bg-black/50 px-3 py-1 text-[9px] text-mv-text-muted backdrop-blur-sm transition-opacity hover:text-white animate-fade-in"
        >
          Move or tap to reveal · Esc to exit focus
        </button>
      )}

      {/* Keyboard hint (desktop, chrome visible) */}
      {chrome && (
        <div className="pointer-events-none fixed bottom-14 right-3 z-20 hidden md:block">
          <div className="rounded-lg border border-mv-border bg-mv-darker/85 px-3 py-2 text-[9px] text-mv-text-dim backdrop-blur-sm">
            <p>
              ← → Navigate · <span className="text-mv-accent">Space</span> Next · <span className="text-mv-accent">F</span> Full · <span className="text-mv-accent">B</span> Bookmark · <span className="text-mv-accent">C</span> Chapters
              {hasProse && <> · <span className="text-mv-accent">M</span> Prose · <span className="text-mv-accent">T</span> Theme</>}
              {' '}· <span className="text-mv-accent">?</span> Help
            </p>
          </div>
        </div>
      )}
    </main>
  );
}
