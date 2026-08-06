import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { validate } from '../../middleware/validate.js';
import { NotFoundError } from '../../lib/errors.js';
import { requirePermission } from '../../services/rbac.js';
import { logAudit } from '../../services/audit.js';

/* ═══════════════════════════════════════════════════════════════
   Admin Support Tickets — internal queue with assignment, priority
   and threaded internal notes (never visible to the user).
   ═══════════════════════════════════════════════════════════════ */

export const adminTicketsRouter = Router();

adminTicketsRouter.use(requirePermission('tickets:read'));

const ListQuery = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.string().max(30).optional(),
  priority: z.string().max(30).optional(),
  assigneeId: z.string().uuid().optional(),
});

const IdParams = z.object({ id: z.string().uuid() });

const UpdateTicketSchema = z.object({
  status: z.enum(['open', 'in_progress', 'resolved', 'closed']).optional(),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).optional(),
});

const AssignSchema = z.object({
  assigneeId: z.string().uuid().nullable(),
});

const NoteSchema = z.object({
  body: z.string().min(1).max(2000),
});

async function resolveActorId(firebaseUid: string): Promise<string | null> {
  try {
    const u = await prisma.user.findUnique({ where: { firebaseUid }, select: { id: true } });
    return u?.id ?? null;
  } catch {
    return null;
  }
}

adminTicketsRouter.get('/tickets', validate({ query: ListQuery }), async (req, res, next) => {
  try {
    const q = req.query as unknown as z.infer<typeof ListQuery>;
    const skip = (q.page - 1) * q.limit;
    const where: Record<string, unknown> = {};
    if (q.status) where.status = q.status;
    if (q.priority) where.priority = q.priority;
    if (q.assigneeId) where.assigneeId = q.assigneeId;

    const [items, total] = await Promise.all([
      prisma.supportTicket.findMany({
        where,
        orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
        skip,
        take: q.limit,
        include: {
          user: { select: { id: true, displayName: true, avatarUrl: true, email: true } },
          assignee: { select: { id: true, displayName: true } },
        },
      }),
      prisma.supportTicket.count({ where }),
    ]);

    res.json({
      success: true,
      data: {
        items: items.map((t) => ({
          id: t.id,
          subject: t.subject,
          status: t.status,
          priority: t.priority,
          user: t.user,
          assignee: t.assignee,
          noteCount: Array.isArray(t.internalNotes) ? t.internalNotes.length : 0,
          createdAt: t.createdAt.toISOString(),
          updatedAt: t.updatedAt.toISOString(),
        })),
        total,
        page: q.page,
        limit: q.limit,
        hasMore: skip + items.length < total,
      },
    });
  } catch (err) {
    next(err);
  }
});

adminTicketsRouter.get('/tickets/:id', validate({ params: IdParams }), async (req, res, next) => {
  try {
    const id = req.params.id as string;
    const ticket = await prisma.supportTicket.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, displayName: true, avatarUrl: true, email: true, createdAt: true } },
        assignee: { select: { id: true, displayName: true } },
      },
    });
    if (!ticket) throw new NotFoundError('SupportTicket', id);
    res.json({
      success: true,
      data: {
        id: ticket.id,
        subject: ticket.subject,
        body: ticket.body,
        status: ticket.status,
        priority: ticket.priority,
        user: ticket.user,
        assignee: ticket.assignee,
        internalNotes: Array.isArray(ticket.internalNotes) ? (ticket.internalNotes as unknown[]) : [],
        createdAt: ticket.createdAt.toISOString(),
        updatedAt: ticket.updatedAt.toISOString(),
      },
    });
  } catch (err) {
    next(err);
  }
});

adminTicketsRouter.patch('/tickets/:id', requirePermission('tickets:update'), validate({ params: IdParams, body: UpdateTicketSchema }), async (req, res, next) => {
  try {
    const id = req.params.id as string;
    const body = req.body as z.infer<typeof UpdateTicketSchema>;
    const existing = await prisma.supportTicket.findUnique({ where: { id }, select: { id: true, status: true } });
    if (!existing) throw new NotFoundError('SupportTicket', id);

    const updated = await prisma.supportTicket.update({
      where: { id },
      data: body as never,
      select: { id: true, status: true, priority: true, updatedAt: true },
    });
    await logAudit({
      actorId: await resolveActorId(req.user!.uid),
      action: 'ticket.update',
      resource: 'support_ticket',
      resourceId: id,
      details: { from: existing.status, to: body.status ?? existing.status },
      ip: req.ip,
    });
    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
});

adminTicketsRouter.post('/tickets/:id/assign', requirePermission('tickets:assign'), validate({ params: IdParams, body: AssignSchema }), async (req, res, next) => {
  try {
    const id = req.params.id as string;
    const body = req.body as z.infer<typeof AssignSchema>;
    const updated = await prisma.supportTicket.update({
      where: { id },
      data: { assigneeId: body.assigneeId },
      select: { id: true, assigneeId: true },
    });
    await logAudit({
      actorId: await resolveActorId(req.user!.uid),
      action: 'ticket.assign',
      resource: 'support_ticket',
      resourceId: id,
      details: { assigneeId: body.assigneeId },
      ip: req.ip,
    });
    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
});

adminTicketsRouter.post('/tickets/:id/notes', requirePermission('tickets:update'), validate({ params: IdParams, body: NoteSchema }), async (req, res, next) => {
  try {
    const id = req.params.id as string;
    const body = req.body as z.infer<typeof NoteSchema>;
    const actorId = await resolveActorId(req.user!.uid);

    const ticket = await prisma.supportTicket.findUnique({ where: { id }, select: { id: true, internalNotes: true } });
    if (!ticket) throw new NotFoundError('SupportTicket', id);

    const actor = actorId
      ? await prisma.user.findUnique({ where: { id: actorId }, select: { displayName: true } })
      : null;
    const notes = Array.isArray(ticket.internalNotes) ? (ticket.internalNotes as unknown[]) : [];
    const updated = await prisma.supportTicket.update({
      where: { id },
      data: {
        internalNotes: [...notes, { actorName: actor?.displayName ?? 'system', body: body.body, at: new Date().toISOString() }] as never,
      },
      select: { id: true },
    });
    await logAudit({
      actorId,
      action: 'ticket.note',
      resource: 'support_ticket',
      resourceId: id,
      ip: req.ip,
    });
    res.json({ success: true, data: { id: updated.id, noteAdded: true } });
  } catch (err) {
    next(err);
  }
});
