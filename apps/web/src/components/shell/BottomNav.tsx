'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icon, type IconName } from '@/components/ui/Icon';
import { useAuthStore } from '@/store/authStore';
import { useResumeData } from './ContinueReading';
import { cn } from '@/lib/cn';

/* ═══════════════════════════════════════════════════════════════
   BottomNav — thumb-zone-optimized mobile navigation. Five slots,
   a raised floating search button, and a sticky "Continue" pill
   that resumes the reader with one tap.
   ═══════════════════════════════════════════════════════════════ */

const TABS: Array<{ href: string; label: string; icon: IconName }> = [
  { href: '/', label: 'Home', icon: 'home' },
  { href: '/browse', label: 'Discover', icon: 'compass' },
  { href: '/library', label: 'Library', icon: 'library' },
  { href: '/community', label: 'Community', icon: 'community' },
  { href: '/dashboard', label: 'Profile', icon: 'dashboard' },
];

function isActive(pathname: string, href: string): boolean {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}

export interface BottomNavProps {
  /** Opens the global search overlay. */
  onOpenSearch: () => void;
}

export function BottomNav({ onOpenSearch }: BottomNavProps) {
  const pathname = usePathname();
  const { token } = useAuthStore();
  const { latest } = useResumeData(1);

  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 md:hidden" aria-label="Mobile navigation">
      <div className="relative border-t border-mv-border/70 bg-mv-darker/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl">
        {/* Sticky Continue pill — the reader shortcut */}
        {token && latest && (
          <Link
            href={`/reader/${latest.chapterId}`}
            className="absolute -top-12 right-3 flex items-center gap-2 rounded-full border border-mv-violet/30 bg-mv-darker/95 py-1.5 pl-2 pr-3 shadow-glow-sm backdrop-blur-xl animate-fade-up"
          >
            <span className="relative flex h-6 w-6 items-center justify-center">
              <svg className="h-6 w-6 -rotate-90" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="2.5" />
                <circle
                  cx="12" cy="12" r="10" fill="none" stroke="#8b5cf6" strokeWidth="2.5" strokeLinecap="round"
                  strokeDasharray={`${Math.min(62.8, Math.max(0, (latest.pct / 100) * 62.8))} 62.8`}
                />
              </svg>
              <Icon name="play" size={9} className="absolute text-mv-violet" strokeWidth={2.4} />
            </span>
            <span className="max-w-28 truncate text-[10px] font-medium text-mv-text-secondary">
              {latest.title} <span className="text-mv-violet">· Ch. {latest.chapterNumber}</span>
            </span>
          </Link>
        )}

        {/* Floating search */}
        <button
          onClick={onOpenSearch}
          aria-label="Search"
          className="absolute -top-7 left-1/2 flex h-14 w-14 -translate-x-1/2 items-center justify-center rounded-full bg-gradient-to-br from-mv-purple to-mv-accent text-white shadow-glow transition-transform active:scale-95"
        >
          <Icon name="search" size={24} strokeWidth={2.2} />
        </button>

        <div className="grid h-16 grid-cols-5 px-2">
          {TABS.map((tab) => {
            const active = isActive(pathname, tab.href);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                aria-current={active ? 'page' : undefined}
                className="relative flex flex-col items-center justify-center gap-1 rounded-xl transition-colors"
              >
                <span
                  className={cn(
                    'flex h-8 w-12 items-center justify-center rounded-full transition-all duration-300',
                    active ? 'bg-mv-accent/20 text-mv-violet' : 'text-mv-text-muted',
                  )}
                >
                  <Icon name={tab.icon} size={20} strokeWidth={active ? 2.2 : 1.8} />
                </span>
                <span className={cn('text-[9px] font-medium', active ? 'text-mv-violet' : 'text-mv-text-dim')}>
                  {tab.label}
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
