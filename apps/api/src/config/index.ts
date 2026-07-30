export const config = {
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
