import type { MetadataRoute } from 'next';

// Rebuild at most hourly — the API (Render free tier) can cold-start, so the
// sitemap is cached and crawlers never pay that latency per request.
export const revalidate = 3600;

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://mangaverse-web.onrender.com';
const API_URL = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api').replace(/\/$/, '');

// Public pages only — auth-gated routes (library, notifications, bookmarks,
// history, settings, goals, wrapped) are excluded: crawlers can't use them
// and they invite login-walled indexing.
const STATIC_ROUTES = [
  '', '/browse', '/community', '/collections', '/lists', '/reviews',
  '/activity', '/download', '/login', '/signup',
];

interface TitleItem {
  slug: string;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entries: MetadataRoute.Sitemap = STATIC_ROUTES.map((route) => ({
    url: `${SITE_URL}${route}`,
    changeFrequency: route === '' ? 'daily' : 'weekly',
    priority: route === '' ? 1 : 0.6,
  }));

  // Most-saved titles (valid sort value for /api/titles; the route accepts
  // trending|newest|updated|rating|title|bookmarks). Best-effort: if the API
  // is cold/unreachable, serve the static map rather than failing the sitemap.
  try {
    // Default fetch caching — the route-level `revalidate = 3600` refreshes
    // both the rendered sitemap and this cached API response hourly.
    const res = await fetch(`${API_URL}/titles?limit=100&sort=bookmarks`, {
      headers: { Accept: 'application/json' },
    });
    if (res.ok) {
      const json = (await res.json()) as { data?: { items?: TitleItem[] } };
      for (const t of json.data?.items ?? []) {
        if (t?.slug) {
          entries.push({ url: `${SITE_URL}/title/${t.slug}`, changeFrequency: 'daily', priority: 0.8 });
        }
      }
    }
  } catch {
    // API unreachable — static-only sitemap is fine.
  }

  return entries;
}
