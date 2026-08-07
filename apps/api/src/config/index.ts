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
    // Server-side key used ONLY by the API to write files into Supabase
    // Storage (Studio uploads). Never expose this to the browser.
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
    // Storage bucket for uploaded covers, banners and chapter pages.
    storageBucket: process.env.SUPABASE_STORAGE_BUCKET || 'mangaverse',
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

// ─── Boot-time environment warnings ─────────────────────
// The API degrades gracefully when optional services are missing, which
// hides misconfiguration (the classic case: a wrong DATABASE_URL boots fine
// but 500s every data route). Production-only warnings make the failure
// visible in the first log lines instead of after the first user hits it.
function warnOnMissingEnv(): void {
  if (process.env.NODE_ENV !== 'production') return;

  const checks: Array<[string, string]> = [
    ['DATABASE_URL', 'every data route will 500 — use the Supabase Session pooler URI (port 5432, aws-0-<region>.pooler.supabase.com)'],
    ['REDIS_URL', 'queues/scraper are disabled and the database stays empty'],
    ['SUPABASE_URL', 'auth falls back to dev mode (dev_ tokens) — never for production'],
    ['SUPABASE_ANON_KEY', 'Supabase auth is configured but the anon key is missing'],
    ['VAPID_PUBLIC_KEY', 'web push is disabled'],
    ['VAPID_PRIVATE_KEY', 'web push is disabled'],
    ['CORS_ORIGIN', 'CORS reflects the request origin — set it explicitly before going public'],
  ];

  for (const [key, hint] of checks) {
    if (!process.env[key]) {
      console.warn(`⚠️  Missing env var ${key} — ${hint}.`);
    }
  }
}

warnOnMissingEnv();
