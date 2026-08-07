'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { AppShell } from '@/components/AppShell';
import { Icon } from '@/components/ui/Icon';
import { CoverImage } from '@/components/CoverImage';
import { useAuthStore } from '@/store/authStore';
import {
  useList,
  useUpdateList,
  useDeleteList,
  useAddListItem,
  useRemoveListItem,
  useToggleListLike,
  type ListTitle,
} from '@/lib/hooks/useLists';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';

/* ═══════════════════════════════════════════════════════════════
   List detail — one curated public list (Phase 8).
   • Cover header, description, tags, like + share
   • Items as a premium cover grid with optional notes
   • Owner tools: add titles via instant search, remove, edit, delete
   ═══════════════════════════════════════════════════════════════ */

function timeAgoEpoch(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86400000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

interface SearchHit {
  id: string;
  slug: string;
  title: string;
  type: string;
  coverUrl: string | null;
}

export default function ListDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { token, user } = useAuthStore();
  const { data: list, isLoading, error } = useList(id, true);
  const updateList = useUpdateList();
  const deleteList = useDeleteList();
  const addItem = useAddListItem();
  const removeItem = useRemoveListItem();
  const toggleLike = useToggleListLike();

  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editTags, setEditTags] = useState('');
  const [adding, setAdding] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);

  // Debounced title search for the "add titles" flow
  useEffect(() => {
    const q = searchQuery.trim();
    if (q.length < 2) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    const t = setTimeout(async () => {
      try {
        const data = await api.get<{ items: SearchHit[] }>(`/titles?search=${encodeURIComponent(q)}&limit=6`);
        setSearchResults(data.items ?? []);
      } catch {
        setSearchResults([]);
      }
      setSearching(false);
    }, 350);
    return () => clearTimeout(t);
  }, [searchQuery]);

  useEffect(() => {
    if (!editing || !list) return;
    setEditName(list.name);
    setEditDesc(list.description ?? '');
    setEditTags(list.tags.join(', '));
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setEditing(false);
    const onDown = (e: MouseEvent | TouchEvent) => {
      if (!dialogRef.current?.contains(e.target as Node)) setEditing(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('touchstart', onDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('touchstart', onDown);
    };
  }, [editing, list]);

  const alreadyInList = useMemo(() => new Set(list?.items.map((i) => i.title.id) ?? []), [list]);

  const saveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!list || editName.trim().length < 3) return;
    try {
      await updateList.mutateAsync({
        id: list.id,
        name: editName.trim(),
        description: editDesc.trim() || null,
        tags: editTags.split(',').map((t) => t.trim()).filter(Boolean).slice(0, 15),
      });
      setEditing(false);
    } catch {
      // surfaced
    }
  };

  const handleAdd = async (title: SearchHit) => {
    if (!list) return;
    try {
      await addItem.mutateAsync({ listId: list.id, titleId: title.id });
      setSearchQuery('');
      setSearchResults([]);
    } catch {
      // surfaced (duplicate → 409)
    }
  };

  const handleRemove = async (titleId: string) => {
    if (!list) return;
    setRemovingId(titleId);
    try {
      await removeItem.mutateAsync({ listId: list.id, titleId });
    } catch {
      // surfaced
    }
    setRemovingId(null);
  };

  const share = async () => {
    const url = window.location.href;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard unavailable
    }
  };

  if (isLoading) {
    return (
      <AppShell>
        <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 md:px-8 md:py-8">
          <div className="skeleton h-44 rounded-3xl" />
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="skeleton aspect-[3/4] rounded-xl" />
            ))}
          </div>
        </div>
      </AppShell>
    );
  }

  if (error || !list) {
    return (
      <AppShell>
        <div className="mx-auto max-w-3xl px-6 py-20 text-center">
          <p className="text-sm text-mv-text-muted mb-2">List not found or it's private</p>
          <Link href="/lists" className="text-xs text-mv-violet hover:underline">← Back to Lists</Link>
        </div>
      </AppShell>
    );
  }

  const own = !!user && list.user.id === user.id;
  const cover = list.items.find((i) => i.title.coverUrl)?.title.coverUrl ?? null;

  return (
    <AppShell>
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 md:px-8 md:py-8">
        <Link href="/lists" className="mb-4 inline-flex items-center gap-1 text-[10px] text-mv-text-muted transition-colors hover:text-mv-text">
          ← All lists
        </Link>

        {/* ─── Header ───────────────────────────────── */}
        <header className="relative overflow-hidden rounded-3xl border border-mv-border bg-mv-darker p-6 md:p-8">
          <div className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-mv-purple/15 blur-3xl" aria-hidden="true" />
          <div className="pointer-events-none absolute -bottom-24 left-1/3 h-48 w-48 rounded-full bg-mv-accent/10 blur-3xl" aria-hidden="true" />
          {cover && (
            <div className="pointer-events-none absolute inset-0 opacity-15">
              <CoverImage src={cover} title={list.name} type="MANGA" className="h-full w-full object-cover" />
            </div>
          )}
          <div className="relative">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="eyebrow mb-2">Community List</p>
                <h1 className="text-2xl font-bold tracking-tight text-white md:text-3xl">{list.name}</h1>
                {list.description && <p className="mt-2 max-w-2xl text-xs leading-relaxed text-mv-text-secondary">{list.description}</p>}
                {list.tags.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {list.tags.map((t) => (
                      <span key={t} className="rounded-full bg-white/5 px-2.5 py-0.5 text-[9px] text-mv-text-dim">#{t}</span>
                    ))}
                  </div>
                )}
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <Link href={`/user/${list.user.id}`} className="flex items-center gap-2">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-mv-purple to-mv-accent text-[9px] font-bold text-white">
                      {list.user.displayName.charAt(0).toUpperCase()}
                    </span>
                    <span className="text-[11px] font-medium text-mv-text-secondary transition-colors hover:text-mv-violet">
                      {own ? 'You' : list.user.displayName}
                    </span>
                  </Link>
                  <span className="text-[9px] text-mv-text-dim">· {timeAgoEpoch(list.createdAt)}</span>
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                {!own && token && (
                  <button
                    onClick={() => toggleLike.mutate(list.id)}
                    aria-pressed={list.liked}
                    className={cn(
                      'flex items-center gap-1.5 rounded-full border px-4 py-2 text-[11px] font-semibold transition-all',
                      list.liked
                        ? 'border-mv-gold/50 bg-mv-gold/15 text-mv-gold'
                        : 'border-mv-border-light bg-mv-surface/60 text-mv-text-secondary hover:border-mv-gold/40 hover:text-mv-gold',
                    )}
                  >
                    <Icon name="heart" size={13} className={list.liked ? 'fill-current' : ''} />
                    {list.likeCount}
                  </button>
                )}
                {!token && (
                  <span className="flex items-center gap-1.5 rounded-full border border-mv-border-light bg-mv-surface/60 px-4 py-2 text-[11px] text-mv-text-secondary">
                    <Icon name="heart" size={13} className="text-mv-gold" /> {list.likeCount}
                  </span>
                )}
                <button onClick={share} className="flex items-center gap-1.5 rounded-full border border-mv-border-light bg-mv-surface/60 px-4 py-2 text-[11px] font-medium text-mv-text-secondary transition-colors hover:border-mv-violet/40 hover:text-mv-violet">
                  <Icon name="link" size={12} /> {copied ? 'Copied ✓' : 'Share'}
                </button>
                {own && (
                  <>
                    <button onClick={() => setEditing(true)} className="flex items-center gap-1.5 rounded-full border border-mv-border-light bg-mv-surface/60 px-4 py-2 text-[11px] font-medium text-mv-text-secondary transition-colors hover:border-mv-violet/40 hover:text-mv-violet">
                      <Icon name="edit" size={12} /> Edit
                    </button>
                    <button
                      onClick={() => {
                        if (confirm('Delete this list?')) void deleteList.mutateAsync(list.id);
                      }}
                      className="flex items-center gap-1.5 rounded-full border border-mv-danger/30 bg-mv-danger/10 px-4 py-2 text-[11px] font-medium text-mv-danger transition-colors hover:bg-mv-danger hover:text-white"
                    >
                      <Icon name="trash" size={12} /> Delete
                    </button>
                  </>
                )}
              </div>
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-4 text-[10px] text-mv-text-dim">
              <span>{list.items.length} title{list.items.length === 1 ? '' : 's'}</span>
              <span className="flex items-center gap-1"><Icon name="eye" size={11} /> {list.viewCount.toLocaleString()} views</span>
              {!list.isPublic && <span className="flex items-center gap-1 text-mv-warning"><Icon name="lock" size={11} /> Private</span>}
            </div>
          </div>
        </header>

        {/* ─── Add titles (owner) ───────────────────── */}
        {own && (
          <div className="mt-6">
            {!adding ? (
              <button onClick={() => setAdding(true)} className="flex items-center gap-2 rounded-2xl border border-dashed border-mv-border-light px-5 py-3.5 text-xs font-medium text-mv-text-dim transition-colors hover:border-mv-violet/40 hover:text-mv-violet">
                <Icon name="plus" size={14} /> Add titles to this list
              </button>
            ) : (
              <div className="rounded-2xl border border-mv-border bg-mv-darker p-4 animate-fade-in">
                <div className="relative">
                  <Icon name="search" size={13} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-mv-text-dim" />
                  <input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search titles to add…"
                    aria-label="Search titles to add"
                    className="field py-2 pl-8 pr-3 text-xs"
                  />
                </div>
                {searching && <p className="mt-2 text-[10px] text-mv-text-dim">Searching…</p>}
                {searchResults.length > 0 && (
                  <ul className="mt-3 space-y-1">
                    {searchResults.map((t) => {
                      const added = alreadyInList.has(t.id);
                      return (
                        <li key={t.id} className="flex items-center gap-3 rounded-lg px-2 py-1.5 transition-colors hover:bg-mv-surface">
                          <span className="h-10 w-7 shrink-0 overflow-hidden rounded bg-mv-surface">
                            {t.coverUrl ? <CoverImage src={t.coverUrl} title={t.title} type={t.type} className="h-full w-full" /> : <span className="flex h-full w-full items-center justify-center text-[8px] text-mv-text-dim">{t.title.charAt(0)}</span>}
                          </span>
                          <span className="min-w-0 flex-1 truncate text-[11px] text-mv-text-secondary">{t.title}</span>
                          <button
                            onClick={() => void handleAdd(t)}
                            disabled={added || addItem.isPending}
                            className={cn(
                              'shrink-0 rounded-full px-3 py-1 text-[9px] font-semibold transition-colors',
                              added ? 'bg-mv-success/15 text-mv-success' : 'bg-gradient-to-r from-mv-purple to-mv-accent text-white hover:brightness-110 disabled:opacity-40',
                            )}
                          >
                            {added ? 'Added ✓' : 'Add'}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
                {!searching && searchQuery.trim().length >= 2 && searchResults.length === 0 && (
                  <p className="mt-2 text-[10px] text-mv-text-dim">No titles found for “{searchQuery}”.</p>
                )}
              </div>
            )}
          </div>
        )}

        {/* ─── Items grid ───────────────────────────── */}
        <div className="mt-6">
          {list.items.length === 0 ? (
            <div className="card flex flex-col items-center rounded-3xl px-6 py-16 text-center">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-mv-purple/20 to-mv-accent/10">
                <Icon name="sparkles" size={24} className="text-mv-violet" />
              </div>
              <p className="text-sm font-medium text-mv-text">This list is empty</p>
              <p className="mt-1 max-w-sm text-xs text-mv-text-muted">
                {own ? 'Add titles above to start curating.' : 'The author hasn\u2019t added titles yet — check back soon.'}
              </p>
              {!own && (
                <Link href="/browse" className="btn-primary mt-6 px-5 py-2.5 text-xs">Browse titles</Link>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
              {list.items.map((item) => (
                <div key={item.id} className={cn('group relative', removingId === item.title.id && 'opacity-40')}>
                  <div className="card-lift img-zoom relative aspect-[3/4] overflow-hidden rounded-xl border border-mv-border bg-mv-surface">
                    <Link href={`/title/${item.title.slug}`} className="absolute inset-0" aria-label={item.title.title}>
                      <CoverImage src={item.title.coverUrl} title={item.title.title} type={item.title.type} className="h-full w-full" />
                      <div className="absolute inset-0 bg-gradient-to-t from-mv-dark/80 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                      <span className="absolute left-1.5 top-1.5 rounded bg-black/60 px-1.5 py-0.5 text-[8px] font-semibold text-white backdrop-blur-sm">
                        #{item.sortOrder + 1}
                      </span>
                    </Link>
                    {own && (
                      <button
                        onClick={() => void handleRemove(item.title.id)}
                        disabled={removingId === item.title.id}
                        aria-label={`Remove ${item.title.title} from list`}
                        className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-mv-text-muted opacity-0 backdrop-blur-sm transition-all hover:bg-mv-danger/80 hover:text-white focus-visible:opacity-100 group-hover:opacity-100"
                      >
                        <Icon name="close" size={11} />
                      </button>
                    )}
                  </div>
                  <div className="mt-2">
                    <Link href={`/title/${item.title.slug}`}>
                      <p className="line-clamp-2 text-xs font-medium leading-snug text-mv-text-secondary transition-colors group-hover:text-white">{item.title.title}</p>
                    </Link>
                    {item.note && <p className="mt-1 line-clamp-2 text-[9px] italic leading-relaxed text-mv-text-dim">“{item.note}”</p>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ─── Edit dialog ────────────────────────────── */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="edit-list-title">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
          <div ref={dialogRef} className="relative w-full max-w-md rounded-3xl border border-mv-violet/25 bg-mv-darker p-7 shadow-modal animate-scale-in">
            <div className="mb-5 flex items-start justify-between">
              <div>
                <p className="eyebrow mb-1">Edit list</p>
                <h2 id="edit-list-title" className="text-lg font-bold text-white">{list.name}</h2>
              </div>
              <button onClick={() => setEditing(false)} aria-label="Close dialog" className="rounded-lg p-1.5 text-mv-text-dim transition-colors hover:bg-white/5 hover:text-white">
                <Icon name="close" size={16} />
              </button>
            </div>
            <form onSubmit={saveEdit} className="space-y-4">
              <div>
                <label htmlFor="edit-name" className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-mv-text-muted">Name</label>
                <input id="edit-name" value={editName} onChange={(e) => setEditName(e.target.value)} maxLength={100} autoFocus className="field w-full" />
              </div>
              <div>
                <label htmlFor="edit-desc" className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-mv-text-muted">Description</label>
                <textarea id="edit-desc" value={editDesc} onChange={(e) => setEditDesc(e.target.value)} maxLength={2000} rows={3} className="field w-full resize-none" />
              </div>
              <div>
                <label htmlFor="edit-tags" className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-mv-text-muted">Tags</label>
                <input id="edit-tags" value={editTags} onChange={(e) => setEditTags(e.target.value)} className="field w-full" />
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button type="button" onClick={() => setEditing(false)} className="btn-ghost px-4 py-2.5 text-xs">Cancel</button>
                <button type="submit" disabled={editName.trim().length < 3 || updateList.isPending} className="btn-primary px-5 py-2.5 text-xs disabled:opacity-50">
                  {updateList.isPending ? 'Saving…' : 'Save changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppShell>
  );
}
