'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { useState, useRef, useEffect } from 'react';

const NAV_ITEMS = [
  { href: '/', label: 'Home' },
  { href: '/browse', label: 'Browse' },
  { href: '/community', label: 'Community' },
  { href: '/dashboard', label: 'Dashboard' },
];

export function TopBar() {
  const pathname = usePathname();
  const { user, token, logout } = useAuthStore();
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

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
        {/* Coin balance */}
        {user && (
          <div className="flex items-center gap-1.5 rounded-full border border-mv-border-light bg-mv-surface px-3 py-1.5">
            <svg className="h-3 w-3 text-mv-gold" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <text x="12" y="16" textAnchor="middle" fontSize="10" fill="currentColor">$</text>
            </svg>
            <span className="text-[10px] text-mv-gold">{user.coinBalance}</span>
          </div>
        )}

        {token && user ? (
          /* Authenticated — user menu */
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="flex items-center gap-2 rounded-md px-2 py-1 transition-colors hover:bg-mv-surface"
            >
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-mv-accent text-[10px] font-semibold text-white">
                {user.displayName?.charAt(0)?.toUpperCase() || 'U'}
              </div>
              <span className="hidden text-xs text-mv-text-secondary sm:block">{user.displayName}</span>
              <svg className={`h-3 w-3 text-mv-text-dim transition-transform ${showMenu ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {showMenu && (
              <div className="absolute right-0 top-full mt-1 w-44 rounded-lg border border-mv-border bg-mv-darker py-1 shadow-xl animate-fade-in">
                <div className="border-b border-mv-border px-3 py-2">
                  <p className="text-xs font-medium text-mv-text">{user.displayName}</p>
                  <p className="text-[10px] text-mv-text-muted">{user.email}</p>
                </div>
                <Link
                  href="/dashboard"
                  onClick={() => setShowMenu(false)}
                  className="flex items-center gap-2 px-3 py-2 text-xs text-mv-text-secondary hover:bg-mv-surface transition-colors"
                >
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  Profile & Stats
                </Link>
                <Link
                  href="/library"
                  onClick={() => setShowMenu(false)}
                  className="flex items-center gap-2 px-3 py-2 text-xs text-mv-text-secondary hover:bg-mv-surface transition-colors"
                >
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                  </svg>
                  My Library
                </Link>
                <button
                  onClick={() => { setShowMenu(false); logout(); }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-xs text-red-400 hover:bg-mv-surface transition-colors"
                >
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  Sign Out
                </button>
              </div>
            )}
          </div>
        ) : (
          /* Not authenticated — login / signup buttons */
          <div className="flex items-center gap-2">
            <Link
              href="/login"
              className="rounded-md border border-mv-border-light bg-transparent px-3 py-1.5 text-xs text-mv-text-secondary transition-colors hover:border-mv-accent/50 hover:text-mv-text"
            >
              Sign In
            </Link>
            <Link
              href="/signup"
              className="rounded-md bg-mv-accent px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-red-500"
            >
              Sign Up
            </Link>
          </div>
        )}
      </div>
    </header>
  );
}
