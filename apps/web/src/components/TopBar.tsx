'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { useState, useRef, useEffect } from 'react';
import {
  useUnreadCount,
  useNotifications,
  useMarkRead,
  useMarkAllRead,
  getNotificationIcon,
  getNotificationTypeColor,
} from '@/lib/hooks/useNotifications';

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

interface TopBarProps {
  /** Opens the global search palette (Cmd+K). Hidden when not provided. */
  onOpenSearch?: () => void;
  /** Use the immersive variant (reader). */
  immersive?: boolean;
}

export function TopBar({ onOpenSearch, immersive }: TopBarProps) {
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
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setShowMenu(false);
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setShowNotifs(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Close menus on route change
  useEffect(() => {
    setShowMenu(false);
    setShowNotifs(false);
  }, [pathname]);

  const handleNotifClick = (notif: (typeof recentNotifs)[0]) => {
    if (!notif.read) markRead.mutate(notif.id);
    setShowNotifs(false);
    if (notif.link) router.push(notif.link);
  };

  const handleLogout = async () => {
    setShowMenu(false);
    await logout();
    router.push('/login');
  };

  return (
    <header
      className={`sticky top-0 z-40 flex h-14 items-center gap-2 border-b border-mv-border/70 px-3 backdrop-blur-xl sm:px-4 ${
        immersive ? 'bg-black/80' : 'bg-mv-darker/75'
      }`}
    >
      {/* Mobile logo (desktop logo lives in the sidebar) */}
      <Link href="/" className="group flex items-center gap-2 md:hidden">
        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-mv-purple to-mv-accent shadow-glow-sm transition-transform group-hover:scale-105">
          <svg className="h-4 w-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
          </svg>
        </span>
        <span className="text-lg font-bold tracking-tight">
          <span className="bg-gradient-to-r from-mv-violet to-mv-purple bg-clip-text text-transparent">Manga</span>
          <span className="text-white">Verse</span>
        </span>
      </Link>

      {/* Breadcrumb-ish context on desktop */}
      <p className="hidden text-xs text-mv-text-dim md:block">
        {pathname === '/' ? 'Home' : pathname.startsWith('/browse') ? 'Browse' : pathname.startsWith('/library') ? 'Library' : pathname.startsWith('/community') ? 'Community' : pathname.startsWith('/dashboard') ? 'Dashboard' : ''}
      </p>

      <div className="ml-auto flex items-center gap-1.5 sm:gap-2.5">
        {/* Search — opens the global palette */}
        {onOpenSearch && (
          <button
            onClick={onOpenSearch}
            className="hidden h-9 items-center gap-2 rounded-xl border border-mv-border-light bg-mv-surface px-3 text-xs text-mv-text-muted transition-colors hover:border-mv-violet/40 hover:text-mv-text-secondary lg:flex"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            Search titles…
            <kbd className="ml-4 rounded-md border border-mv-border bg-mv-darker px-1.5 py-0.5 text-[9px] text-mv-text-dim">⌘K</kbd>
          </button>
        )}
        {onOpenSearch && (
          <button
            onClick={onOpenSearch}
            aria-label="Search"
            className="flex h-9 w-9 items-center justify-center rounded-xl text-mv-text-secondary transition-colors hover:bg-white/5 hover:text-white lg:hidden"
          >
            <svg className="h-4.5 w-4.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </button>
        )}

        {/* Get the App button */}
        <Link
          href="/download"
          className="hidden items-center gap-1.5 rounded-full border border-mv-violet/30 bg-mv-violet/10 px-3.5 py-1.5 text-[10px] font-medium text-mv-violet transition-all hover:border-mv-violet/60 hover:bg-mv-violet/20 sm:flex"
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
              aria-label="Notifications"
              className="relative flex h-9 w-9 items-center justify-center rounded-xl transition-colors hover:bg-white/5"
            >
              <svg className="h-4.5 w-4.5 text-mv-text-secondary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              {unreadCount > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-gradient-to-r from-mv-accent to-mv-purple px-1 text-[8px] font-bold text-white shadow-md shadow-mv-accent/40">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </button>

            {showNotifs && (
              <div className="glass absolute right-0 top-full mt-2 w-80 overflow-hidden rounded-2xl shadow-modal animate-scale-in">
                <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
                  <p className="text-xs font-semibold text-white">Notifications</p>
                  <div className="flex items-center gap-3">
                    {unreadCount > 0 && (
                      <button onClick={() => markAllRead.mutate()} className="text-[9px] text-mv-violet hover:underline">
                        Mark all read
                      </button>
                    )}
                    <Link href="/notifications" onClick={() => setShowNotifs(false)} className="text-[9px] text-mv-text-muted hover:text-mv-text">
                      View all
                    </Link>
                  </div>
                </div>

                {recentNotifs.length === 0 ? (
                  <div className="px-4 py-8 text-center">
                    <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-white/5">
                      <svg className="h-5 w-5 text-mv-text-dim" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                      </svg>
                    </div>
                    <p className="text-[11px] text-mv-text-muted">No notifications yet</p>
                    <p className="mt-1 text-[9px] text-mv-text-dim">We&apos;ll notify you about new chapters and activity</p>
                  </div>
                ) : (
                  <div className="max-h-80 overflow-y-auto">
                    {recentNotifs.map((notif) => (
                      <button
                        key={notif.id}
                        onClick={() => handleNotifClick(notif)}
                        className={`flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-white/5 ${
                          !notif.read ? 'bg-white/[0.03]' : ''
                        }`}
                      >
                        <div
                          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs"
                          style={{ backgroundColor: `${getNotificationTypeColor(notif.type)}20` }}
                        >
                          <span>{getNotificationIcon(notif.type)}</span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className={`text-xs leading-relaxed ${!notif.read ? 'font-medium text-white' : 'text-mv-text-secondary'}`}>
                            {notif.title}
                          </p>
                          {notif.body && <p className="mt-0.5 line-clamp-1 text-[10px] text-mv-text-muted">{notif.body}</p>}
                          <p className="mt-1 text-[9px] text-mv-text-dim">{formatNotifTime(notif.createdAt)}</p>
                        </div>
                        {!notif.read && <div className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-gradient-to-r from-mv-accent to-mv-purple" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Avatar / user menu */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setShowMenu(!showMenu)}
            aria-label="Account menu"
            className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-xl border border-mv-border-light bg-mv-surface transition-all hover:border-mv-violet/50"
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

          {showMenu && (
            <div className="glass absolute right-0 top-full mt-2 w-52 overflow-hidden rounded-2xl p-1.5 shadow-modal animate-scale-in">
              {user && (
                <div className="border-b border-white/10 px-3 pb-2.5 pt-2">
                  <p className="truncate text-xs font-semibold text-white">{user.displayName}</p>
                  <p className="truncate text-[10px] text-mv-text-muted">{user.email}</p>
                </div>
              )}
              {[
                { href: '/dashboard', label: 'Dashboard' },
                { href: '/library', label: 'My Library' },
                { href: '/history', label: 'History' },
                { href: '/reviews', label: 'My Reviews' },
                { href: '/notifications', label: 'Notifications' },
                { href: '/settings', label: 'Settings' },
              ].map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setShowMenu(false)}
                  className="block rounded-xl px-3 py-2 text-xs text-mv-text-secondary transition-colors hover:bg-white/5 hover:text-white"
                >
                  {item.label}
                </Link>
              ))}
              {token ? (
                <button
                  onClick={handleLogout}
                  className="mt-1 block w-full rounded-xl border-t border-white/10 px-3 py-2 text-left text-xs text-red-400 transition-colors hover:bg-red-500/10"
                >
                  Sign out
                </button>
              ) : (
                <Link
                  href="/login"
                  onClick={() => setShowMenu(false)}
                  className="block rounded-xl px-3 py-2 text-xs font-medium text-mv-violet transition-colors hover:bg-white/5"
                >
                  Sign in
                </Link>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
