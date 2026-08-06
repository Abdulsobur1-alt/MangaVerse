import { prisma } from '../lib/prisma.js';

/* ═══════════════════════════════════════════════════════════════
   Audit — every critical action logged, searchable, exportable.
   Convention: action = "resource.action" (e.g. "role.change",
   "title.publish", "user.ban", "flag.toggle", "settings.update").
   Fire-and-forget friendly: logAudit never throws.
   ═══════════════════════════════════════════════════════════════ */

export interface AuditInput {
  actorId?: string | null;
  action: string;
  resource: string;
  resourceId?: string | null;
  targetUserId?: string | null;
  details?: Record<string, unknown> | null;
  ip?: string | null;
}

export async function logAudit(input: AuditInput): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        actorId: input.actorId ?? null,
        action: input.action,
        resource: input.resource,
        resourceId: input.resourceId ?? null,
        targetUserId: input.targetUserId ?? null,
        details: (input.details ?? null) as never,
        ip: input.ip ?? null,
      },
    });
  } catch {
    // Auditing is best-effort — never break the primary action
  }
}

/** Resolve the acting user's db id from a firebase uid (null if unknown). */
export async function resolveActorId(firebaseUid?: string): Promise<string | null> {
  if (!firebaseUid) return null;
  try {
    const user = await prisma.user.findUnique({
      where: { firebaseUid },
      select: { id: true },
    });
    return user?.id ?? null;
  } catch {
    return null;
  }
}
