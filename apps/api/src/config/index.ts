export const config = {
  // Explicit opt-in for development auth flows (dev_ tokens, /auth/register).
  // Must NEVER be enabled in production — it bypasses auth verification.
  devAuth: process.env.DEV_AUTH === '1' || process.env.NODE_ENV === 'development',

  // MangaDex API
  mangadex: {
    baseUrl: 'https://api.mangadex.org',
    coverUrl: 'https://uploads.mangadex.org/covers',
    rateLimit: 5, // requests per second
  },

  // Scraper settings
  scraper: {
    refreshIntervalMs: 30 * 60 * 1000, // 30 min
    maxRetries: 3,
    requestTimeout: 10_000,
  },

  // Meilisearch
  meilisearch: {
    host: process.env.MEILISEARCH_HOST || 'http://localhost:7700',
    apiKey: process.env.MEILISEARCH_API_KEY || '',
    indexName: 'titles',
  },

  // Image proxy
  imageProxy: {
    baseUrl: process.env.IMAGE_PROXY_URL || '/api/proxy/image',
  },

  // Supabase Auth — production sign-in (GoTrue). The API only verifies
  // access-token JWTs against the project's JWKS, so the URL is what
  // matters here; the anon key powers the web/mobile client signups.
  supabase: {
    // Plain project URL (https://<ref>.supabase.co). The dashboard's "API
    // URL" field includes /rest/v1 — normalize it away so a copy-paste can't
    // break JWT verification (JWKS + issuer would point at /rest/v1/auth/v1).
    url: (process.env.SUPABASE_URL || '')
      .replace(/\/rest\/v1\/?$/, '')
      .replace(/\/+$/, ''),
    anonKey: process.env.SUPABASE_ANON_KEY || '',
  },

  // BullMQ
  bullmq: {
    prefix: 'mangaverse',
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 },
      removeOnComplete: 100,
      removeOnFail: 50,
    },
  },
} as const;
