import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { rateLimit } from 'express-rate-limit';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

import { errorHandler, notFoundHandler } from './middleware/error.js';
import { authRouter } from './routes/auth.js';
import { titlesRouter } from './routes/titles.js';
import { chaptersRouter } from './routes/chapters.js';
import { usersRouter } from './routes/users.js';
import { libraryRouter } from './routes/library.js';
import { readingRouter } from './routes/reading.js';
import { searchRouter } from './routes/search.js';
import { reviewsRouter } from './routes/reviews.js';
import { notificationsRouter } from './routes/notifications.js';
import { coinsRouter } from './routes/coins.js';
import { achievementsRouter } from './routes/achievements.js';
import { healthRouter } from './routes/health.js';
import { createImageProxyHandler } from './services/image-proxy.js';
import { getScraperQueue, startScraperWorker } from './queues/scraper.js';
import { meilisearch } from './services/meilisearch.js';

const app = express();
const PORT = parseInt(process.env.PORT || '3001', 10);

// ─── Global Middleware ─────────────────────────────────

app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN || '*', credentials: true }));
app.use(morgan('dev'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 60_000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: { code: 'RATE_LIMITED', message: 'Too many requests, please try again later.' } },
});
app.use(limiter);

// ─── Routes ───────────────────────────────────────────

app.use('/api/health', healthRouter);
app.use('/api/auth', authRouter);
app.use('/api/titles', titlesRouter);
app.use('/api/chapters', chaptersRouter);
app.use('/api/users', usersRouter);
app.use('/api/library', libraryRouter);
app.use('/api/reading', readingRouter);
app.use('/api/search', searchRouter);
app.use('/api/reviews', reviewsRouter);
app.use('/api/notifications', notificationsRouter);
app.use('/api/coins', coinsRouter);
app.use('/api/achievements', achievementsRouter);

// Reviews are also accessible via titles: GET/POST /api/titles/:slug/reviews
// The reviews router handles /title/:slug internally

// ─── Image Proxy ──────────────────────────────────────

app.get('/api/proxy/image', createImageProxyHandler());
// Placeholder images are served through the proxy: /api/proxy/image?url=%2Fapi%2Fproxy%2Fplaceholder%3F...
// The standalone /api/proxy/placeholder route is not registered to avoid 400 errors —
// it's handled inline by createImageProxyHandler() when imageUrl includes '/api/proxy/placeholder'.

// ─── Static Files (Downloads, APKs) ───────────────────

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
app.use('/api/download', express.static(join(__dirname, '../public')));

// ─── Error Handling ───────────────────────────────────

app.use(notFoundHandler);
app.use(errorHandler);

// ─── Start Server ─────────────────────────────────────

async function start() {
  // Initialize Meilisearch index on startup
  try {
    await meilisearch.initIndex();
  } catch {
    // Meilisearch not available — DB fallback will be used
  }

  // Start the scraper worker (only if Redis is available)
  const worker = startScraperWorker();
  if (worker) {
    console.log('🤖 Scraper worker started');

    // Schedule initial refresh after 30 seconds
    const queue = getScraperQueue();
    if (queue) {
      await queue.add('seed-database', { count: 100 }, { delay: 30_000 });
      console.log('📅 Initial content refresh scheduled (30s delay)');
    }
  }

  app.listen(PORT, () => {
    console.log(`⚡ MangaVerse API running on http://localhost:${PORT}`);
    console.log(`   Health check: http://localhost:${PORT}/api/health`);
  });
}

start().catch(console.error);

export default app;
