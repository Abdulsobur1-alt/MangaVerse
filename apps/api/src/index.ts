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
import { bookmarksRouter } from './routes/bookmarks.js';
import { listsRouter } from './routes/lists.js';
import { collectionsRouter } from './routes/collections.js';
import { goalsRouter } from './routes/goals.js';
import { readingRouter } from './routes/reading.js';
import { searchRouter } from './routes/search.js';
import { reviewsRouter } from './routes/reviews.js';
import { notificationsRouter } from './routes/notifications.js';
import { coinsRouter } from './routes/coins.js';
import { achievementsRouter } from './routes/achievements.js';
import { communityRouter } from './routes/community.js';
import { socialRouter } from './routes/social.js';
import { adminRouter } from './routes/admin.js';
import { pushRouter } from './routes/push.js';
import { healthRouter } from './routes/health.js';
import { createImageProxyHandler } from './services/image-proxy.js';
import { getScraperQueue, startScraperWorker } from './queues/scraper.js';
import { startPredictionsWorker } from './queues/predictions.js';
import { meilisearch } from './services/meilisearch.js';
import { prisma } from './lib/prisma.js';

const app = express();
const PORT = parseInt(process.env.PORT || '3001', 10);

// ─── Global Middleware ─────────────────────────────────

app.use(helmet());
// CORS: an explicit CORS_ORIGIN (comma-separated list) is enforced when set;
// otherwise the request origin is reflected. Never `*` with credentials:true —
// browsers reject that combination, silently breaking auth on VPS/Docker deploys.
const corsOrigins = (process.env.CORS_ORIGIN || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
app.use(cors({ origin: corsOrigins.length > 0 ? corsOrigins : true, credentials: true }));
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
app.use('/api/bookmarks', bookmarksRouter);
app.use('/api/lists', listsRouter);
app.use('/api/collections', collectionsRouter);
app.use('/api/goals', goalsRouter);
app.use('/api/reading', readingRouter);
app.use('/api/search', searchRouter);
app.use('/api/reviews', reviewsRouter);
app.use('/api/notifications', notificationsRouter);
app.use('/api/coins', coinsRouter);
app.use('/api/achievements', achievementsRouter);
app.use('/api/community', communityRouter);
app.use('/api/social', socialRouter);
app.use('/api/admin', adminRouter);
app.use('/api/push', pushRouter);

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

  // Start the scraper worker (only if Redis is available). Belt-and-braces:
  // if Redis drops in the window between the probe and Worker construction,
  // BullMQ's waitUntilReady() rejection must not crash boot — workers just
  // degrade to disabled and the API still serves.
  let worker: Awaited<ReturnType<typeof startScraperWorker>> = null;
  try {
    worker = await startScraperWorker();
  } catch (err) {
    console.warn('⚠️  Could not start scraper worker — continuing without it:', (err as Error).message);
  }
  if (worker) {
    console.log('🤖 Scraper worker started');

    // Schedule initial refresh after 30 seconds. Best-effort: a dead Redis
    // connection must NOT block server boot — the seed just won't run.
    const queue = await getScraperQueue();
    if (queue) {
      try {
        // Only seed when the DB is empty — otherwise every cold start (free
        // tier spins down idle instances) would re-enqueue the heavy
        // MangaDex sync job and hammer the external API repeatedly.
        const titleCount = await prisma.title.count();
        if (titleCount > 0) {
          console.log(`🌱 DB already has ${titleCount} titles — skipping initial seed`);
        } else {
          await queue.add('seed-database', { count: 100 }, { delay: 30_000 });
          console.log('📅 Initial content refresh scheduled (30s delay)');
        }
      } catch (err) {
        console.warn('⚠️  Could not schedule seed job — continuing without it:', (err as Error).message);
      }
    }
  }

  // Start the prediction-resolution worker (recurring job resolves due markets)
  try {
    const pWorker = await startPredictionsWorker();
    if (pWorker) {
      console.log('🔮 Predictions worker started (resolves due markets every 15m)');
    }
  } catch {
    // Redis unavailable — GET /predictions still lazily resolves due markets
  }

  app.listen(PORT, () => {
    console.log(`⚡ MangaVerse API running on http://localhost:${PORT}`);
    console.log(`   Health check: http://localhost:${PORT}/api/health`);
  });
}

start().catch(console.error);

export default app;
