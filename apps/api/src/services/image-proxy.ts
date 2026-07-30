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
 */
function needsProxy(url: string): boolean {
  try {
    const hostname = new URL(url).hostname;
    return PROXIED_HOSTS.some((host) => hostname.includes(host));
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

      // Fetch the image from the source
      const response = await fetch(imageUrl, {
        headers: {
          Referer: 'https://mangaverse.app/',
          'User-Agent': 'MangaVerse/0.1.0',
        },
      });

      if (!response.ok) {
        return res.status(response.status).json({ error: 'Failed to fetch image' });
      }

      // Stream the image with proper headers
      const buffer = await response.arrayBuffer();
      const contentType = response.headers.get('content-type') || 'image/jpeg';

      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'public, max-age=86400');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.send(Buffer.from(buffer));
    } catch (err) {
      next(err);
    }
  };
}
