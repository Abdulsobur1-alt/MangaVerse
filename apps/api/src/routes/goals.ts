import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { validate } from '../middleware/validate.js';
import { requireAuth } from '../middleware/auth.js';
import { NotFoundError } from '../lib/errors.js';

/* ═══════════════════════════════════════════════════════════════
   Reading Goals — personal targets with progress derived live from
   reading data (no counters to drift). Types:
   • chapters_week     — completed chapters in the calendar week (Mon–Sun UTC)
   • chapters_day      — completed chapters today
   • chapters_total    — lifetime completed chapters
   • series_total      — distinct series with ≥1 completed chapter
   • series_completed  — series finished (read the final known chapter)
   • streak_days       — maintain a current streak of at least `target` days
   ═══════════════════════════════════════════════════════════════ */

export const goalsRouter = Router();

goalsRouter.use(requireAuth);

// ─── Schemas ──────────────────────────────────────────

const GOAL_TYPES = [
  'chapters_week',
  'chapters_day',
  'chapters_total',
  'series_total',
  'series_completed',
  'streak_days',
] as const;

const CreateGoalSchema = z.object({
  title: z.string().trim().min(1).max(120),
  type: z.enum(GOAL_TYPES),
  target: z.number().int().positive().max(1_000_000),
  endsAt: z.string().datetime().nullable().optional(),
});

const UpdateGoalSchema = z.object({
  title: z.string().trim().min(1).max(120).optional(),
  target: z.number().int().positive().max(1_000_000).optional(),
  active: z.boolean().optional(),
  endsAt: z.string().datetime().nullable().optional(),
});

// ─── Progress ─────────────────────────────────────────

interface GoalStats {
  chaptersWeek: number;
  chaptersDay: number;
  chaptersTotal: number;
  seriesTotal: number;
  seriesCompleted: number;
  streakDays: number;
}

async function computeGoalStats(userId: string): Promise<GoalStats> {
  const now = new Date();
  const dayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const weekStart = new Date(dayStart.getTime() - ((now.getUTCDay() + 6) % 7) * 24 * 60 * 60 * 1000);

  const [user, chaptersWeek, chaptersDay, chaptersTotal, completedRows] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { streakDays: true } }),
    prisma.readingProgress.count({
      where: { userId, completed: true, updatedAt: { gte: weekStart } },
    }),
    prisma.readingProgress.count({
      where: { userId, completed: true, updatedAt: { gte: dayStart } },
    }),
    prisma.readingProgress.count({ where: { userId, completed: true } }),
    prisma.readingProgress.findMany({
      where: { userId, completed: true },
      select: {
        chapter: {
          select: {
            number: true,
            titleId: true,
            series: { select: { totalChapters: true } },
          },
        },
      },
      take: 50_000,
    }),
  ]);

  // Highest completed chapter per title + each title's declared chapter count.
  const maxByTitle = new Map<string, number>();
  const totalByTitle = new Map<string, number | null>();
  for (const row of completedRows) {
    const { titleId, number, series } = row.chapter;
    totalByTitle.set(titleId, series.totalChapters);
    const current = maxByTitle.get(titleId) ?? 0;
    if (number > current) maxByTitle.set(titleId, number);
  }

  const seriesTotal = maxByTitle.size;
  const seriesCompleted = [...maxByTitle.entries()].filter(([titleId, maxNumber]) => {
    const total = totalByTitle.get(titleId);
    return total != null && maxNumber >= total;
  }).length;

  return {
    chaptersWeek,
    chaptersDay,
    chaptersTotal,
    seriesTotal,
    seriesCompleted,
    streakDays: user?.streakDays ?? 0,
  };
}

const STAT_KEYS: Record<string, keyof GoalStats> = {
  chapters_week: 'chaptersWeek',
  chapters_day: 'chaptersDay',
  chapters_total: 'chaptersTotal',
  series_total: 'seriesTotal',
  series_completed: 'seriesCompleted',
  streak_days: 'streakDays',
};

function toGoalView(
  goal: {
    id: string;
    title: string;
    type: string;
    target: number;
    active: boolean;
    endsAt: Date | null;
    createdAt: Date;
  },
  current: number,
) {
  return {
    id: goal.id,
    title: goal.title,
    type: goal.type,
    target: goal.target,
    active: goal.active,
    endsAt: goal.endsAt ? goal.endsAt.toISOString() : null,
    createdAt: goal.createdAt.toISOString(),
    current,
    progress: Math.min(100, Math.round((current / goal.target) * 100)),
    done: current >= goal.target,
  };
}

// ─── GET /api/goals ───────────────────────────────────

goalsRouter.get('/', async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({ where: { firebaseUid: req.user!.uid }, select: { id: true } });
    if (!user) throw new NotFoundError('User');

    const [goals, stats] = await Promise.all([
      prisma.readingGoal.findMany({
        where: { userId: user.id },
        orderBy: [{ active: 'desc' }, { createdAt: 'desc' }],
      }),
      computeGoalStats(user.id),
    ]);

    res.json({
      success: true,
      data: goals.map((goal) => toGoalView(goal, stats[STAT_KEYS[goal.type] ?? 'chaptersTotal'])),
    });
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/goals ──────────────────────────────────

goalsRouter.post('/', validate({ body: CreateGoalSchema }), async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({ where: { firebaseUid: req.user!.uid }, select: { id: true } });
    if (!user) throw new NotFoundError('User');

    const body = req.body as z.infer<typeof CreateGoalSchema>;
    const goal = await prisma.readingGoal.create({
      data: {
        userId: user.id,
        title: body.title,
        type: body.type,
        target: body.target,
        endsAt: body.endsAt ? new Date(body.endsAt) : null,
      },
    });

    const stats = await computeGoalStats(user.id);
    res.status(201).json({ success: true, data: toGoalView(goal, stats[STAT_KEYS[goal.type]]) });
  } catch (err) {
    next(err);
  }
});

// ─── PATCH /api/goals/:id ─────────────────────────────

goalsRouter.patch('/:id', validate({ body: UpdateGoalSchema }), async (req, res, next) => {
  try {
    const id = req.params.id as string;
    const user = await prisma.user.findUnique({ where: { firebaseUid: req.user!.uid }, select: { id: true } });
    if (!user) throw new NotFoundError('User');

    const goal = await prisma.readingGoal.findFirst({
      where: { id, userId: user.id },
    });
    if (!goal) throw new NotFoundError('Goal');

    const body = req.body as z.infer<typeof UpdateGoalSchema>;
    const updated = await prisma.readingGoal.update({
      where: { id: goal.id },
      data: {
        ...(body.title !== undefined ? { title: body.title } : {}),
        ...(body.target !== undefined ? { target: body.target } : {}),
        ...(body.active !== undefined ? { active: body.active } : {}),
        ...(body.endsAt !== undefined ? { endsAt: body.endsAt ? new Date(body.endsAt) : null } : {}),
      },
    });

    const stats = await computeGoalStats(user.id);
    res.json({ success: true, data: toGoalView(updated, stats[STAT_KEYS[updated.type]]) });
  } catch (err) {
    next(err);
  }
});

// ─── DELETE /api/goals/:id ────────────────────────────

goalsRouter.delete('/:id', async (req, res, next) => {
  try {
    const id = req.params.id as string;
    const user = await prisma.user.findUnique({ where: { firebaseUid: req.user!.uid }, select: { id: true } });
    if (!user) throw new NotFoundError('User');

    const goal = await prisma.readingGoal.findFirst({
      where: { id, userId: user.id },
    });
    if (!goal) throw new NotFoundError('Goal');

    await prisma.readingGoal.delete({ where: { id: goal.id } });

    res.json({ success: true, data: { message: 'Goal deleted' } });
  } catch (err) {
    next(err);
  }
});
