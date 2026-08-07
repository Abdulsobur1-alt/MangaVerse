'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { AppShell } from '@/components/AppShell';
import { Icon } from '@/components/ui/Icon';
import { EmptyState } from '@/components/ui/EmptyState';
import { CoverImage } from '@/components/CoverImage';
import { useAuthStore } from '@/store/authStore';
import { useLibrary, type BookmarkItem } from '@/lib/hooks/useLibrary';
import {
  useDownloads,
  useDownloadPrefs,
  loadDownloadPrefs,
  saveDownloadPrefs,
  enqueueDownload,
  cancelDownload,
  removeDownload,
  removeSeriesDownloads,
  clearAllDownloads,
  getStorageEstimate,
  isOnWifi,
  type DownloadRecord,
  type DownloadPrefs,
} from '@/lib/downloads';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';

/* ═══════════════════════════════════════════════════════════════
   Downloads — the offline library (Phase 7 completion).
   Answers "what can I read offline right now?":
   • Live offline status + storage usage + last-sync
   • Active download queue with real per-chapter progress
   • Downloaded chapters grouped by series, with per-series cleanup
   • "Download from your shelf" — pull the latest chapters of your
     Reading-shelf titles in one tap
   • Rules: auto-download new chapters + Wi-Fi only
   • Manage storage (remove all) + export the list as JSON
   A compact "Get the mobile app" card keeps the original page's purpose.
   ═══════════════════════════════════════════════════════════════ */

function formatBytes(bytes: number): string {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let i = 0;
  let n = bytes;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i += 1;
  }
  return `${n.toFixed(n >= 100 || i === 0 ? 0 : 1)} ${units[i]}`;
}

function timeAgo(epochMs: number): string {
  if (!epochMs) return 'Never';
  const diff = Date.now() - epochMs;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(epochMs).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function StatTile({ label, value, accent, hint, icon }: { label: string; value: string | number; accent?: string; hint: string; icon: 'download' | 'library' | 'database' | 'clock' }) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-mv-border bg-mv-darker p-4 transition-all duration-300 hover:-translate-y-0.5 hover:border-mv-violet/30 hover:shadow-card-hover">
      <div className="pointer-events-none absolute -right-4 -top-6 h-16 w-16 rounded-full bg-mv-accent/10 blur-2xl" />
      <div className="flex items-center justify-between">
        <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-mv-text-muted">{label}</p>
        <Icon name={icon} size={13} className="text-mv-text-dim" />
      </div>
      <p className={`mt-1.5 text-2xl font-bold tracking-tight ${accent || 'text-white'}`}>{value}</p>
      <p className="mt-0.5 text-[10px] text-mv-text-dim">{hint}</p>
    </div>
  );
}

/** One Reading-shelf title: quick "download latest" card. */
function ShelfTitleCard({ item }: { item: BookmarkItem }) {
  const downloads = useDownloads();
  const [latest, setLatest] = useState<{ id: string; number: number; title: string | null } | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api
      .get<{ items: { id: string; number: number; title: string | null }[] }>(`/chapters?titleId=${item.titleId}&limit=1`)
      .then((d) => {
        if (!cancelled && d.items[0]) setLatest(d.items[0]);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [item.titleId]);

  const dl = latest ? downloads.find((d) => d.chapterId === latest.id) : undefined;
  const busy = dl?.status === 'queued' || dl?.status === 'downloading';
  const done = !!dl && !busy;

  const click = async () => {
    if (!latest) return;
    if (busy) cancelDownload(latest.id);
    else if (dl) await removeDownload(latest.id);
    else
      enqueueDownload({
        chapterId: latest.id,
        titleId: item.titleId,
        seriesSlug: item.title.slug,
        seriesTitle: item.title.title,
        coverUrl: item.title.coverUrl,
        chapterNumber: latest.number,
        chapterTitle: latest.title,
      });
  };

  return (
    <div className="group flex items-center gap-3 rounded-2xl border border-mv-border bg-mv-darker p-3 transition-all duration-300 hover:border-mv-violet/40 hover:shadow-card-hover">
      <Link href={`/title/${item.title.slug}`} className="block h-16 w-11 shrink-0 overflow-hidden rounded-lg bg-mv-surface">
        <CoverImage src={item.title.coverUrl} title={item.title.title} type={item.title.type} className="h-full w-full" />
      </Link>
      <div className="min-w-0 flex-1">
        <Link href={`/title/${item.title.slug}`} className="block">
          <p className="truncate text-xs font-medium text-mv-text transition-colors group-hover:text-mv-violet">{item.title.title}</p>
        </Link>
        <p className="mt-0.5 text-[9px] text-mv-text-dim">
          {loading ? 'Locating latest…' : latest ? `Ch. ${latest.number}${latest.title ? ` · ${latest.title}` : ''}` : 'No chapters'}
        </p>
      </div>
      <button
        onClick={click}
        disabled={!latest}
        aria-label={busy ? `Cancel download of latest chapter of ${item.title.title}` : done ? `Remove offline copy of ${item.title.title}` : `Download latest chapter of ${item.title.title}`}
        title={busy ? 'Cancel download' : done ? 'Downloaded — tap to remove' : 'Download latest chapter'}
        className={cn(
          'flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-all',
          busy
            ? 'text-mv-warning'
            : done
              ? 'bg-mv-accent/20 text-mv-accent'
              : 'bg-mv-surface text-mv-text-secondary hover:bg-gradient-to-r hover:from-mv-purple hover:to-mv-accent hover:text-white',
        )}
      >
        {busy ? (
          <span className="h-3.5 w-3.5 animate-spin rounded-full border-[1.5px] border-current border-t-transparent" aria-hidden="true" />
        ) : (
          <Icon name={done ? 'check' : 'download'} size={14} />
        )}
      </button>
    </div>
  );
}

export default function DownloadPage() {
  const { token } = useAuthStore();
  const downloads = useDownloads();
  const prefs = useDownloadPrefs();
  const [online, setOnline] = useState(true);
  const [storage, setStorage] = useState<{ usage: number; quota: number | null }>({ usage: 0, quota: null });
  const [syncing, setSyncing] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [exported, setExported] = useState(false);
  const { data: library } = useLibrary(undefined, !!token);

  useEffect(() => {
    setOnline(navigator.onLine);
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);

  // Refresh storage estimate when downloads change.
  useEffect(() => {
    void getStorageEstimate().then(setStorage);
  }, [downloads]);

  const completed = downloads.filter((d) => d.status === 'complete');
  const active = downloads.filter((d) => d.status === 'queued' || d.status === 'downloading');
  const errored = downloads.filter((d) => d.status === 'error');
  const totalBytes = completed.reduce((sum, d) => sum + d.bytes, 0);
  const seriesCount = new Set(completed.map((d) => d.seriesSlug)).size;

  // Group completed + errored by series (active downloads live in the queue).
  const bySeries = useMemo(() => {
    const map = new Map<string, DownloadRecord[]>();
    for (const d of [...completed, ...errored]) {
      const list = map.get(d.seriesSlug) ?? [];
      list.push(d);
      map.set(d.seriesSlug, list);
    }
    return [...map.entries()].sort((a, b) => {
      const lastA = Math.max(...a[1].map((r) => r.updatedAt));
      const lastB = Math.max(...b[1].map((r) => r.updatedAt));
      return lastB - lastA;
    });
  }, [completed, errored]);

  const shelf = (library?.items ?? []).filter((b) => b.listName === 'Reading').slice(0, 8);

  // ─── Batch sync: enqueue the latest chapter of each shelf title ──
  const syncShelf = async () => {
    if (syncing || shelf.length === 0) return;
    setSyncing(true);
    try {
      const latestById = new Map<string, { id: string; number: number; title: string | null }>();
      await Promise.all(
        shelf.map(async (item) => {
          try {
            const d = await api.get<{ items: { id: string; number: number; title: string | null }[] }>(`/chapters?titleId=${item.titleId}&limit=1`);
            if (d.items[0]) latestById.set(item.titleId, d.items[0]);
          } catch {
            // skip titles with no chapters / errors
          }
        }),
      );
      shelf.forEach((item) => {
        const ch = latestById.get(item.titleId);
        if (!ch) return;
        if (downloads.some((d) => d.chapterId === ch.id)) return;
        enqueueDownload({
          chapterId: ch.id,
          titleId: item.titleId,
          seriesSlug: item.title.slug,
          seriesTitle: item.title.title,
          coverUrl: item.title.coverUrl,
          chapterNumber: ch.number,
          chapterTitle: ch.title,
        });
      });
    } finally {
      setSyncing(false);
    }
  };

  // ─── Auto-download pass: once per mount when enabled + signed in ──
  const autoRanRef = useRef(false);
  useEffect(() => {
    if (autoRanRef.current) return;
    if (!loadDownloadPrefs().autoDownload || !token) return;
    autoRanRef.current = true;
    void syncShelf();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, library]);

  const togglePref = (patch: Partial<DownloadPrefs>) => {
    saveDownloadPrefs({ ...loadDownloadPrefs(), ...patch });
  };

  const exportList = () => {
    const payload = downloads.map(({ chapterId, titleId, seriesSlug, seriesTitle, chapterNumber, chapterTitle, totalPages, bytes, status, addedAt, updatedAt }) => ({
      chapterId,
      titleId,
      seriesSlug,
      seriesTitle,
      chapterNumber,
      chapterTitle,
      totalPages,
      bytes,
      status,
      addedAt: new Date(addedAt).toISOString(),
      updatedAt: new Date(updatedAt).toISOString(),
    }));
    const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), items: payload }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mangaverse-downloads-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    setExported(true);
    setTimeout(() => setExported(false), 2500);
  };

  const wifiOnly = prefs.wifiOnly;
  const onWifi = isOnWifi();

  return (
    <AppShell>
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 md:px-8 md:py-8">
        {/* ─── Header ───────────────────────────────── */}
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="eyebrow mb-2">Offline Library</p>
            <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl md:text-4xl">
              <span className="text-gradient">Downloads</span>
            </h1>
            <p className="mt-1.5 text-xs text-mv-text-muted">
              Chapters cached on this device — read anywhere, even without a connection.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={cn(
                'flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-medium',
                online ? 'border-mv-success/30 bg-mv-success/10 text-mv-success' : 'border-mv-warning/30 bg-mv-warning/10 text-mv-warning',
              )}
            >
              <span className={cn('h-1.5 w-1.5 rounded-full', online ? 'bg-mv-success animate-pulse' : 'bg-mv-warning animate-pulse-dot')} />
              {online ? 'Online' : 'Offline — reading from cache'}
            </span>
            <span className="rounded-full border border-mv-border-light bg-mv-surface/60 px-3 py-1 text-[11px] text-mv-text-secondary">
              Synced {timeAgo(prefs.lastSynced)}
            </span>
          </div>
        </header>

        {/* ─── Stat tiles ───────────────────────────── */}
        <div className="mt-7 grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatTile label="Chapters Downloaded" value={completed.length} hint="ready offline" icon="download" />
          <StatTile label="Series Offline" value={seriesCount} accent="text-mv-violet" hint="complete series" icon="library" />
          <StatTile label="Storage Used" value={formatBytes(totalBytes)} accent="text-mv-gold" hint={`of ${storage.quota ? formatBytes(storage.quota) : 'browser quota'}`} icon="database" />
          <StatTile label="Last Sync" value={timeAgo(prefs.lastSynced)} accent="text-mv-orange" hint="background pass" icon="clock" />
        </div>

        {/* ─── Active queue ─────────────────────────── */}
        {active.length > 0 && (
          <section aria-label="Download queue" className="mt-8">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-white">
              <Icon name="download" size={15} className="text-mv-violet" />
              Downloading
              <span className="rounded-full bg-mv-violet/15 px-2 py-0.5 text-[9px] font-semibold text-mv-violet">{active.length}</span>
            </h2>
            <div className="space-y-2.5">
              {active.map((d) => (
                <div key={d.chapterId} className="rounded-2xl border border-mv-border bg-mv-darker p-3.5">
                  <div className="flex items-center gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-mv-purple/25 to-mv-accent/15">
                      <Icon name="download" size={15} className="text-mv-violet" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-medium text-mv-text">
                        {d.seriesTitle} · Ch. {d.chapterNumber}
                      </p>
                      <p className="mt-0.5 text-[9px] text-mv-text-dim">
                        {d.status === 'queued' ? 'Queued…' : `${d.donePages}/${d.totalPages || '…'} pages · ${formatBytes(d.bytes)}`}
                      </p>
                    </div>
                    <button
                      onClick={() => cancelDownload(d.chapterId)}
                      aria-label={`Cancel download of chapter ${d.chapterNumber}`}
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-mv-text-dim transition-colors hover:bg-mv-danger/10 hover:text-mv-danger"
                    >
                      <Icon name="close" size={13} />
                    </button>
                  </div>
                  <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-mv-surface">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-mv-purple to-mv-accent transition-all duration-300"
                      style={{ width: `${d.totalPages ? Math.max(4, (d.donePages / d.totalPages) * 100) : 4}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ─── Downloaded by series ─────────────────── */}
        {bySeries.length > 0 && (
          <section aria-label="Downloaded chapters" className="mt-8">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-white">
                <Icon name="library" size={15} className="text-mv-violet" />
                Saved for Offline
              </h2>
              <span className="text-[10px] text-mv-text-dim">{completed.length} chapter{completed.length === 1 ? '' : 's'} · {formatBytes(totalBytes)}</span>
            </div>
            <div className="space-y-4">
              {bySeries.map(([slug, rows]) => {
                const cover = rows[0]?.coverUrl;
                const seriesTitle = rows[0]?.seriesTitle;
                const seriesBytes = rows.reduce((s, r) => s + r.bytes, 0);
                return (
                  <div key={slug} className="overflow-hidden rounded-2xl border border-mv-border bg-mv-darker">
                    <div className="flex items-center gap-3 border-b border-mv-border/60 bg-mv-surface/40 px-4 py-3">
                      <span className="h-10 w-7 shrink-0 overflow-hidden rounded-md bg-mv-surface">
                        {cover ? <CoverImage src={cover} title={seriesTitle} type="MANGA" className="h-full w-full" /> : <span className="flex h-full w-full items-center justify-center text-[9px] text-mv-text-dim">{rows.length}</span>}
                      </span>
                      <Link href={`/title/${slug}`} className="min-w-0 flex-1 truncate text-xs font-semibold text-mv-text transition-colors hover:text-mv-violet">
                        {seriesTitle}
                      </Link>
                      <span className="hidden text-[9px] text-mv-text-dim sm:block">
                        {rows.length} chapter{rows.length === 1 ? '' : 's'} · {formatBytes(seriesBytes)}
                      </span>
                      <button
                        onClick={() => void removeSeriesDownloads(slug)}
                        aria-label={`Remove all downloads for ${seriesTitle}`}
                        className="flex items-center gap-1 rounded-lg px-2 py-1 text-[9px] font-medium text-mv-text-dim transition-colors hover:bg-mv-danger/10 hover:text-mv-danger"
                      >
                        <Icon name="trash" size={11} /> Remove
                      </button>
                    </div>
                    <div className="divide-y divide-mv-border/60">
                      {rows.map((r) => (
                        <div key={r.chapterId} className="group/row flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-mv-surface/50">
                          <span className={cn('flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[9px]', r.status === 'complete' ? 'bg-mv-success/15 text-mv-success' : 'bg-mv-danger/15 text-mv-danger')}>
                            <Icon name={r.status === 'complete' ? 'check' : 'alert'} size={11} />
                          </span>
                          <Link href={`/reader/${r.chapterId}`} className="min-w-0 flex-1">
                            <span className="block truncate text-[11px] text-mv-text-secondary transition-colors group-hover/row:text-mv-violet">
                              Chapter {r.chapterNumber}
                              {r.chapterTitle ? ` — ${r.chapterTitle}` : ''}
                            </span>
                            <span className="text-[9px] text-mv-text-dim">
                              {r.status === 'complete' ? `${r.donePages} pages · ${formatBytes(r.bytes)}` : r.error ?? 'Incomplete'}
                            </span>
                          </Link>
                          <button
                            onClick={() => void removeDownload(r.chapterId)}
                            aria-label={`Remove offline copy of chapter ${r.chapterNumber}`}
                            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-mv-text-dim opacity-0 transition-all hover:bg-mv-danger/10 hover:text-mv-danger focus-visible:opacity-100 group-hover/row:opacity-100"
                          >
                            <Icon name="trash" size={12} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* ─── Empty state ──────────────────────────── */}
        {!active.length && bySeries.length === 0 && (
          <EmptyState
            icon="download"
            title="Nothing downloaded yet"
            body="Tap the download button in any chapter to save it for offline reading — or pull your shelf's latest chapters below."
            action={
              <Link href="/browse" className="btn-primary px-5 py-2.5 text-xs">
                <Icon name="search" size={13} className="mr-1.5 inline" /> Discover Titles
              </Link>
            }
          />
        )}

        {/* ─── Shelf sync (signed in) ───────────────── */}
        {token && shelf.length > 0 && (
          <section aria-label="Download from your shelf" className="mt-8">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-white">
                <Icon name="sparkles" size={15} className="text-mv-violet" />
                Download from your shelf
              </h2>
              <button
                onClick={() => void syncShelf()}
                disabled={syncing || active.length > 0}
                className="flex items-center gap-1.5 rounded-full bg-gradient-to-r from-mv-purple to-mv-accent px-3.5 py-1.5 text-[10px] font-semibold text-white transition-all hover:brightness-110 disabled:opacity-40"
              >
                <Icon name="download" size={12} />
                {syncing ? 'Syncing…' : 'Get latest of all'}
              </button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {shelf.map((item) => (
                <ShelfTitleCard key={item.titleId} item={item} />
              ))}
            </div>
            {shelf.length < (library?.items ?? []).filter((b) => b.listName === 'Reading').length && (
              <p className="mt-2 text-[9px] text-mv-text-dim">Showing the first {shelf.length} Reading-shelf titles.</p>
            )}
          </section>
        )}

        {/* ─── Rules + manage ───────────────────────── */}
        <div className="mt-8 grid gap-5 lg:grid-cols-2">
          {/* Auto-download rules */}
          <section aria-label="Download rules" className="rounded-2xl border border-mv-border bg-mv-darker p-5">
            <h2 className="mb-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-mv-text-muted">
              <Icon name="zap" size={13} /> Auto-download rules
            </h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-medium text-mv-text">Auto-download new chapters</p>
                  <p className="mt-0.5 text-[10px] text-mv-text-muted">
                    {token ? 'Grab the latest chapter of your Reading-shelf titles automatically.' : 'Sign in to sync from your Reading shelf.'}
                  </p>
                </div>
                <label className="relative inline-flex cursor-pointer items-center">
                  <input type="checkbox" checked={prefs.autoDownload} disabled={!token} onChange={(e) => togglePref({ autoDownload: e.target.checked })} className="peer sr-only" />
                  <div className="h-5 w-9 rounded-full bg-mv-border-light after:absolute after:left-[2px] after:top-[2px] after:h-4 after:w-4 after:rounded-full after:bg-mv-text-muted after:transition-all peer-checked:bg-mv-accent/60 peer-checked:after:translate-x-full peer-checked:after:bg-mv-accent" />
                </label>
              </div>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-medium text-mv-text">Wi-Fi only</p>
                  <p className="mt-0.5 text-[10px] text-mv-text-muted">
                    {wifiOnly ? 'Downloads pause off Wi-Fi.' : 'Downloads run on any connection.'}{' '}
                    <span className={cn('inline-flex items-center gap-1 font-medium', onWifi ? 'text-mv-success' : 'text-mv-warning')}>
                      <Icon name="wifi" size={11} /> {onWifi ? 'On Wi-Fi now' : 'Not on Wi-Fi'}
                    </span>
                  </p>
                </div>
                <label className="relative inline-flex cursor-pointer items-center">
                  <input type="checkbox" checked={wifiOnly} onChange={(e) => togglePref({ wifiOnly: e.target.checked })} className="peer sr-only" />
                  <div className="h-5 w-9 rounded-full bg-mv-border-light after:absolute after:left-[2px] after:top-[2px] after:h-4 after:w-4 after:rounded-full after:bg-mv-text-muted after:transition-all peer-checked:bg-mv-accent/60 peer-checked:after:translate-x-full peer-checked:after:bg-mv-accent" />
                </label>
              </div>
              <p className="text-[9px] text-mv-text-dim">
                Downloads live in your browser's storage ({formatBytes(storage.usage)} in use) and sync per-device. Reading progress still syncs across devices through your account.
              </p>
            </div>
          </section>

          {/* Manage storage */}
          <section aria-label="Manage storage" className="rounded-2xl border border-mv-border bg-mv-darker p-5">
            <h2 className="mb-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-mv-text-muted">
              <Icon name="database" size={13} /> Manage storage
            </h2>
            {storage.quota ? (
              <>
                <div className="mb-1.5 flex items-baseline justify-between text-[10px]">
                  <span className="text-mv-text-secondary">{formatBytes(storage.usage)} used</span>
                  <span className="text-mv-text-dim">of {formatBytes(storage.quota)}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-mv-surface">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-mv-purple to-mv-accent transition-all duration-500"
                    style={{ width: `${Math.min(100, (storage.usage / storage.quota) * 100)}%` }}
                  />
                </div>
              </>
            ) : (
              <p className="mb-3 text-[10px] text-mv-text-dim">Storage estimate unavailable in this browser.</p>
            )}
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <button
                onClick={exportList}
                className="flex items-center gap-1.5 rounded-lg border border-mv-border-light bg-mv-surface/60 px-3.5 py-2 text-[10px] font-medium text-mv-text-secondary transition-colors hover:border-mv-violet/40 hover:text-mv-violet"
              >
                <Icon name="download" size={12} /> {exported ? 'Exported ✓' : 'Export list (JSON)'}
              </button>
              <button
                onClick={() => setConfirmClear(true)}
                disabled={downloads.length === 0}
                className="flex items-center gap-1.5 rounded-lg border border-mv-danger/30 bg-mv-danger/10 px-3.5 py-2 text-[10px] font-medium text-mv-danger transition-colors hover:bg-mv-danger hover:text-white disabled:opacity-40"
              >
                <Icon name="trash" size={12} /> Remove everything
              </button>
            </div>
            {!token && (
              <p className="mt-4 rounded-xl border border-mv-border-light bg-mv-surface/40 px-3.5 py-2.5 text-[10px] text-mv-text-dim">
                Downloads are device-local. <Link href="/login" className="text-mv-violet hover:underline">Sign in</Link> to sync reading progress and auto-download from your shelf.
              </p>
            )}
          </section>
        </div>

        {/* ─── Get the mobile app (preserved) ───────── */}
        <section className="mt-8 overflow-hidden rounded-3xl border border-mv-border bg-gradient-to-br from-mv-darker via-mv-darker to-mv-purple/10 p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-mv-purple to-mv-accent">
                <Icon name="library" size={22} className="text-white" />
              </span>
              <div>
                <p className="text-sm font-semibold text-white">Take it further with the MangaVerse mobile app</p>
                <p className="mt-0.5 text-[10px] text-mv-text-muted">Offline downloads, native push notifications, and background downloads — Android APK available.</p>
              </div>
            </div>
            <a href="/api/download/mangaverse-v0.1.0.apk" className="btn-primary flex items-center gap-2 px-5 py-2.5 text-xs">
              <Icon name="download" size={14} /> Get the APK
            </a>
          </div>
        </section>
      </div>

      {/* ─── Clear-all confirm ──────────────────────── */}
      {confirmClear && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="alertdialog" aria-modal="true" aria-labelledby="clear-dl-title">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
          <div className="relative w-full max-w-sm rounded-3xl border border-mv-danger/30 bg-mv-darker p-7 shadow-modal animate-scale-in">
            <h2 id="clear-dl-title" className="text-base font-bold text-white">Remove all downloads?</h2>
            <p className="mt-2 text-xs leading-relaxed text-mv-text-muted">
              This deletes {downloads.length} downloaded chapter{downloads.length === 1 ? '' : 's'} ({formatBytes(totalBytes)}) from this device. You can always re-download them.
            </p>
            <div className="mt-6 flex items-center justify-end gap-2">
              <button onClick={() => setConfirmClear(false)} className="btn-ghost px-4 py-2.5 text-xs">Cancel</button>
              <button
                onClick={() => {
                  void clearAllDownloads();
                  setConfirmClear(false);
                }}
                className="rounded-xl bg-mv-danger px-5 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-red-600"
              >
                Remove everything
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
