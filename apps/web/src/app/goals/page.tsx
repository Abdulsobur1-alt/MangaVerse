'use client';

import { useEffect, useRef, useState } from 'react';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { AppShell } from '@/components/AppShell';
import Link from 'next/link';
import { Icon } from '@/components/ui/Icon';
import {
  useGoals,
  useCreateGoal,
  useUpdateGoal,
  useDeleteGoal,
  GOAL_TYPE_META,
  type GoalType,
  type GoalItem,
} from '@/lib/hooks/useGoals';
import { useAuthStore } from '@/store/authStore';
import { cn } from '@/lib/cn';

/* ═══════════════════════════════════════════════════════════════
   Reading Goals — personal targets that make progress visible.
   • Active goals: progress bars, done states, archive/delete
   • Quick-start suggestions (one-tap prefilled goals)
   • Archived section keeps your history of goals
   Progress is computed server-side from reading data (§16).
   ═══════════════════════════════════════════════════════════════ */

const QUICK_STARTS: { title: string; type: GoalType; target: number }[] = [
  { title: 'Read 20 chapters this week', type: 'chapters_week', target: 20 },
  { title: 'Complete 5 series', type: 'series_completed', target: 5 },
  { title: 'Read 30 days in a row', type: 'streak_days', target: 30 },
  { title: 'Read 100 chapters total', type: 'chapters_total', target: 100 },
];

function GoalCard({ goal, onArchive, onDelete, busy }: { goal: GoalItem; onArchive: () => void; onDelete: () => void; busy: boolean }) {
  const meta = GOAL_TYPE_META[goal.type];
  return (
    <div className={cn('rounded-2xl border bg-mv-darker p-5 transition-all duration-300', goal.done ? 'border-mv-success/40' : 'border-mv-border hover:border-mv-violet/30')}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-white">{goal.title}</p>
          <p className="mt-0.5 text-[10px] text-mv-text-muted">
            {meta.label} · {meta.hint}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button onClick={onArchive} disabled={busy} aria-label={goal.active ? 'Archive goal' : 'Reactivate goal'} className="rounded-lg p-1.5 text-mv-text-dim transition-colors hover:bg-white/5 hover:text-mv-violet disabled:opacity-40">
            <Icon name={goal.active ? 'pause' : 'play'} size={13} />
          </button>
          <button onClick={onDelete} disabled={busy} aria-label="Delete goal" className="rounded-lg p-1.5 text-mv-text-dim transition-colors hover:bg-mv-danger/10 hover:text-mv-danger disabled:opacity-40">
            <Icon name="trash" size={13} />
          </button>
        </div>
      </div>

      {/* Progress */}
      <div className="mt-4">
        <div className="mb-1.5 flex items-baseline justify-between">
          <p className={cn('text-xl font-bold tracking-tight', goal.done ? 'text-mv-success' : 'text-white')}>
            {goal.current.toLocaleString()}
            <span className="text-xs font-medium text-mv-text-dim"> / {goal.target.toLocaleString()} {meta.unit}</span>
          </p>
          <span className={cn('rounded-full px-2 py-0.5 text-[9px] font-semibold', goal.done ? 'bg-mv-success/15 text-mv-success' : goal.progress >= 50 ? 'bg-mv-violet/15 text-mv-violet' : 'bg-white/5 text-mv-text-dim')}>
            {goal.done ? 'Done 🎉' : `${goal.progress}%`}
          </span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-mv-surface">
          <div
            className={cn('h-full rounded-full transition-all duration-700', goal.done ? 'bg-mv-success' : 'bg-gradient-to-r from-mv-purple to-mv-accent')}
            style={{ width: `${Math.max(goal.done ? 100 : goal.progress, goal.progress > 0 ? 3 : 0)}%` }}
          />
        </div>
      </div>
    </div>
  );
}

export default function GoalsPage() {
  const { token } = useAuthStore();
  const { data: goals, isLoading } = useGoals(!!token);
  const create = useCreateGoal();
  const update = useUpdateGoal();
  const remove = useDeleteGoal();

  // ── Create dialog state ──
  const [open, setOpen] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const [title, setTitle] = useState('');
  const [type, setType] = useState<GoalType>('chapters_week');
  const [target, setTarget] = useState('10');
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    const onDown = (e: MouseEvent | TouchEvent) => {
      if (!dialogRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('touchstart', onDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('touchstart', onDown);
    };
  }, [open]);

  const activeGoals = (goals ?? []).filter((g) => g.active);
  const archived = (goals ?? []).filter((g) => !g.active);

  const openCreate = (prefill?: { title: string; type: GoalType; target: number }) => {
    setTitle(prefill?.title ?? '');
    setType(prefill?.type ?? 'chapters_week');
    setTarget(prefill ? String(prefill.target) : '10');
    setOpen(true);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const t = Number(target);
    if (!title.trim() || !Number.isFinite(t) || t <= 0 || create.isPending) return;
    try {
      await create.mutateAsync({ title: title.trim(), type, target: Math.round(t) });
      setOpen(false);
    } catch {
      // surfaced by hooks
    }
  };

  const toggleActive = async (id: string, currentlyActive: boolean) => {
    setBusyId(id);
    try {
      await update.mutateAsync({ id, active: !currentlyActive });
    } catch {
      // surfaced by hooks
    }
    setBusyId(null);
  };

  const handleDelete = async (id: string) => {
    setBusyId(id);
    try {
      await remove.mutateAsync(id);
    } catch {
      // surfaced by hooks
    }
    setBusyId(null);
  };

  return (
    <ProtectedRoute>
      <AppShell>
        <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 md:px-8 md:py-8">
          <header className="mb-8 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="eyebrow mb-2">Make it visible</p>
              <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl md:text-4xl">
                Reading <span className="text-gradient">Goals</span>
              </h1>
              <p className="mt-1.5 text-xs text-mv-text-muted">
                Small targets, real momentum. Progress updates automatically from your reading.
              </p>
            </div>
            <button onClick={() => openCreate()} className="btn-primary flex items-center gap-2 px-5 py-2.5 text-xs">
              <Icon name="plus" size={14} />
              New Goal
            </button>
          </header>

          {/* ─── Quick starts (only when no active goals) ── */}
          {!isLoading && activeGoals.length === 0 && (
            <div className="mb-8">
              <p className="mb-2.5 text-[10px] font-semibold uppercase tracking-wider text-mv-text-muted">Start with a classic</p>
              <div className="flex flex-wrap gap-2">
                {QUICK_STARTS.map((q) => (
                  <button
                    key={q.title}
                    onClick={() => openCreate(q)}
                    className="group flex items-center gap-2 rounded-full border border-mv-border-light bg-mv-surface/60 px-3.5 py-2 text-[11px] font-medium text-mv-text-secondary transition-all hover:border-mv-violet/40 hover:text-mv-violet"
                  >
                    <Icon name="zap" size={12} className="text-mv-violet opacity-70 transition-opacity group-hover:opacity-100" />
                    {q.title}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ─── Loading ─────────────────────────────── */}
          {isLoading ? (
            <div className="grid gap-4 md:grid-cols-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="skeleton h-36 rounded-2xl" />
              ))}
            </div>
          ) : !goals || goals.length === 0 ? (
            <div className="card flex flex-col items-center rounded-3xl px-6 py-16 text-center">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-mv-purple/20 to-mv-accent/10">
                <Icon name="zap" size={24} className="text-mv-violet" />
              </div>
              <p className="text-sm font-medium text-mv-text">No goals yet</p>
              <p className="mt-1 max-w-sm text-xs text-mv-text-muted">
                Set a target — chapters this week, series finished, a streak to hold. We'll track it for you.
              </p>
              <button onClick={() => openCreate(QUICK_STARTS[0])} className="btn-primary mt-6 px-5 py-2.5 text-xs">
                <Icon name="plus" size={13} className="mr-1.5 inline" />
                Create your first goal
              </button>
            </div>
          ) : (
            <>
              {/* ─── Active goals ─────────────────────── */}
              {activeGoals.length > 0 && (
                <section aria-label="Active goals">
                  <p className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-mv-text-muted">Active</p>
                  <div className="grid gap-4 md:grid-cols-2">
                    {activeGoals.map((g) => (
                      <GoalCard key={g.id} goal={g} busy={busyId === g.id} onArchive={() => toggleActive(g.id, true)} onDelete={() => handleDelete(g.id)} />
                    ))}
                  </div>
                </section>
              )}

              {/* ─── Archived goals ───────────────────── */}
              {archived.length > 0 && (
                <section aria-label="Archived goals" className="mt-10">
                  <p className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-mv-text-muted">Archived</p>
                  <div className="grid gap-4 opacity-70 md:grid-cols-2">
                    {archived.map((g) => (
                      <GoalCard key={g.id} goal={g} busy={busyId === g.id} onArchive={() => toggleActive(g.id, false)} onDelete={() => handleDelete(g.id)} />
                    ))}
                  </div>
                </section>
              )}

              {/* ─── Links ────────────────────────────── */}
              <div className="mt-10 flex flex-wrap items-center gap-4 rounded-2xl border border-mv-border bg-mv-darker/60 px-5 py-4">
                <p className="text-[11px] text-mv-text-muted">
                  Goals reset automatically — weekly goals roll every Monday, daily goals every midnight (UTC).
                </p>
                <Link href="/library" className="ml-auto flex items-center gap-1.5 text-[11px] font-medium text-mv-violet transition-colors hover:brightness-125">
                  Back to library <Icon name="arrowRight" size={12} />
                </Link>
              </div>
            </>
          )}
        </div>

        {/* ─── Create dialog ─────────────────────────── */}
        {open && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="goal-dialog-title">
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
            <div ref={dialogRef} className="relative max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto rounded-3xl border border-mv-violet/25 bg-mv-darker p-7 shadow-modal animate-scale-in">
              <div className="mb-5 flex items-start justify-between">
                <div>
                  <p className="eyebrow mb-1">New goal</p>
                  <h2 id="goal-dialog-title" className="text-lg font-bold text-white">Set a target</h2>
                </div>
                <button onClick={() => setOpen(false)} aria-label="Close dialog" className="rounded-lg p-1.5 text-mv-text-dim transition-colors hover:bg-white/5 hover:text-white">
                  <Icon name="close" size={16} />
                </button>
              </div>

              <form onSubmit={submit} className="space-y-4">
                <div>
                  <label htmlFor="goal-title" className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-mv-text-muted">Title</label>
                  <input id="goal-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} autoFocus placeholder='e.g. "Read 20 chapters this week"' className="field w-full" />
                </div>
                <div>
                  <label htmlFor="goal-type" className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-mv-text-muted">Type</label>
                  <select id="goal-type" value={type} onChange={(e) => setType(e.target.value as GoalType)} className="field w-full">
                    {(Object.keys(GOAL_TYPE_META) as GoalType[]).map((t) => (
                      <option key={t} value={t} className="bg-mv-darker">{GOAL_TYPE_META[t].label}</option>
                    ))}
                  </select>
                  <p className="mt-1.5 text-[9px] text-mv-text-dim">{GOAL_TYPE_META[type].hint}</p>
                </div>
                <div>
                  <label htmlFor="goal-target" className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-mv-text-muted">
                    Target ({GOAL_TYPE_META[type].unit})
                  </label>
                  <input
                    id="goal-target"
                    type="number"
                    min={1}
                    max={1000000}
                    value={target}
                    onChange={(e) => setTarget(e.target.value)}
                    className="field w-full"
                  />
                </div>
                <div className="flex items-center justify-end gap-2 pt-2">
                  <button type="button" onClick={() => setOpen(false)} className="btn-ghost px-4 py-2.5 text-xs">Cancel</button>
                  <button type="submit" disabled={!title.trim() || !Number(target) || create.isPending} className="btn-primary px-5 py-2.5 text-xs disabled:opacity-50">
                    {create.isPending ? 'Creating…' : 'Create goal'}
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
