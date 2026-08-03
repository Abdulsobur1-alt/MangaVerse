import { Queue, Worker } from 'bullmq';
import { Redis } from 'ioredis';
import { config } from '../config/index.js';
import { resolveDuePredictions } from '../services/predictions.js';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const QUEUE_NAME = 'mangaverse-predictions';
const RESOLVE_INTERVAL_MS = 15 * 60 * 1000; // every 15 minutes

let connection: Redis | null = null;
let predictionsQueue: Queue | null = null;

async function getConnection(): Promise<Redis | null> {
  if (connection?.status === 'ready') return connection;
  // Once retryStrategy has given up, the client is permanently dead — treat
  // Redis as unavailable instead of constructing a new instance per call.
  if (connection && ['close', 'end'].includes(connection.status)) return null;
  try {
    connection = new Redis(REDIS_URL, {
      maxRetriesPerRequest: null,
      lazyConnect: true,
      // Bound the retry window: if Redis is down, give up after ~2.5s
      // (500ms + 1s + 1s) so the API boots anyway (workers degrade to
      // disabled) instead of hanging forever on a dead connection.
      retryStrategy: (times) => (times > 3 ? null : Math.min(times * 500, 1000)),
    });
    // A Redis connection error must never crash the process — without an
    // 'error' listener ioredis throws and takes the whole API down with it.
    connection.on('error', (err) => {
      console.warn('⚠️  Redis connection error:', (err as Error).message);
    });

    // Probe BEFORE handing the client to BullMQ. BullMQ's internal
    // waitUntilReady() rejects when the connection closes, and that
    // rejection is unhandled — on Node 22 an unhandled rejection crashes
    // the process, killing the API before app.listen. By connecting and
    // waiting for 'ready' ourselves, we only return clients that are
    // actually up; a dead Redis yields null (graceful degradation) and
    // BullMQ never sees the dead client.
    const ready = await new Promise<boolean>((resolve) => {
      let settled = false;
      let timeout: NodeJS.Timeout | undefined;
      const finish = (ok: boolean) => {
        if (settled) return;
        settled = true;
        if (timeout) clearTimeout(timeout);
        connection!.off('ready', onReady);
        connection!.off('end', onEnd);
        resolve(ok);
      };
      const onReady = () => finish(true);
      const onEnd = () => finish(false);
      timeout = setTimeout(() => finish(false), 5000);
      connection!.on('ready', onReady);
      connection!.on('end', onEnd);
      connection!.connect().catch(() => finish(false));
    });

    if (!ready) {
      connection = null; // reset so a later call can retry fresh
      return null;
    }
    return connection;
  } catch {
    connection = null;
    return null;
  }
}

// ─── Queue ───────────────────────────────────────────

export async function getPredictionsQueue(): Promise<Queue | null> {
  if (predictionsQueue) return predictionsQueue;
  const conn = await getConnection();
  if (!conn) {
    console.warn('⚠️  Redis not available — predictions queue disabled');
    return null;
  }
  predictionsQueue = new Queue(QUEUE_NAME, {
    connection: conn,
    defaultJobOptions: config.bullmq.defaultJobOptions,
  });
  // BullMQ re-emits Redis connection errors on the Queue itself — without
  // an 'error' listener, that event throws and kills the whole process.
  predictionsQueue.on('error', (err) => {
    console.warn('⚠️  Predictions queue error:', (err as Error).message);
  });
  return predictionsQueue;
}

// ─── Worker ──────────────────────────────────────────

/**
 * Start the prediction-resolution worker and schedule the recurring
 * resolve-due-predictions job.
 */
export async function startPredictionsWorker(): Promise<Worker | null> {
  const conn = await getConnection();
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

  // Worker-level errors (e.g. connection dropped mid-run) must not crash
  // the process either.
  worker.on('error', (err) => {
    console.warn('⚠️  Predictions worker error:', (err as Error).message);
  });

  // Schedule the recurring job (repeatable jobs survive restarts in Redis)
  const queue = await getPredictionsQueue();
  if (queue) {
    await queue.add(
      'resolve-due-predictions',
      {},
      { repeat: { every: RESOLVE_INTERVAL_MS } },
    );
  }

  return worker;
}
