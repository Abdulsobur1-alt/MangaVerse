'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { AppShell } from '@/components/AppShell';
import { Icon } from '@/components/ui/Icon';
import { CoverImage } from '@/components/CoverImage';
import { useAuthStore } from '@/store/authStore';
import { usePublicLists, useMyLists, useCreateList, useDeleteList, type ListSummary } from '@/lib/hooks/useLists';
import { cn } from '@/lib/cn';

/* ═══════════════════════════════════════════════════════════════
   Lists — curated public reading lists (Phase 8).
   • "My lists" tab (create / delete / privacy badge)
   • "Explore" tab: the community's most-liked public lists
   • Create dialog: name, description, tags, visibility
   Lists are shareable, likeable shelves — different from the private
   Collections used for personal organizing.
   ═══════════════════════════════════════════════════════════════ */

function timeAgoEpoch(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86400000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 30) return `${days}d ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

function ListCard({ list, onDelete, deleting }: { list: ListSummary; onDelete?: (id: string) => void; deleting?: boolean }) {
  const { token, user } = useAuthStore();
  const own = !!user && list.user.id === user.id;
  return (
    <div
      className={cn(
        'group relative overflow-hidden rounded-2xl border border-mv-border bg-mv-darker transition-all duration-300 hover:-translate-y-0.5 hover:border-mv-violet/40 hover:shadow-card-hover',
        deleting && 'opacity-40',
      )}
    >
      <Link href={`/list/${list.id}`} className="block">
        {/* Cover area */}
        <div className="relative h-28 overflow-hidden bg-gradient-to-br from-mv-purple/25 via-mv-darker to-mv-accent/10">
          {list.cover ? (
            <CoverImage src={list.cover} title={list.name} type="MANGA" className="absolute inset-0 h-full w-full opacity-50 transition-transform duration-500 group-hover:scale-105" />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <Icon name="sparkles" size={24} className="text-mv-violet/60" />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-mv-darker via-mv-darker/30 to-transparent" />
          <span className="absolute right-3 top-3 rounded-full bg-black/60 px-2 py-0.5 text-[8px] font-semibold text-mv-text-secondary backdrop-blur-sm">
            {list.itemCount} title{list.itemCount === 1 ? '' : 's'}
          </span>
          {!list.isPublic && (
            <span className="absolute left-3 top-3 flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 text-[8px] font-semibold text-mv-text-secondary backdrop-blur-sm">
              <Icon name="lock" size={8} /> Private
            </span>
          )}
        </div>
        <div className="p-4 pt-2.5">
          <h2 className="line-clamp-1 text-sm font-semibold text-white transition-colors group-hover:text-mv-violet">{list.name}</h2>
          {list.description && <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-mv-text-muted">{list.description}</p>}
          <div className="mt-3 flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-1.5">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-mv-purple to-mv-accent text-[8px] font-bold text-white">
                {list.user.displayName.charAt(0).toUpperCase()}
              </span>
              <span className="truncate text-[9px] text-mv-text-dim">{own ? 'You' : list.user.displayName}</span>
            </div>
            <span className="flex shrink-0 items-center gap-1 text-[9px] text-mv-text-dim">
              <Icon name="heart" size={10} className="text-mv-gold" /> {list.likeCount}
            </span>
          </div>
          <div className="mt-2 flex flex-wrap gap-1">
            {list.tags.slice(0, 3).map((t) => (
              <span key={t} className="rounded-full bg-white/5 px-2 py-0.5 text-[8px] text-mv-text-dim">#{t}</span>
            ))}
          </div>
        </div>
      </Link>
      {token && own && onDelete && (
        <button
          onClick={() => onDelete(list.id)}
          aria-label={`Delete list ${list.name}`}
          className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-mv-text-secondary opacity-0 backdrop-blur-sm transition-all hover:bg-mv-danger/80 hover:text-white focus-visible:opacity-100 group-hover:opacity-100"
        >
          <Icon name="trash" size={12} />
        </button>
      )}
    </div>
  );
}

export default function ListsPage() {
  const { token } = useAuthStore();
  const [tab, setTab] = useState<'mine' | 'explore'>('explore');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<'popular' | 'newest'>('popular');
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const { data: publicLists, isLoading: publicLoading } = usePublicLists({ sort, search: search.trim() || undefined }, true);
  const { data: myLists, isLoading: myLoading } = useMyLists();
  const createList = useCreateList();
  const deleteList = useDeleteList();

  // Create-dialog state
  const dialogRef = useRef<HTMLDivElement>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState('');
  const [isPublic, setIsPublic] = useState(true);

  useEffect(() => {
    if (!creating) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setCreating(false);
    const onDown = (e: MouseEvent | TouchEvent) => {
      if (!dialogRef.current?.contains(e.target as Node)) setCreating(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('touchstart', onDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('touchstart', onDown);
    };
  }, [creating]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim().length < 3 || createList.isPending) return;
    try {
      await createList.mutateAsync({
        name: name.trim(),
        description: description.trim() || undefined,
        tags: tags.split(',').map((t) => t.trim()).filter(Boolean).slice(0, 15),
        isPublic,
      });
      setCreating(false);
      setName('');
      setDescription('');
      setTags('');
      setIsPublic(true);
      setTab('mine');
    } catch {
      // surfaced by hooks
    }
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await deleteList.mutateAsync(id);
    } catch {
      // surfaced
    }
    setDeletingId(null);
  };

  const mine = myLists ?? [];
  const explore = publicLists?.items ?? [];
  const loading = tab === 'mine' ? myLoading : publicLoading;

  return (
    <AppShell>
      <div className="mx-auto max-w-6xl px-5 py-8 sm:px-6 md:px-8">
        {/* ─── Header ───────────────────────────────── */}
        <header className="mb-7 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="eyebrow mb-2">Curated by the community</p>
            <h1 className="text-3xl font-bold tracking-tight text-white md:text-4xl">
              <span className="text-gradient">Lists</span>
            </h1>
            <p className="mt-1.5 text-xs text-mv-text-muted">
              Public reading lists — “Top Romance”, “Best Villains”, “Must Read Before 2027”. Discover or make your own.
            </p>
          </div>
          {token && (
            <button onClick={() => setCreating(true)} className="btn-primary flex items-center gap-2 px-5 py-2.5 text-xs">
              <Icon name="plus" size={14} />
              New List
            </button>
          )}
        </header>

        {/* ─── Tabs + filters ───────────────────────── */}
        <div className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex gap-1 rounded-xl border border-mv-border bg-mv-darker p-1" role="group" aria-label="List views">
            <button
              onClick={() => setTab('explore')}
              aria-pressed={tab === 'explore'}
              className={cn('rounded-lg px-4 py-1.5 text-[10px] font-medium transition-colors', tab === 'explore' ? 'bg-gradient-to-r from-mv-purple to-mv-accent text-white shadow-glow-sm' : 'text-mv-text-secondary hover:text-mv-text')}
            >
              Explore
            </button>
            <button
              onClick={() => setTab('mine')}
              aria-pressed={tab === 'mine'}
              className={cn('rounded-lg px-4 py-1.5 text-[10px] font-medium transition-colors', tab === 'mine' ? 'bg-gradient-to-r from-mv-purple to-mv-accent text-white shadow-glow-sm' : 'text-mv-text-secondary hover:text-mv-text')}
            >
              My lists {token ? `(${mine.length})` : ''}
            </button>
          </div>
          {tab === 'explore' && (
            <div className="flex items-center gap-2">
              <div className="relative flex-1 lg:w-60 lg:flex-none">
                <Icon name="search" size={13} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-mv-text-dim" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search lists…"
                  aria-label="Search lists"
                  className="field py-2 pl-8 pr-3 text-xs"
                />
              </div>
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as 'popular' | 'newest')}
                aria-label="Sort lists"
                className="field py-2 text-xs"
              >
                <option value="popular">Most liked</option>
                <option value="newest">Newest</option>
              </select>
            </div>
          )}
        </div>

        {/* ─── Mine tab ─────────────────────────────── */}
        {tab === 'mine' && (
          <>
            {!token ? (
              <div className="card flex flex-col items-center rounded-3xl px-6 py-16 text-center">
                <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-mv-purple/20 to-mv-accent/10">
                  <Icon name="sparkles" size={24} className="text-mv-violet" />
                </div>
                <p className="text-sm font-medium text-mv-text">Sign in to create lists</p>
                <p className="mt-1 max-w-sm text-xs text-mv-text-muted">
                  Lists are shareable shelves — build one and the community can like and discover it.
                </p>
                <Link href="/login" className="btn-primary mt-6 px-5 py-2.5 text-xs">Sign in</Link>
              </div>
            ) : mine.length === 0 ? (
              <div className="card flex flex-col items-center rounded-3xl px-6 py-16 text-center">
                <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-mv-purple/20 to-mv-accent/10">
                  <Icon name="sparkles" size={24} className="text-mv-violet" />
                </div>
                <p className="text-sm font-medium text-mv-text">No lists yet</p>
                <p className="mt-1 max-w-sm text-xs text-mv-text-muted">
                  Create your first public list — “Best Villains”, “Emotional Damage”, anything readers would love.
                </p>
                <button onClick={() => setCreating(true)} className="btn-primary mt-6 flex items-center gap-2 px-5 py-2.5 text-xs">
                  <Icon name="plus" size={13} /> Create your first list
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {mine.map((l) => (
                  <ListCard key={l.id} list={l} deleting={deletingId === l.id} onDelete={handleDelete} />
                ))}
                <button
                  onClick={() => setCreating(true)}
                  className="flex min-h-[220px] flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-mv-border-light text-mv-text-dim transition-colors hover:border-mv-violet/40 hover:text-mv-violet"
                >
                  <Icon name="plus" size={22} />
                  <span className="text-xs font-medium">New list</span>
                </button>
              </div>
            )}
          </>
        )}

        {/* ─── Explore tab ──────────────────────────── */}
        {tab === 'explore' && (
          <>
            {loading ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="skeleton h-56 rounded-2xl" />
                ))}
              </div>
            ) : explore.length === 0 ? (
              <div className="card flex flex-col items-center rounded-3xl px-6 py-16 text-center">
                <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-mv-purple/20 to-mv-accent/10">
                  <Icon name="heart" size={24} className="text-mv-violet" />
                </div>
                <p className="text-sm font-medium text-mv-text">
                  {search.trim() ? `No lists match “${search}”` : 'No public lists yet'}
                </p>
                <p className="mt-1 max-w-sm text-xs text-mv-text-muted">
                  {search.trim() ? 'Try a different search.' : 'Be the first to share a curated list with the community.'}
                </p>
                {token && !search.trim() && (
                  <button onClick={() => setCreating(true)} className="btn-primary mt-6 px-5 py-2.5 text-xs">Create a list</button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {explore.map((l) => (
                  <ListCard key={l.id} list={l} />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* ─── Create dialog ──────────────────────────── */}
      {creating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="list-dialog-title">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
          <div ref={dialogRef} className="relative w-full max-w-md rounded-3xl border border-mv-violet/25 bg-mv-darker p-7 shadow-modal animate-scale-in">
            <div className="mb-5 flex items-start justify-between">
              <div>
                <p className="eyebrow mb-1">New public list</p>
                <h2 id="list-dialog-title" className="text-lg font-bold text-white">Curate a list</h2>
              </div>
              <button onClick={() => setCreating(false)} aria-label="Close dialog" className="rounded-lg p-1.5 text-mv-text-dim transition-colors hover:bg-white/5 hover:text-white">
                <Icon name="close" size={16} />
              </button>
            </div>

            <form onSubmit={submit} className="space-y-4">
              <div>
                <label htmlFor="list-name" className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-mv-text-muted">Name</label>
                <input id="list-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={100} autoFocus placeholder='e.g. "Best Villains in Shonen"' className="field w-full" />
              </div>
              <div>
                <label htmlFor="list-desc" className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-mv-text-muted">Description</label>
                <textarea id="list-desc" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={2000} rows={3} placeholder="Why should readers check this out?" className="field w-full resize-none" />
              </div>
              <div>
                <label htmlFor="list-tags" className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-mv-text-muted">Tags</label>
                <input id="list-tags" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="romance, underrated, classics" className="field w-full" />
              </div>
              <label className="flex items-center justify-between gap-4 rounded-xl border border-mv-border-light bg-mv-surface/40 px-4 py-3">
                <div>
                  <p className="text-xs font-medium text-mv-text">Public list</p>
                  <p className="mt-0.5 text-[10px] text-mv-text-muted">Anyone can view, like, and share it.</p>
                </div>
                <input type="checkbox" checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} className="h-4 w-4 accent-violet-500" />
              </label>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button type="button" onClick={() => setCreating(false)} className="btn-ghost px-4 py-2.5 text-xs">Cancel</button>
                <button type="submit" disabled={name.trim().length < 3 || createList.isPending} className="btn-primary px-5 py-2.5 text-xs disabled:opacity-50">
                  {createList.isPending ? 'Creating…' : 'Create list'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppShell>
  );
}
