import { Queue, Worker } from 'bullmq';
import { Redis } from 'ioredis';
import { config } from '../config/index.js';
import { generateReadingReminders, runDigests } from '../services/notifications.js';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const QUEUE_NAME = 'mangaverse-engagement';
const REMINDER_INTERVAL_MS = 15 * 60 * 1000; // every 15 minutes
const DIGEST_INTERVAL_MS = 60 * 60 * 1000; // hourly — checks which users are due

let connection: Redis | null = null;
let engagementQueue: Queue | null = null;

async function getConnection(): Promise<Redis | null> {
  if (connection?.status === 'ready') return connection;
  if (connection && ['close', 'end'].includes(connection.status)) return null;
  try {
    connection = new Redis(REDIS_URL, {
      maxRetriesPerRequest: null,
      lazyConnect: true,
      retryStrategy: (times) => (times > 3 ? null : Math.min(times * 500, 1000)),
    });
    connection.on('error', (err) => {
      console.warn('⚠️  Redis connection error:', (err as Error).message);
    });

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
      connection = null;
      return null;
    }
    return connection;
  } catch {
    connection = null;
    return null;
  }
}

// ─── Queue ───────────────────────────────────────────

export async function getEngagementQueue(): Promise<Queue | null> {
  if (engagementQueue) return engagementQueue;
  const conn = await getConnection();
  if (!conn) {
    console.warn('⚠️  Redis not available — engagement queue disabled');
    return null;
  }
  engagementQueue = new Queue(QUEUE_NAME, {
    connection: conn,
    defaultJobOptions: config.bullmq.defaultJobOptions,
  });
  engagementQueue.on('error', (err) => {
    console.warn('⚠️  Engagement queue error:', (err as Error).message);
  });
  return engagementQueue;
}

// ─── Worker ──────────────────────────────────────────

/**
 * Start the engagement worker and schedule its recurring jobs:
 *  • send-reminders — reading reminders every 15 minutes
 *  • generate-digests — digest pass every hour
 */
export async function startEngagementWorker(): Promise<Worker | null> {
  const conn = await getConnection();
  if (!conn) return null;

  const worker = new Worker(
    QUEUE_NAME,
    async (job) => {
      switch (job.name) {
        case 'send-reminders': {
          const sent = await generateReadingReminders();
          if (sent > 0) console.log(`🔔 Sent ${sent} reading reminder(s)`);
          break;
        }
        case 'generate-digests': {
          const ran = await runDigests();
          if (ran > 0) console.log(`📬 Ran digest pass for ${ran} user(s)`);
          break;
        }
        default:
          console.warn(`Unknown job type: ${job.name}`);
      }
    },
    { connection: conn },
  );

  worker.on('failed', (job, err) => {
    console.error(`❌ Engagement job ${job?.name} failed:`, err.message);
  });
  worker.on('error', (err) => {
    console.warn('⚠️  Engagement worker error:', (err as Error).message);
  });

  const queue = await getEngagementQueue();
  if (queue) {
    await queue.add('send-reminders', {}, { repeat: { every: REMINDER_INTERVAL_MS } });
    await queue.add('generate-digests', {}, { repeat: { every: DIGEST_INTERVAL_MS } });
  }

  return worker;
}
