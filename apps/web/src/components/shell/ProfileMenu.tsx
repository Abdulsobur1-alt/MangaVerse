'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useRef, useState, useEffect } from 'react';
import { useAuthStore } from '@/store/authStore';
import { Icon } from '@/components/ui/Icon';
import { cn } from '@/lib/cn';

/* ═══════════════════════════════════════════════════════════════
   ProfileMenu — avatar button + glass dropdown (dashboard, library,
   history, reviews, notifications, settings, sign out). Reusable in
   the top bar or the expanded sidebar footer.
   ═══════════════════════════════════════════════════════════════ */

export interface ProfileMenuProps {
  className?: string;
}

const MENU_ITEMS = [
  { href: '/dashboard', label: 'Dashboard', icon: 'dashboard' as const },
  { href: '/library', label: 'My Library', icon: 'library' as const },
  { href: '/history', label: 'History', icon: 'history' as const },
  { href: '/reviews', label: 'My Reviews', icon: 'star' as const },
  { href: '/notifications', label: 'Notifications', icon: 'bell' as const },
  { href: '/settings', label: 'Settings', icon: 'settings' as const },
];

export function ProfileMenu({ className }: ProfileMenuProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, token, logout } = useAuthStore();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Close on route change + Escape
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open]);

  const handleLogout = async () => {
    setOpen(false);
    await logout();
    router.push('/login');
  };

  return (
    <div className={cn('relative', className)} ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        aria-label="Account menu"
        aria-expanded={open}
        className="tap-target h-10 w-10 overflow-hidden rounded-xl border border-mv-border-light bg-mv-surface transition-all hover:border-mv-violet/50"
      >
        {user?.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={user.avatarUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className="flex h-full w-full items-center justify-center bg-gradient-to-br from-mv-purple to-mv-accent text-xs font-bold text-white">
            {user?.displayName?.charAt(0)?.toUpperCase() || 'U'}
          </span>
        )}
      </button>

      {open && (
        <div className="glass absolute right-0 top-full z-50 mt-2 w-52 overflow-hidden rounded-2xl p-1.5 shadow-modal animate-scale-in">
          {user && (
            <div className="border-b border-white/10 px-3 pb-2.5 pt-2">
              <p className="truncate text-xs font-semibold text-white">{user.displayName}</p>
              <p className="truncate text-[10px] text-mv-text-muted">{user.email}</p>
            </div>
          )}
          {MENU_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs text-mv-text-secondary transition-colors hover:bg-white/5 hover:text-white"
            >
              <Icon name={item.icon} size={15} />
              {item.label}
            </Link>
          ))}
          {token ? (
            <button
              onClick={handleLogout}
              className="mt-1 flex w-full items-center gap-2.5 rounded-xl border-t border-white/10 px-3 py-2 text-left text-xs text-red-400 transition-colors hover:bg-red-500/10"
            >
              <Icon name="logOut" size={15} />
              Sign out
            </button>
          ) : (
            <Link
              href="/login"
              onClick={() => setOpen(false)}
              className="mt-1 flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-medium text-mv-violet transition-colors hover:bg-white/5"
            >
              <Icon name="logOut" size={15} />
              Sign in
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
