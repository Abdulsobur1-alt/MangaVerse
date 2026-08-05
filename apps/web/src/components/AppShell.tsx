'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { TopBar } from '@/components/TopBar';
import { useTrendingTitles } from '@/lib/hooks/useTitles';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';

/* ═══════════════════════════════════════════════════════════════
   AppShell — the global navigation & search layer.
   • Desktop: floating collapsible sidebar (icons → expands on hover)
   • Mobile:  bottom navigation + floating search button
   • Global:  Cmd/Ctrl+K command palette (search across titles)
   Pages render <AppShell>…content…</AppShell>.
   ═══════════════════════════════════════════════════════════════ */

const SIDEBAR_ITEMS = [
  { href: '/', label: 'Home', icon: 'M3 12l9-9 9 9M5 10v10a1 1 0 001 1h4v-6h4v6h4a1 1 0 001-1V10' },
  { href: '/browse', label: 'Browse', icon: 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z' },
  { href: '/library', label: 'Library', icon: 'M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z' },
  { href: '/community', label: 'Community', icon: 'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z' },
  { href: '/history', label: 'History', icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z' },
  { href: '/dashboard', label: 'Dashboard', icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z' },
  { href: '/notifications', label: 'Alerts', icon: 'M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9' },
  { href: '/settings', label: 'Settings', icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z' },
] as const;

const MOBILE_NAV = [
  { href: '/', label: 'Home', icon: 'M3 12l9-9 9 9M5 10v10a1 1 0 001 1h4v-6h4v6h4a1 1 0 001-1V10' },
  { href: '/browse', label: 'Browse', icon: 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z' },
  { href: '/library', label: 'Library', icon: 'M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z' },
  { href: '/community', label: 'Community', icon: 'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z' },
  { href: '/dashboard', label: 'Profile', icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z' },
] as const;

interface SearchHit {
  id: string;
  slug: string;
  title: string;
  type: string;
  coverUrl: string | null;
  rating?: number;
  status?: string;
}

function isActive(pathname: string, href: string): boolean {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}

function typeIcon(type?: string): string {
  switch ((type || '').toUpperCase()) {
    case 'MANHWA': return '🇰🇷';
    case 'MANHUA': return '🇨🇳';
    case 'LIGHT_NOVEL': return '📕';
    default: return '📖';
  }
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { token } = useAuthStore();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const { data: trending } = useTrendingTitles();

  const trendingList = (trending || []).slice(0, 7);
  const flatList = query.trim() ? results : trendingList;
  const isSearching = query.trim() && searching;

  // ── Cmd/Ctrl+K global shortcut ────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Focus the input when the palette opens
  useEffect(() => {
    if (paletteOpen) {
      setQuery('');
      setResults([]);
      setActiveIndex(0);
      const t = setTimeout(() => inputRef.current?.focus(), 40);
      return () => clearTimeout(t);
    }
  }, [paletteOpen]);

  // Debounced live search
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        const data = await api.get<{ items: SearchHit[] }>(`/titles?search=${encodeURIComponent(query.trim())}&limit=8`);
        setResults(data.items || []);
      } catch {
        setResults([]);
      }
      setSearching(false);
      setActiveIndex(0);
    }, 220);
    return () => clearTimeout(timer);
  }, [query]);

  // Close on Escape
  useEffect(() => {
    if (!paletteOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPaletteOpen(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [paletteOpen]);

  // Lock body scroll while the palette is open
  useEffect(() => {
    document.body.style.overflow = paletteOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [paletteOpen]);

  const go = (slug: string) => {
    setPaletteOpen(false);
    router.push(`/title/${slug}`);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, flatList.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const hit = flatList[activeIndex];
      if (hit) go(hit.slug);
    }
  };

  return (
    <div className="min-h-screen bg-mv-dark">
      {/* ─── Desktop sidebar (collapsible, floats on hover) ─── */}
      <aside className="group/side fixed inset-y-0 left-0 z-50 hidden md:block">
        <div className="flex h-full w-14 flex-col border-r border-mv-border/60 bg-mv-darker/85 px-2 py-3 backdrop-blur-xl transition-all duration-300 ease-out group-hover/side:w-60 group-hover/side:items-stretch group-hover/side:border-r-mv-border group-hover/side:px-3 group-hover/side:shadow-modal">
          {/* Logo */}
          <Link href="/" className="mb-4 flex items-center gap-2.5 rounded-xl px-1.5 py-1.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-mv-purple to-mv-accent shadow-glow-sm">
              <svg className="h-4.5 w-4.5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
              </svg>
            </span>
            <span className="whitespace-nowrap text-base font-bold tracking-tight text-white opacity-0 transition-opacity duration-200 group-hover/side:opacity-100">
              Manga<span className="text-mv-violet">Verse</span>
            </span>
          </Link>

          {/* Nav items */}
          <nav className="flex flex-col gap-1">
            {SIDEBAR_ITEMS.map((item) => {
              const active = isActive(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  title={item.label}
                  aria-label={item.label}
                  className={`group/item relative flex items-center gap-3 rounded-xl px-2.5 py-2.5 transition-all duration-200 ${
                    active
                      ? 'bg-mv-accent/15 text-mv-violet'
                      : 'text-mv-text-muted hover:bg-white/5 hover:text-mv-text'
                  }`}
                >
                  {active && (
                    <span className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-gradient-to-b from-mv-purple to-mv-accent" />
                  )}
                  <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
                  </svg>
                  <span className="whitespace-nowrap text-xs font-medium opacity-0 transition-opacity duration-200 group-hover/side:opacity-100">
                    {item.label}
                  </span>
                </Link>
              );
            })}
          </nav>

          {/* Bottom: app download + avatar */}
          <div className="mt-auto flex flex-col gap-1.5">
            <Link
              href="/download"
              title="Get the App"
              className="flex items-center gap-3 rounded-xl px-2.5 py-2.5 text-mv-text-muted transition-colors hover:bg-white/5 hover:text-mv-violet"
            >
              <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span className="whitespace-nowrap text-xs font-medium opacity-0 transition-opacity duration-200 group-hover/side:opacity-100">Get the App</span>
            </Link>
            <Link
              href={token ? '/dashboard' : '/login'}
              title="Account"
              className="flex items-center gap-3 rounded-xl px-2.5 py-2 text-mv-text-muted transition-colors hover:bg-white/5 hover:text-mv-text"
            >
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-mv-purple to-mv-accent text-[10px] font-bold text-white">
                {token ? 'U' : '→'}
              </span>
              <span className="whitespace-nowrap text-xs font-medium opacity-0 transition-opacity duration-200 group-hover/side:opacity-100">
                {token ? 'Account' : 'Sign in'}
              </span>
            </Link>
          </div>
        </div>
      </aside>

      {/* ─── Content column ─────────────────────────────────── */}
      <div className="md:pl-14">
        <TopBar onOpenSearch={() => setPaletteOpen(true)} />
        <main className="min-h-[calc(100vh-56px)] pb-24 md:pb-0">{children}</main>
      </div>

      {/* ─── Mobile bottom navigation ───────────────────────── */}
      <nav className="fixed inset-x-0 bottom-0 z-50 md:hidden" aria-label="Mobile navigation">
        <div className="relative border-t border-mv-border/70 bg-mv-darker/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl">
          {/* Floating search button */}
          <button
            onClick={() => setPaletteOpen(true)}
            aria-label="Search"
            className="absolute -top-7 left-1/2 flex h-14 w-14 -translate-x-1/2 items-center justify-center rounded-full bg-gradient-to-br from-mv-purple to-mv-accent text-white shadow-glow transition-transform active:scale-95"
          >
            <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </button>

          <div className="grid h-16 grid-cols-5 px-2">
            {MOBILE_NAV.map((item) => {
              const active = isActive(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex flex-col items-center justify-center gap-1 rounded-xl transition-colors"
                >
                  <span
                    className={`flex h-8 w-12 items-center justify-center rounded-full transition-all duration-300 ${
                      active ? 'bg-mv-accent/20 text-mv-violet' : 'text-mv-text-muted'
                    }`}
                  >
                    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8}>
                      <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
                    </svg>
                  </span>
                  <span className={`text-[9px] font-medium ${active ? 'text-mv-violet' : 'text-mv-text-dim'}`}>{item.label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      </nav>

      {/* ─── Command palette (Cmd+K) ────────────────────────── */}
      {paletteOpen && (
        <div
          className="fixed inset-0 z-[90] flex items-start justify-center bg-black/70 p-4 pt-[12vh] backdrop-blur-sm animate-fade-in"
          onClick={() => setPaletteOpen(false)}
        >
          <div
            className="w-full max-w-xl overflow-hidden rounded-2xl border border-mv-border bg-mv-darker shadow-modal animate-scale-in"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Search titles"
          >
            {/* Input */}
            <div className="flex items-center gap-3 border-b border-mv-border px-4">
              <svg className="h-5 w-5 shrink-0 text-mv-text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder="Search titles, authors, genres…"
                className="h-14 w-full bg-transparent text-sm text-mv-text outline-none placeholder:text-mv-text-dim"
              />
              {isSearching && <div className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-mv-violet border-t-transparent" />}
              <button
                onClick={() => setPaletteOpen(false)}
                className="shrink-0 rounded-md border border-mv-border px-1.5 py-0.5 text-[9px] text-mv-text-dim transition-colors hover:text-mv-text"
              >
                ESC
              </button>
            </div>

            {/* Results */}
            <div className="max-h-[46vh] overflow-y-auto p-2">
              <p className="px-3 pb-1.5 pt-2 text-[9px] font-semibold uppercase tracking-[0.14em] text-mv-text-muted">
                {query.trim() ? (searching ? 'Searching…' : results.length > 0 ? 'Results' : 'No results') : 'Trending now'}
              </p>

              {flatList.length === 0 && !searching && (
                <div className="px-3 py-8 text-center">
                  <p className="text-xs text-mv-text-muted">
                    {query.trim() ? `Nothing found for “${query}”` : 'No trending titles right now'}
                  </p>
                  <p className="mt-1 text-[10px] text-mv-text-dim">Try a different title, or browse all titles.</p>
                  <button
                    onClick={() => {
                      setPaletteOpen(false);
                      router.push(query.trim() ? `/browse?search=${encodeURIComponent(query.trim())}` : '/browse');
                    }}
                    className="mt-4 rounded-full bg-mv-accent/15 px-4 py-1.5 text-[11px] font-medium text-mv-violet transition-colors hover:bg-mv-accent/25"
                  >
                    {query.trim() ? `Search for “${query}”` : 'Browse all titles'}
                  </button>
                </div>
              )}

              {flatList.map((hit, i) => (
                <button
                  key={`${hit.id}-${i}`}
                  onClick={() => go(hit.slug)}
                  onMouseEnter={() => setActiveIndex(i)}
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors ${
                    i === activeIndex ? 'bg-mv-accent/15' : 'hover:bg-white/5'
                  }`}
                >
                  <span className="flex h-11 w-8 shrink-0 items-center justify-center overflow-hidden rounded-md bg-mv-surface text-sm">
                    {hit.coverUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={hit.coverUrl} alt="" className="h-full w-full object-cover" />
                    ) : (
                      typeIcon(hit.type)
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-medium text-mv-text">{hit.title}</span>
                    <span className="mt-0.5 flex items-center gap-2 text-[10px] text-mv-text-muted">
                      <span>{typeIcon(hit.type)} {hit.type?.replace(/_/g, ' ')}</span>
                      {hit.rating ? <span className="text-mv-gold">★ {hit.rating.toFixed(1)}</span> : null}
                      {hit.status ? <span className="capitalize">{hit.status}</span> : null}
                    </span>
                  </span>
                  <svg className="h-3.5 w-3.5 shrink-0 text-mv-text-dim" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              ))}
            </div>

            {/* Footer hints */}
            <div className="flex items-center gap-4 border-t border-mv-border px-4 py-2.5 text-[9px] text-mv-text-dim">
              <span><kbd className="rounded border border-mv-border bg-mv-surface px-1">↑↓</kbd> navigate</span>
              <span><kbd className="rounded border border-mv-border bg-mv-surface px-1">↵</kbd> open</span>
              <Link href="/browse" onClick={() => setPaletteOpen(false)} className="ml-auto font-medium text-mv-violet transition-colors hover:text-mv-violet/80">
                Advanced search →
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
