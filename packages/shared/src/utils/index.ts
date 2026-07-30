import type { ContentFormat } from '../types';

/**
 * Formats a chapter number with optional leading zeros.
 * e.g., 1 → "Ch. 1", 198 → "Ch. 198"
 */
export function formatChapterNumber(num: number): string {
  return `Ch. ${num}`;
}

/**
 * Formats a volume number.
 */
export function formatVolumeNumber(num: number): string {
  return `Vol. ${num}`;
}

/**
 * Returns a human-readable label for content format.
 */
export function formatLabel(type: ContentFormat): string {
  const labels: Record<ContentFormat, string> = {
    manga: 'Manga',
    manhwa: 'Manhwa',
    manhua: 'Manhua',
    light_novel: 'Light Novel',
    webtoon: 'Webtoon',
  };
  return labels[type] ?? 'Manga';
}

/**
 * Generates a slug from a title string.
 */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
}

/**
 * Returns a relative time string (e.g., "2h ago", "3d ago").
 */
export function timeAgo(date: string | Date): string {
  const now = Date.now();
  const then = new Date(date).getTime();
  const seconds = Math.floor((now - then) / 1000);

  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  const years = Math.floor(months / 12);
  return `${years}y ago`;
}

/**
 * Formats a number with compact notation (e.g., 1240 → "1.2K").
 */
export function compactNumber(num: number): string {
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
  return num.toString();
}

/**
 * Clamp a value between min and max.
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Calculate reading progress percentage.
 */
export function progressPercentage(current: number, total: number): number {
  if (total === 0) return 0;
  return clamp(Math.round((current / total) * 100), 0, 100);
}
