'use client';

import Link from 'next/link';
import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAnnouncements, useDismissAnnouncement, type Announcement } from '@/lib/hooks/useAnnouncements';
import { useRealtime, type RealtimeEvent } from '@/lib/realtime';
import { Icon } from '@/components/ui/Icon';
import { cn } from '@/lib/cn';

/* ═══════════════════════════════════════════════════════════════
   AnnouncementBanner — dismissible in-app banners for product
   updates, maintenance, events and seasonal themes. Lives at the top
   of the content column; refreshes live when a new announcement is
   broadcast. Never more than two stacked.
   ═══════════════════════════════════════════════════════════════ */

const VARIANT_STYLES: Record<Announcement['variant'], { bar: string; chip: string; emoji: string }> = {
  info: { bar: 'border-mv-violet/30 bg-gradient-to-r from-mv-violet/15 to-transparent', chip: 'bg-mv-violet/20 text-mv-violet', emoji: '💡' },
  success: { bar: 'border-emerald-500/30 bg-gradient-to-r from-emerald-500/15 to-transparent', chip: 'bg-emerald-500/20 text-emerald-400', emoji: '🎉' },
  warning: { bar: 'border-amber-500/30 bg-gradient-to-r from-amber-500/15 to-transparent', chip: 'bg-amber-500/20 text-amber-400', emoji: '⚠️' },
  seasonal: { bar: 'border-pink-500/30 bg-gradient-to-r from-pink-500/15 via-mv-accent/10 to-transparent', chip: 'bg-pink-500/20 text-pink-400', emoji: '🎐' },
  maintenance: { bar: 'border-slate-500/30 bg-gradient-to-r from-slate-500/15 to-transparent', chip: 'bg-slate-500/20 text-slate-300', emoji: '🛠️' },
};

function Banner({ announcement }: { announcement: Announcement }) {
  const dismiss = useDismissAnnouncement();
  const style = VARIANT_STYLES[announcement.variant] ?? VARIANT_STYLES.info;

  const content = (
    <div className={cn('flex items-center gap-3 rounded-xl border px-4 py-2.5', style.bar)}>
      <span className={cn('flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-xs', style.chip)}>
        {style.emoji}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[11px] font-medium text-mv-text">{announcement.title}</p>
        {announcement.body && <p className="truncate text-[10px] text-mv-text-muted">{announcement.body}</p>}
      </div>
      {announcement.link && (
        <span className="shrink-0 text-[10px] font-medium text-mv-violet">Learn more →</span>
      )}
    </div>
  );

  return (
    <div className="group relative">
      {announcement.link ? (
        <Link href={announcement.link} className="block">{content}</Link>
      ) : (
        content
      )}
      {announcement.dismissible && (
        <button
          onClick={() => dismiss.mutate(announcement.id)}
          aria-label={`Dismiss announcement: ${announcement.title}`}
          className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full border border-mv-border-light bg-mv-darker text-mv-text-dim opacity-0 transition-opacity hover:text-white group-hover:opacity-100"
        >
          <Icon name="close" size={10} />
        </button>
      )}
    </div>
  );
}

export function AnnouncementBanner() {
  const { data: announcements, isLoading } = useAnnouncements();
  const queryClient = useQueryClient();

  // Live: a newly broadcast announcement appears without a reload.
  // useCallback keeps the listener identity stable so useRealtime doesn't
  // re-subscribe on every render.
  const onRealtime = useCallback(
    (event: RealtimeEvent) => {
      if (event.type === 'announcement:new') {
        queryClient.invalidateQueries({ queryKey: ['announcements'] });
      }
    },
    [queryClient],
  );
  useRealtime(onRealtime);

  if (isLoading || !announcements || announcements.length === 0) return null;

  return (
    <div className="sticky top-[56px] z-40 mx-auto flex max-w-5xl flex-col gap-2 px-4 pt-3 md:px-8">
      {announcements.slice(0, 2).map((a) => (
        <Banner key={a.id} announcement={a} />
      ))}
    </div>
  );
}
