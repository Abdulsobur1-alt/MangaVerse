'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Icon, type IconName } from '@/components/ui/Icon';
import { useAuthStore } from '@/store/authStore';
import { useUnreadCount } from '@/lib/hooks/useNotifications';
import { useReadingHistory } from '@/lib/hooks/useReadingStats';
import { ThemeSwitcher } from './ThemeSwitcher';
import { useResumeData, ContinueReading } from './ContinueReading';
import { cn } from '@/lib/cn';

/* ═══════════════════════════════════════════════════════════════
   Sidebar — the desktop navigation rail. Icons at rest, expands on
   hover to reveal section labels, Continue Reading progress, and
   recently viewed titles. Linear/Arc-inspired grouping.
   ═══════════════════════════════════════════════════════════════ */

interface NavItem {
  href: string;
  label: string;
  icon: IconName;
  badge?: number;
}

const PRIMARY: NavItem[] = [
  { href: '/', label: 'Home', icon: 'home' },
  { href: '/browse', label: 'Discover', icon: 'compass' },
  { href: '/library', label: 'Library', icon: 'library' },
  { href: '/community', label: 'Community', icon: 'community' },
];

const OVERVIEW: NavItem[] = [
  { href: '/history', label: 'History', icon: 'history' },
  { href: '/dashboard', label: 'Profile', icon: 'dashboard' },
  { href: '/collections', label: 'Collections', icon: 'sparkles' },
  { href: '/goals', label: 'Goals', icon: 'zap' },
  { href: '/notifications', label: 'Alerts', icon: 'bell' },
  { href: '/settings', label: 'Settings', icon: 'settings' },
];

function isActive(pathname: string, href: string): boolean {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="hidden whitespace-nowrap px-3 pb-1 pt-3 text-[9px] font-semibold uppercase tracking-[0.14em] text-mv-text-dim group-hover/side:block">
      {children}
    </p>
  );
}

function NavLink({ item, pathname }: { item: NavItem; pathname: string }) {
  const active = isActive(pathname, item.href);
  return (
    <Link
      href={item.href}
      title={item.label}
      aria-label={item.label}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'group/item relative flex items-center gap-3 rounded-xl px-2.5 py-2.5 transition-all duration-200',
        active ? 'bg-mv-accent/15 text-mv-violet' : 'text-mv-text-muted hover:bg-white/5 hover:text-mv-text',
      )}
    >
      {active && (
        <span className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-gradient-to-b from-mv-purple to-mv-accent" />
      )}
      <Icon name={item.icon} size={20} strokeWidth={active ? 2.2 : 1.8} className="shrink-0" />
      <span className="whitespace-nowrap text-xs font-medium opacity-0 transition-opacity duration-200 group-hover/side:opacity-100">
        {item.label}
      </span>
      {item.badge ? (
        <span className="ml-auto flex h-4 min-w-4 items-center justify-center rounded-full bg-gradient-to-r from-mv-accent to-mv-purple px-1 text-[8px] font-bold text-white opacity-0 transition-opacity duration-200 group-hover/side:opacity-100">
          {item.badge > 99 ? '99+' : item.badge}
        </span>
      ) : null}
    </Link>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const { token, user } = useAuthStore();
  const { data: unreadData } = useUnreadCount();
  const resume = useResumeData(3);
  const { data: history } = useReadingHistory(1, 3);
  const [online, setOnline] = useState(true);

  useEffect(() => {
    setOnline(navigator.onLine);
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);

  const unread = unreadData?.count || 0;
  const overview = OVERVIEW.map((item) => (item.href === '/notifications' ? { ...item, badge: unread } : item));
  const recent = token && history ? history.items.slice(0, 3) : [];
  const resumeEntries = resume?.entries ?? [];

  return (
    <aside className="group/side fixed inset-y-0 left-0 z-50 hidden md:block">
      <div className="flex h-full w-14 flex-col border-r border-mv-border/60 bg-mv-darker/85 px-2 py-3 backdrop-blur-xl transition-all duration-300 ease-out group-hover/side:w-60 group-hover/side:px-3 group-hover/side:shadow-modal">
        {/* Logo */}
        <Link href="/" className="mb-2 flex items-center gap-2.5 rounded-xl px-1.5 py-1.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-mv-purple to-mv-accent shadow-glow-sm">
            <Icon name="library" size={18} strokeWidth={2.2} className="text-white" />
          </span>
          <span className="whitespace-nowrap text-base font-bold tracking-tight text-white opacity-0 transition-opacity duration-200 group-hover/side:opacity-100">
            Manga<span className="text-mv-violet">Verse</span>
          </span>
        </Link>

        {/* Primary */}
        <nav aria-label="Primary" className="flex flex-col gap-1">
          <SectionLabel>Discover</SectionLabel>
          {PRIMARY.map((item) => (
            <NavLink key={item.href} item={item} pathname={pathname} />
          ))}
        </nav>

        {/* Continue reading */}
        {resumeEntries.length > 0 && (
          <div className="mt-2 border-t border-mv-border/50 pt-1">
            <SectionLabel>Continue Reading</SectionLabel>
            <div className="hidden group-hover/side:block">
              <ContinueReading entries={resumeEntries} limit={3} />
            </div>
          </div>
        )}

        {/* Overview */}
        <nav aria-label="Overview" className="mt-2 flex flex-col gap-1 border-t border-mv-border/50 pt-1">
          <SectionLabel>Overview</SectionLabel>
          {overview.map((item) => (
            <NavLink key={item.href} item={item} pathname={pathname} />
          ))}
        </nav>

        {/* Recently viewed */}
        {recent.length > 0 && (
          <div className="mt-2 border-t border-mv-border/50 pt-1">
            <SectionLabel>Recently Viewed</SectionLabel>
            <div className="hidden space-y-0.5 group-hover/side:block">
              {recent.map((entry: any) => (
                <Link
                  key={entry.id}
                  href={`/reader/${entry.chapter.id}`}
                  title={entry.chapter.series.title}
                  className="flex items-center gap-2.5 rounded-xl px-2 py-1.5 transition-colors hover:bg-white/5"
                >
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-mv-surface text-[10px]">
                    {entry.chapter.series.title.charAt(0).toUpperCase()}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[10px] text-mv-text-muted">{entry.chapter.series.title}</span>
                    <span className="text-[8px] text-mv-text-dim">Ch. {entry.chapter.number}</span>
                  </span>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="mt-auto flex flex-col gap-1.5 border-t border-mv-border/50 pt-2">
          <Link
            href="/download"
            title="Get the App"
            className="flex items-center gap-3 rounded-xl px-2.5 py-2.5 text-mv-text-muted transition-colors hover:bg-white/5 hover:text-mv-violet"
          >
            <Icon name="download" size={20} className="shrink-0" />
            <span className="whitespace-nowrap text-xs font-medium opacity-0 transition-opacity duration-200 group-hover/side:opacity-100">
              Get the App
            </span>
          </Link>

          <ThemeSwitcher labelled />

          {!online && (
            <div className="flex items-center gap-3 rounded-xl px-2.5 py-2 text-mv-text-muted">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center">
                <span className="h-2 w-2 rounded-full bg-mv-warning animate-pulse-dot" />
              </span>
              <span className="whitespace-nowrap text-[10px] font-medium opacity-0 transition-opacity duration-200 group-hover/side:opacity-100">
                Offline — cached reads only
              </span>
            </div>
          )}

          <Link
            href={token ? '/dashboard' : '/login'}
            title="Account"
            className="flex items-center gap-3 rounded-xl px-2.5 py-2 text-mv-text-muted transition-colors hover:bg-white/5 hover:text-mv-text"
          >
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-mv-purple to-mv-accent text-[10px] font-bold text-white">
              {token ? user?.displayName?.charAt(0)?.toUpperCase() || 'U' : '→'}
            </span>
            <span className="whitespace-nowrap text-xs font-medium opacity-0 transition-opacity duration-200 group-hover/side:opacity-100">
              {token ? 'My Profile' : 'Sign in'}
            </span>
          </Link>
        </div>
      </div>
    </aside>
  );
}
