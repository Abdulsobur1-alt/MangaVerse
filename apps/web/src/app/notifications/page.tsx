'use client';

import Link from 'next/link';
import { useState, useRef, useEffect, useCallback } from 'react';
import { AppShell } from '@/components/AppShell';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import {
  useInfiniteNotifications,
  useMarkRead,
  useMarkAllRead,
  useDeleteNotification,
  usePinNotification,
  useArchiveNotification,
  useUnreadCount,
  getNotificationIcon,
  getNotificationTypeColor,
  getPriorityMeta,
  NOTIFICATION_FILTERS,
  PRIORITY_META,
  type NotificationItem,
} from '@/lib/hooks/useNotifications';
import { useRealtime } from '@/lib/realtime';
import { Icon } from '@/components/ui/Icon';
import { EmptyState } from '@/components/ui/EmptyState';
import { cn } from '@/lib/cn';

/* ═══════════════════════════════════════════════════════════════
   Notifications — the full notification center (Phase 10).
   Search, category + priority filters, inbox/archive scopes,
   day-grouped infinite timeline, pin/archive/read/delete actions,
   digest cards, and live updates over the realtime socket.
   ═══════════════════════════════════════════════════════════════ */

function formatNotifDate(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins} minute${mins === 1 ? '' : 's'} ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} day${days === 1 ? '' : 's'} ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
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
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
}

function NotifRow({ notif }: { notif: NotificationItem }) {
  const markRead = useMarkRead();
  const pin = usePinNotification();
  const archive = useArchiveNotification();
  const deleteNotif = useDeleteNotification();
  const priority = getPriorityMeta(notif.priority);
  const pinned = !!notif.pinnedAt;
  const isDigest = (notif.data as { digest?: boolean } | null)?.digest === true;

  // ── Swipe-to-delete (touch) — desktop keeps the hover quick actions ──
  const [isTouch, setIsTouch] = useState(false);
  const [dx, setDx] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [dismissing, setDismissing] = useState(false);
  const drag = useRef<{ startX: number; startY: number; engaged: boolean } | null>(null);
  const suppressClick = useRef(false);
  const dxRef = useRef(0);

  useEffect(() => {
    if (typeof window !== 'undefined') setIsTouch(window.matchMedia('(pointer: coarse)').matches);
  }, []);

  const onTouchStart = (e: React.TouchEvent) => {
    if (!isTouch || dismissing) return;
    const t = e.touches[0];
    drag.current = { startX: t.clientX, startY: t.clientY, engaged: false };
    setDragging(true);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    const d = drag.current;
    if (!d || dismissing) return;
    const t = e.touches[0];
    const deltaX = t.clientX - d.startX;
    const deltaY = t.clientY - d.startY;
    // Engage only after a clear horizontal intent (keeps vertical scroll intact).
    if (!d.engaged && Math.abs(deltaX) > 10 && Math.abs(deltaX) > Math.abs(deltaY)) d.engaged = true;
    if (d.engaged) {
      // Mirror into a ref too — on fast flings the last touchmove may not have
      // rendered before touchend, so state alone can lag the real position.
      const v = Math.max(-160, Math.min(0, deltaX));
      setDx(v);
      dxRef.current = v;
    }
  };

  const onTouchEnd = () => {
    const d = drag.current;
    drag.current = null;
    setDragging(false);
    if (!d?.engaged) return;
    suppressClick.current = true;
    if (dxRef.current < -80) {
      setDismissing(true);
      setDx(-480);
      setTimeout(() => {
        deleteNotif.mutate(notif.id, {
          // Roll back the fly-out if the request fails — the row must never
          // get stuck invisible off-screen.
          onError: () => {
            setDismissing(false);
            setDx(0);
            dxRef.current = 0;
          },
        });
      }, 170);
    } else {
      setDx(0);
      dxRef.current = 0;
    }
  };

  const onClickGuard = (e: React.MouseEvent) => {
    if (suppressClick.current) {
      e.preventDefault();
      e.stopPropagation();
      suppressClick.current = false;
    }
  };

  const inner = (
    <div className={cn('flex items-start gap-3 p-4', isDigest && 'border-l-2 border-mv-violet/60 bg-gradient-to-r from-mv-violet/10 to-transparent')}>
      <div className="relative">
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-sm"
          style={{ backgroundColor: `${getNotificationTypeColor(notif.type)}20` }}
        >
          {getNotificationIcon(notif.type)}
        </div>
        {notif.priority !== 'normal' && (
          <span
            className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full ring-2 ring-mv-darker"
            style={{ backgroundColor: priority.color }}
            title={`${priority.label} priority`}
          />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className={cn('text-sm leading-relaxed', !notif.read ? 'font-medium text-white' : 'text-mv-text-secondary')}>
            {notif.title}
          </p>
          {!notif.read && <div className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-mv-accent" />}
        </div>
        {notif.body && <p className="mt-0.5 line-clamp-2 text-xs text-mv-text-muted">{notif.body}</p>}
        <p className="mt-1.5 flex items-center gap-1.5 text-[10px] text-mv-text-dim">
          {formatNotifDate(notif.createdAt)}
          {pinned && (
            <span className="flex items-center gap-0.5 text-mv-violet">
              <Icon name="pin" size={10} /> pinned
            </span>
          )}
          <span className="rounded-full bg-mv-surface px-1.5 py-px capitalize" style={{ color: priority.color }}>
            {priority.label}
          </span>
        </p>
      </div>
    </div>
  );

  return (
    <div
      className="relative overflow-hidden rounded-xl"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onClick={onClickGuard}
    >
      {/* Reveal layer — the delete action slides in behind the row */}
      <div
        aria-hidden="true"
        className="absolute inset-y-0 right-0 flex w-20 items-center justify-center bg-mv-danger/15 text-mv-danger"
        style={{ opacity: isTouch ? Math.min(1, -dx / 140) : 0 }}
      >
        <Icon name="trash" size={15} />
      </div>

      <div
        className={cn('group relative rounded-xl border', !notif.read ? 'border-mv-accent/20 bg-mv-darker' : 'border-mv-border bg-mv-darker/50 hover:bg-mv-darker')}
        style={{
          transform: dismissing ? 'translateX(-480px)' : `translateX(${dx}px)`,
          opacity: dismissing ? 0 : 1 - Math.min(1, -dx / 240),
          transition: dragging ? 'none' : 'transform 0.25s ease, opacity 0.25s ease, background-color 0.2s ease',
          touchAction: isTouch ? 'pan-y' : undefined,
        }}
      >
        {notif.link ? (
          <Link href={notif.link} className="block" onClick={() => { if (!notif.read) markRead.mutate(notif.id); }}>
            {inner}
          </Link>
        ) : (
          inner
        )}

        {/* Actions */}
        <div className="absolute right-2 top-2 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          {!notif.read && (
            <button
              onClick={() => markRead.mutate(notif.id)}
              className="rounded-md bg-mv-surface px-2 py-1 text-[9px] text-mv-text-secondary transition-colors hover:text-mv-accent"
              title="Mark as read"
            >
              Read
            </button>
          )}
          <button
            onClick={() => pin.mutate({ id: notif.id, pinned })}
            className={cn('rounded-md bg-mv-surface px-2 py-1 text-[9px] transition-colors', pinned ? 'text-mv-violet' : 'text-mv-text-secondary hover:text-mv-violet')}
            title={pinned ? 'Unpin' : 'Pin'}
          >
            {pinned ? 'Unpin' : 'Pin'}
          </button>
          <button
            onClick={() => archive.mutate({ id: notif.id, archived: false })}
            className="rounded-md bg-mv-surface px-2 py-1 text-[9px] text-mv-text-secondary transition-colors hover:text-mv-violet"
            title="Archive"
          >
            Archive
          </button>
          <button
            onClick={() => deleteNotif.mutate(notif.id)}
            className="rounded-md bg-mv-surface px-2 py-1 text-[9px] text-red-400/70 transition-colors hover:text-red-400"
            title="Delete"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

const PRIORITY_KEYS = Object.keys(PRIORITY_META);

export default function NotificationsPage() {
  // Live updates over the realtime socket
  useRealtime();

  const [scope, setScope] = useState<'inbox' | 'archived'>('inbox');
  const [readFilter, setReadFilter] = useState<'all' | 'unread' | 'read'>('all');
  const [category, setCategory] = useState('');
  const [priority, setPriority] = useState('');
  const [q, setQ] = useState('');
  const [qInput, setQInput] = useState('');
  const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const filters = { scope, read: readFilter, category: category || undefined, priority: priority || undefined, q: q || undefined };
  const feed = useInfiniteNotifications(20, filters);
  const markAllRead = useMarkAllRead();
  const { data: unreadData } = useUnreadCount();
  const loadMoreRef = useRef<HTMLDivElement>(null);

  const allItems = feed.data?.pages.flatMap((p) => p.items) ?? [];
  const total = feed.data?.pages[0]?.total ?? 0;

  // Debounced search
  useEffect(() => {
    if (searchDebounce.current) clearTimeout(searchDebounce.current);
    searchDebounce.current = setTimeout(() => setQ(qInput.trim()), 350);
    return () => { if (searchDebounce.current) clearTimeout(searchDebounce.current); };
  }, [qInput]);

  // Infinite scroll via IntersectionObserver
  const onLoadMore = useCallback(() => {
    if (feed.hasNextPage && !feed.isFetchingNextPage) feed.fetchNextPage();
  }, [feed]);

  useEffect(() => {
    const el = loadMoreRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) onLoadMore();
      },
      { rootMargin: '200px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [onLoadMore]);

  // Group by day
  const groups = new Map<string, NotificationItem[]>();
  for (const n of allItems) {
    const key = dayGroup(n.createdAt);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(n);
  }

  const hasFilters = !!category || !!priority || !!q || readFilter !== 'all';

  return (
    <ProtectedRoute>
      <AppShell>
        <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 md:px-8 md:py-8">
          {/* Header */}
          <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="eyebrow mb-2">Inbox</p>
              <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl md:text-4xl">Notifications</h1>
              <p className="mt-1 text-xs text-mv-text-muted">
                {scope === 'inbox'
                  ? `${total} notification${total !== 1 ? 's' : ''}${unreadData?.count ? ` · ${unreadData.count} unread` : ''}`
                  : `${total} archived`}
              </p>
            </div>
            {scope === 'inbox' && total > 0 && (
              <button
                onClick={() => markAllRead.mutate()}
                disabled={markAllRead.isPending}
                className="btn-ghost px-4 py-2 text-[11px] disabled:opacity-50"
              >
                {markAllRead.isPending ? '...' : 'Mark All Read'}
              </button>
            )}
          </div>

          {/* Search + scope + read filter */}
          <div className="mb-4 space-y-3">
            <div className="relative">
              <Icon name="search" size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-mv-text-dim" />
              <input
                type="text"
                value={qInput}
                onChange={(e) => setQInput(e.target.value)}
                placeholder="Search notifications…"
                className="w-full rounded-xl border border-mv-border-light bg-mv-darker py-2.5 pl-9 pr-3 text-xs text-mv-text placeholder:text-mv-text-dim outline-none transition-colors focus:border-mv-accent"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex gap-1 rounded-xl border border-mv-border-light bg-mv-surface/60 p-1">
                {(['inbox', 'archived'] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => setScope(s)}
                    aria-pressed={scope === s}
                    className={cn(
                      'rounded-lg px-3.5 py-1.5 text-[10px] font-medium capitalize transition-all',
                      scope === s ? 'bg-gradient-to-r from-mv-purple to-mv-accent text-white shadow-glow-sm' : 'text-mv-text-secondary hover:text-mv-text',
                    )}
                  >
                    {s === 'inbox' ? 'Inbox' : 'Archived'}
                  </button>
                ))}
              </div>
              <div className="flex gap-1 rounded-xl border border-mv-border-light bg-mv-surface/60 p-1">
                {(['all', 'unread', 'read'] as const).map((r) => (
                  <button
                    key={r}
                    onClick={() => setReadFilter(r)}
                    aria-pressed={readFilter === r}
                    className={cn(
                      'rounded-lg px-3 py-1.5 text-[10px] font-medium capitalize transition-all',
                      readFilter === r ? 'bg-mv-accent/15 text-mv-violet' : 'text-mv-text-secondary hover:text-mv-text',
                    )}
                  >
                    {r}
                  </button>
                ))}
              </div>
              <div className="flex gap-1 rounded-xl border border-mv-border-light bg-mv-surface/60 p-1">
                {PRIORITY_KEYS.map((p) => (
                  <button
                    key={p}
                    onClick={() => setPriority(priority === p ? '' : p)}
                    aria-pressed={priority === p}
                    title={PRIORITY_META[p].label}
                    className={cn(
                      'h-6 w-6 rounded-lg transition-all',
                      priority === p ? 'ring-1 ring-offset-1 ring-offset-mv-darker' : 'opacity-60 hover:opacity-100',
                    )}
                    style={{ backgroundColor: priority === p ? PRIORITY_META[p].color : `${PRIORITY_META[p].color}30` }}
                  />
                ))}
              </div>
            </div>
            {/* Category chips */}
            <div className="scrollbar-none -mx-4 flex gap-1.5 overflow-x-auto px-4 sm:mx-0 sm:px-0" role="group" aria-label="Filter by category">
              {NOTIFICATION_FILTERS.map((f) => {
                const active = (category === '' && f.key === '') || category === f.key;
                return (
                  <button
                    key={f.key || 'all'}
                    onClick={() => setCategory(f.key)}
                    aria-pressed={active}
                    className={cn(
                      'flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[11px] font-medium transition-all duration-200',
                      active
                        ? 'bg-gradient-to-r from-mv-purple to-mv-accent text-white shadow-glow-sm'
                        : 'border border-mv-border-light bg-mv-surface/60 text-mv-text-secondary hover:border-mv-violet/40 hover:text-mv-text',
                    )}
                  >
                    <span aria-hidden="true">{f.emoji}</span>
                    {f.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Feed */}
          {feed.isLoading ? (
            <div className="space-y-2 animate-pulse">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex items-start gap-3 rounded-xl border border-mv-border bg-mv-darker p-4">
                  <div className="h-10 w-10 rounded-lg bg-mv-surface" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 w-3/4 rounded bg-mv-surface" />
                    <div className="h-2 w-1/2 rounded bg-mv-surface" />
                  </div>
                </div>
              ))}
            </div>
          ) : allItems.length === 0 ? (
            <EmptyState
              icon="bell"
              title={hasFilters ? 'No matching notifications' : scope === 'archived' ? 'Nothing archived yet' : 'All caught up!'}
              body={hasFilters ? 'Try clearing filters or searching differently.' : 'You have no notifications right now.'}
              action={
                hasFilters ? (
                  <button
                    onClick={() => { setCategory(''); setPriority(''); setQ(''); setQInput(''); setReadFilter('all'); }}
                    className="btn-ghost px-4 py-2 text-[10px]"
                  >
                    Clear filters
                  </button>
                ) : undefined
              }
            />
          ) : (
            <div className="space-y-4">
              {[...groups.entries()].map(([day, items]) => (
                <section key={day} aria-label={day}>
                  <p className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-mv-text-dim">
                    <Icon name="clock" size={11} className="text-mv-violet/70" />
                    {day}
                  </p>
                  <div className="space-y-2">
                    {items.map((notif) => (
                      <NotifRow key={notif.id} notif={notif} />
                    ))}
                  </div>
                </section>
              ))}

              {/* Infinite scroll sentinel */}
              <div ref={loadMoreRef} className="flex items-center justify-center py-4">
                {feed.isFetchingNextPage ? (
                  <span className="text-[10px] text-mv-text-dim">Loading more…</span>
                ) : feed.hasNextPage ? (
                  <button onClick={onLoadMore} className="btn-ghost px-4 py-2 text-[10px]">
                    Load more
                  </button>
                ) : (
                  <p className="text-[10px] text-mv-text-dim">End of history — that’s everything.</p>
                )}
              </div>
            </div>
          )}
        </div>
      </AppShell>
    </ProtectedRoute>
  );
}
