'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { useAuthStore } from '@/store/authStore';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { Icon } from '@/components/ui/Icon';
import {
  useStudioTitles,
  useStudioTitle,
  useStudioChapters,
  useStudioCreateTitle,
  useStudioDeleteTitle,
  useStudioUpdateTitle,
  useStudioCreateChapter,
  useStudioDeleteChapter,
  useStudioReorderChapters,
  useStudioUpdateChapter,
  useStudioUpload,
  isStaffRole,
  STUDIO_TYPES,
  STUDIO_STATUSES,
  GENRES,
  type StudioTitle,
  type StudioTitleDetail,
  type StudioChapter,
} from '@/lib/hooks/useStudio';
import { cn } from '@/lib/cn';

/* ═══════════════════════════════════════════════════════════════
   Studio — the staff content workspace.
   Admins promote staff (Admin Console → Users → role), then editors
   & uploaders self-manage every manga / manhwa / manhua / light
   novel / novel here: create titles, upload covers & chapter pages,
   paste prose, reorder chapters — no admin ticket required.
   ═══════════════════════════════════════════════════════════════ */

const TYPE_EMOJI: Record<string, string> = {
  manga: '📗', manhwa: '🇰🇷', manhua: '🇨🇳', light_novel: '📕', novel: '📖', webtoon: '🎨',
};

function typeLabel(t: string) {
  return STUDIO_TYPES.find((x) => x.value === t)?.label ?? t;
}

export default function StudioPage() {
  const { user } = useAuthStore();

  if (!isStaffRole(user?.role)) {
    return (
      <ProtectedRoute>
        <AppShell>
          <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
            <EmptyState
              icon="lock"
              title="Staff access only"
              body="The Studio is where editors and uploaders manage content. Ask an admin to assign you the editor, uploader, or content manager role."
              emoji="🔐"
              action={
                <Button href="/browse" variant="outline">Back to browsing</Button>
              }
            />
          </div>
        </AppShell>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <AppShell>
        <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 md:px-8 md:py-8">
          <StudioHeader />
          <StudioContent key={user?.id} />
        </div>
      </AppShell>
    </ProtectedRoute>
  );
}

/* ─── Header ─────────────────────────────────────────── */

function StudioHeader() {
  const { user } = useAuthStore();
  return (
    <div className="mb-6 flex flex-wrap items-center gap-3">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-mv-purple to-mv-accent shadow-glow-sm">
        <Icon name="sparkles" size={18} strokeWidth={2} className="text-white" />
      </div>
      <div>
        <h1 className="text-xl font-semibold text-white">Content Studio</h1>
        <p className="text-xs text-mv-text-muted">Create, upload & arrange every series on the site</p>
      </div>
      <Badge tone="accent" dot pulse className="ml-auto">
        {user?.role === 'admin' ? 'Admin' : (user?.role ?? 'Staff')}
      </Badge>
    </div>
  );
}

/* ─── Main workspace ─────────────────────────────────── */

function StudioContent() {
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const { data: titles, isLoading } = useStudioTitles(
    { search: debounced || undefined, type: typeFilter || undefined, status: statusFilter || undefined },
    true,
  );

  return (
    <div className="space-y-5">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-mv-border bg-mv-darker p-3">
        <div className="relative min-w-[200px] flex-1">
          <Icon name="search" size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-mv-text-dim" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search titles…"
            className="w-full rounded-lg border border-mv-border-light bg-mv-surface py-2 pl-9 pr-3 text-xs text-mv-text placeholder:text-mv-text-dim outline-none focus:border-mv-accent"
          />
        </div>
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="field w-auto">
          <option value="">All formats</option>
          {STUDIO_TYPES.map((t) => (
            <option key={t.value} value={t.value}>{t.emoji} {t.label}</option>
          ))}
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="field w-auto">
          <option value="">All statuses</option>
          {STUDIO_STATUSES.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
        <Button onClick={() => { setShowCreate(true); setSelectedId(null); }}>
          <Icon name="plus" size={13} /> New title
        </Button>
      </div>

      {/* Create form */}
      {showCreate && <CreateTitleForm onDone={() => setShowCreate(false)} />}

      {/* Detail */}
      {selectedId && <TitleDetail id={selectedId} onBack={() => setSelectedId(null)} />}

      {/* List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20"><Spinner size={22} /></div>
      ) : !titles || titles.items.length === 0 ? (
        <EmptyState
          icon="library"
          title={debounced || typeFilter ? 'No titles match' : 'No content yet'}
          body={debounced || typeFilter ? 'Try a different search or filter.' : 'Create your first title to start building the library.'}
          emoji="📚"
          action={!debounced && !typeFilter ? (
            <Button onClick={() => setShowCreate(true)}><Icon name="plus" size={13} /> New title</Button>
          ) : undefined}
        />
      ) : (
        <div className="grid gap-2.5 sm:grid-cols-2">
          {titles.items.map((t) => (
            <TitleRow
              key={t.id}
              title={t}
              selected={t.id === selectedId}
              onSelect={() => setSelectedId(t.id === selectedId ? null : t.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Title row ──────────────────────────────────────── */

function TitleRow({ title, selected, onSelect }: { title: StudioTitle; selected: boolean; onSelect: () => void }) {
  return (
    <button
      onClick={onSelect}
      className={cn(
        'flex items-center gap-3 rounded-2xl border bg-mv-darker p-3 text-left transition-all duration-200',
        selected ? 'border-mv-accent/60 shadow-glow-sm' : 'border-mv-border hover:border-mv-violet/40 hover:bg-mv-surface/40',
      )}
    >
      {title.coverUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={title.coverUrl} alt="" className="h-14 w-10 shrink-0 rounded-md object-cover" />
      ) : (
        <span className="flex h-14 w-10 shrink-0 items-center justify-center rounded-md bg-mv-surface text-lg">
          {TYPE_EMOJI[title.type] ?? '📖'}
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-xs font-medium text-mv-text">{title.title}</span>
        <span className="mt-1 flex flex-wrap items-center gap-1.5">
          <Badge tone="neutral">{TYPE_EMOJI[title.type] ?? ''} {typeLabel(title.type)}</Badge>
          <Badge tone={title.status === 'ongoing' ? 'success' : title.status === 'hiatus' ? 'warning' : 'neutral'}>
            {title.status}
          </Badge>
          <span className="text-[9px] text-mv-text-dim">{title.chapters} ch · {title.saves} saves</span>
        </span>
      </span>
      <Icon name="chevronRight" size={14} className={cn('shrink-0 transition-transform', selected && 'rotate-90')} />
    </button>
  );
}

/* ─── Create title form ──────────────────────────────── */

function CreateTitleForm({ onDone }: { onDone: () => void }) {
  const create = useStudioCreateTitle();
  const [form, setForm] = useState({
    title: '',
    type: 'manga',
    status: 'ongoing',
    author: '',
    artist: '',
    releaseYear: '',
    synopsis: '',
    alternativeTitles: '',
    sourceUrl: '',
    coverUrl: '',
    genres: [] as string[],
  });
  const [error, setError] = useState<string | null>(null);
  const coverUpload = useStudioUpload();

  const set = (k: string, v: unknown) => setForm((f) => ({ ...f, [k]: v }));

  const toggleGenre = (g: string) =>
    set('genres', form.genres.includes(g) ? form.genres.filter((x) => x !== g) : [...form.genres, g]);

  const submit = async () => {
    if (!form.title.trim()) { setError('Title is required'); return; }
    setError(null);
    try {
      await create.mutateAsync({
        title: form.title.trim(),
        type: form.type,
        status: form.status,
        author: form.author.trim() || null,
        artist: form.artist.trim() || null,
        releaseYear: form.releaseYear ? Number(form.releaseYear) : null,
        synopsis: form.synopsis.trim() || null,
        alternativeTitles: form.alternativeTitles.trim() || null,
        sourceUrl: form.sourceUrl.trim() || null,
        coverUrl: form.coverUrl.trim() || null,
        genres: form.genres,
      });
      onDone();
    } catch (err) {
      setError((err as { message?: string })?.message ?? 'Could not create title');
    }
  };

  const handleCoverFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      const res = await coverUpload.mutateAsync({ file, folder: 'covers', type: 'cover', name: `cover-${Date.now()}` });
      set('coverUrl', res.url);
    } catch {
      setError('Cover upload failed');
    }
  };

  return (
    <div className="rounded-2xl border border-mv-accent/30 bg-mv-darker p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white">New title</h3>
        <button onClick={onDone} className="rounded-lg p-1 text-mv-text-dim hover:bg-white/5 hover:text-mv-text" aria-label="Close">
          <Icon name="close" size={14} />
        </button>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <label className="text-[9px] uppercase tracking-wider text-mv-text-dim">
          Title *
          <input value={form.title} onChange={(e) => set('title', e.target.value)} placeholder="Solo Leveling: Ragnarok" className="field mt-1 w-full" />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="text-[9px] uppercase tracking-wider text-mv-text-dim">
            Format
            <select value={form.type} onChange={(e) => set('type', e.target.value)} className="field mt-1 w-full">
              {STUDIO_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.emoji} {t.label}</option>
              ))}
            </select>
          </label>
          <label className="text-[9px] uppercase tracking-wider text-mv-text-dim">
            Status
            <select value={form.status} onChange={(e) => set('status', e.target.value)} className="field mt-1 w-full">
              {STUDIO_STATUSES.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </label>
        </div>
        <label className="text-[9px] uppercase tracking-wider text-mv-text-dim">
          Author
          <input value={form.author} onChange={(e) => set('author', e.target.value)} placeholder="Chugong" className="field mt-1 w-full" />
        </label>
        <label className="text-[9px] uppercase tracking-wider text-mv-text-dim">
          Artist
          <input value={form.artist} onChange={(e) => set('artist', e.target.value)} placeholder="h-goon" className="field mt-1 w-full" />
        </label>
        <label className="text-[9px] uppercase tracking-wider text-mv-text-dim">
          Release year
          <input type="number" min={1900} max={2100} value={form.releaseYear} onChange={(e) => set('releaseYear', e.target.value)} placeholder="2018" className="field mt-1 w-full" />
        </label>
        <label className="text-[9px] uppercase tracking-wider text-mv-text-dim">
          Alternative titles
          <input value={form.alternativeTitles} onChange={(e) => set('alternativeTitles', e.target.value)} placeholder="나 혼자만 레벨업 (comma separated)" className="field mt-1 w-full" />
        </label>
        <label className="text-[9px] uppercase tracking-wider text-mv-text-dim">
          Source URL (optional, MangaDex link enables chapter sync)
          <input value={form.sourceUrl} onChange={(e) => set('sourceUrl', e.target.value)} placeholder="https://mangadex.org/title/…" className="field mt-1 w-full" />
        </label>

        <div className="lg:col-span-2">
          <span className="text-[9px] uppercase tracking-wider text-mv-text-dim">Cover image</span>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            {form.coverUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={form.coverUrl} alt="cover preview" className="h-16 w-12 rounded-md object-cover" />
            )}
            <input
              value={form.coverUrl}
              onChange={(e) => set('coverUrl', e.target.value)}
              placeholder="…or paste an image URL"
              className="field min-w-[220px] flex-1"
            />
            <label className="btn-ghost cursor-pointer px-3 py-2 text-[10px]">
              {coverUpload.isPending ? 'Uploading…' : 'Upload file'}
              <input type="file" accept="image/*" className="hidden" onChange={(e) => handleCoverFile(e.target.files?.[0])} />
            </label>
          </div>
        </div>

        <div className="lg:col-span-2">
          <span className="text-[9px] uppercase tracking-wider text-mv-text-dim">Genres</span>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {GENRES.map((g) => (
              <button
                key={g}
                onClick={() => toggleGenre(g)}
                className={cn(
                  'rounded-full px-2.5 py-1 text-[9px] transition-colors',
                  form.genres.includes(g)
                    ? 'bg-mv-accent/20 text-mv-accent border border-mv-accent/40'
                    : 'bg-mv-surface text-mv-text-secondary border border-mv-border hover:text-mv-text',
                )}
              >
                {g.replace(/_/g, ' ')}
              </button>
            ))}
          </div>
        </div>

        <label className="text-[9px] uppercase tracking-wider text-mv-text-dim lg:col-span-2">
          Synopsis
          <textarea value={form.synopsis} onChange={(e) => set('synopsis', e.target.value)} rows={3} placeholder="What is this story about?" className="field mt-1 w-full resize-none" />
        </label>
      </div>

      {error && <p className="mt-3 text-[10px] text-red-400">{error}</p>}
      <div className="mt-4 flex items-center gap-2">
        <Button onClick={submit} loading={create.isPending} size="sm">
          <Icon name="plus" size={13} /> Create title
        </Button>
        <Button variant="outline" size="sm" onClick={onDone}>Cancel</Button>
      </div>
    </div>
  );
}

/* ─── Title detail ───────────────────────────────────── */

function TitleDetail({ id, onBack }: { id: string; onBack: () => void }) {
  const { data: title, isLoading } = useStudioTitle(id);
  const del = useStudioDeleteTitle();

  if (isLoading || !title) {
    return (
      <div className="rounded-2xl border border-mv-border bg-mv-darker p-8">
        <div className="flex items-center justify-center py-10"><Spinner size={20} /></div>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-mv-violet/30 bg-mv-darker">
      <div className="flex items-center gap-3 border-b border-mv-border p-4">
        <button onClick={onBack} className="rounded-lg p-1.5 text-mv-text-dim hover:bg-white/5 hover:text-mv-text" aria-label="Back">
          <Icon name="arrowLeft" size={15} />
        </button>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-semibold text-white">{title.title}</h3>
          <p className="text-[10px] text-mv-text-muted">
            /{title.slug} · {TYPE_EMOJI[title.type] ?? ''} {typeLabel(title.type)} · {title.genres.length} genres
          </p>
        </div>
        <Button
          variant="danger"
          size="sm"
          loading={del.isPending}
          onClick={async () => {
            if (confirm(`Delete "${title.title}" and all its chapters? This cannot be undone.`)) {
              try { await del.mutateAsync(id); onBack(); } catch { /* surfaced by hook */ }
            }
          }}
        >
          <Icon name="trash" size={12} /> Delete
        </Button>
      </div>

      <div className="grid gap-5 p-4 lg:grid-cols-[1fr_1.4fr]">
        <MetadataEditor title={title} />
        <ChapterManager titleId={title.id} />
      </div>
    </div>
  );
}

/* ─── Metadata editor ────────────────────────────────── */

function MetadataEditor({ title }: { title: StudioTitleDetail }) {
  const update = useStudioUpdateTitle();
  const coverUpload = useStudioUpload();
  const [synopsis, setSynopsis] = useState(title.synopsis ?? '');
  const [status, setStatus] = useState(title.status);
  const [genres, setGenres] = useState<string[]>(title.genres ?? []);
  const [saved, setSaved] = useState(false);

  const save = async (patch: Record<string, unknown>) => {
    setSaved(false);
    try {
      await update.mutateAsync({ id: title.id, patch: { ...patch, note: 'Edited in Studio' } });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch { /* hook surfaces */ }
  };

  // Compute the next genre set from CURRENT state (setGenres' return value is
  // undefined — the previous `const next = toggleGenre(g)` made save({genres:
  // next}) silently drop the payload).
  const toggleGenre = (g: string) => {
    const next = genres.includes(g) ? genres.filter((x) => x !== g) : [...genres, g];
    setGenres(next);
    return next;
  };

  return (
    <div className="space-y-4">
      <div>
        <p className="mb-2 text-[9px] font-semibold uppercase tracking-wider text-mv-text-muted">Metadata</p>
        <div className="space-y-3 rounded-xl border border-mv-border/60 bg-mv-surface/30 p-3">
          <label className="block text-[9px] uppercase tracking-wider text-mv-text-dim">
            Status
            <select
              value={status}
              onChange={(e) => { setStatus(e.target.value); save({ status: e.target.value }); }}
              className="field mt-1 w-full"
            >
              {STUDIO_STATUSES.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </label>
          <label className="block text-[9px] uppercase tracking-wider text-mv-text-dim">
            Synopsis
            <textarea
              value={synopsis}
              onChange={(e) => setSynopsis(e.target.value)}
              onBlur={() => synopsis !== (title.synopsis ?? '') && save({ synopsis })}
              rows={6}
              className="field mt-1 w-full resize-none"
            />
          </label>
          <div>
            <span className="text-[9px] uppercase tracking-wider text-mv-text-dim">Genres</span>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {GENRES.map((g) => (
                <button
                  key={g}
                  onClick={() => { const next = toggleGenre(g); save({ genres: next }); }}
                  className={cn(
                    'rounded-full px-2.5 py-1 text-[9px] transition-colors',
                    genres.includes(g)
                      ? 'bg-mv-accent/20 text-mv-accent border border-mv-accent/40'
                      : 'bg-mv-surface text-mv-text-secondary border border-mv-border hover:text-mv-text',
                  )}
                >
                  {g.replace(/_/g, ' ')}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div>
        <p className="mb-2 text-[9px] font-semibold uppercase tracking-wider text-mv-text-muted">Cover</p>
        <div className="flex items-center gap-3 rounded-xl border border-mv-border/60 bg-mv-surface/30 p-3">
          {title.coverUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={title.coverUrl} alt="" className="h-20 w-14 shrink-0 rounded-md object-cover" />
          ) : (
            <span className="flex h-20 w-14 shrink-0 items-center justify-center rounded-md bg-mv-surface text-2xl">📖</span>
          )}
          <div className="min-w-0 flex-1 space-y-1.5">
            <label className="btn-ghost cursor-pointer px-3 py-1.5 text-[10px]">
              {coverUpload.isPending ? 'Uploading…' : 'Replace cover'}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  try {
                    const res = await coverUpload.mutateAsync({ file: f, folder: 'covers', type: 'cover', name: `cover-${title.id.slice(0, 8)}` });
                    await save({ coverUrl: res.url });
                  } catch { /* surfaced */ }
                }}
              />
            </label>
            <p className="text-[9px] text-mv-text-dim">Upload a new cover image, or edit the URL in the CMS.</p>
          </div>
        </div>
      </div>

      {saved && <p className="animate-fade-in text-[10px] text-green-400">✓ Saved</p>}
    </div>
  );
}

/* ─── Chapter manager ────────────────────────────────── */

function ChapterManager({ titleId }: { titleId: string }) {
  const { data: chapters, isLoading } = useStudioChapters(titleId);
  const create = useStudioCreateChapter();
  const del = useStudioDeleteChapter();
  const reorder = useStudioReorderChapters();
  const update = useStudioUpdateChapter();
  const upload = useStudioUpload();

  const [mode, setMode] = useState<'upload' | 'prose' | 'link'>('upload');
  const [number, setNumber] = useState('');
  const [chTitle, setChTitle] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [prose, setProse] = useState('');
  const [pageUrls, setPageUrls] = useState<string[]>([]);
  const [coinLocked, setCoinLocked] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const nextNumber = useMemo(() => {
    if (!chapters?.length) return 1;
    return Math.max(...chapters.map((c) => c.number), 0) + 1;
  }, [chapters]);

  useEffect(() => { if (!number) setNumber(String(nextNumber)); }, [nextNumber, number]);

  const handleFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploading(true);
    setError(null);
    try {
      const urls: string[] = [];
      for (const f of Array.from(files)) {
        const res = await upload.mutateAsync({ file: f, folder: `chapters/${titleId.slice(0, 8)}`, name: `page-${Date.now()}-${urls.length + 1}` });
        urls.push(res.url);
      }
      setPageUrls((prev) => [...prev, ...urls]);
    } catch {
      setError('One or more page uploads failed');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const submit = async () => {
    const num = parseFloat(number);
    if (Number.isNaN(num) || num < 0) { setError('Chapter number is required'); return; }
    if (mode === 'upload' && pageUrls.length === 0) { setError('Upload at least one page image'); return; }
    if (mode === 'prose' && !prose.trim()) { setError('Prose content is required'); return; }
    if (mode === 'link' && !sourceUrl.trim()) { setError('Source URL is required'); return; }
    setError(null);

    const chapter: Record<string, unknown> = {
      number: num,
      title: chTitle.trim() || null,
      coinLocked,
    };
    if (mode === 'upload') chapter.pageUrls = pageUrls;
    if (mode === 'prose') chapter.contentText = prose;
    if (mode === 'link') chapter.sourceUrl = sourceUrl.trim();

    try {
      await create.mutateAsync({ titleId, chapter });
      setChTitle(''); setProse(''); setSourceUrl(''); setPageUrls([]); setCoinLocked(false);
      setNumber(String(num + 1));
    } catch (err) {
      setError((err as { message?: string })?.message ?? 'Could not create chapter');
    }
  };

  const move = (index: number, dir: -1 | 1) => {
    if (!chapters) return;
    const target = index + dir;
    if (target < 0 || target >= chapters.length) return;
    const next = [...chapters];
    const a = next[index];
    next[index] = next[target];
    next[target] = a;
    reorder.mutate({ titleId, order: next.map((c, i) => ({ id: c.id, number: i + 1 })) });
  };

  return (
    <div className="space-y-4">
      <div>
        <p className="mb-2 text-[9px] font-semibold uppercase tracking-wider text-mv-text-muted">
          Chapters ({chapters?.length ?? 0})
        </p>

        {/* Chapter list */}
        {isLoading ? (
          <div className="flex justify-center py-8"><Spinner size={18} /></div>
        ) : !chapters || chapters.length === 0 ? (
          <p className="rounded-xl border border-dashed border-mv-border bg-mv-surface/20 p-6 text-center text-[10px] text-mv-text-dim">
            No chapters yet — add the first one below.
          </p>
        ) : (
          <div className="space-y-1.5">
            {chapters.map((c, i) => (
              <ChapterRow
                key={c.id}
                chapter={c}
                index={i}
                total={chapters.length}
                onMove={move}
                onDelete={async () => {
                  if (confirm(`Delete chapter ${c.number}?`)) {
                    try { await del.mutateAsync({ id: c.id, titleId }); } catch { /* surfaced */ }
                  }
                }}
                onToggleLock={() => update.mutate({ id: c.id, titleId, patch: { coinLocked: !c.coinLocked } })}
              />
            ))}
          </div>
        )}
      </div>

      {/* Add chapter */}
      <div className="rounded-xl border border-mv-border/60 bg-mv-surface/30 p-3">
        <p className="mb-3 text-[9px] font-semibold uppercase tracking-wider text-mv-accent">Add chapter</p>

        <div className="grid grid-cols-2 gap-3">
          <label className="text-[9px] uppercase tracking-wider text-mv-text-dim">
            Number
            <input type="number" step="0.5" min={0} value={number} onChange={(e) => setNumber(e.target.value)} className="field mt-1 w-full" />
          </label>
          <label className="text-[9px] uppercase tracking-wider text-mv-text-dim">
            Title (optional)
            <input value={chTitle} onChange={(e) => setChTitle(e.target.value)} placeholder="The Awakening" className="field mt-1 w-full" />
          </label>
        </div>

        {/* Content mode */}
        <div className="mt-3 flex gap-1 rounded-lg border border-mv-border bg-mv-surface p-1">
          {([
            ['upload', '🖼️ Pages'],
            ['prose', '📝 Prose'],
            ['link', '🔗 Source link'],
          ] as const).map(([m, label]) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={cn(
                'flex-1 rounded-md px-2 py-1.5 text-[9px] transition-colors',
                mode === m ? 'bg-mv-accent/20 text-mv-accent' : 'text-mv-text-secondary hover:text-mv-text',
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {mode === 'upload' && (
          <div className="mt-3">
            <label
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); handleFiles(e.dataTransfer.files); }}
              className="flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-mv-violet/40 bg-mv-surface/40 py-6 text-center transition-colors hover:border-mv-accent/60 hover:bg-mv-surface/70"
            >
              <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => handleFiles(e.target.files)} />
              <span className="text-lg">{uploading ? '⏳' : '🖼️'}</span>
              <span className="text-[10px] font-medium text-mv-text-secondary">
                {uploading ? 'Uploading pages…' : 'Drop page images here or click to browse'}
              </span>
              <span className="text-[9px] text-mv-text-dim">PNG / JPG / WebP · multiple files allowed</span>
            </label>
            {pageUrls.length > 0 && (
              <div className="mt-2.5">
                <div className="flex flex-wrap gap-2">
                  {pageUrls.map((u, i) => (
                    <div key={u} className="group relative">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={u} alt={`Page ${i + 1}`} className="h-20 w-14 rounded-md border border-mv-border object-cover" />
                      <button
                        onClick={() => setPageUrls((prev) => prev.filter((x) => x !== u))}
                        className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500/90 text-[8px] text-white opacity-0 transition-opacity group-hover:opacity-100"
                        aria-label="Remove page"
                      >
                        ✕
                      </button>
                      <span className="absolute bottom-0.5 right-1 text-[8px] font-bold text-white drop-shadow">{i + 1}</span>
                    </div>
                  ))}
                </div>
                <p className="mt-1.5 text-[9px] text-mv-text-dim">{pageUrls.length} page{pageUrls.length === 1 ? '' : 's'} staged</p>
              </div>
            )}
          </div>
        )}

        {mode === 'prose' && (
          <textarea
            value={prose}
            onChange={(e) => setProse(e.target.value)}
            rows={6}
            placeholder="Paste the chapter's prose here… (light novels & novels)"
            className="field mt-3 w-full resize-none"
          />
        )}

        {mode === 'link' && (
          <div className="mt-3">
            <input
              value={sourceUrl}
              onChange={(e) => setSourceUrl(e.target.value)}
              placeholder="https://mangadex.org/chapter/… — pages stream from the source"
              className="field w-full"
            />
          </div>
        )}

        <label className="mt-3 flex items-center gap-2 text-[9px] text-mv-text-secondary">
          <input type="checkbox" checked={coinLocked} onChange={(e) => setCoinLocked(e.target.checked)} className="h-3.5 w-3.5 accent-mv-accent" />
          Coin-locked chapter (readers spend coins to unlock)
        </label>

        {error && <p className="mt-2 text-[10px] text-red-400">{error}</p>}
        <div className="mt-3">
          <Button onClick={submit} loading={create.isPending || uploading} size="sm">
            <Icon name="plus" size={13} /> Add chapter {number ? `Ch. ${number}` : ''}
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ─── Chapter row ────────────────────────────────────── */

function ChapterRow({
  chapter,
  index,
  total,
  onMove,
  onDelete,
  onToggleLock,
}: {
  chapter: StudioChapter;
  index: number;
  total: number;
  onMove: (index: number, dir: -1 | 1) => void;
  onDelete: () => void;
  onToggleLock: () => void;
}) {
  const pageCount = chapter.pageUrls.length > 0 ? chapter.pageUrls.length : chapter.pageCount;
  return (
    <div className="flex items-center gap-2 rounded-xl border border-mv-border/60 bg-mv-surface/30 px-3 py-2">
      <span className="flex w-8 shrink-0 justify-center text-[11px] font-semibold text-mv-text">{chapter.number}</span>
      <span className="min-w-0 flex-1 truncate text-[10px] text-mv-text-secondary">
        {chapter.title || 'Untitled chapter'}
      </span>
      <span className="shrink-0 text-[9px] text-mv-text-dim">
        {chapter.pageUrls.length > 0
          ? `${chapter.pageUrls.length} pages · uploaded`
          : chapter.pageCount
            ? `${chapter.pageCount} pages`
            : '—'}
      </span>
      {chapter.coinLocked && (
        <span className="shrink-0" title="Coin-locked">
          <Icon name="lock" size={11} className="text-mv-gold" />
        </span>
      )}
      <div className="flex shrink-0 items-center gap-0.5">
        <button onClick={() => onMove(index, -1)} disabled={index === 0} className="rounded-md p-1 text-mv-text-dim hover:bg-white/5 hover:text-mv-text disabled:opacity-30" aria-label="Move up">
          <Icon name="chevronUp" size={12} />
        </button>
        <button onClick={() => onMove(index, 1)} disabled={index === total - 1} className="rounded-md p-1 text-mv-text-dim hover:bg-white/5 hover:text-mv-text disabled:opacity-30" aria-label="Move down">
          <Icon name="chevronDown" size={12} />
        </button>
        <button onClick={onToggleLock} className={cn('rounded-md p-1 hover:bg-white/5', chapter.coinLocked ? 'text-mv-gold' : 'text-mv-text-dim hover:text-mv-gold')} title={chapter.coinLocked ? 'Make free' : 'Coin-lock'} aria-label="Toggle lock">
          <Icon name="lock" size={12} />
        </button>
        <button onClick={onDelete} className="rounded-md p-1 text-mv-text-dim hover:bg-red-500/10 hover:text-red-400" aria-label="Delete chapter">
          <Icon name="trash" size={12} />
        </button>
      </div>
    </div>
  );
}
