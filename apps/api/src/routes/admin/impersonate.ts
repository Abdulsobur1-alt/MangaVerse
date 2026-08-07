import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { validate } from '../../middleware/validate.js';
import { NotFoundError, ForbiddenError } from '../../lib/errors.js';
import { requirePermission, effectiveRoles } from '../../services/rbac.js';
import { logAudit } from '../../services/audit.js';
import { config } from '../../config/index.js';
import { supabaseConfigured } from '../../lib/supabase.js';

/* ═══════════════════════════════════════════════════════════════
   Admin Impersonation — support agents can temporarily act as a user.
   • Dev mode: returns the dev_<dbUserId> token directly (matches the
     local auth flow) so the console can "sign in as" any user.
   • Production: impersonation tokens require a real signing service —
     this endpoint refuses rather than minting an insecure token.
   Every impersonation is audit-logged. Super admins only.
   ═══════════════════════════════════════════════════════════════ */

export const adminImpersonateRouter = Router();

const IdParams = z.object({ id: z.string().uuid() });

adminImpersonateRouter.post('/impersonate/:id', requirePermission('impersonate:act'), validate({ params: IdParams }), async (req, res, next) => {
  try {
    const id = req.params.id as string;
    const target = await prisma.user.findUnique({ where: { id }, select: { id: true, displayName: true, role: true, roles: true } });
    if (!target) throw new NotFoundError('User', id);
    if (effectiveRoles(target).includes('super_admin')) throw new ForbiddenError('Cannot impersonate a super admin');

    const actorId = await prisma.user
      .findUnique({ where: { firebaseUid: req.user!.uid }, select: { id: true } })
      .then((u) => u?.id ?? null);

    await logAudit({
      actorId,
      action: 'user.impersonate',
      resource: 'user',
      resourceId: id,
      targetUserId: id,
      details: { target: target.displayName },
      ip: req.ip,
    });

    if (config.devAuth && !supabaseConfigured()) {
      // dev_<dbUserId> is exactly how dev-mode auth resolves tokens
      // (see middleware/auth.ts) — the actor's client can store it to
      // act as the target locally.
      res.json({ success: true, data: { token: `dev_${id}`, expiresHint: 'dev-only token' } });
      return;
    }

    throw new ForbiddenError('Impersonation requires a production signing service — unavailable in this deployment');
  } catch (err) {
    next(err);
  }
});
