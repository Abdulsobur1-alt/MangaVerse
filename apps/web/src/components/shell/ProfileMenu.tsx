'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useAuthStore } from '@/store/authStore';
import { useOwnIdentity } from '@/lib/hooks/useIdentity';
import { useUnreadCount } from '@/lib/hooks/useNotifications';
import { useMediaQuery } from '@/lib/hooks/useMediaQuery';
import { useResumeData } from './ContinueReading';
import { ThemeSwitcher } from './ThemeSwitcher';
import { Icon, type IconName } from '@/components/ui/Icon';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { cn } from '@/lib/cn';

/* ═══════════════════════════════════════════════════════════════
   ProfileMenu — responsive profile command center.
   • Desktop / tablet (≥768px): premium floating dropdown anchored to
     the avatar, viewport-collision aware (flips upward when tight),
     fade + scale entrance, keyboard accessible.
   • Mobile (<768px): draggable bottom sheet — profile header with
     rank / level / streak, quick stats, Continue Reading shortcut,
     theme switch, and the full menu. Swipe down to dismiss.
   Shared: 48px+ touch targets, purple hover, danger zone with an
   inline sign-out confirmation, closes on navigation / Esc / outside.
   ═══════════════════════════════════════════════════════════════ */

export interface ProfileMenuProps {
  className?: string;
}

interface MenuItemDef {
  href: string;
  label: string;
  icon: IconName;
  sub?: string;
  badge?: number;
}

const PRIMARY_ITEMS: MenuItemDef[] = [
  { href: '/dashboard', label: 'Dashboard', icon: 'dashboard', sub: 'Your story at a glance' },
  { href: '/library', label: 'Library', icon: 'library', sub: 'Your personal shelf' },
  { href: '/bookmarks', label: 'Bookmarks', icon: 'bookmark' },
  { href: '/history', label: 'History', icon: 'history' },
  { href: '/reviews', label: 'Reviews', icon: 'star' },
];

/** Achievements lives on the own-profile Badges tab; falls back to the dashboard. */
const achievementsItem = (userId?: string): MenuItemDef => ({
  href: userId ? `/user/${userId}?tab=achievements` : '/dashboard',
  label: 'Achievements',
  icon: 'trophy',
  sub: userId ? 'Your badge cabinet' : 'Badges & milestones',
});

const SECONDARY_ITEMS: MenuItemDef[] = [
  { href: '/notifications', label: 'Notifications', icon: 'bell' },
  { href: '/download', label: 'Downloads', icon: 'download' },
  { href: '/settings', label: 'Settings', icon: 'settings' },
  { href: '/community', label: 'Help & Support', icon: 'community', sub: 'Community & feedback' },
];

/** Menu row — shared by the dropdown and the sheet. 48px minimum height. */
function MenuRow({
  item,
  onNavigate,
  active,
}: {
  item: MenuItemDef;
  onNavigate?: () => void;
  active?: boolean;
}) {
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      className={cn(
        'group/item flex min-h-12 items-center gap-3 rounded-xl px-3 transition-all duration-150',
        'hover:bg-mv-accent/10 active:scale-[0.985] active:bg-mv-accent/15',
      )}
    >
      <span
        className={cn(
          'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-colors duration-150',
          active ? 'bg-mv-accent/20 text-mv-violet' : 'bg-mv-surface text-mv-text-muted group-hover/item:bg-mv-accent/15 group-hover/item:text-mv-violet',
        )}
      >
        <Icon name={item.icon} size={17} strokeWidth={active ? 2.2 : 1.8} />
      </span>
      <span className="min-w-0 flex-1">
        <span className={cn('block truncate text-[13px] font-medium', active ? 'text-mv-violet' : 'text-mv-text-secondary group-hover/item:text-white')}>
          {item.label}
        </span>
        {item.sub && <span className="block truncate text-[10px] text-mv-text-dim">{item.sub}</span>}
      </span>
      {typeof item.badge === 'number' && item.badge > 0 && (
        <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-gradient-to-r from-mv-accent to-mv-purple px-1.5 text-[9px] font-bold text-white">
          {item.badge > 99 ? '99+' : item.badge}
        </span>
      )}
      <Icon name="chevronRight" size={14} className="shrink-0 text-mv-text-dim transition-all group-hover/item:translate-x-0.5 group-hover/item:text-mv-violet" />
    </Link>
  );
}

export function ProfileMenu({ className }: ProfileMenuProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, token, logout } = useAuthStore();
  const { data: identity } = useOwnIdentity(!!token);
  const { data: unreadData } = useUnreadCount();
  const { latest } = useResumeData(1);

  const isMobile = useMediaQuery('(max-width: 767px)');
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [dropPos, setDropPos] = useState<'down' | 'up'>('down');
  const [dropMaxH, setDropMaxH] = useState(520);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const reducedMotion = useReducedMotion();

  const unread = unreadData?.count ?? 0;
  const stats = identity?.stats;
  const level = identity?.readingLevel?.current;
  const rank = identity?.reputation?.tier;
  const username = identity?.username ?? user?.email?.split('@')[0] ?? 'reader';
  const streakValue = stats ? `${stats.streakDays}d` : (user?.streakDays ?? 0) > 0 ? `${user?.streakDays}d` : '—';

  // Notifications badge on the menu row.
  const secondaries = SECONDARY_ITEMS.map((it) =>
    it.href === '/notifications' ? { ...it, badge: unread } : it,
  );

  // Own-profile Achievements row (deep-links to the Badges tab).
  const primaries = [...PRIMARY_ITEMS, achievementsItem(user?.id)];

  // Close on route change (navigation) + reset confirm state.
  useEffect(() => {
    setOpen(false);
    setConfirming(false);
  }, [pathname]);

  // Outside click → close (dropdown).
  useEffect(() => {
    if (!open || isMobile) return;
    const onDown = (e: MouseEvent | TouchEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('touchstart', onDown);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('touchstart', onDown);
    };
  }, [open, isMobile]);

  // Escape closes either presentation.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        setConfirming(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  // Viewport collision: flip the dropdown above the avatar when there
  // isn't enough room below, and cap its height to the available space.
  useEffect(() => {
    if (!open || isMobile || !btnRef.current) return;
    const rect = btnRef.current.getBoundingClientRect();
    const below = window.innerHeight - rect.bottom - 16;
    const above = rect.top - 16;
    const fitBelow = below >= 320;
    const fitAbove = above >= 320;
    const pos: 'down' | 'up' = !fitBelow && fitAbove ? 'up' : 'down';
    setDropPos(pos);
    setDropMaxH(Math.min(560, Math.max(320, pos === 'down' ? below : above)));
  }, [open, isMobile]);

  // Focus the first menu row when the dropdown opens.
  useEffect(() => {
    if (!open || isMobile) return;
    const t = setTimeout(() => {
      menuRef.current?.querySelector<HTMLElement>('a')?.focus();
    }, 40);
    return () => clearTimeout(t);
  }, [open, isMobile]);

  const navigate = () => {
    setOpen(false);
    setConfirming(false);
  };

  const handleLogout = async () => {
    setOpen(false);
    setConfirming(false);
    await logout();
    router.push('/login');
  };

  const avatar = user?.avatarUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={user.avatarUrl} alt="" className="h-full w-full object-cover" />
  ) : (
    <span className="flex h-full w-full items-center justify-center bg-gradient-to-br from-mv-purple to-mv-accent text-xs font-bold text-white">
      {user?.displayName?.charAt(0)?.toUpperCase() || 'U'}
    </span>
  );

  // ── Profile header — avatar, name, username, rank, level, streak ──
  // `compact` (dropdown) shows identity only; the mobile sheet keeps the
  // full header with XP progress + quick stats.
  const profileHeader = (compact: boolean) => (
    <div
      className={cn(
        'relative overflow-hidden border-b border-mv-border/70',
        compact ? 'px-4 pb-3 pt-3' : 'px-4 pb-4 pt-1',
      )}
    >
      {/* Purple radial glow behind the avatar */}
      <div
        aria-hidden="true"
        className={cn(
          'pointer-events-none absolute -top-16 left-6 h-36 w-36 rounded-full blur-3xl',
          'bg-mv-accent/25',
        )}
      />
      <div className="relative flex items-center gap-3.5">
        <div className="relative shrink-0">
          <motion.div
            whileHover={reducedMotion ? undefined : { scale: 1.04 }}
            whileTap={reducedMotion ? undefined : { scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 400, damping: 22 }}
            className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-2xl border border-mv-border-light bg-mv-surface shadow-glow-sm"
          >
            {avatar}
          </motion.div>
          {user?.streakDays != null && user.streakDays > 0 && (
            <span
              title={`${user.streakDays}-day streak`}
              className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full border border-mv-darker bg-gradient-to-br from-mv-warning to-mv-accent text-[10px] shadow-md"
            >
              🔥
            </span>
          )}
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-white">{user?.displayName || 'Reader'}</p>
          <p className="truncate text-[11px] text-mv-text-muted">@{username}</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            {level && (
              <span className="flex items-center gap-1 rounded-full border border-mv-violet/30 bg-mv-violet/10 px-2 py-0.5 text-[9px] font-semibold text-mv-violet">
                {level.emoji} {level.label}
              </span>
            )}
            {rank && (
              <span className="flex items-center gap-1 rounded-full border border-mv-gold/30 bg-mv-gold/10 px-2 py-0.5 text-[9px] font-semibold text-mv-gold">
                {rank.emoji} {rank.label}
              </span>
            )}
          </div>
        </div>
        <Link
          href={user ? `/user/${user.id}` : '/login'}
          onClick={navigate}
          className="tap-target ml-auto shrink-0 rounded-xl border border-mv-border-light bg-mv-surface/60 px-3 text-[10px] font-medium text-mv-text-secondary transition-colors hover:border-mv-violet/40 hover:text-mv-violet"
        >
          View profile
        </Link>
      </div>

      {!compact && (
        <>
          {/* XP progress */}
          {identity?.readingLevel && (
            <div className="relative mt-3">
              <div className="mb-1 flex items-center justify-between text-[9px] text-mv-text-dim">
                <span>
                  {level?.label ?? 'Level'} {level ? `· next ${identity.readingLevel.next?.label ?? 'max'}` : ''}
                </span>
                <span className="font-semibold text-mv-violet">{Math.round(identity.readingLevel.progress)}%</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                <motion.div
                  initial={reducedMotion ? false : { width: 0 }}
                  animate={{ width: `${Math.min(100, identity.readingLevel.progress)}%` }}
                  transition={{ duration: 0.6, ease: 'easeOut', delay: 0.15 }}
                  className="h-full rounded-full bg-gradient-to-r from-mv-purple to-mv-accent"
                />
              </div>
            </div>
          )}

          {/* Quick stats row */}
          <div className="relative mt-3.5 grid grid-cols-3 gap-2">
            {[
              { icon: 'book' as IconName, label: 'Chapters', value: stats?.totalChapters?.toLocaleString() ?? '—' },
              { icon: 'flame' as IconName, label: 'Streak', value: streakValue },
              { icon: 'trophy' as IconName, label: 'Rank', value: rank?.label?.split(' ')[0] ?? '—' },
            ].map((s) => (
              <div key={s.label} className="rounded-xl border border-mv-border/80 bg-mv-surface/50 px-2.5 py-2 text-center">
                <Icon name={s.icon} size={13} className="mx-auto text-mv-violet/80" />
                <p className="mt-1 truncate text-[11px] font-bold text-white">{s.value}</p>
                <p className="text-[8px] uppercase tracking-wider text-mv-text-dim">{s.label}</p>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );

  // ── Continue Reading shortcut ──
  const continueShortcut = latest ? (
    <Link
      href={`/reader/${latest.chapterId}`}
      onClick={navigate}
      className="group/cont mb-1 flex min-h-12 items-center gap-3 rounded-xl border border-mv-violet/25 bg-gradient-to-r from-mv-violet/10 to-transparent px-3 transition-colors hover:border-mv-violet/50 hover:from-mv-violet/20"
    >
      <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-mv-purple to-mv-accent text-white shadow-glow-sm">
        <Icon name="play" size={15} strokeWidth={2.2} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-medium text-white">Continue Reading</span>
        <span className="block truncate text-[10px] text-mv-text-muted">
          {latest.title} · Ch. {latest.chapterNumber}
        </span>
      </span>
      <Icon name="chevronRight" size={14} className="shrink-0 text-mv-violet transition-transform group-hover/cont:translate-x-0.5" />
    </Link>
  ) : null;

  // ── Menu list (sectioned: Library / General) ──
  const menuList = (
    <div ref={menuRef} className="space-y-0.5">
      {continueShortcut}
      <p className="px-3 pb-1 pt-2 text-[9px] font-semibold uppercase tracking-[0.14em] text-mv-text-dim">Library</p>
      {primaries.map((item) => (
        <MenuRow key={item.href} item={item} onNavigate={navigate} active={pathname === item.href} />
      ))}
      <p className="px-3 pb-1 pt-2.5 text-[9px] font-semibold uppercase tracking-[0.14em] text-mv-text-dim">General</p>
      {secondaries.map((item) => (
        <MenuRow key={item.href} item={item} onNavigate={navigate} active={pathname === item.href} />
      ))}
    </div>
  );

  // ── Danger zone with inline confirmation ──
  const dangerZone = confirming ? (
    <div className="animate-fade-in rounded-xl border border-mv-danger/30 bg-mv-danger/10 p-3">
      <p className="text-xs font-medium text-white">Sign out of MangaVerse?</p>
      <p className="mt-0.5 text-[10px] text-mv-text-muted">Your library and progress stay synced to your account.</p>
      <div className="mt-3 flex items-center gap-2">
        <button
          onClick={() => setConfirming(false)}
          className="btn-ghost min-h-11 flex-1 px-4 py-2 text-[11px]"
        >
          Cancel
        </button>
        <button
          onClick={handleLogout}
          className="min-h-11 flex-1 rounded-xl bg-mv-danger px-4 py-2 text-[11px] font-semibold text-white transition-all hover:brightness-110 active:scale-[0.98]"
        >
          Sign Out
        </button>
      </div>
    </div>
  ) : (
    <button
      onClick={() => setConfirming(true)}
      className="group/signout flex min-h-12 w-full items-center gap-3 rounded-xl px-3 transition-all duration-150 hover:bg-mv-danger/10 active:scale-[0.985] active:bg-mv-danger/15"
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-mv-danger/10 text-mv-danger transition-colors group-hover/signout:bg-mv-danger/15">
        <Icon name="logOut" size={17} />
      </span>
      <span className="min-w-0 flex-1 text-left text-[13px] font-medium text-mv-danger">Sign Out</span>
      <Icon name="chevronRight" size={14} className="shrink-0 text-mv-danger/60" />
    </button>
  );

  // ── Theme row (sheet bonus) ──
  const themeRow = (
    <div className="group/side flex min-h-12 items-center gap-3 rounded-xl px-3 transition-all duration-150 hover:bg-white/5 active:scale-[0.985]">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-mv-surface text-mv-text-muted">
        <Icon name="brightness" size={17} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] font-medium text-mv-text-secondary">Appearance</span>
        <span className="block text-[10px] text-mv-text-dim">Light / dark theme</span>
      </span>
      <ThemeSwitcher className="h-9 w-9 rounded-xl" />
    </div>
  );

  return (
    <div className={cn('relative', className)} ref={wrapperRef}>
      {/* Avatar trigger */}
      <motion.button
        ref={btnRef}
        onClick={() => {
          setOpen((o) => !o);
          setConfirming(false);
        }}
        aria-label="Account menu"
        aria-expanded={open}
        whileTap={reducedMotion ? undefined : { scale: 0.92 }}
        transition={{ type: 'spring', stiffness: 500, damping: 25 }}
        className="tap-target h-10 w-10 overflow-hidden rounded-xl border border-mv-border-light bg-mv-surface transition-colors hover:border-mv-violet/50"
      >
        {avatar}
      </motion.button>

      {/* ── Desktop / tablet dropdown (≥768px) ──
          Decluttered: compact identity header (sticky top), sectioned menu
          in a scrollable body, sign-out pinned to the bottom. */}
      <AnimatePresence>
        {open && !isMobile && (
          <motion.div
            initial={reducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.95, y: dropPos === 'up' ? -8 : 8 }}
            animate={reducedMotion ? { opacity: 1 } : { opacity: 1, scale: 1, y: 0 }}
            exit={reducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: dropPos === 'up' ? -6 : 6 }}
            transition={{ type: 'spring', stiffness: 420, damping: 32 }}
            aria-label="Account menu"
            style={{ maxHeight: dropMaxH }}
            className={cn(
              'glass absolute right-0 z-50 flex w-80 flex-col overflow-hidden rounded-2xl shadow-modal',
              dropPos === 'up' ? 'bottom-full mb-2 origin-bottom-right' : 'top-full mt-2 origin-top-right',
            )}
          >
            {token ? (
              <>
                {/* Sticky compact identity header */}
                <div className="shrink-0">{profileHeader(true)}</div>
                {/* Scrollable, sectioned menu body */}
                <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 pb-2">
                  {menuList}
                </div>
                {/* Sticky sign-out footer */}
                <div className="shrink-0 border-t border-mv-border/70 p-2">{dangerZone}</div>
              </>
            ) : (
              <div className="p-3">
                <Link
                  href="/login"
                  onClick={navigate}
                  className="btn-primary flex min-h-12 items-center justify-center rounded-xl px-4 text-xs"
                >
                  Sign in
                </Link>
                <Link
                  href="/signup"
                  onClick={navigate}
                  className="btn-ghost mt-2 flex min-h-12 items-center justify-center rounded-xl px-4 text-xs"
                >
                  Create account
                </Link>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Mobile bottom sheet (<768px) — never the dropdown on phones ── */}
      <BottomSheet
        open={open && isMobile}
        onClose={() => {
          setOpen(false);
          setConfirming(false);
        }}
        title="Account"
        header={
          <div>
            <div className="flex items-center justify-between px-4 pb-2 pt-1">
              <p className="text-sm font-semibold text-white">Account</p>
              <button
                type="button"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={() => {
                  setOpen(false);
                  setConfirming(false);
                }}
                aria-label="Close account menu"
                className="tap-target flex h-10 w-10 items-center justify-center rounded-xl text-mv-text-muted transition-colors hover:bg-white/5 hover:text-white"
              >
                <Icon name="close" size={16} />
              </button>
            </div>
            {token ? profileHeader(false) : null}
          </div>
        }
        footer={
          <div className="pb-2">
            {themeRow}
            {token ? (
              <div className="pb-1 pt-1">{dangerZone}</div>
            ) : (
              <div className="flex gap-2 pb-1">
                <Link href="/login" onClick={navigate} className="btn-primary min-h-12 flex-1 px-4 text-xs">
                  Sign in
                </Link>
                <Link href="/signup" onClick={navigate} className="btn-ghost min-h-12 flex-1 px-4 text-xs">
                  Create account
                </Link>
              </div>
            )}
          </div>
        }
      >
        {token ? (
          <>
            <div className="pt-1">{menuList}</div>
            <p className="px-3 pb-2 pt-3 text-[9px] text-mv-text-dim">
              Logged in as {user?.email} · {username}
            </p>
          </>
        ) : (
          <div className="px-2 pb-2 pt-1">
            <p className="px-2 py-3 text-center text-xs text-mv-text-muted">
              Sign in to sync your library, streaks, and reviews across devices.
            </p>
          </div>
        )}
      </BottomSheet>
    </div>
  );
}
