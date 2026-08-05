'use client';

/* ═══════════════════════════════════════════════════════════════
   Reader preferences — the customization surface for the reader.
   Everything is persisted to localStorage and merged over defaults
   so new fields never break saved users. Also owns the lightweight
   chapter-bookmark store (page-level marks are kept per chapter).
   ═══════════════════════════════════════════════════════════════ */

export type ReaderMode = 'page' | 'strip' | 'prose';
export type ProseTheme = 'dark' | 'black' | 'sepia' | 'paper' | 'contrast';

export interface ReaderPrefs {
  rtl: boolean;
  zoomed: boolean;
  fontFamily: 'serif' | 'sans';
  fontSize: number;
  lineHeight: number;
  theme: ProseTheme;
  /** Reader chrome / immersion */
  brightness: number;        // 0.6 – 1.2
  controlOpacity: number;    // 0.35 – 1
  pageTransitions: boolean;  // crossfade page flips
  gestures: boolean;         // touch/dbl-tap gestures on
  autoHideChrome: boolean;   // fade controls while reading
}

const READER_PREFS_KEY = 'mangaverse_reader_prefs';
const READER_BOOKMARKS_KEY = 'mangaverse_reader_bookmarks'; // chapterId → pageIndex

export const DEFAULT_PREFS: ReaderPrefs = {
  rtl: false,
  zoomed: false,
  fontFamily: 'serif',
  fontSize: 18,
  lineHeight: 1.9,
  theme: 'dark',
  brightness: 1,
  controlOpacity: 0.9,
  pageTransitions: true,
  gestures: true,
  autoHideChrome: true,
};

export function loadPrefs(): ReaderPrefs {
  if (typeof window === 'undefined') return DEFAULT_PREFS;
  try {
    const raw = localStorage.getItem(READER_PREFS_KEY);
    if (raw) return { ...DEFAULT_PREFS, ...JSON.parse(raw) };
  } catch {
    // ignore corrupt prefs
  }
  return DEFAULT_PREFS;
}

export function savePrefs(prefs: ReaderPrefs): void {
  try {
    localStorage.setItem(READER_PREFS_KEY, JSON.stringify(prefs));
  } catch {
    // quota errors — ignore
  }
}

/** Prose theme palette (CSS-var driven). */
export const THEMES: Record<ProseTheme, { bg: string; text: string; muted: string; label: string }> = {
  dark: { bg: 'var(--reader-bg-dark)', text: 'var(--reader-text-dark)', muted: 'var(--reader-muted-dark)', label: 'Dark' },
  black: { bg: '#000000', text: '#d4d4d8', muted: '#6b6b72', label: 'Pure Black' },
  sepia: { bg: 'var(--reader-bg-sepia)', text: 'var(--reader-text-sepia)', muted: 'var(--reader-muted-sepia)', label: 'Sepia' },
  paper: { bg: '#f5f1e8', text: '#2a2419', muted: '#7a7364', label: 'Paper' },
  contrast: { bg: '#0a0a0a', text: '#ffffff', muted: '#d4d4d8', label: 'High Contrast' },
};

// ─── Chapter bookmarks ───────────────────────────────

export function loadChapterBookmarks(): Record<string, number> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(READER_BOOKMARKS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function saveChapterBookmark(chapterId: string, pageIndex: number): void {
  try {
    const all = loadChapterBookmarks();
    all[chapterId] = pageIndex;
    localStorage.setItem(READER_BOOKMARKS_KEY, JSON.stringify(all));
  } catch {
    // ignore
  }
}

export function clearChapterBookmark(chapterId: string): void {
  try {
    const all = loadChapterBookmarks();
    delete all[chapterId];
    localStorage.setItem(READER_BOOKMARKS_KEY, JSON.stringify(all));
  } catch {
    // ignore
  }
}
