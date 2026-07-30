'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { useState, useRef, useEffect } from 'react';
import { useUnreadCount, useNotifications, useMarkRead, useMarkAllRead, getNotificationIcon, getNotificationTypeColor } from '@/lib/hooks/useNotifications';

const NAV_ITEMS = [
  { href: '/', label: 'Home' },
  { href: '/browse', label: 'Browse' },
  { href: '/community', label: 'Community' },
  { href: '/dashboard', label: 'Dashboard' },
];

function formatNotifTime(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function TopBar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, token, logout } = useAuthStore();
  const [showMenu, setShowMenu] = useState(false);
  const [showNotifs, setShowNotifs] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);

  const { data: unreadData } = useUnreadCount();
  const { data: notifData } = useNotifications(1, 5);
  const markRead = useMarkRead();
  const markAllRead = useMarkAllRead();

  const unreadCount = unreadData?.count || 0;
  const recentNotifs = notifData?.items || [];

  // Close menus when clicking outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setShowNotifs(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleNotifClick = (notif: typeof recentNotifs[0]) => {
    if (!notif.read) {
      markRead.mutate(notif.id);
    }
    setShowNotifs(false);
    if (notif.link) {
      router.push(notif.link);
    }
  };

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

      <div className="ml-auto flex items-center gap-2.5">
        {/* Get the App button */}
        <Link
          href="/download"
          className="hidden sm:flex items-center gap-1.5 rounded-full border border-mv-purple/40 bg-mv-purple/10 px-3 py-1.5 text-[10px] text-mv-purple transition-all hover:bg-mv-purple/20 hover:border-mv-purple/60"
        >
          <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          Get App
        </Link>

        {/* Notification Bell */}
        {token && (
          <div className="relative" ref={notifRef}>
            <button
              onClick={() => setShowNotifs(!showNotifs)}
              className="relative flex h-8 w-8 items-center justify-center rounded-lg transition-colors hover:bg-mv-surface"
            >
              <svg className="h-4 w-4 text-mv-text-secondary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              {unreadCount > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-mv-accent px-1 text-[8px] font-bold text-white leading-none">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </button>

            {/* Notification Dropdown */}
            {showNotifs && (
              <div className="absolute right-0 top-full mt-1 w-80 rounded-lg border border-mv-border bg-mv-darker shadow-xl animate-fade-in overflow-hidden">
                <div className="flex items-center justify-between border-b border-mv-border px-4 py-2.5">
                  <p className="text-xs font-medium text-white">Notifications</p>
                  <div className="flex items-center gap-2">
                    {unreadCount > 0 && (
                      <button
                        onClick={() => markAllRead.mutate()}
                        className="text-[9px] text-mv-accent hover:underline"
                      >
                        Mark all read
                      </button>
                    )}
                    <Link
                      href="/notifications"
                      onClick={() => setShowNotifs(false)}
                      className="text-[9px] text-mv-text-muted hover:text-mv-text"
                    >
                      View all
                    </Link>
                  </div>
                </div>

                {recentNotifs.length === 0 ? (
                  <div className="px-4 py-8 text-center">
                    <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-mv-surface">
                      <svg className="h-5 w-5 text-mv-text-dim" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                      </svg>
                    </div>
                    <p className="text-[11px] text-mv-text-muted">No notifications yet</p>
                    <p className="text-[9px] text-mv-text-dim mt-1">We&apos;ll notify you about new chapters and activity</p>
                  </div>
                ) : (
                  <div className="max-h-80 overflow-y-auto">
                    {recentNotifs.map((notif) => (
                      <button
                        key={notif.id}
                        onClick={() => handleNotifClick(notif)}
                        className={`flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-mv-surface ${
                          !notif.read ? 'bg-mv-surface/40' : ''
                        }`}
                      >
                        <div
                          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs"
                          style={{ backgroundColor: `${getNotificationTypeColor(notif.type)}20` }}
                        >
                          <span>{getNotificationIcon(notif.type)}</span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className={`text-xs leading-relaxed ${!notif.read ? 'text-white font-medium' : 'text-mv-text-secondary'}`}>
                            {notif.title}
                          </p>
                          {notif.body && (
                            <p className="text-[10px] text-mv-text-muted mt-0.5 line-clamp-1">{notif.body}</p>
                          )}
                          <p className="text-[9px] text-mv-text-dim mt-1">{formatNotifTime(notif.createdAt)}</p>
                        </div>
                        {!notif.read && (
                          <div className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-mv-accent" />
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

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
                  href="/notifications"
                  onClick={() => setShowMenu(false)}
                  className="flex items-center gap-2 px-3 py-2 text-xs text-mv-text-secondary hover:bg-mv-surface transition-colors"
                >
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                  </svg>
                  Notifications
                  {unreadCount > 0 && (
                    <span className="ml-auto flex h-4 min-w-[16px] items-center justify-center rounded-full bg-mv-accent px-1 text-[8px] font-bold text-white">
                      {unreadCount}
                    </span>
                  )}
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
