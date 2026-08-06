import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { adminCoreRouter } from './core.js';
import { adminDashboardRouter } from './dashboard.js';
import { adminCmsRouter } from './cms.js';
import { adminMediaRouter } from './media.js';
import { adminModerationRouter } from './moderation.js';
import { adminFlagsRouter } from './flags.js';
import { adminAuditRouter } from './audit.js';
import { adminTicketsRouter } from './tickets.js';
import { adminHealthRouter } from './health.js';
import { adminAnalyticsRouter } from './analytics.js';
import { adminSettingsRouter } from './settings.js';
import { adminImpersonateRouter } from './impersonate.js';

/* ═══════════════════════════════════════════════════════════════
   Admin API (Phase 11) — the modular platform console.
   • /core            legacy moderation endpoints (roles, users,
                      posts/comments/wiki/clubs, reports, engagement)
   • /dashboard       executive widgets
   • /cms             titles, chapters, revisions, editorial picks
   • /media           asset library
   • /moderation      warn → suspend → ban ladder
   • /flags           feature flags + per-user overrides
   • /audit           audit log (read + export)
   • /tickets         support tickets + internal notes
   • /health          system health (db / redis / meilisearch / ws)
   • /analytics       platform analytics
   • /settings        platform settings + maintenance mode
   • /impersonate     super-admin only dev signing
   Auth: requireAuth once at the top; every module enforces its own
   granular requirePermission(...) gate (see services/rbac.ts).
   ═══════════════════════════════════════════════════════════════ */

export const adminRouter = Router();

adminRouter.use(requireAuth);

adminRouter.use('/', adminCoreRouter);
adminRouter.use('/', adminDashboardRouter);
adminRouter.use('/', adminCmsRouter);
adminRouter.use('/', adminMediaRouter);
adminRouter.use('/', adminModerationRouter);
adminRouter.use('/', adminFlagsRouter);
adminRouter.use('/', adminAuditRouter);
adminRouter.use('/', adminTicketsRouter);
adminRouter.use('/', adminHealthRouter);
adminRouter.use('/', adminAnalyticsRouter);
adminRouter.use('/', adminSettingsRouter);
adminRouter.use('/', adminImpersonateRouter);
