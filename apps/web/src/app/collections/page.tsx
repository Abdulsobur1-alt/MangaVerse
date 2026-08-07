'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { AppShell } from '@/components/AppShell';
import { Icon } from '@/components/ui/Icon';
import { EmptyState } from '@/components/ui/EmptyState';
import { CoverImage } from '@/components/CoverImage';
import { CollectionFormDialog } from '@/components/collections/CollectionFormDialog';
import { useCollections, useDeleteCollection, type CollectionSummary } from '@/lib/hooks/useCollections';
import { useAuthStore } from '@/store/authStore';
import { cn } from '@/lib/cn';

/* ═══════════════════════════════════════════════════════════════
   My Collections — the user's curated shelves, beyond the five
   default lists. Grid of cards with cover collages, counts, and an
   edit/delete menu; "New collection" opens the shared form dialog.
   ═══════════════════════════════════════════════════════════════ */

export default function CollectionsPage() {
  const { token } = useAuthStore();
  const { data: collections, isLoading } = useCollections(!!token);
  const deleteCollection = useDeleteCollection();
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<CollectionSummary | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<CollectionSummary | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = async (c: CollectionSummary) => {
    setDeletingId(c.id);
    try {
      await deleteCollection.mutateAsync(c.id);
      setConfirmDelete(null);
    } catch {
      // surfaced by hooks
    }
    setDeletingId(null);
  };

  return (
    <ProtectedRoute>
      <AppShell>
        <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 md:px-8 md:py-8">
          <header className="mb-8 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="eyebrow mb-2">Curated by you</p>
              <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl md:text-4xl">
                My <span className="text-gradient">Collections</span>
              </h1>
              <p className="mt-1.5 text-xs text-mv-text-muted">
                Unlimited custom shelves — organize by mood, genre, or pure vibes.
              </p>
            </div>
            <button
              onClick={() => setCreating(true)}
              className="btn-primary flex items-center gap-2 px-5 py-2.5 text-xs"
            >
              <Icon name="plus" size={14} />
              New Collection
            </button>
          </header>

          {isLoading ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="skeleton h-36 rounded-2xl" />
              ))}
            </div>
          ) : !collections || collections.length === 0 ? (
            <EmptyState
              icon="sparkles"
              title="No collections yet"
              body="Collections are your own reading lists — “Weekend Reads”, “Peak Fiction”, “Emotional Damage”. Start with one."
              action={
                <>
                  <button onClick={() => setCreating(true)} className="btn-primary px-5 py-2.5 text-xs">
                    <Icon name="plus" size={13} className="mr-1.5 inline" />
                    Create your first collection
                  </button>
                  <Link href="/browse" className="btn-ghost px-5 py-2.5 text-xs">
                    Find titles
                  </Link>
                </>
              }
            />
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {collections.map((c) => (
                <div
                  key={c.id}
                  className={cn('group relative overflow-hidden rounded-2xl border border-mv-border bg-mv-darker transition-all duration-300 hover:-translate-y-0.5 hover:border-mv-violet/40 hover:shadow-card-hover', deletingId === c.id && 'opacity-40')}
                >
                  <Link href={`/collection/${c.id}`} className="block">
                    {/* Cover area */}
                    <div className="relative h-24 bg-gradient-to-br from-mv-purple/25 via-mv-darker to-mv-accent/10">
                      {c.cover ? (
                        <CoverImage src={c.cover} title={c.name} type="MANGA" className="absolute inset-0 h-full w-full opacity-40" />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <Icon name="sparkles" size={22} className="text-mv-violet/60" />
                        </div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-mv-darker via-mv-darker/40 to-transparent" />
                      <span className="absolute right-3 top-3 rounded-full bg-black/50 px-2 py-0.5 text-[8px] font-semibold text-mv-text-secondary backdrop-blur-sm">
                        {c.itemCount} title{c.itemCount === 1 ? '' : 's'}
                      </span>
                      {!c.isPrivate && (
                        <span className="absolute left-3 top-3 flex items-center gap-1 rounded-full bg-mv-violet/20 px-2 py-0.5 text-[8px] font-semibold text-mv-violet backdrop-blur-sm">
                          <Icon name="eye" size={9} /> Public
                        </span>
                      )}
                    </div>
                    <div className="p-4 pt-2.5">
                      <h2 className="truncate text-sm font-semibold text-white transition-colors group-hover:text-mv-violet">
                        {c.name}
                      </h2>
                      {c.description && (
                        <p className="mt-1 line-clamp-2 text-[11px] text-mv-text-muted">{c.description}</p>
                      )}
                      {c.tags.length > 0 && (
                        <div className="mt-2.5 flex flex-wrap gap-1">
                          {c.tags.slice(0, 4).map((tag) => (
                            <span key={tag} className="rounded-full bg-white/5 px-2 py-0.5 text-[8px] text-mv-text-dim">
                              #{tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </Link>
                  {/* Edit / delete */}
                  <div className="absolute right-3 top-3 flex gap-1 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                    <button
                      onClick={() => setEditing(c)}
                      aria-label={`Edit ${c.name}`}
                      className="flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-mv-text-secondary backdrop-blur-sm transition-colors hover:bg-mv-violet/30 hover:text-white"
                    >
                      <Icon name="edit" size={12} />
                    </button>
                    <button
                      onClick={() => setConfirmDelete(c)}
                      aria-label={`Delete ${c.name}`}
                      className="flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-mv-text-secondary backdrop-blur-sm transition-colors hover:bg-mv-danger/80 hover:text-white"
                    >
                      <Icon name="trash" size={12} />
                    </button>
                  </div>
                </div>
              ))}

              {/* New collection card */}
              <button
                onClick={() => setCreating(true)}
                className="flex min-h-[168px] flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-mv-border-light text-mv-text-dim transition-colors hover:border-mv-violet/40 hover:text-mv-violet"
              >
                <Icon name="plus" size={22} />
                <span className="text-xs font-medium">New collection</span>
              </button>
            </div>
          )}
        </div>

        {/* Dialogs */}
        <CollectionFormDialog open={creating} onClose={() => setCreating(false)} />
        <CollectionFormDialog open={!!editing} onClose={() => setEditing(null)} existing={editing} />

        {/* Delete confirm */}
        {confirmDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="alertdialog" aria-modal="true" aria-labelledby="delete-col-title">
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
            <div className="relative w-full max-w-sm rounded-3xl border border-mv-danger/30 bg-mv-darker p-7 shadow-modal animate-scale-in">
              <h2 id="delete-col-title" className="text-base font-bold text-white">Delete “{confirmDelete.name}”?</h2>
              <p className="mt-2 text-xs leading-relaxed text-mv-text-muted">
                This removes the collection and its {confirmDelete.itemCount} item{confirmDelete.itemCount === 1 ? '' : 's'}.
                Titles stay in your library — only the shelf is deleted.
              </p>
              <div className="mt-6 flex items-center justify-end gap-2">
                <button onClick={() => setConfirmDelete(null)} className="btn-ghost px-4 py-2.5 text-xs">
                  Cancel
                </button>
                <button
                  onClick={() => handleDelete(confirmDelete)}
                  disabled={deletingId === confirmDelete.id}
                  className="rounded-xl bg-mv-danger px-5 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-red-600 disabled:opacity-50"
                >
                  {deletingId === confirmDelete.id ? 'Deleting…' : 'Delete collection'}
                </button>
              </div>
            </div>
          </div>
        )}
      </AppShell>
    </ProtectedRoute>
  );
}
