import webpush from 'web-push';
import { prisma } from '../lib/prisma.js';

// ─── VAPID configuration ──────────────────────────────
// Keys come from env (VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY / VAPID_SUBJECT).
// Generate them with: pnpm --filter @mangaverse/api webpush:generate-keys

const vapidPublicKey = process.env.VAPID_PUBLIC_KEY || '';
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY || '';
const vapidSubject = process.env.VAPID_SUBJECT || 'mailto:admin@mangaverse.app';

/** True when VAPID keys are configured (needed to send pushes). */
export const webpushConfigured = Boolean(vapidPublicKey && vapidPrivateKey);

if (webpushConfigured) {
  webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
}

// ─── Types ────────────────────────────────────────────

export interface PushPayload {
  title: string;
  body?: string;
  link?: string;
  icon?: string;
}

// ─── Subscription management ──────────────────────────

/** Register (or refresh) a push subscription for a user. */
export async function savePushSubscription(
  dbUserId: string,
  subscription: { endpoint: string; p256dh: string; auth: string },
  userAgent?: string,
): Promise<boolean> {
  try {
    await prisma.pushSubscription.upsert({
      where: { endpoint: subscription.endpoint },
      update: { p256dh: subscription.p256dh, auth: subscription.auth, userId: dbUserId, userAgent },
      create: {
        userId: dbUserId,
        endpoint: subscription.endpoint,
        p256dh: subscription.p256dh,
        auth: subscription.auth,
        userAgent: userAgent || null,
      },
    });
    return true;
  } catch {
    return false;
  }
}

/** Remove a push subscription by endpoint (e.g. on logout or 410 gone). */
export async function removePushSubscription(endpoint: string): Promise<void> {
  try {
    await prisma.pushSubscription.deleteMany({ where: { endpoint } });
  } catch {
    // Best-effort
  }
}

// ─── Sending ──────────────────────────────────────────

/**
 * Send a web push notification to all of a user's subscriptions.
 * Stale subscriptions (410 Gone / 404) are pruned automatically.
 * Fire-and-forget friendly — swallows all errors.
 */
export async function sendWebPushToUser(
  dbUserId: string,
  payload: PushPayload,
): Promise<number> {
  if (!webpushConfigured) return 0;

  try {
    const subs = await prisma.pushSubscription.findMany({
      where: { userId: dbUserId },
      select: { id: true, endpoint: true, p256dh: true, auth: true },
    });

    let sent = 0;
    for (const sub of subs) {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          JSON.stringify({
            title: payload.title,
            body: payload.body || '',
            link: payload.link || '/',
            icon: payload.icon || '/icon.svg',
          }),
        );
        sent++;
      } catch (err) {
        // 404/410 = subscription is dead — prune it
        const status = (err as { statusCode?: number })?.statusCode;
        if (status === 404 || status === 410) {
          await removePushSubscription(sub.endpoint).catch(() => {});
        }
        // Other errors (rate limit etc.) are transient — ignore
      }
    }
    return sent;
  } catch {
    return 0;
  }
}
