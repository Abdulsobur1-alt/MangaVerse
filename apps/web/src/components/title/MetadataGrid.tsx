'use client';

import Link from 'next/link';
import { Icon } from '@/components/ui/Icon';
import { formatTimeAgo } from '@/lib/format';
import type { TitleDetail } from '@/lib/hooks/useTitles';
import type { IconName } from '@/components/ui/Icon';
import { cn } from '@/lib/cn';

/* ═══════════════════════════════════════════════════════════════
   MetadataGrid — the details sidebar, rebuilt as elegant cards.
   No tables: each datum is a glass chip with an icon + label.
   Fields the catalog doesn't carry (publisher, age rating, …) render
   a graceful “not listed” chip so the UI stays honest and complete.
   ═══════════════════════════════════════════════════════════════ */

interface MetaItem {
  icon: IconName;
  label: string;
  value: string;
  accent?: string;
  /** Link target for clickable values (e.g. author pages). */
  href?: string;
}

function NotListed() {
  return <span className="text-[10px] italic text-mv-text-dim">Not listed</span>;
}

export function MetadataGrid({ title, chaptersTotal, views }: { title: TitleDetail; chaptersTotal: number; views: number }) {
  const direction = title.type === 'manga' ? 'Right → left' : 'Top → bottom';
  // Honest schedule: the catalog has no release schedule, so we derive a
  // status-based summary rather than inventing a cadence.
  const schedule = title.status === 'completed' ? 'Finished' : title.status === 'hiatus' ? 'On hiatus' : title.status === 'cancelled' ? 'Discontinued' : 'Ongoing';

  const left: MetaItem[] = [
    { icon: 'book', label: 'Format', value: title.type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) },
    { icon: 'tag', label: 'Author', value: title.author ?? '', href: title.author ? `/author/${encodeURIComponent(title.author)}` : undefined },
    { icon: 'calendar', label: 'Release year', value: title.releaseYear ? String(title.releaseYear) : '' },
    { icon: 'clock', label: 'Updated', value: title.updatedAt ? formatTimeAgo(title.updatedAt) : '' },
    { icon: 'globe', label: 'Language', value: '' },
  ];

  const right: MetaItem[] = [
    { icon: 'bookmark', label: 'Bookmarks', value: (title._count?.bookmarks ?? 0).toLocaleString() },
    { icon: 'eye', label: 'Views', value: views.toLocaleString() },
    { icon: 'book', label: 'Chapters', value: String(chaptersTotal) },
    { icon: 'users', label: 'Reviews', value: (title._count?.reviews ?? 0).toLocaleString() },
    { icon: 'arrowPath', label: 'Schedule', value: schedule },
    { icon: 'shield', label: 'Age rating', value: '' },
  ];

  const render = (m: MetaItem) => (
    <div className="glass flex items-start gap-2.5 rounded-xl px-3 py-2.5 transition-colors hover:border-mv-violet/30">
      <Icon name={m.icon} size={14} className={cn('mt-0.5 shrink-0 text-mv-text-muted', m.accent)} />
      <div className="min-w-0">
        <p className="text-[8px] font-semibold uppercase tracking-[0.12em] text-mv-text-dim">{m.label}</p>
        {m.value ? (
          m.href ? (
            <Link
              href={m.href}
              className="mt-0.5 block truncate text-[11px] font-medium text-mv-text underline decoration-mv-violet/40 decoration-1 underline-offset-2 transition-colors hover:text-mv-violet hover:decoration-mv-violet"
            >
              {m.value}
            </Link>
          ) : (
            <p className="mt-0.5 truncate text-[11px] font-medium text-mv-text">{m.value}</p>
          )
        ) : (
          <div className="mt-0.5"><NotListed /></div>
        )}
      </div>
    </div>
  );

  return (
    <section aria-label="Details">
      <p className="eyebrow mb-3 flex items-center gap-2">
        <Icon name="info" size={12} className="text-mv-violet" />
        Details
      </p>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-2">{left.map((m) => <div key={m.label}>{render(m)}</div>)}</div>
        <div className="space-y-2">{right.map((m) => <div key={m.label}>{render(m)}</div>)}</div>
      </div>

      {/* Reading direction strip */}
      <div className="mt-3 flex items-center justify-between rounded-xl border border-mv-border bg-mv-darker px-3.5 py-2.5">
        <span className="text-[9px] text-mv-text-muted">Reading direction</span>
        <span className="flex items-center gap-1.5 text-[11px] font-medium text-mv-violet">
          {direction}
          <Icon name="chevronRight" size={12} />
        </span>
      </div>
    </section>
  );
}
