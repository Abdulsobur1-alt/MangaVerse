/**
 * Image proxy utility.
 *
 * In production, this runs as a Cloudflare Worker to:
 * 1. Proxy manga page images from source servers
 * 2. Add proper CORS headers
 * 3. Cache images at the edge (Cloudflare CDN)
 * 4. Resize/optimize images on-the-fly
 *
 * For local development, this provides the URL builder and validation.
 */

import { config } from '../config/index.js';

// Known manga image hosts that need proxying
const PROXIED_HOSTS = [
  'uploads.mangadex.org',
  'mangadex.org',
  'cdn.mangaeden.com',
  'cdn.readpanda.com',
  'img.mngadex.com',
  'scans-hot.leanbox.us',
  's2.mangacdn.net',
];

/**
 * Check if an image URL needs proxying.
 * Host matching is strict: exact host or a subdomain of an allowlisted host.
 * A bare IP literal is always rejected (blocks SSRF against private/metadata IPs).
 */
export function needsProxy(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false;
    const hostname = parsed.hostname.toLowerCase();
    if (/^\d{1,3}(\.\d{1,3}){3}$/.test(hostname)) return false;
    return PROXIED_HOSTS.some((host) => hostname === host || hostname.endsWith(`.${host}`));
  } catch {
    return false;
  }
}

/**
 * Build the proxied URL for a manga image.
 * In production, this redirects through a Cloudflare Worker.
 */
export function getProxiedImageUrl(sourceUrl: string): string {
  if (!needsProxy(sourceUrl)) {
    return sourceUrl;
  }

  // For Cloudflare Worker: construct proxy URL
  // eg: https://mangaverse.workers.dev/proxy?url=https://uploads.mangadex.org/...
  const proxyBase = config.imageProxy.baseUrl;

  // Check if we're using the local API proxy or Cloudflare Worker
  if (proxyBase.startsWith('/api/')) {
    // Local: use the API's image proxy route
    return `/api/proxy/image?url=${encodeURIComponent(sourceUrl)}`;
  }

  // Cloudflare Worker
  return `${proxyBase}?url=${encodeURIComponent(sourceUrl)}`;
}

/**
 * Extract the original URL from a proxied URL (reverse operation).
 */
export function extractOriginalUrl(proxiedUrl: string): string {
  try {
    const url = new URL(proxiedUrl, 'http://localhost');
    const original = url.searchParams.get('url');
    return original ? decodeURIComponent(original) : proxiedUrl;
  } catch {
    return proxiedUrl;
  }
}

/**
 * Color palette for generating placeholder manga pages.
 * Each page gets a unique color based on its position.
 */
const PLACEHOLDER_COLORS = [
  '#1a1a2e', '#16213e', '#0f3460', '#1a1a3e', '#2d1b69',
  '#1b3a5e', '#3d1b69', '#1b5e3d', '#5e1b3a', '#3a5e1b',
  '#1b3a2d', '#4e2d1a', '#1a2d4e', '#4e1a3a', '#2d4e1a',
];

/**
 * Generate an SVG placeholder image for a manga page.
 * This creates a colored page with chapter/page info displayed.
 */
function generatePlaceholderSvg(chapter: number, page: number, total: number): string {
  const color = PLACEHOLDER_COLORS[(chapter * 7 + page) % PLACEHOLDER_COLORS.length];
  const accentColor = '#e94560';
  const progress = Math.round((page / total) * 100);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="1200" viewBox="0 0 800 1200">
    <rect width="800" height="1200" fill="${color}"/>
    <rect x="50" y="50" width="700" height="1100" rx="4" fill="none" stroke="${accentColor}20" stroke-width="1"/>
    <text x="400" y="500" text-anchor="middle" fill="${accentColor}60" font-family="sans-serif" font-size="24" font-weight="300">Ch. ${chapter}</text>
    <text x="400" y="540" text-anchor="middle" fill="${accentColor}40" font-family="sans-serif" font-size="16" font-weight="300">Page ${page} of ${total}</text>
    <rect x="300" y="580" width="200" height="4" rx="2" fill="${accentColor}30"/>
    <rect x="300" y="580" width="${progress * 2}" height="4" rx="2" fill="${accentColor}"/>
    <line x1="200" y1="680" x2="600" y2="680" stroke="${accentColor}15" stroke-width="1"/>
    <line x1="200" y1="700" x2="550" y2="700" stroke="${accentColor}10" stroke-width="1"/>
    <line x1="200" y1="720" x2="580" y2="720" stroke="${accentColor}10" stroke-width="1"/>
    <line x1="200" y1="740" x2="500" y2="740" stroke="${accentColor}8" stroke-width="1"/>
    <line x1="200" y1="760" x2="560" y2="760" stroke="${accentColor}8" stroke-width="1"/>
    <rect x="50" y="850" width="700" height="200" rx="8" fill="${accentColor}08"/>
    <text x="400" y="920" text-anchor="middle" fill="${accentColor}30" font-family="sans-serif" font-size="12">Panel Preview</text>
    <rect x="100" y="940" width="180" height="80" rx="4" fill="${accentColor}10"/>
    <rect x="310" y="940" width="180" height="80" rx="4" fill="${accentColor}10"/>
    <rect x="520" y="940" width="180" height="80" rx="4" fill="${accentColor}10"/>
    <text x="400" y="1130" text-anchor="middle" fill="${accentColor}15" font-family="sans-serif" font-size="10">MangaVerse Reader — Placeholder Image</text>
  </svg>`;
}

/**
 * Generate the image proxy route handler for the Express API.
 * This is used locally when Cloudflare Worker is not available.
 */
export function createImageProxyHandler() {
  return async (req: any, res: any, next: any) => {
    try {
      const imageUrl = req.query.url as string;
      if (!imageUrl) {
        return res.status(400).json({ error: 'Missing url parameter' });
      }

      // Check if this is a placeholder request FIRST — it's an internal
      // relative path, so it must bypass the external-host SSRF guard below.
      if (imageUrl.includes('/api/proxy/placeholder')) {
        const url = new URL(imageUrl, 'http://localhost');
        const chapter = parseInt(url.searchParams.get('chapter') || '1', 10);
        const page = parseInt(url.searchParams.get('page') || '1', 10);
        const total = parseInt(url.searchParams.get('total') || '12', 10);

        const svg = generatePlaceholderSvg(chapter, page, total);
        res.setHeader('Content-Type', 'image/svg+xml');
        res.setHeader('Cache-Control', 'public, max-age=3600');
        res.setHeader('Access-Control-Allow-Origin', '*');
        return res.send(svg);
      }

      // SSRF guard: the requested URL must resolve to an allowlisted host.
      // Re-validate at request time — the needsProxy() checks applied when the
      // URL was built do not protect this endpoint against direct calls.
      if (!needsProxy(imageUrl)) {
        return res.status(400).json({ error: 'URL not allowed for proxying' });
      }

      // Fetch the image from the source
      const response = await fetch(imageUrl, {
        redirect: 'follow',
        headers: {
          Referer: 'https://mangaverse.app/',
          'User-Agent': 'MangaVerse/0.1.0',
        },
      });

      if (!response.ok) {
        return res.status(response.status).json({ error: 'Failed to fetch image' });
      }

      // Verify the final host after redirects is still allowlisted (blocks
      // redirect-to-internal SSRF chains).
      if (!needsProxy(response.url || imageUrl)) {
        return res.status(400).json({ error: 'URL not allowed for proxying' });
      }

      // Stream the image with proper headers
      const buffer = await response.arrayBuffer();
      if (buffer.byteLength > 10 * 1024 * 1024) {
        return res.status(413).json({ error: 'Image too large' });
      }
      const contentType = response.headers.get('content-type') || 'image/jpeg';
      if (!contentType.startsWith('image/') && contentType !== 'application/octet-stream') {
        return res.status(415).json({ error: 'Unsupported content type' });
      }

      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'public, max-age=86400');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.send(Buffer.from(buffer));
    } catch (err) {
      next(err);
    }
  };
}
