'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useRef, useState, useEffect } from 'react';
import {
  useUnreadCount,
  useNotifications,
  useMarkRead,
  useMarkAllRead,
  getNotificationIcon,
  getNotificationTypeColor,
} from '@/lib/hooks/useNotifications';
import { Icon } from '@/components/ui/Icon';
import { cn } from '@/lib/cn';

/* ═══════════════════════════════════════════════════════════════
   NotificationCenter — the bell affordance + unread badge + the
   glass dropdown of recent notifications. Reusable anywhere in the
   shell (top bar, expanded sidebar, mobile).
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

export interface NotificationCenterProps {
  className?: string;
}

export function NotificationCenter({ className }: NotificationCenterProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const { data: unreadData } = useUnreadCount();
  const { data: notifData } = useNotifications(1, 5);
  const markRead = useMarkRead();
  const markAllRead = useMarkAllRead();

  const unreadCount = unreadData?.count || 0;
  const recentNotifs = notifData?.items || [];

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

  const handleClick = (notif: (typeof recentNotifs)[0]) => {
    if (!notif.read) markRead.mutate(notif.id);
    setOpen(false);
    if (notif.link) router.push(notif.link);
  };

  return (
    <div className={cn('relative', className)} ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        aria-label="Notifications"
        aria-expanded={open}
        className="relative flex h-9 w-9 items-center justify-center rounded-xl text-mv-text-secondary transition-colors hover:bg-white/5 hover:text-white"
      >
        <Icon name="bell" size={18} />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-gradient-to-r from-mv-accent to-mv-purple px-1 text-[8px] font-bold text-white shadow-md shadow-mv-accent/40">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="glass absolute right-0 top-full z-50 mt-2 w-80 overflow-hidden rounded-2xl shadow-modal animate-scale-in">
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

          {recentNotifs.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-white/5">
                <Icon name="bell" size={20} className="text-mv-text-dim" />
              </div>
              <p className="text-[11px] text-mv-text-muted">No notifications yet</p>
              <p className="mt-1 text-[9px] text-mv-text-dim">We&apos;ll notify you about new chapters and activity</p>
            </div>
          ) : (
            <div className="max-h-80 overflow-y-auto">
              {recentNotifs.map((notif) => (
                <button
                  key={notif.id}
                  onClick={() => handleClick(notif)}
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
  );
}
