import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate.js';
import { requireAuth } from '../middleware/auth.js';
import { resolveUserId } from '../services/coins.js';
import {
  webpushConfigured,
  savePushSubscription,
  removePushSubscription,
} from '../services/webpush.js';

export const pushRouter = Router();

// ─── Schemas ──────────────────────────────────────────

const SubscribeSchema = z.object({
  endpoint: z.string().url().min(1),
  p256dh: z.string().min(1),
  auth: z.string().min(1),
});

// ─── GET /api/push/vapid-public-key ───────────────────
// Exposes the VAPID public key so clients can subscribe.
// Returns 503 if push isn't configured (no keys in env).

pushRouter.get('/vapid-public-key', (_req, res) => {
  if (!webpushConfigured) {
    res.status(503).json({
      success: false,
      error: {
        code: 'PUSH_NOT_CONFIGURED',
        message: 'Web push is not configured. Add VAPID keys to the API environment.',
      },
    });
    return;
  }
  res.json({ success: true, data: { publicKey: process.env.VAPID_PUBLIC_KEY } });
});

// ─── POST /api/push/subscribe ─────────────────────────
// Register (or refresh) the browser push subscription for the current user.

pushRouter.post('/subscribe', requireAuth, validate({ body: SubscribeSchema }), async (req, res, next) => {
  try {
    const dbUserId = await resolveUserId(req.user!.uid);
    const body = req.body as z.infer<typeof SubscribeSchema>;

    const ok = await savePushSubscription(
      dbUserId,
      { endpoint: body.endpoint, p256dh: body.p256dh, auth: body.auth },
      req.headers['user-agent'],
    );

    if (!ok) {
      res.status(500).json({ success: false, error: { code: 'SAVE_FAILED', message: 'Could not save push subscription' } });
      return;
    }

    res.json({ success: true, data: { subscribed: true } });
  } catch (err) {
    next(err);
  }
});

// ─── DELETE /api/push/subscribe?endpoint=... ──────────
// Remove a subscription by endpoint (on logout or explicit opt-out).
// Endpoint arrives as a query param since the web api client's DELETE
// helper doesn't send a body.

const UnsubscribeQuery = z.object({
  endpoint: z.string().min(1),
});

pushRouter.delete('/subscribe', requireAuth, validate({ query: UnsubscribeQuery }), async (req, res, next) => {
  try {
    const query = req.query as unknown as z.infer<typeof UnsubscribeQuery>;
    await removePushSubscription(query.endpoint);
    res.json({ success: true, data: { subscribed: false } });
  } catch (err) {
    next(err);
  }
});
