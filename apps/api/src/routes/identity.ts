import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { NotFoundError } from '../lib/errors.js';
import { resolveUserId } from '../services/coins.js';
import { getOwnIdentity } from '../services/identity.js';
import { getJourney } from '../services/journey.js';
import { computeReputation } from '../services/reputation.js';
import { generateWrapped, getWrapped } from '../services/wrapped.js';

/* ═══════════════════════════════════════════════════════════════
   Identity — Phase 9 endpoints for the reader's own profile.
   • /me/identity — the composed dashboard payload
   • /me/journey — the reading-journey timeline
   • /me/reputation — the trust breakdown (raw score is own-view only)
   • /me/wrapped — the annual Wrapped report (get + generate)
   ═══════════════════════════════════════════════════════════════ */

export const identityRouter = Router();
identityRouter.use(requireAuth);

const WrappedGenerateSchema = z.object({
  year: z.coerce.number().int().min(2020).max(2100).optional(),
});

// ─── GET /api/users/me/identity ───────────────────────

identityRouter.get('/me/identity', async (req, res, next) => {
  try {
    const me = await resolveUserId(req.user!.uid);
    const data = await getOwnIdentity(me);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/users/me/journey ────────────────────────

identityRouter.get('/me/journey', async (req, res, next) => {
  try {
    const me = await resolveUserId(req.user!.uid);
    const journey = await getJourney(me);
    res.json({ success: true, data: journey });
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/users/me/reputation ─────────────────────

identityRouter.get('/me/reputation', async (req, res, next) => {
  try {
    const me = await resolveUserId(req.user!.uid);
    const reputation = await computeReputation(me);
    res.json({ success: true, data: reputation });
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/users/me/wrapped?year= ──────────────────

identityRouter.get('/me/wrapped', async (req, res, next) => {
  try {
    const me = await resolveUserId(req.user!.uid);
    const year = parseInt(req.query.year as string) || new Date().getFullYear();
    const data = await getWrapped(me, year);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/users/me/wrapped { year? } ─────────────
// Generate (and cache) the annual report. Call once a year per user.

identityRouter.post('/me/wrapped', validate({ body: WrappedGenerateSchema }), async (req, res, next) => {
  try {
    const me = await resolveUserId(req.user!.uid);
    const user = await prisma.user.findUnique({ where: { id: me }, select: { id: true } });
    if (!user) throw new NotFoundError('User');
    const year = (req.body as z.infer<typeof WrappedGenerateSchema>).year ?? new Date().getFullYear();
    const data = await generateWrapped(me, year);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});
