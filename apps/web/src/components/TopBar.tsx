'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/hooks/useAuth';

const NAV_ITEMS = [
  { href: '/', label: 'Home' },
  { href: '/browse', label: 'Browse' },
  { href: '/community', label: 'Community' },
  { href: '/dashboard', label: 'Dashboard' },
];

export function TopBar() {
  const pathname = usePathname();
  const { user, isAuthenticated } = useAuth();

  return (
    <header className="flex h-12 items-center border-b border-mv-border bg-mv-darker px-4 sticky top-0 z-50">
      <Link href="/" className="flex items-center gap-2">
        <span className="text-lg font-semibold tracking-tight text-mv-accent">
          Manga<span className="text-mv-purple">Verse</span>
        </span>
      </Link>

      <nav className="ml-8 hidden items-center gap-1 md:flex">
        {NAV_ITEMS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`rounded-md px-3 py-1.5 text-xs transition-colors ${
              pathname === item.href
                ? 'bg-mv-surface text-mv-accent'
                : 'text-mv-text-secondary hover:bg-mv-surface hover:text-mv-text'
            }`}
          >
            {item.label}
          </Link>
        ))}
      </nav>

      <div className="ml-auto flex items-center gap-3">
        {user && (
          <div className="flex items-center gap-1.5 rounded-full border border-mv-border-light bg-mv-surface px-3 py-1.5">
            <svg className="h-3 w-3 text-mv-gold" fill="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="2"/><text x="12" y="16" textAnchor="middle" fontSize="10" fill="currentColor">$</text></svg>
            <span className="text-[10px] text-mv-gold">{user.coinBalance}</span>
          </div>
        )}
        {isAuthenticated ? (
          <div className="flex items-center gap-2">
            <span className="hidden text-xs text-mv-text-secondary sm:block">{user?.displayName}</span>
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-mv-accent text-[10px] font-semibold text-white">
              {user?.displayName?.charAt(0) || 'U'}
            </div>
          </div>
        ) : (
          <Link
            href="/browse"
            className="rounded-md bg-mv-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-red-500 transition-colors"
          >
            Browse Manga
          </Link>
        )}
      </div>
    </header>
  );
}
