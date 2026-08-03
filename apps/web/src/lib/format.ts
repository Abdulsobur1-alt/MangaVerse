/** Human-readable relative time, e.g. "2h ago", "3d ago", "Aug 3". */
export function formatTimeAgo(dateStr: string): string {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return '';
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/** Tailwind classes + label for a title's status pill/banner. */
export function statusColors(status: string): { label: string; className: string } {
  switch (status) {
    case 'ongoing':
      return { label: 'Ongoing', className: 'bg-green-500/15 text-green-400 border-green-400/30' };
    case 'completed':
      return { label: 'Completed', className: 'bg-blue-500/15 text-blue-400 border-blue-400/30' };
    case 'hiatus':
      return { label: 'Hiatus', className: 'bg-yellow-500/15 text-yellow-400 border-yellow-400/30' };
    case 'cancelled':
      return { label: 'Dropped', className: 'bg-red-500/15 text-red-400 border-red-400/30' };
    default:
      return { label: status || 'Unknown', className: 'bg-white/10 text-mv-text-secondary border-white/20' };
  }
}

/** Short format label for a title type. */
export function formatType(type?: string): string {
  switch ((type || '').toUpperCase()) {
    case 'MANHWA':
      return 'Manhwa';
    case 'MANHUA':
      return 'Manhua';
    case 'LIGHT_NOVEL':
      return 'LN';
    default:
      return 'Manga';
  }
}

/** Full display label for a title type. */
export function formatTypeFull(type?: string): string {
  switch ((type || '').toUpperCase()) {
    case 'MANHWA':
      return '🇰🇷 Manhwa';
    case 'MANHUA':
      return '🇨🇳 Manhua';
    case 'LIGHT_NOVEL':
      return '📕 Light Novel';
    default:
      return '🇯🇵 Manga';
  }
}
