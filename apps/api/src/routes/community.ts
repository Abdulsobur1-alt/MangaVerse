import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { validate } from '../middleware/validate.js';
import { requireAuth, optionalAuth } from '../middleware/auth.js';
import { NotFoundError, ForbiddenError, ConflictError } from '../lib/errors.js';
import { resolveUserId, debitCoins } from '../services/coins.js';
import { checkAndAwardAchievements } from '../services/achievements.js';
import { notifyCommentAdded } from '../services/notifications.js';
import { resolveDuePredictions, computePredictionReturn } from '../services/predictions.js';

export const communityRouter = Router();

// ─── Schemas ──────────────────────────────────────────

const PostListQuery = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  tag: z.enum(['theory', 'prediction', 'discussion', 'review']).optional(),
  sort: z.enum(['newest', 'top']).default('newest'),
});

const CreatePostSchema = z.object({
  title: z.string().min(3).max(200),
  body: z.string().min(10).max(20000),
  tag: z.enum(['theory', 'prediction', 'discussion', 'review']).default('discussion'),
  titleId: z.string().uuid().optional(),
});

const AddCommentSchema = z.object({
  body: z.string().min(1).max(5000),
});

const CreateClubSchema = z.object({
  name: z.string().min(3).max(60),
});

const ClubParams = z.object({
  id: z.string().uuid(),
});

const PostParams = z.object({
  id: z.string().uuid(),
});

const PredictionParams = z.object({
  id: z.string().uuid(),
});

const VotePredictionSchema = z.object({
  option: z.string().min(1).max(100),
  coins: z.number().int().min(1).max(500),
});

const WikiParams = z.object({
  slug: z.string().min(1),
});

const UpsertWikiSchema = z.object({
  contentMd: z.string().min(1).max(50000),
});

const RevertWikiSchema = z.object({
  version: z.number().int().positive(),
});

const CreateReportSchema = z.object({
  contentType: z.enum(['post', 'comment', 'wiki']),
  targetId: z.string().uuid(),
  reason: z.enum(['spam', 'harassment', 'spoiler', 'misinformation', 'other']),
  details: z.string().max(2000).optional(),
});

// ─── Helpers ──────────────────────────────────────────

const POST_TAG_COLORS: Record<string, string> = {
  theory: 'bg-[#1a0535] text-[#a05bdf]',
  prediction: 'bg-[#1a1400] text-[#d4a017]',
  discussion: 'bg-[#0d2035] text-[#4aa0e0]',
  review: 'bg-[#0d3520] text-[#4ae0a0]',
};

function postTagColor(tag: string): string {
  return POST_TAG_COLORS[tag] || POST_TAG_COLORS.discussion;
}

// ─── POST /api/community/reports ─────────────────────
// User-flagging: report a post, comment, or wiki page for moderation.

communityRouter.post('/reports', requireAuth, validate({ body: CreateReportSchema }), async (req, res, next) => {
  try {
    const dbUserId = await resolveUserId(req.user!.uid);
    const body = req.body as z.infer<typeof CreateReportSchema>;

    // Validate the reported target actually exists so a bad id doesn't create
    // a dangling report row. (Branched explicitly — a union-typed delegate is
    // not callable in TS.)
    let targetExists = false;
    if (body.contentType === 'post') {
      targetExists = !!(await prisma.communityPost.findUnique({
        where: { id: body.targetId },
        select: { id: true },
      }));
    } else if (body.contentType === 'comment') {
      targetExists = !!(await prisma.postComment.findUnique({
        where: { id: body.targetId },
        select: { id: true },
      }));
    } else {
      targetExists = !!(await prisma.wikiPage.findUnique({
        where: { id: body.targetId },
        select: { id: true },
      }));
    }
    if (!targetExists) throw new NotFoundError('Reported content', body.targetId);

    try {
      const report = await prisma.contentReport.create({
        data: {
          reporterId: dbUserId,
          contentType: body.contentType,
          targetId: body.targetId,
          reason: body.reason,
          details: body.details || null,
        },
        select: { id: true, status: true, createdAt: true },
      });
      res.status(201).json({
        success: true,
        data: { id: report.id, status: report.status, createdAt: report.createdAt.toISOString() },
      });
    } catch (err) {
      // P2002: this user already reported this target — clean 409, not a crash.
      if ((err as { code?: string })?.code === 'P2002') {
        throw new ConflictError('You have already reported this content');
      }
      throw err;
    }
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/community/posts ─────────────────────────

communityRouter.get('/posts', optionalAuth, validate({ query: PostListQuery }), async (req, res, next) => {
  try {
    const query = req.query as unknown as z.infer<typeof PostListQuery>;
    const { page, limit, tag, sort } = query;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};
    if (tag) where.tag = tag;

    const orderBy: Record<string, unknown> =
      sort === 'top' ? { votes: { _count: 'desc' } } : { createdAt: 'desc' };

    const [posts, total] = await Promise.all([
      prisma.communityPost.findMany({
        where: where as any,
        orderBy: orderBy as any,
        skip,
        take: limit,
        include: {
          author: { select: { id: true, displayName: true, avatarUrl: true } },
          series: { select: { slug: true, title: true, coverUrl: true } },
          _count: { select: { votes: true, comments: true } },
        },
      }),
      prisma.communityPost.count({ where: where as any }),
    ]);

    // Per-user vote state
    let votedPostIds = new Set<string>();
    if (req.user?.uid) {
      try {
        const dbUserId = await resolveUserId(req.user.uid);
        const votes = await prisma.postVote.findMany({
          where: { userId: dbUserId, postId: { in: posts.map((p) => p.id) } },
          select: { postId: true },
        });
        votedPostIds = new Set(votes.map((v) => v.postId));
      } catch {
        // anonymous or unknown user
      }
    }

    res.json({
      success: true,
      data: {
        items: posts.map((p) => ({
          id: p.id,
          title: p.title,
          body: p.body,
          tag: p.tag,
          tagColor: postTagColor(p.tag),
          views: p.views,
          createdAt: p.createdAt.toISOString(),
          updatedAt: p.updatedAt.toISOString(),
          author: p.author,
          series: p.series,
          upvotes: p._count.votes,
          comments: p._count.comments,
          voted: votedPostIds.has(p.id),
        })),
        total,
        page,
        limit,
        hasMore: skip + posts.length < total,
      },
    });
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/community/posts ────────────────────────

communityRouter.post('/posts', requireAuth, validate({ body: CreatePostSchema }), async (req, res, next) => {
  try {
    const dbUserId = await resolveUserId(req.user!.uid);
    const body = req.body as z.infer<typeof CreatePostSchema>;

    if (body.titleId) {
      const title = await prisma.title.findUnique({ where: { id: body.titleId } });
      if (!title) throw new NotFoundError('Title', body.titleId);
    }

    const post = await prisma.communityPost.create({
      data: {
        authorId: dbUserId,
        titleId: body.titleId || null,
        title: body.title,
        body: body.body,
        tag: body.tag,
      },
      include: {
        author: { select: { id: true, displayName: true, avatarUrl: true } },
        series: { select: { slug: true, title: true, coverUrl: true } },
        _count: { select: { votes: true, comments: true } },
      },
    });

    // Fire-and-forget: award community participation badges (first post, poster)
    checkAndAwardAchievements(dbUserId).catch(() => {});

    res.status(201).json({
      success: true,
      data: {
        id: post.id,
        title: post.title,
        body: post.body,
        tag: post.tag,
        tagColor: postTagColor(post.tag),
        views: post.views,
        createdAt: post.createdAt.toISOString(),
        updatedAt: post.updatedAt.toISOString(),
        author: post.author,
        series: post.series,
        upvotes: post._count.votes,
        comments: post._count.comments,
        voted: false,
      },
    });
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/community/posts/:id ─────────────────────

communityRouter.get('/posts/:id', optionalAuth, validate({ params: PostParams }), async (req, res, next) => {
  try {
    const id = req.params.id as string;

    const post = await prisma.communityPost.findUnique({
      where: { id },
      include: {
        author: { select: { id: true, displayName: true, avatarUrl: true } },
        series: { select: { slug: true, title: true, coverUrl: true } },
        comments: {
          orderBy: { createdAt: 'asc' },
          include: { author: { select: { id: true, displayName: true, avatarUrl: true } } },
        },
        _count: { select: { votes: true } },
      },
    });

    if (!post) throw new NotFoundError('Post', id);

    // Increment view count (fire-and-forget)
    prisma.communityPost.update({ where: { id }, data: { views: { increment: 1 } } }).catch(() => {});

    let voted = false;
    if (req.user?.uid) {
      try {
        const dbUserId = await resolveUserId(req.user.uid);
        const vote = await prisma.postVote.findUnique({
          where: { postId_userId: { postId: id, userId: dbUserId } },
        });
        voted = !!vote;
      } catch {
        // ignore
      }
    }

    res.json({
      success: true,
      data: {
        id: post.id,
        title: post.title,
        body: post.body,
        tag: post.tag,
        tagColor: postTagColor(post.tag),
        views: post.views + 1,
        createdAt: post.createdAt.toISOString(),
        updatedAt: post.updatedAt.toISOString(),
        author: post.author,
        series: post.series,
        upvotes: post._count.votes,
        voted,
        comments: post.comments.map((c) => ({
          id: c.id,
          body: c.body,
          createdAt: c.createdAt.toISOString(),
          author: c.author,
        })),
      },
    });
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/community/posts/:id/vote ───────────────

communityRouter.post('/posts/:id/vote', requireAuth, validate({ params: PostParams }), async (req, res, next) => {
  try {
    const id = req.params.id as string;
    const dbUserId = await resolveUserId(req.user!.uid);

    const post = await prisma.communityPost.findUnique({ where: { id }, select: { id: true } });
    if (!post) throw new NotFoundError('Post', id);

    const existing = await prisma.postVote.findUnique({
      where: { postId_userId: { postId: id, userId: dbUserId } },
    });

    if (existing) {
      // Unvote
      await prisma.postVote.delete({ where: { id: existing.id } });
      res.json({ success: true, data: { voted: false } });
      return;
    }

    await prisma.postVote.create({ data: { postId: id, userId: dbUserId } });
    res.json({ success: true, data: { voted: true } });
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/community/posts/:id/comments ───────────

communityRouter.post('/posts/:id/comments', requireAuth, validate({ params: PostParams, body: AddCommentSchema }), async (req, res, next) => {
  try {
    const id = req.params.id as string;
    const dbUserId = await resolveUserId(req.user!.uid);
    const body = req.body as z.infer<typeof AddCommentSchema>;

    const post = await prisma.communityPost.findUnique({
      where: { id },
      select: { id: true, title: true, authorId: true },
    });
    if (!post) throw new NotFoundError('Post', id);

    const comment = await prisma.postComment.create({
      data: { postId: id, authorId: dbUserId, body: body.body },
      include: { author: { select: { id: true, displayName: true, avatarUrl: true } } },
    });

    // Fire-and-forget: notify the post author (unless they commented on their own post)
    if (post.authorId !== dbUserId) {
      notifyCommentAdded(post.authorId, comment.author.displayName, post.title, id).catch(() => {});
    }
    // Award community participation badges (first comment, conversationalist)
    checkAndAwardAchievements(dbUserId).catch(() => {});

    res.status(201).json({
      success: true,
      data: {
        id: comment.id,
        body: comment.body,
        createdAt: comment.createdAt.toISOString(),
        author: comment.author,
      },
    });
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/community/clubs ─────────────────────────

communityRouter.get('/clubs', optionalAuth, async (req, res, next) => {
  try {
    const clubs = await prisma.readingClub.findMany({
      orderBy: { memberCount: 'desc' },
      take: 50,
      include: {
        members: { select: { userId: true } },
      },
    });

    let myClubIds = new Set<string>();
    if (req.user?.uid) {
      try {
        const dbUserId = await resolveUserId(req.user.uid);
        const memberships = await prisma.readingClubMember.findMany({
          where: { userId: dbUserId },
          select: { clubId: true },
        });
        myClubIds = new Set(memberships.map((m) => m.clubId));
      } catch {
        // ignore
      }
    }

    res.json({
      success: true,
      data: {
        items: clubs.map((c) => ({
          id: c.id,
          name: c.name,
          memberCount: c.memberCount,
          createdAt: c.createdAt.toISOString(),
          joined: myClubIds.has(c.id),
        })),
      },
    });
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/community/clubs ────────────────────────

communityRouter.post('/clubs', requireAuth, validate({ body: CreateClubSchema }), async (req, res, next) => {
  try {
    const dbUserId = await resolveUserId(req.user!.uid);
    const body = req.body as z.infer<typeof CreateClubSchema>;

    const club = await prisma.readingClub.create({
      data: {
        name: body.name,
        creatorId: dbUserId,
        memberCount: 1,
        members: {
          create: { userId: dbUserId, role: 'creator' },
        },
      },
    });

    // Fire-and-forget: award club badges (clubber, club hopper)
    checkAndAwardAchievements(dbUserId).catch(() => {});

    res.status(201).json({ success: true, data: { id: club.id, name: club.name, memberCount: 1, joined: true } });
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/community/clubs/:id/join ───────────────

communityRouter.post('/clubs/:id/join', requireAuth, validate({ params: ClubParams }), async (req, res, next) => {
  try {
    const id = req.params.id as string;
    const dbUserId = await resolveUserId(req.user!.uid);

    const club = await prisma.readingClub.findUnique({ where: { id } });
    if (!club) throw new NotFoundError('ReadingClub', id);

    const existing = await prisma.readingClubMember.findUnique({
      where: { clubId_userId: { clubId: id, userId: dbUserId } },
    });
    if (existing) throw new ConflictError('Already a member of this club');

    try {
      await prisma.$transaction([
        prisma.readingClubMember.create({ data: { clubId: id, userId: dbUserId } }),
        prisma.readingClub.update({ where: { id }, data: { memberCount: { increment: 1 } } }),
      ]);
    } catch (err) {
      // P2002: a concurrent join created the membership first — clean conflict.
      if ((err as { code?: string })?.code === 'P2002') {
        throw new ConflictError('Already a member of this club');
      }
      throw err;
    }

    // Fire-and-forget: award club badges (clubber, club hopper)
    checkAndAwardAchievements(dbUserId).catch(() => {});

    res.json({ success: true, data: { joined: true, memberCount: club.memberCount + 1 } });
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/community/clubs/:id/leave ──────────────

communityRouter.post('/clubs/:id/leave', requireAuth, validate({ params: ClubParams }), async (req, res, next) => {
  try {
    const id = req.params.id as string;
    const dbUserId = await resolveUserId(req.user!.uid);

    const club = await prisma.readingClub.findUnique({ where: { id } });
    if (!club) throw new NotFoundError('ReadingClub', id);

    const membership = await prisma.readingClubMember.findUnique({
      where: { clubId_userId: { clubId: id, userId: dbUserId } },
    });
    if (!membership) throw new NotFoundError('Membership');

    // Creator cannot leave (must have at least one member)
    if (membership.role === 'creator') {
      throw new ForbiddenError('The club creator cannot leave. Delete the club instead.');
    }

    await prisma.$transaction([
      prisma.readingClubMember.delete({ where: { id: membership.id } }),
      prisma.readingClub.update({ where: { id }, data: { memberCount: { decrement: 1 } } }),
    ]);

    res.json({ success: true, data: { joined: false, memberCount: Math.max(0, club.memberCount - 1) } });
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/community/predictions ───────────────────

communityRouter.get('/predictions', optionalAuth, async (req, res, next) => {
  try {
    // Lazily resolve any due prediction markets before serving the list.
    // (The scheduled BullMQ job is the primary driver; this is a safety net
    // so results always surface even if the worker is down.)
    try {
      await resolveDuePredictions();
    } catch {
      // Resolution is best-effort — serve current state on failure
    }

    const predictions = await prisma.prediction.findMany({
      orderBy: { createdAt: 'desc' },
      take: 20,
      include: {
        title: { select: { slug: true, title: true, coverUrl: true } },
        votes: { select: { option: true, coinsStaked: true } },
      },
    });

    let myVotes = new Map<string, { option: string; coinsStaked: number }>();
    if (req.user?.uid) {
      try {
        const dbUserId = await resolveUserId(req.user.uid);
        const votes = await prisma.predictionVote.findMany({
          where: { userId: dbUserId, predictionId: { in: predictions.map((p) => p.id) } },
          select: { predictionId: true, option: true, coinsStaked: true },
        });
        myVotes = new Map(votes.map((v) => [v.predictionId, { option: v.option, coinsStaked: v.coinsStaked }]));
      } catch {
        // ignore
      }
    }

    res.json({
      success: true,
      data: {
        items: predictions.map((p) => {
          // Aggregate per-option stakes
          const optionMap = new Map<string, number>();
          for (const v of p.votes) {
            optionMap.set(v.option, (optionMap.get(v.option) || 0) + v.coinsStaked);
          }
          const totalStaked = [...optionMap.values()].reduce((a, b) => a + b, 0);

          // If resolved, report the user's outcome + winnings on their vote
          let myVote: { option: string; coinsStaked: number; won?: boolean; payout?: number } | null =
            myVotes.get(p.id) || null;
          if (myVote && p.result) {
            const winningPool = optionMap.get(p.result) || 0;
            const loserPool = totalStaked - winningPool;
            const won = myVote.option === p.result;
            const payout = won
              ? computePredictionReturn(myVote.coinsStaked, winningPool, loserPool) - myVote.coinsStaked
              : 0;
            myVote = { ...myVote, won, payout };
          }

          return {
            id: p.id,
            question: p.question,
            options: p.options,
            resolvesAt: p.resolvesAt ? p.resolvesAt.toISOString() : null,
            result: p.result,
            createdAt: p.createdAt.toISOString(),
            title: p.title,
            optionStakes: Object.fromEntries(optionMap),
            totalStaked,
            totalVotes: p.votes.length,
            myVote,
          };
        }),
      },
    });
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/community/predictions/:id/vote ─────────

communityRouter.post('/predictions/:id/vote', requireAuth, validate({ params: PredictionParams, body: VotePredictionSchema }), async (req, res, next) => {
  try {
    const id = req.params.id as string;
    const dbUserId = await resolveUserId(req.user!.uid);
    const body = req.body as z.infer<typeof VotePredictionSchema>;

    const prediction = await prisma.prediction.findUnique({
      where: { id },
      select: { id: true, options: true, resolvesAt: true },
    });
    if (!prediction) throw new NotFoundError('Prediction', id);
    if (prediction.resolvesAt && new Date(prediction.resolvesAt).getTime() < Date.now()) {
      throw new ForbiddenError('This prediction has closed');
    }
    if (!prediction.options.includes(body.option)) {
      throw new ForbiddenError('Invalid prediction option');
    }

    const existing = await prisma.predictionVote.findUnique({
      where: { predictionId_userId: { predictionId: id, userId: dbUserId } },
    });
    if (existing) throw new ConflictError('You already voted on this prediction');

    // Spend coins + record the vote in ONE transaction so a vote insert failure
    // (e.g. concurrent duplicate → P2002, or any DB error) rolls back the spend
    // — coins can never be lost without a vote being recorded.
    let result: { ok: boolean; balance: number } | undefined;
    try {
      result = await prisma.$transaction(async (tx) => {
        const debit = await debitCoins(tx, dbUserId, body.coins, 'spend', id, 'Staked on prediction');
        if (!debit.ok) return debit;
        await tx.predictionVote.create({
          data: {
            predictionId: id,
            userId: dbUserId,
            option: body.option,
            coinsStaked: body.coins,
          },
        });
        return debit;
      });
    } catch (err) {
      // P2002: a concurrent duplicate vote created the record first. The
      // transaction rolls back the coin spend; surface a clean 409 instead of 500.
      if ((err as { code?: string })?.code === 'P2002') {
        throw new ConflictError('You already voted on this prediction');
      }
      throw err;
    }

    if (!result.ok) {
      res.status(402).json({
        success: false,
        error: {
          code: 'INSUFFICIENT_COINS',
          message: 'Not enough coins to stake on this prediction',
          details: { balance: result.balance },
        },
      });
      return;
    }

    res.json({
      success: true,
      data: {
        option: body.option,
        coinsStaked: body.coins,
        balance: result.balance,
      },
    });
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/community/wiki/:slug/revert ────────────
// Restore the wiki page to a previous revision (creates a new version).

communityRouter.post('/wiki/:slug/revert', requireAuth, validate({ params: WikiParams, body: RevertWikiSchema }), async (req, res, next) => {
  try {
    const slug = req.params.slug as string;
    const dbUserId = await resolveUserId(req.user!.uid);
    const body = req.body as z.infer<typeof RevertWikiSchema>;

    const title = await prisma.title.findUnique({ where: { slug }, select: { id: true } });
    if (!title) throw new NotFoundError('Title', slug);

    const wiki = await prisma.wikiPage.findUnique({
      where: { titleId_slug: { titleId: title.id, slug } },
    });
    if (!wiki) throw new NotFoundError('WikiPage', slug);

    // Reverting to the current version would just duplicate it — reject early.
    if (body.version === wiki.version) {
      throw new ConflictError('That is already the current version');
    }

    const revision = await prisma.wikiRevision.findUnique({
      where: { wikiId_version: { wikiId: wiki.id, version: body.version } },
    });
    if (!revision) throw new NotFoundError('WikiRevision', String(body.version));

    const updated = await prisma.$transaction(async (tx) => {
      const page = await tx.wikiPage.update({
        where: { id: wiki.id },
        data: {
          contentMd: revision.contentMd,
          version: { increment: 1 },
          authorId: dbUserId,
        },
      });
      await tx.wikiRevision.create({
        data: {
          wikiId: wiki.id,
          authorId: dbUserId,
          contentMd: revision.contentMd,
          version: page.version,
        },
      });
      return page;
    });

    // Fire-and-forget: reverting is also a contribution (appends a revision)
    checkAndAwardAchievements(dbUserId).catch(() => {});

    res.json({
      success: true,
      data: { id: wiki.id, version: updated.version, revertedTo: body.version },
    });
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/community/wiki/:slug ────────────────────

communityRouter.get('/wiki/:slug', validate({ params: WikiParams }), async (req, res, next) => {
  try {
    const slug = req.params.slug as string;

    const title = await prisma.title.findUnique({
      where: { slug },
      select: { id: true, title: true, coverUrl: true },
    });
    if (!title) throw new NotFoundError('Title', slug);

    const wiki = await prisma.wikiPage.findFirst({
      where: { titleId: title.id },
      orderBy: { version: 'desc' },
      include: {
        author: { select: { id: true, displayName: true } },
        revisions: {
          orderBy: { version: 'desc' },
          take: 20,
          include: { author: { select: { id: true, displayName: true } } },
        },
      },
    });

    res.json({
      success: true,
      data: {
        titleId: title.id,
        title: title.title,
        coverUrl: title.coverUrl,
        wiki: wiki
          ? {
              id: wiki.id,
              slug: wiki.slug,
              contentMd: wiki.contentMd,
              version: wiki.version,
              updatedAt: wiki.updatedAt.toISOString(),
              author: wiki.author,
              revisions: wiki.revisions.map((r) => ({
                id: r.id,
                version: r.version,
                contentMd: r.contentMd,
                createdAt: r.createdAt.toISOString(),
                author: r.author,
              })),
            }
          : null,
      },
    });
  } catch (err) {
    next(err);
  }
});

// ─── PUT /api/community/wiki/:slug ────────────────────

communityRouter.put('/wiki/:slug', requireAuth, validate({ params: WikiParams, body: UpsertWikiSchema }), async (req, res, next) => {
  try {
    const slug = req.params.slug as string;
    const dbUserId = await resolveUserId(req.user!.uid);
    const body = req.body as z.infer<typeof UpsertWikiSchema>;

    const title = await prisma.title.findUnique({
      where: { slug },
      select: { id: true },
    });
    if (!title) throw new NotFoundError('Title', slug);

    // Upsert the page AND append a revision in one transaction so history is
    // never lost: even a concurrent edit rolls back cleanly rather than
    // overwriting someone else's revision.
    const wiki = await prisma.$transaction(async (tx) => {
      const page = await tx.wikiPage.upsert({
        where: { titleId_slug: { titleId: title.id, slug } },
        create: {
          titleId: title.id,
          slug,
          contentMd: body.contentMd,
          authorId: dbUserId,
          version: 1,
        },
        update: {
          contentMd: body.contentMd,
          version: { increment: 1 },
          authorId: dbUserId,
        },
      });

      await tx.wikiRevision.create({
        data: {
          wikiId: page.id,
          authorId: dbUserId,
          contentMd: body.contentMd,
          version: page.version,
        },
      });

      return page;
    });

    // Fire-and-forget: award wiki contribution badges (lore keeper, scribe)
    checkAndAwardAchievements(dbUserId).catch(() => {});

    const isNew = wiki.version === 1 && wiki.createdAt.getTime() > Date.now() - 5000;
    res.status(isNew ? 201 : 200).json({
      success: true,
      data: { id: wiki.id, version: wiki.version, updated: !isNew },
    });
  } catch (err) {
    next(err);
  }
});
