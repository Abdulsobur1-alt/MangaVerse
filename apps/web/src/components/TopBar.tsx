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

function isActive(pathname: string, href: string): boolean {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function TopBar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, token, logout } = useAuthStore();
  const [showMenu, setShowMenu] = useState(false);
  const [showNotifs, setShowNotifs] = useState(false);
  const [showMobileNav, setShowMobileNav] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);
  const mobileRef = useRef<HTMLDivElement>(null);

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
      if (mobileRef.current && !mobileRef.current.contains(e.target as Node)) setShowMobileNav(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Close mobile nav on route change
  useEffect(() => {
    setShowMobileNav(false);
    setShowMenu(false);
    setShowNotifs(false);
  }, [pathname]);

  const handleNotifClick = (notif: typeof recentNotifs[0]) => {
    if (!notif.read) markRead.mutate(notif.id);
    setShowNotifs(false);
    if (notif.link) router.push(notif.link);
  };

  return (
    <header className="sticky top-0 z-50 border-b border-white/5 bg-mv-darker/70 backdrop-blur-xl">
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-mv-accent/40 to-transparent" />

      <div className="flex h-14 items-center gap-3 px-4">
        {/* Logo */}
        <Link href="/" className="group flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-mv-accent to-mv-purple text-sm shadow-lg shadow-mv-accent/30 transition-transform group-hover:scale-105">
            <svg className="h-4 w-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
            </svg>
          </span>
          <span className="text-lg font-bold tracking-tight">
            <span className="bg-gradient-to-r from-mv-accent to-mv-purple bg-clip-text text-transparent">Manga</span>
            <span className="text-white">Verse</span>
          </span>
        </Link>

        {/* Desktop nav */}
        <nav className="ml-6 hidden items-center gap-1 md:flex">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`relative rounded-full px-3.5 py-1.5 text-xs font-medium transition-all duration-200 ${
                isActive(pathname, item.href)
                  ? 'bg-gradient-to-r from-mv-accent to-mv-purple text-white shadow-lg shadow-mv-accent/25'
                  : 'text-mv-text-secondary hover:bg-white/5 hover:text-mv-text'
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
            className="hidden items-center gap-1.5 rounded-full border border-mv-purple/40 bg-mv-purple/10 px-3.5 py-1.5 text-[10px] font-medium text-mv-purple transition-all hover:border-mv-purple/70 hover:bg-mv-purple/20 hover:shadow-lg hover:shadow-mv-purple/20 sm:flex"
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
                <div className="glass absolute right-0 top-full mt-2 w-80 overflow-hidden rounded-2xl shadow-2xl shadow-black/50 animate-fade-up">
                  <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
                    <p className="text-xs font-semibold text-white">Notifications</p>
                    <div className="flex items-center gap-3">
                      {unreadCount > 0 && (
                        <button onClick={() => markAllRead.mutate()} className="text-[9px] text-mv-accent hover:underline">
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
                            {notif.body && (
                              <p className="mt-0.5 line-clamp-1 text-[10px] text-mv-text-muted">{notif.body}</p>
                            )}
                            <p className="mt-1 text-[9px] text-mv-text-dim">{formatNotifTime(notif.createdAt)}</p>
                          </div>
                          {!notif.read && (
                            <div className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-gradient-to-r from-mv-accent to-mv-purple" />
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
            <div className="flex items-center gap-1.5 rounded-full border border-mv-gold/20 bg-mv-gold/5 px-3 py-1.5 shadow-inner">
              <svg className="h-3 w-3 text-mv-gold" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <text x="12" y="16" textAnchor="middle" fontSize="10" fill="currentColor">$</text>
              </svg>
              <span className="text-[10px] font-medium text-mv-gold">{user.coinBalance}</span>
            </div>
          )}

          {token && user ? (
            /* Authenticated — user menu */
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setShowMenu(!showMenu)}
                className="flex items-center gap-2 rounded-xl px-2 py-1 transition-colors hover:bg-white/5"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-mv-accent to-mv-purple text-[10px] font-bold text-white shadow-md shadow-mv-accent/30">
                  {user.displayName?.charAt(0)?.toUpperCase() || 'U'}
                </div>
                <span className="hidden max-w-[90px] truncate text-xs text-mv-text-secondary sm:block">{user.displayName}</span>
                <svg className={`h-3 w-3 text-mv-text-dim transition-transform duration-200 ${showMenu ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {showMenu && (
                <div className="glass absolute right-0 top-full mt-2 w-52 rounded-2xl p-1.5 shadow-2xl shadow-black/50 animate-fade-up">
                  <div className="mb-1 rounded-xl bg-white/[0.03] px-3 py-2.5">
                    <p className="text-xs font-semibold text-white">{user.displayName}</p>
                    <p className="text-[10px] text-mv-text-muted">{user.email}</p>
                  </div>
                  <MenuLink href="/dashboard" onClick={() => setShowMenu(false)} icon="profile">
                    Profile & Stats
                  </MenuLink>
                  <MenuLink href="/notifications" onClick={() => setShowMenu(false)} icon="bell" badge={unreadCount}>
                    Notifications
                  </MenuLink>
                  <MenuLink href="/settings" onClick={() => setShowMenu(false)} icon="gear">
                    Settings
                  </MenuLink>
                  <MenuLink href="/library" onClick={() => setShowMenu(false)} icon="book">
                    My Library
                  </MenuLink>
                  {(user.role === 'moderator' || user.role === 'admin') && (
                    <MenuLink href="/admin" onClick={() => setShowMenu(false)} icon="shield">
                      Admin Console
                    </MenuLink>
                  )}
                  <button
                    onClick={() => { setShowMenu(false); logout(); }}
                    className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-xs text-red-400 transition-colors hover:bg-red-500/10"
                  >
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                    Sign Out
                  </button>
                </div>
              )}
            </div>
          ) : (
            /* Not authenticated — login / signup buttons */
            <div className="hidden items-center gap-2 sm:flex">
              <Link
                href="/login"
                className="rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-1.5 text-xs text-mv-text-secondary transition-colors hover:border-mv-accent/50 hover:text-mv-text"
              >
                Sign In
              </Link>
              <Link
                href="/signup"
                className="btn-primary px-3.5 py-1.5 text-xs"
              >
                Sign Up
              </Link>
            </div>
          )}

          {/* Mobile hamburger */}
          <button
            onClick={() => setShowMobileNav(!showMobileNav)}
            aria-label="Menu"
            className="flex h-9 w-9 items-center justify-center rounded-xl text-mv-text-secondary transition-colors hover:bg-white/5 md:hidden"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              {showMobileNav ? (
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 7h16M4 12h16M4 17h16" />
              )}
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile nav panel */}
      {showMobileNav && (
        <div ref={mobileRef} className="border-t border-white/5 bg-mv-darker/95 px-4 pb-4 pt-2 backdrop-blur-xl md:hidden animate-fade-in">
          <nav className="flex flex-col gap-1">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-xl px-3.5 py-2.5 text-sm font-medium transition-colors ${
                  isActive(pathname, item.href)
                    ? 'bg-gradient-to-r from-mv-accent/15 to-mv-purple/15 text-mv-accent'
                    : 'text-mv-text-secondary hover:bg-white/5 hover:text-mv-text'
                }`}
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="mt-3 flex items-center gap-2">
            <Link href="/download" className="flex-1 rounded-xl border border-mv-purple/40 bg-mv-purple/10 px-3 py-2.5 text-center text-xs font-medium text-mv-purple">
              📱 Get the App
            </Link>
            {!token ? (
              <>
                <Link href="/login" className="flex-1 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-center text-xs text-mv-text-secondary">
                  Sign In
                </Link>
                <Link href="/signup" className="btn-primary flex-1 px-3 py-2.5 text-xs">
                  Sign Up
                </Link>
              </>
            ) : null}
          </div>
        </div>
      )}
    </header>
  );
}

function MenuLink({
  href,
  onClick,
  icon,
  badge,
  children,
}: {
  href: string;
  onClick: () => void;
  icon: 'profile' | 'bell' | 'gear' | 'book' | 'shield';
  badge?: number;
  children: React.ReactNode;
}) {
  const paths: Record<typeof icon, string> = {
    profile: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z',
    bell: 'M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9',
    gear: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.573-1.066z',
    book: 'M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z',
    shield: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
  };
  return (
    <Link
      href={href}
      onClick={onClick}
      className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-xs text-mv-text-secondary transition-colors hover:bg-white/5 hover:text-mv-text"
    >
      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d={paths[icon]} />
      </svg>
      {children}
      {typeof badge === 'number' && badge > 0 && (
        <span className="ml-auto flex h-4 min-w-[16px] items-center justify-center rounded-full bg-gradient-to-r from-mv-accent to-mv-purple px-1 text-[8px] font-bold text-white">
          {badge}
        </span>
      )}
    </Link>
  );
}
