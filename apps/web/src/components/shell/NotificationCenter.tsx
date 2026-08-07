'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useRef, useState, useEffect } from 'react';
import {
  useUnreadCount,
  useNotifications,
  useMarkRead,
  useMarkAllRead,
  usePinNotification,
  useArchiveNotification,
  getNotificationIcon,
  getNotificationTypeColor,
  getPriorityMeta,
  type NotificationItem,
} from '@/lib/hooks/useNotifications';
import { useRealtime } from '@/lib/realtime';
import { Icon } from '@/components/ui/Icon';
import { cn } from '@/lib/cn';

/* ═══════════════════════════════════════════════════════════════
   NotificationCenter — the bell affordance + unread badge + the
   glass dropdown. Phase 10 redesign: All/Unread tabs, day-grouped
   timeline, priority dots, pinned items, hover quick-actions, and
   live updates over the realtime socket.
   ═══════════════════════════════════════════════════════════════ */

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

function dayGroup(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfDay = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diffDays = Math.round((startOfToday - startOfDay) / 86_400_000);
  if (diffDays <= 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return d.toLocaleDateString('en-US', { weekday: 'long' });
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

interface RowProps {
  notif: NotificationItem;
  onOpen: (n: NotificationItem) => void;
}

function NotifRow({ notif, onOpen }: RowProps) {
  const markRead = useMarkRead();
  const pin = usePinNotification();
  const archive = useArchiveNotification();
  const priority = getPriorityMeta(notif.priority);
  const pinned = !!notif.pinnedAt;

  return (
    <button
      onClick={() => onOpen(notif)}
      className={cn(
        'group flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-white/5',
        !notif.read && 'bg-white/[0.03]',
      )}
    >
      <div className="relative">
        <div
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs"
          style={{ backgroundColor: `${getNotificationTypeColor(notif.type)}20` }}
        >
          <span>{getNotificationIcon(notif.type)}</span>
        </div>
        {notif.priority !== 'normal' && (
          <span
            className="absolute -right-1 -top-1 h-2 w-2 rounded-full ring-2 ring-mv-darker"
            style={{ backgroundColor: priority.color }}
            title={`${priority.label} priority`}
          />
        )}
      </div>

      <div className="min-w-0 flex-1">
        <p className={cn('text-xs leading-relaxed', !notif.read ? 'font-medium text-white' : 'text-mv-text-secondary')}>
          {notif.title}
        </p>
        {notif.body && <p className="mt-0.5 line-clamp-1 text-[10px] text-mv-text-muted">{notif.body}</p>}
        <p className="mt-1 text-[9px] text-mv-text-dim">
          {formatNotifTime(notif.createdAt)}
          {pinned && <span className="ml-1.5 text-mv-violet">· pinned</span>}
        </p>
      </div>

      {!notif.read && <div className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-gradient-to-r from-mv-accent to-mv-purple" />}

      {/* Quick actions (hover) */}
      <div className="absolute right-3 top-2.5 hidden items-center gap-0.5 rounded-lg bg-mv-darker/90 p-0.5 shadow-sm group-hover:flex">
        <button
          onClick={(e) => { e.stopPropagation(); pin.mutate({ id: notif.id, pinned }); }}
          aria-label={pinned ? 'Unpin' : 'Pin'}
          className={cn('rounded-md p-1 transition-colors hover:bg-white/10', pinned ? 'text-mv-violet' : 'text-mv-text-dim hover:text-mv-text')}
        >
          <Icon name="pin" size={11} />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); archive.mutate({ id: notif.id, archived: false }); }}
          aria-label="Archive"
          className="rounded-md p-1 text-mv-text-dim transition-colors hover:bg-white/10 hover:text-mv-text"
        >
          <Icon name="archive" size={11} />
        </button>
        {!notif.read && (
          <button
            onClick={(e) => { e.stopPropagation(); markRead.mutate(notif.id); }}
            aria-label="Mark as read"
            className="rounded-md p-1 text-mv-text-dim transition-colors hover:bg-white/10 hover:text-mv-text"
          >
            <Icon name="check" size={11} />
          </button>
        )}
      </div>
    </button>
  );
}

export interface NotificationCenterProps {
  className?: string;
}

export function NotificationCenter({ className }: NotificationCenterProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<'all' | 'unread'>('all');
  const ref = useRef<HTMLDivElement>(null);

  // Live updates: invalidates the notification queries on new events
  useRealtime();

  const { data: unreadData } = useUnreadCount();
  const { data: notifData } = useNotifications(1, 8);
  const markRead = useMarkRead();
  const markAllRead = useMarkAllRead();

  const unreadCount = unreadData?.count || 0;
  const allNotifs = notifData?.items || [];
  const notifs = tab === 'unread' ? allNotifs.filter((n) => !n.read) : allNotifs;

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Close on route change
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open]);

  const handleOpen = (notif: NotificationItem) => {
    if (!notif.read) markRead.mutate(notif.id);
    setOpen(false);
    if (notif.link) router.push(notif.link);
  };

  // Group by day
  const groups = new Map<string, NotificationItem[]>();
  for (const n of notifs) {
    const key = dayGroup(n.createdAt);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(n);
  }

  return (
    <div className={cn('relative', className)} ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        aria-label="Notifications"
        aria-expanded={open}
        className="tap-target relative h-10 w-10 rounded-xl text-mv-text-secondary transition-colors hover:bg-white/5 hover:text-white"
      >
        <Icon name="bell" size={18} />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-gradient-to-r from-mv-accent to-mv-purple px-1 text-[8px] font-bold text-white shadow-md shadow-mv-accent/40">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="glass fixed inset-x-2 bottom-[calc(env(safe-area-inset-bottom)+0.5rem)] z-[60] max-h-[72vh] w-auto overflow-hidden rounded-2xl shadow-modal animate-slide-up sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:bottom-auto sm:mt-2 sm:w-[22rem] sm:max-h-none sm:animate-scale-in">
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
            <p className="text-xs font-semibold text-white">Notifications</p>
            <div className="flex items-center gap-3">
              {unreadCount > 0 && (
                <button onClick={() => markAllRead.mutate()} className="text-[9px] text-mv-violet hover:underline">
                  Mark all read
                </button>
              )}
              <Link href="/notifications" onClick={() => setOpen(false)} className="text-[9px] text-mv-text-muted hover:text-mv-text">
                View all
              </Link>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 border-b border-white/5 px-3 py-2">
            {(['all', 'unread'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                aria-pressed={tab === t}
                className={cn(
                  'rounded-full px-3 py-1 text-[10px] font-medium transition-colors',
                  tab === t ? 'bg-mv-accent/15 text-mv-violet' : 'text-mv-text-muted hover:text-mv-text',
                )}
              >
                {t === 'all' ? 'All' : `Unread${unreadCount > 0 ? ` (${unreadCount})` : ''}`}
              </button>
            ))}
          </div>

          {notifs.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-white/5">
                <Icon name="bell" size={20} className="text-mv-text-dim" />
              </div>
              <p className="text-[11px] text-mv-text-muted">
                {tab === 'unread' ? 'You’re all caught up!' : 'No notifications yet'}
              </p>
              <p className="mt-1 text-[9px] text-mv-text-dim">We’ll notify you about new chapters and activity</p>
            </div>
          ) : (
            <div className="max-h-[60vh] overflow-y-auto overscroll-contain sm:max-h-80">
              {[...groups.entries()].map(([day, items]) => (
                <div key={day}>
                  <p className="px-4 pb-1 pt-3 text-[9px] font-semibold uppercase tracking-[0.14em] text-mv-text-dim">{day}</p>
                  {items.map((notif) => (
                    <div key={notif.id} className="relative">
                      <NotifRow notif={notif} onOpen={handleOpen} />
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
