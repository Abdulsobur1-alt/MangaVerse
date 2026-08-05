'use client';

import { useEffect, useRef, useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { useCreateCollection, useUpdateCollection, type CollectionSummary } from '@/lib/hooks/useCollections';
import { cn } from '@/lib/cn';

/* ═══════════════════════════════════════════════════════════════
   CollectionFormDialog — create or edit a custom collection.
   Fields: name, description, tags (comma-separated), privacy.
   Reused by /collections (create + edit) and /collection/[id] (edit).
   ═══════════════════════════════════════════════════════════════ */

interface Props {
  open: boolean;
  onClose: () => void;
  /** Pass an existing collection to edit; omit to create. */
  existing?: CollectionSummary | null;
}

export function CollectionFormDialog({ open, onClose, existing }: Props) {
  const create = useCreateCollection();
  const update = useUpdateCollection();
  const dialogRef = useRef<HTMLDivElement>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState('');
  const [isPrivate, setIsPrivate] = useState(true);

  const busy = create.isPending || update.isPending;
  const editing = !!existing;

  // Reset fields whenever the dialog opens for a different target.
  useEffect(() => {
    if (open) {
      setName(existing?.name ?? '');
      setDescription(existing?.description ?? '');
      setTags((existing?.tags ?? []).join(', '));
      setIsPrivate(existing?.isPrivate ?? true);
    }
  }, [open, existing]);

  // Escape + outside click close (dialog semantics).
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    const onDown = (e: MouseEvent | TouchEvent) => {
      if (!dialogRef.current?.contains(e.target as Node)) onClose();
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('touchstart', onDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('touchstart', onDown);
    };
  }, [open, onClose]);

  if (!open) return null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || busy) return;
    const payload = {
      name: name.trim(),
      description: description.trim() || undefined,
      tags: tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean)
        .slice(0, 20),
      isPrivate,
    };
    try {
      if (editing && existing) {
        await update.mutateAsync({ id: existing.id, ...payload });
      } else {
        await create.mutateAsync(payload);
      }
      onClose();
    } catch {
      // surfaced by hooks
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="collection-dialog-title">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div
        ref={dialogRef}
        className="relative w-full max-w-md rounded-3xl border border-mv-violet/25 bg-mv-darker p-7 shadow-modal animate-scale-in"
      >
        <div className="mb-5 flex items-start justify-between">
          <div>
            <p className="eyebrow mb-1">{editing ? 'Edit collection' : 'New collection'}</p>
            <h2 id="collection-dialog-title" className="text-lg font-bold text-white">
              {editing ? existing?.name : 'Organize your shelf'}
            </h2>
          </div>
          <button onClick={onClose} aria-label="Close dialog" className="rounded-lg p-1.5 text-mv-text-dim transition-colors hover:bg-white/5 hover:text-white">
            <Icon name="close" size={16} />
          </button>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label htmlFor="col-name" className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-mv-text-muted">
              Name
            </label>
            <input
              id="col-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={80}
              autoFocus
              placeholder='e.g. "Weekend Reads"'
              className="field w-full"
            />
          </div>
          <div>
            <label htmlFor="col-desc" className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-mv-text-muted">
              Description <span className="normal-case text-mv-text-dim">(optional)</span>
            </label>
            <textarea
              id="col-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={500}
              rows={2}
              placeholder="What lives here?"
              className="field w-full resize-none"
            />
          </div>
          <div>
            <label htmlFor="col-tags" className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-mv-text-muted">
              Tags <span className="normal-case text-mv-text-dim">(comma-separated)</span>
            </label>
            <input
              id="col-tags"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              maxLength={200}
              placeholder="romance, hidden gems, re-read"
              className="field w-full"
            />
          </div>

          {/* Privacy */}
          <button
            type="button"
            onClick={() => setIsPrivate((p) => !p)}
            aria-pressed={isPrivate}
            className="flex w-full items-center justify-between rounded-xl border border-mv-border-light bg-mv-surface/60 px-4 py-3 transition-colors hover:border-mv-violet/40"
          >
            <span className="flex items-center gap-2.5 text-left">
              <Icon name={isPrivate ? 'lock' : 'eye'} size={15} className={isPrivate ? 'text-mv-gold' : 'text-mv-violet'} />
              <span>
                <span className="block text-xs font-medium text-mv-text">{isPrivate ? 'Private' : 'Public'}</span>
                <span className="block text-[9px] text-mv-text-dim">
                  {isPrivate ? 'Only you can see this collection' : 'Visible on your public profile (coming soon)'}
                </span>
              </span>
            </span>
            <span className={cn('relative h-5 w-9 rounded-full transition-colors', isPrivate ? 'bg-mv-accent/60' : 'bg-mv-border-light')}>
              <span className={cn('absolute top-[2px] h-4 w-4 rounded-full bg-white transition-all', isPrivate ? 'left-[18px]' : 'left-[2px]')} />
            </span>
          </button>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="btn-ghost px-4 py-2.5 text-xs">
              Cancel
            </button>
            <button type="submit" disabled={!name.trim() || busy} className="btn-primary px-5 py-2.5 text-xs disabled:opacity-50">
              {busy ? (editing ? 'Saving…' : 'Creating…') : editing ? 'Save changes' : 'Create collection'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
