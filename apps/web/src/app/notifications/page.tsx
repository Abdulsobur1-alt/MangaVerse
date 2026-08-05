'use client';

import Link from 'next/link';
import { useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { useNotifications, useMarkRead, useMarkAllRead, useDeleteNotification, getNotificationIcon, getNotificationTypeColor } from '@/lib/hooks/useNotifications';

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

export default function NotificationsPage() {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useNotifications(page, 20);
  const markRead = useMarkRead();
  const markAllRead = useMarkAllRead();
  const deleteNotif = useDeleteNotification();

  const notifs = data?.items || [];
  const totalPages = data ? Math.ceil(data.total / data.limit) : 0;

  return (
    <ProtectedRoute>
      <AppShell>
        <div className="mx-auto max-w-3xl px-5 py-8 sm:px-6 md:px-8">
          <div className="mb-8 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="eyebrow mb-2">Activity</p>
              <h1 className="text-3xl font-bold tracking-tight text-white md:text-4xl">
                Notifications
              </h1>
              <p className="mt-1 text-xs text-mv-text-muted">
                {data?.total || 0} notification{data?.total !== 1 ? 's' : ''}
              </p>
            </div>
            {data && data.total > 0 && (
              <button
                onClick={() => markAllRead.mutate()}
                disabled={markAllRead.isPending}
                className="btn-ghost px-4 py-2 text-[11px] disabled:opacity-50"
              >
                {markAllRead.isPending ? '...' : 'Mark All Read'}
              </button>
            )}
          </div>

          {isLoading ? (
            <div className="space-y-2 animate-pulse">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-start gap-3 rounded-xl bg-mv-darker border border-mv-border p-4">
                  <div className="h-10 w-10 rounded-lg bg-mv-surface" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 w-3/4 rounded bg-mv-surface" />
                    <div className="h-2 w-1/2 rounded bg-mv-surface" />
                  </div>
                </div>
              ))}
            </div>
          ) : notifs.length === 0 ? (
            <div className="rounded-xl border border-mv-border bg-mv-darker p-12 text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-mv-surface">
                <svg className="h-7 w-7 text-mv-text-dim" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
              </div>
              <h3 className="text-sm font-medium text-mv-text mb-1">All caught up!</h3>
              <p className="text-xs text-mv-text-muted mb-4">You have no notifications right now.</p>
              <Link
                href="/browse"
                className="btn-primary px-5 py-2.5 text-xs"
              >
                Browse Titles
              </Link>
            </div>
          ) : (
            <>
              <div className="space-y-1">
                {notifs.map((notif) => (
                  <div
                    key={notif.id}
                    className={`group relative rounded-xl border transition-all ${
                      !notif.read
                        ? 'border-mv-accent/20 bg-mv-darker'
                        : 'border-mv-border bg-mv-darker/50 hover:bg-mv-darker'
                    }`}
                  >
                    {notif.link ? (
                      <Link href={notif.link} className="flex items-start gap-3 p-4" onClick={() => { if (!notif.read) markRead.mutate(notif.id); }}>
                        <div
                          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-sm"
                          style={{ backgroundColor: `${getNotificationTypeColor(notif.type)}20` }}
                        >
                          {getNotificationIcon(notif.type)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <p className={`text-sm leading-relaxed ${!notif.read ? 'text-white font-medium' : 'text-mv-text-secondary'}`}>
                              {notif.title}
                            </p>
                            {!notif.read && (
                              <div className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-mv-accent" />
                            )}
                          </div>
                          {notif.body && (
                            <p className="text-xs text-mv-text-muted mt-1 line-clamp-2">{notif.body}</p>
                          )}
                          <p className="text-[10px] text-mv-text-dim mt-1.5">{formatNotifDate(notif.createdAt)}</p>
                        </div>
                      </Link>
                    ) : (
                      <div className="flex items-start gap-3 p-4">
                        <div
                          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-sm"
                          style={{ backgroundColor: `${getNotificationTypeColor(notif.type)}20` }}
                        >
                          {getNotificationIcon(notif.type)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <p className={`text-sm leading-relaxed ${!notif.read ? 'text-white font-medium' : 'text-mv-text-secondary'}`}>
                              {notif.title}
                            </p>
                            {!notif.read && (
                              <div className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-mv-accent" />
                            )}
                          </div>
                          {notif.body && (
                            <p className="text-xs text-mv-text-muted mt-1 line-clamp-2">{notif.body}</p>
                          )}
                          <p className="text-[10px] text-mv-text-dim mt-1.5">{formatNotifDate(notif.createdAt)}</p>
                        </div>
                      </div>
                    )}
                    <div className="absolute right-2 top-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {!notif.read && (
                        <button
                          onClick={() => markRead.mutate(notif.id)}
                          className="rounded-md bg-mv-surface px-2 py-1 text-[9px] text-mv-text-secondary hover:text-mv-accent transition-colors"
                        >
                          Read
                        </button>
                      )}
                      <button
                        onClick={() => deleteNotif.mutate(notif.id)}
                        className="rounded-md bg-mv-surface px-2 py-1 text-[9px] text-red-400/70 hover:text-red-400 transition-colors"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="mt-6 flex items-center justify-center gap-2">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="rounded-lg border border-mv-border-light bg-mv-surface px-3 py-1.5 text-[10px] text-mv-text-secondary transition-colors hover:text-mv-text disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    ← Prev
                  </button>
                  <span className="text-[10px] text-mv-text-muted">Page {page} of {totalPages}</span>
                  <button
                    onClick={() => setPage(p => p + 1)}
                    disabled={!data?.hasMore}
                    className="rounded-lg border border-mv-border-light bg-mv-surface px-3 py-1.5 text-[10px] text-mv-text-secondary transition-colors hover:text-mv-text disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    Next →
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </AppShell>
    </ProtectedRoute>
  );
}
