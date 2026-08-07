'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { AppShell } from '@/components/AppShell';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { Icon } from '@/components/ui/Icon';
import { EmptyState } from '@/components/ui/EmptyState';
import { CoverImage } from '@/components/CoverImage';
import { useBookmarks, useUpdateBookmark, useDeleteBookmark, type PageBookmarkItem } from '@/lib/hooks/useBookmarks';
import { useAuthStore } from '@/store/authStore';
import { cn } from '@/lib/cn';

/* ═══════════════════════════════════════════════════════════════
   Bookmarks — the reading journal (Phase 7 completion).
   Server-synced page marks: a quote, a scene, a note, a panel.
   • Folder chips + tag filter + instant search
   • Edit note / folder / tags inline in a dialog
   • Export as JSON · jump back to the exact page in the reader
   • Premium empty state that points to the reader's "B" key
   ═══════════════════════════════════════════════════════════════ */

interface EditTarget {
  item: PageBookmarkItem;
  note: string;
  folder: string;
  tags: string;
}

export default function BookmarksPage() {
  const { token } = useAuthStore();
  const [folder, setFolder] = useState<string | null>(null);
  const [tag, setTag] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<EditTarget | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [exported, setExported] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);

  const { data, isLoading } = useBookmarks(
    { folder: folder ?? undefined, tag: tag ?? undefined, search: query.trim() || undefined, page, limit: 24 },
    !!token,
  );
  const updateBookmark = useUpdateBookmark();
  const deleteBookmark = useDeleteBookmark();

  const items = data?.items ?? [];
  const folders = useMemo(() => [{ name: 'All', count: data?.total ?? 0 }, ...(data?.folders ?? [])], [data]);
  const totalPages = data ? Math.ceil(data.total / data.limit) : 0;

  // Close edit dialog on Escape / outside click
  useEffect(() => {
    if (!editing) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setEditing(null);
    const onDown = (e: MouseEvent | TouchEvent) => {
      if (!dialogRef.current?.contains(e.target as Node)) setEditing(null);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('touchstart', onDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('touchstart', onDown);
    };
  }, [editing]);

  const saveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    const { item, note, folder: f, tags } = editing;
    try {
      await updateBookmark.mutateAsync({
        id: item.id,
        note: note.trim() || null,
        folder: f.trim() || null,
        tags: tags.split(',').map((t) => t.trim()).filter(Boolean).slice(0, 20),
      });
      setEditing(null);
    } catch {
      // surfaced by hooks
    }
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await deleteBookmark.mutateAsync(id);
    } catch {
      // surfaced by hooks
    }
    setDeletingId(null);
  };

  const exportBookmarks = () => {
    const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), items }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mangaverse-bookmarks-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    setExported(true);
    setTimeout(() => setExported(false), 2500);
  };

  return (
    <ProtectedRoute>
      <AppShell>
        <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 md:px-8 md:py-8">
          {/* ─── Header ──────────────────────────────── */}
          <header className="mb-7 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="eyebrow mb-2">Reading Journal</p>
              <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl md:text-4xl">
                <span className="text-gradient">Bookmarks</span>
              </h1>
              <p className="mt-1.5 text-xs text-mv-text-muted">
                Every page you marked — quotes, scenes, and notes, synced across devices.
              </p>
            </div>
            <div className="flex items-center gap-2">
              {data && (
                <span className="rounded-full border border-mv-border-light bg-mv-surface/60 px-3 py-1 text-[11px] text-mv-text-secondary">
                  {data.total} bookmark{data.total === 1 ? '' : 's'}
                </span>
              )}
              <button
                onClick={exportBookmarks}
                disabled={items.length === 0}
                className="flex items-center gap-1.5 rounded-full border border-mv-border-light bg-mv-surface/60 px-3.5 py-1.5 text-[11px] font-medium text-mv-text-secondary transition-colors hover:border-mv-violet/40 hover:text-mv-violet disabled:opacity-40"
              >
                <Icon name="download" size={12} />
                {exported ? 'Exported ✓' : 'Export'}
              </button>
            </div>
          </header>

          {/* ─── Filters ─────────────────────────────── */}
          <div className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="scrollbar-none -mx-4 flex gap-1.5 overflow-x-auto px-4 sm:mx-0 sm:px-0" role="group" aria-label="Bookmark folders">
              {folders.map((f) => {
                const active = folder === f.name || (folder === null && f.name === 'All');
                return (
                  <button
                    key={f.name}
                    aria-pressed={active}
                    onClick={() => {
                      setFolder(f.name === 'All' ? null : f.name);
                      setPage(1);
                    }}
                    className={cn(
                      'flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[11px] font-medium transition-all duration-200',
                      active
                        ? 'bg-gradient-to-r from-mv-purple to-mv-accent text-white shadow-glow-sm'
                        : 'border border-mv-border-light bg-mv-surface/60 text-mv-text-secondary hover:border-mv-violet/40 hover:text-mv-text',
                    )}
                  >
                    {f.name === 'All' ? <Icon name="bookmark" size={12} /> : <Icon name="tag" size={11} />}
                    {f.name}
                    <span className={cn('rounded-full px-1.5 py-0.5 text-[9px] font-semibold', active ? 'bg-white/20 text-white' : 'bg-white/5 text-mv-text-dim')}>
                      {f.count}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-2">
              <div className="relative flex-1 lg:w-56 lg:flex-none">
                <Icon name="search" size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-mv-text-dim" />
                <input
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setPage(1);
                  }}
                  placeholder="Search notes, quotes, tags…"
                  aria-label="Search bookmarks"
                  className="field py-2 pl-9 pr-3 text-xs"
                />
              </div>
              {tag && (
                <button
                  onClick={() => setTag(null)}
                  className="flex shrink-0 items-center gap-1 rounded-full border border-mv-violet/40 bg-mv-violet/15 px-3 py-1.5 text-[10px] font-medium text-mv-violet transition-colors hover:bg-mv-violet/25"
                >
                  #{tag} <Icon name="close" size={10} />
                </button>
              )}
            </div>
          </div>

          {/* ─── Tag chips ───────────────────────────── */}
          {data && data.tags.length > 0 && folder === null && (
            <div className="mb-5 flex flex-wrap items-center gap-1.5">
              <span className="text-[9px] font-semibold uppercase tracking-wider text-mv-text-dim">Tags</span>
              {data.tags.slice(0, 12).map((t) => (
                <button
                  key={t.name}
                  onClick={() => {
                    setTag(tag === t.name ? null : t.name);
                    setPage(1);
                  }}
                  aria-pressed={tag === t.name}
                  className={cn(
                    'rounded-full border px-2.5 py-1 text-[9px] font-medium transition-all',
                    tag === t.name ? 'border-mv-violet/50 bg-mv-violet/20 text-mv-violet' : 'border-mv-border-light bg-mv-surface/60 text-mv-text-dim hover:border-mv-violet/40 hover:text-mv-text',
                  )}
                >
                  #{t.name} · {t.count}
                </button>
              ))}
            </div>
          )}

          {/* ─── Loading ─────────────────────────────── */}
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4 rounded-2xl bg-mv-darker p-4">
                  <div className="skeleton h-16 w-11 rounded-lg" />
                  <div className="flex-1 space-y-2">
                    <div className="skeleton h-3 w-40 rounded" />
                    <div className="skeleton h-2 w-64 rounded" />
                  </div>
                </div>
              ))}
            </div>
          ) : !data || items.length === 0 ? (
            <EmptyState
              icon="bookmark"
              title={query.trim() || folder || tag ? 'No bookmarks match those filters' : 'No bookmarks yet'}
              body={
                query.trim() || folder || tag
                  ? 'Try a different search or clear the filters.'
                  : 'Press B in any chapter to mark the page you\u2019re on — quotes, scenes, and notes will collect here.'
              }
              action={
                query.trim() || folder || tag ? (
                  <button
                    onClick={() => {
                      setQuery('');
                      setFolder(null);
                      setTag(null);
                    }}
                    className="btn-ghost px-5 py-2.5 text-xs"
                  >
                    Clear filters
                  </button>
                ) : (
                  <Link href="/browse" className="btn-primary px-5 py-2.5 text-xs">
                    <Icon name="search" size={13} className="mr-1.5 inline" /> Find something to read
                  </Link>
                )
              }
            />
          ) : (
            <>
              {/* ─── List ─────────────────────────────── */}
              <ul className="space-y-3">
                {items.map((b) => (
                  <li
                    key={b.id}
                    className={cn(
                      'group relative flex items-start gap-4 rounded-2xl border border-mv-border bg-mv-darker p-4 transition-all duration-300 hover:border-mv-violet/40 hover:shadow-card-hover',
                      deletingId === b.id && 'opacity-40',
                    )}
                  >
                    <Link href={`/title/${b.title.slug}`} className="block h-[4.5rem] w-11 shrink-0 overflow-hidden rounded-lg bg-mv-surface">
                      <CoverImage src={b.title.coverUrl} title={b.title.title} type={b.title.type} className="h-full w-full" />
                    </Link>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                        <Link href={`/title/${b.title.slug}`} className="truncate text-xs font-semibold text-mv-text transition-colors hover:text-mv-violet">
                          {b.title.title}
                        </Link>
                        <span className="text-[9px] text-mv-text-dim">
                          · Ch. {b.chapter.number}
                          {b.pageNumber > 0 ? ` · p.${b.pageNumber + 1}` : ''}
                        </span>
                      </div>
                      {b.quote && (
                        <blockquote className="mt-2 border-l-2 border-mv-gold/50 pl-3 text-[11px] italic leading-relaxed text-mv-text-secondary">
                          “{b.quote.length > 160 ? `${b.quote.slice(0, 160)}…` : b.quote}”
                        </blockquote>
                      )}
                      {b.note && <p className="mt-2 text-[11px] leading-relaxed text-mv-text-secondary">{b.note}</p>}
                      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                        {b.folder && (
                          <span className="flex items-center gap-1 rounded-full bg-mv-violet/15 px-2 py-0.5 text-[9px] font-medium text-mv-violet">
                            <Icon name="tag" size={9} /> {b.folder}
                          </span>
                        )}
                        {b.tags.slice(0, 5).map((t) => (
                          <button
                            key={t}
                            onClick={() => {
                              setTag(t);
                              setPage(1);
                            }}
                            className="rounded-full bg-white/5 px-2 py-0.5 text-[9px] text-mv-text-dim transition-colors hover:bg-mv-violet/15 hover:text-mv-violet"
                          >
                            #{t}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1.5">
                      <Link
                        href={`/reader/${b.chapterId}`}
                        aria-label={`Read chapter ${b.chapter.number} of ${b.title.title}`}
                        title="Jump to this chapter"
                        className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-r from-mv-accent to-mv-purple text-white transition-all hover:brightness-110"
                      >
                        <Icon name="play" size={13} />
                      </Link>
                      <div className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                        <button
                          onClick={() => setEditing({ item: b, note: b.note ?? '', folder: b.folder ?? '', tags: b.tags.join(', ') })}
                          aria-label={`Edit bookmark for ${b.title.title}`}
                          className="flex h-7 w-7 items-center justify-center rounded-lg text-mv-text-dim transition-colors hover:bg-white/5 hover:text-white"
                        >
                          <Icon name="edit" size={12} />
                        </button>
                        <button
                          onClick={() => void handleDelete(b.id)}
                          disabled={deletingId === b.id}
                          aria-label={`Delete bookmark for ${b.title.title}`}
                          className="flex h-7 w-7 items-center justify-center rounded-lg text-mv-text-dim transition-colors hover:bg-mv-danger/10 hover:text-mv-danger disabled:opacity-40"
                        >
                          <Icon name="trash" size={12} />
                        </button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>

              {/* ─── Pagination ───────────────────────── */}
              {totalPages > 1 && (
                <div className="mt-6 flex items-center justify-center gap-3">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="flex items-center gap-1 rounded-lg border border-mv-border-light bg-mv-surface px-3.5 py-2 text-[10px] text-mv-text-secondary transition-colors hover:text-mv-text disabled:opacity-30"
                  >
                    <Icon name="chevronLeft" size={12} /> Prev
                  </button>
                  <span className="text-[10px] text-mv-text-muted">Page {page} of {totalPages}</span>
                  <button
                    onClick={() => setPage((p) => p + 1)}
                    disabled={!data?.hasMore}
                    className="flex items-center gap-1 rounded-lg border border-mv-border-light bg-mv-surface px-3.5 py-2 text-[10px] text-mv-text-secondary transition-colors hover:text-mv-text disabled:opacity-30"
                  >
                    Next <Icon name="chevronRight" size={12} />
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {/* ─── Edit dialog ───────────────────────────── */}
        {editing && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="bmk-dialog-title">
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
            <div ref={dialogRef} className="relative max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto rounded-3xl border border-mv-violet/25 bg-mv-darker p-7 shadow-modal animate-scale-in">
              <div className="mb-5 flex items-start justify-between">
                <div>
                  <p className="eyebrow mb-1">Bookmark</p>
                  <h2 id="bmk-dialog-title" className="text-lg font-bold text-white">
                    {editing.item.title.title} · Ch. {editing.item.chapter.number}
                  </h2>
                </div>
                <button onClick={() => setEditing(null)} aria-label="Close dialog" className="rounded-lg p-1.5 text-mv-text-dim transition-colors hover:bg-white/5 hover:text-white">
                  <Icon name="close" size={16} />
                </button>
              </div>

              <form onSubmit={saveEdit} className="space-y-4">
                <div>
                  <label htmlFor="bmk-note" className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-mv-text-muted">Note</label>
                  <textarea
                    id="bmk-note"
                    value={editing.note}
                    onChange={(e) => setEditing({ ...editing, note: e.target.value })}
                    maxLength={5000}
                    rows={3}
                    autoFocus
                    placeholder="Why did you mark this page?"
                    className="field w-full resize-none"
                  />
                </div>
                <div>
                  <label htmlFor="bmk-folder" className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-mv-text-muted">Folder</label>
                  <input
                    id="bmk-folder"
                    value={editing.folder}
                    onChange={(e) => setEditing({ ...editing, folder: e.target.value })}
                    maxLength={60}
                    list="bmk-folders"
                    placeholder="e.g. Weekend Reads, Peak Fiction…"
                    className="field w-full"
                  />
                  <datalist id="bmk-folders">
                    {(data?.folders ?? []).map((f) => (
                      <option key={f.name} value={f.name} />
                    ))}
                  </datalist>
                </div>
                <div>
                  <label htmlFor="bmk-tags" className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-mv-text-muted">Tags</label>
                  <input
                    id="bmk-tags"
                    value={editing.tags}
                    onChange={(e) => setEditing({ ...editing, tags: e.target.value })}
                    placeholder="comma, separated, tags"
                    className="field w-full"
                  />
                </div>
                <div className="flex items-center justify-end gap-2 pt-2">
                  <button type="button" onClick={() => setEditing(null)} className="btn-ghost px-4 py-2.5 text-xs">Cancel</button>
                  <button type="submit" disabled={updateBookmark.isPending} className="btn-primary px-5 py-2.5 text-xs disabled:opacity-50">
                    {updateBookmark.isPending ? 'Saving…' : 'Save bookmark'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </AppShell>
    </ProtectedRoute>
  );
}
