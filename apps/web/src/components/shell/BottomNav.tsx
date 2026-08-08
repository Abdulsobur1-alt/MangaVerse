'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Icon, type IconName } from '@/components/ui/Icon';
import { useAuthStore } from '@/store/authStore';
import { useResumeData } from './ContinueReading';
import { isStaffRole } from '@/lib/hooks/useStudio';
import { cn } from '@/lib/cn';

/* ═══════════════════════════════════════════════════════════════
   BottomNav — thumb-zone-optimized mobile navigation.
   • Five 44px+ tap targets, active state pill
   • Floating search button (raised above the tab row)
   • Continue pill docked ABOVE the nav — never overlaps content
   • Pill hides while scrolling down, reappears on scroll up
   • Respects iPhone safe-area inset
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

/** True when the user is scrolling down the main document. */
function useScrollDirection() {
  const [hidden, setHidden] = useState(false);
  const lastY = useRef(0);
  const raf = useRef<number | null>(null);

  useEffect(() => {
    lastY.current = window.scrollY;
    const onScroll = () => {
      if (raf.current != null) return;
      raf.current = requestAnimationFrame(() => {
        raf.current = null;
        const y = window.scrollY;
        // Hide while scrolling down (past a small threshold), show on scroll
        // up or when near the very top. Keep visible if the page is short.
        setHidden(y > lastY.current && y > 120 && window.innerHeight < document.body.scrollHeight - 240);
        lastY.current = y;
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (raf.current != null) cancelAnimationFrame(raf.current);
    };
  }, []);

  return hidden;
}

export interface BottomNavProps {
  /** Opens the global search overlay. */
  onOpenSearch: () => void;
}

export function BottomNav({ onOpenSearch }: BottomNavProps) {
  const pathname = usePathname();
  const { token, user } = useAuthStore();
  const { latest } = useResumeData(1);
  const pillHidden = useScrollDirection();
  const staff = isStaffRole(user?.role);

  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 md:hidden" aria-label="Mobile navigation">
      <div className="relative border-t border-mv-border/70 bg-mv-darker/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl">
        {/* Mobile utility tray — attached to the dock so actions never compete
            with each other or appear as independent floating page controls. */}
        {!pillHidden && (staff || (token && latest)) && (
          <div className="absolute inset-x-0 bottom-full px-3 pb-2">
            <div className="flex min-h-11 items-center gap-1.5 rounded-2xl border border-mv-border-light bg-mv-darker px-1.5 shadow-modal">
              {staff && (
                <Link
                  href="/studio"
                  aria-label="Content Studio"
                  className="tap-target flex h-11 shrink-0 items-center gap-1.5 rounded-xl px-2.5 text-mv-text-secondary transition-colors hover:bg-white/5 hover:text-mv-violet"
                >
                  <Icon name="sparkles" size={14} className="text-mv-violet" strokeWidth={2} />
                  <span className="text-[11px] font-medium">Studio</span>
                </Link>
              )}
              {token && latest && (
                <Link
                  href={`/reader/${latest.chapterId}`}
                  aria-label={`Continue reading ${latest.title}, chapter ${latest.chapterNumber}`}
                  className="tap-target flex h-11 min-w-0 flex-1 items-center gap-2 rounded-xl px-1.5 text-mv-text-secondary transition-colors hover:bg-white/5"
                >
                  <span className="relative flex h-7 w-7 shrink-0 items-center justify-center">
                    <svg className="h-7 w-7 -rotate-90" viewBox="0 0 24 24" aria-hidden="true">
                      <circle cx="12" cy="12" r="10" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="2.5" />
                      <circle
                        cx="12" cy="12" r="10" fill="none" stroke="#8b5cf6" strokeWidth="2.5" strokeLinecap="round"
                        strokeDasharray={`${Math.min(62.8, Math.max(0, (latest.pct / 100) * 62.8))} 62.8`}
                      />
                    </svg>
                    <Icon name="play" size={10} className="absolute text-mv-violet" strokeWidth={2.4} />
                  </span>
                  <span className="min-w-0 truncate text-[11px] font-medium">
                    {latest.title} <span className="text-mv-violet">· Ch. {latest.chapterNumber}</span>
                  </span>
                </Link>
              )}
            </div>
          </div>
        )}

        {/* Floating search */}
        <button
          onClick={onOpenSearch}
          aria-label="Search"
          className="absolute -top-7 left-1/2 flex h-12 w-12 -translate-x-1/2 items-center justify-center rounded-full bg-gradient-to-br from-mv-purple to-mv-accent text-white shadow-glow transition-transform active:scale-95"
        >
          <Icon name="search" size={21} strokeWidth={2.2} />
        </button>

        <div className="grid h-[72px] grid-cols-5 px-2">
          {TABS.map((tab) => {
            const active = isActive(pathname, tab.href);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'relative flex min-h-11 flex-col items-center justify-center gap-1 rounded-xl transition-colors',
                  tab.href === '/library' && 'pt-6',
                )}
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
