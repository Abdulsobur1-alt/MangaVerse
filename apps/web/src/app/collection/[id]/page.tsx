'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { AppShell } from '@/components/AppShell';
import { Icon } from '@/components/ui/Icon';
import { CoverImage } from '@/components/CoverImage';
import { CollectionFormDialog } from '@/components/collections/CollectionFormDialog';
import {
  useCollection,
  useDeleteCollection,
  useAddCollectionItem,
  useRemoveCollectionItem,
  type CollectionSummary,
} from '@/lib/hooks/useCollections';
import { useTitles, type TitleListItem } from '@/lib/hooks/useTitles';
import { useAuthStore } from '@/store/authStore';
import { formatType } from '@/lib/format';
import { cn } from '@/lib/cn';

/* ═══════════════════════════════════════════════════════════════
   Collection detail — one curated shelf, fully manageable.
   • Header with name/description/tags/privacy + edit & delete
   • Add-titles search: debounced catalog query with one-tap adds
     (already-in-collection titles show a check)
   • Item grid with remove-on-hover, links into titles
   • Premium empty state that guides to the add flow
   ═══════════════════════════════════════════════════════════════ */

export default function CollectionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = typeof params.id === 'string' ? params.id : '';
  const { token } = useAuthStore();

  const { data: collection, isLoading } = useCollection(id, !!token);
  const addItem = useAddCollectionItem();
  const removeItem = useRemoveCollectionItem();
  const deleteCollection = useDeleteCollection();
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  // ── Add-titles search ──
  const [searchOpen, setSearchOpen] = useState(false);
  const [term, setTerm] = useState('');
  const [debounced, setDebounced] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setDebounced(term.trim()), 250);
    return () => clearTimeout(t);
  }, [term]);

  const { data: searchData, isFetching: searching } = useTitles({
    search: debounced || undefined,
    limit: 8,
    enabled: searchOpen && !!debounced,
  });

  const existingTitleIds = useMemo(
    () => new Set(collection?.items.map((i) => i.titleId) ?? []),
    [collection],
  );

  const addToCollection = async (t: TitleListItem) => {
    try {
      await addItem.mutateAsync({ collectionId: id, titleId: t.id });
    } catch {
      // surfaced by hooks (idempotent server-side anyway)
    }
  };

  const removeFromCollection = async (titleId: string) => {
    setRemovingId(titleId);
    try {
      await removeItem.mutateAsync({ collectionId: id, titleId });
    } catch {
      // surfaced by hooks
    }
    setRemovingId(null);
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteCollection.mutateAsync(id);
      router.push('/collections');
    } catch {
      setDeleting(false);
    }
  };

  const items = collection?.items ?? [];

  return (
    <ProtectedRoute>
      <AppShell>
        <div className="mx-auto max-w-6xl px-5 py-8 sm:px-6 md:px-8">
          {/* ─── Back ─────────────────────────────────── */}
          <Link href="/collections" className="mb-5 inline-flex items-center gap-1.5 text-[11px] text-mv-text-dim transition-colors hover:text-mv-violet">
            <Icon name="arrowLeft" size={13} />
            All collections
          </Link>

          {isLoading ? (
            <div className="space-y-4">
              <div className="skeleton h-8 w-64 rounded-xl" />
              <div className="skeleton h-3 w-96 max-w-full rounded" />
              <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                {Array.from({ length: 12 }).map((_, i) => (
                  <div key={i} className="skeleton aspect-[3/4] rounded-xl" />
                ))}
              </div>
            </div>
          ) : !collection ? (
            <div className="card flex flex-col items-center rounded-3xl px-6 py-16 text-center">
              <Icon name="alert" size={26} className="mb-3 text-mv-text-dim" />
              <p className="text-sm text-mv-text-secondary">Collection not found.</p>
              <Link href="/collections" className="btn-primary mt-5 px-5 py-2.5 text-xs">Back to collections</Link>
            </div>
          ) : (
            <>
              {/* ─── Header ───────────────────────────── */}
              <header className="relative overflow-hidden rounded-3xl border border-mv-border bg-mv-darker p-6 md:p-8">
                <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-mv-purple/15 blur-3xl" aria-hidden="true" />
                <div className="relative flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="eyebrow mb-2">Collection</p>
                    <h1 className="text-2xl font-bold tracking-tight text-white md:text-3xl">{collection.name}</h1>
                    {collection.description && (
                      <p className="mt-2 max-w-xl text-xs leading-relaxed text-mv-text-muted">{collection.description}</p>
                    )}
                    <div className="mt-3 flex flex-wrap items-center gap-1.5">
                      <span className="rounded-full bg-white/5 px-2.5 py-0.5 text-[9px] text-mv-text-dim">
                        {items.length} title{items.length === 1 ? '' : 's'}
                      </span>
                      <span className={cn('flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[9px] font-medium', collection.isPrivate ? 'bg-mv-gold/10 text-mv-gold' : 'bg-mv-violet/15 text-mv-violet')}>
                        <Icon name={collection.isPrivate ? 'lock' : 'eye'} size={9} />
                        {collection.isPrivate ? 'Private' : 'Public'}
                      </span>
                      {collection.tags.map((tag) => (
                        <span key={tag} className="rounded-full bg-white/5 px-2.5 py-0.5 text-[9px] text-mv-text-dim">#{tag}</span>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setSearchOpen((o) => !o)}
                      aria-expanded={searchOpen}
                      className={cn(
                        'flex items-center gap-2 rounded-xl border px-4 py-2.5 text-xs font-medium transition-all',
                        searchOpen
                          ? 'border-mv-violet/40 bg-mv-violet/15 text-mv-violet'
                          : 'border-white/10 bg-white/5 text-mv-text-secondary hover:border-mv-violet/40 hover:text-mv-violet',
                      )}
                    >
                      <Icon name="plus" size={13} />
                      Add titles
                    </button>
                    <button
                      onClick={() => setEditing(true)}
                      aria-label="Edit collection"
                      className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-mv-text-dim transition-colors hover:border-mv-violet/40 hover:text-mv-violet"
                    >
                      <Icon name="edit" size={14} />
                    </button>
                    <button
                      onClick={() => setConfirmDelete(true)}
                      aria-label="Delete collection"
                      className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-mv-text-dim transition-colors hover:border-mv-danger/40 hover:text-mv-danger"
                    >
                      <Icon name="trash" size={14} />
                    </button>
                  </div>
                </div>

                {/* ─── Add-titles search panel ───────── */}
                {searchOpen && (
                  <div className="relative mt-6 animate-fade-in">
                    <div className="relative">
                      <Icon name="search" size={14} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-mv-text-dim" />
                      <input
                        value={term}
                        onChange={(e) => setTerm(e.target.value)}
                        placeholder="Search the catalog to add titles…"
                        aria-label="Search titles to add"
                        autoFocus
                        className="field w-full pl-10 py-2.5 text-xs"
                      />
                    </div>
                    {debounced && (
                      <div className="absolute left-0 right-0 top-full z-30 mt-2 overflow-hidden rounded-xl border border-mv-border-light bg-mv-darker/95 shadow-modal backdrop-blur-xl">
                        {searching ? (
                          <div className="flex items-center justify-center gap-2 px-4 py-6 text-[11px] text-mv-text-dim">
                            <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-mv-violet border-t-transparent" />
                            Searching…
                          </div>
                        ) : !searchData?.items?.length ? (
                          <p className="px-4 py-6 text-center text-[11px] text-mv-text-muted">No titles match “{debounced}”.</p>
                        ) : (
                          <ul className="max-h-80 overflow-y-auto p-1.5">
                            {searchData.items.map((t) => {
                              const added = existingTitleIds.has(t.id);
                              return (
                                <li key={t.id}>
                                  <button
                                    onClick={() => !added && addToCollection(t)}
                                    disabled={added || addItem.isPending}
                                    className={cn(
                                      'flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors',
                                      added ? 'opacity-60' : 'hover:bg-white/5',
                                    )}
                                  >
                                    <span className="h-10 w-7 shrink-0 overflow-hidden rounded bg-mv-surface">
                                      <CoverImage src={t.coverUrl} title={t.title} type={t.type} className="h-full w-full" />
                                    </span>
                                    <span className="min-w-0 flex-1">
                                      <span className="block truncate text-[11px] font-medium text-mv-text">{t.title}</span>
                                      <span className="text-[9px] text-mv-text-dim">
                                        {t.author || 'Unknown author'} · {formatType(t.type)}
                                      </span>
                                    </span>
                                    {added ? (
                                      <span className="flex items-center gap-1 rounded-full bg-mv-success/15 px-2 py-0.5 text-[9px] font-semibold text-mv-success">
                                        <Icon name="check" size={10} /> Added
                                      </span>
                                    ) : (
                                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-mv-violet/15 text-mv-violet">
                                        <Icon name="plus" size={12} />
                                      </span>
                                    )}
                                  </button>
                                </li>
                              );
                            })}
                          </ul>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </header>

              {/* ─── Items ────────────────────────────── */}
              {items.length === 0 ? (
                <div className="card mt-6 flex flex-col items-center rounded-3xl px-6 py-16 text-center">
                  <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-mv-purple/20 to-mv-accent/10">
                    <Icon name="sparkles" size={24} className="text-mv-violet" />
                  </div>
                  <p className="text-sm font-medium text-mv-text">This collection is empty</p>
                  <p className="mt-1 max-w-sm text-xs text-mv-text-muted">
                    Add your first title — search the catalog above, or start from a series you love.
                  </p>
                  <button onClick={() => setSearchOpen(true)} className="btn-primary mt-6 px-5 py-2.5 text-xs">
                    <Icon name="plus" size={13} className="mr-1.5 inline" />
                    Add titles
                  </button>
                </div>
              ) : (
                <div className="mt-6 grid grid-cols-2 gap-x-4 gap-y-7 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                  {items.map((item) => (
                    <div key={item.id} className={`group relative ${removingId === item.titleId ? 'opacity-40' : ''}`}>
                      <div className="card-lift img-zoom relative aspect-[3/4] overflow-hidden rounded-xl border border-mv-border bg-mv-surface">
                        <Link href={`/title/${item.title.slug}`} className="absolute inset-0" aria-label={`View ${item.title.title}`}>
                          <CoverImage src={item.title.coverUrl} title={item.title.title} type={item.title.type} className="h-full w-full" />
                          <div className="absolute inset-0 bg-gradient-to-t from-mv-dark/80 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                          {item.title.rating != null && (
                            <span className="absolute bottom-2 left-2 flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 text-[8px] font-semibold text-mv-gold backdrop-blur-sm">
                              <Icon name="star" size={9} className="fill-current" />
                              {item.title.rating.toFixed(1)}
                            </span>
                          )}
                        </Link>
                        <button
                          onClick={() => removeFromCollection(item.titleId)}
                          disabled={removingId === item.titleId}
                          aria-label={`Remove ${item.title.title} from collection`}
                          className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-black/50 text-mv-text-muted opacity-0 backdrop-blur-sm transition-all hover:bg-mv-danger/80 hover:text-white focus-visible:opacity-100 group-hover:opacity-100 disabled:opacity-30"
                        >
                          <Icon name="close" size={11} />
                        </button>
                      </div>
                      <div className="mt-2.5">
                        <Link href={`/title/${item.title.slug}`}>
                          <p className="line-clamp-2 text-xs font-medium leading-snug text-mv-text-secondary transition-colors group-hover:text-white">
                            {item.title.title}
                          </p>
                        </Link>
                        <p className="mt-1 text-[9px] text-mv-text-muted">{formatType(item.title.type)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* Edit dialog */}
        <CollectionFormDialog open={editing} onClose={() => setEditing(false)} existing={collection as CollectionSummary | null} />

        {/* Delete confirm */}
        {confirmDelete && collection && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="alertdialog" aria-modal="true" aria-labelledby="delete-col-title">
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
            <div className="relative w-full max-w-sm rounded-3xl border border-mv-danger/30 bg-mv-darker p-7 shadow-modal animate-scale-in">
              <h2 id="delete-col-title" className="text-base font-bold text-white">Delete “{collection.name}”?</h2>
              <p className="mt-2 text-xs leading-relaxed text-mv-text-muted">
                This removes the collection and its {items.length} item{items.length === 1 ? '' : 's'}. Titles stay in your library.
              </p>
              <div className="mt-6 flex items-center justify-end gap-2">
                <button onClick={() => setConfirmDelete(false)} className="btn-ghost px-4 py-2.5 text-xs">Cancel</button>
                <button onClick={handleDelete} disabled={deleting} className="rounded-xl bg-mv-danger px-5 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-red-600 disabled:opacity-50">
                  {deleting ? 'Deleting…' : 'Delete collection'}
                </button>
              </div>
            </div>
          </div>
        )}
      </AppShell>
    </ProtectedRoute>
  );
}
