import { Queue, Worker } from 'bullmq';
import { Redis } from 'ioredis';
import { config } from '../config/index.js';
import { resolveDuePredictions } from '../services/predictions.js';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const QUEUE_NAME = 'mangaverse-predictions';
const RESOLVE_INTERVAL_MS = 15 * 60 * 1000; // every 15 minutes

let connection: Redis | null = null;
let predictionsQueue: Queue | null = null;

function getConnection(): Redis | null {
  if (connection?.status === 'ready') return connection;
  try {
    connection = new Redis(REDIS_URL, {
      maxRetriesPerRequest: null,
      lazyConnect: true,
    });
    return connection;
  } catch {
    return null;
  }
}

// ─── Queue ───────────────────────────────────────────

export function getPredictionsQueue(): Queue | null {
  if (predictionsQueue) return predictionsQueue;
  const conn = getConnection();
  if (!conn) {
    console.warn('⚠️  Redis not available — predictions queue disabled');
    return null;
  }
  predictionsQueue = new Queue(QUEUE_NAME, {
    connection: conn,
    defaultJobOptions: config.bullmq.defaultJobOptions,
  });
  return predictionsQueue;
}

// ─── Worker ──────────────────────────────────────────

/**
 * Start the prediction-resolution worker and schedule the recurring
 * resolve-due-predictions job.
 */
export async function startPredictionsWorker(): Promise<Worker | null> {
  const conn = getConnection();
  if (!conn) return null;

  const worker = new Worker(
    QUEUE_NAME,
    async (job) => {
      switch (job.name) {
        case 'resolve-due-predictions':
          const resolved = await resolveDuePredictions();
          if (resolved > 0) {
            console.log(`🔮 Resolved ${resolved} due prediction market(s)`);
          }
          break;
        default:
          console.warn(`Unknown job type: ${job.name}`);
      }
    },
    { connection: conn },
  );

  worker.on('failed', (job, err) => {
    console.error(`❌ Predictions job ${job?.name} failed:`, err.message);
  });

  // Schedule the recurring job (repeatable jobs survive restarts in Redis)
  const queue = getPredictionsQueue();
  if (queue) {
    await queue.add(
      'resolve-due-predictions',
      {},
      { repeat: { every: RESOLVE_INTERVAL_MS } },
    );
  }

  return worker;
}
