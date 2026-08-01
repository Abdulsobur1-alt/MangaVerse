import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { validate } from '../middleware/validate.js';
import { requireAuth, optionalAuth } from '../middleware/auth.js';
import { NotFoundError, ForbiddenError, ConflictError } from '../lib/errors.js';
import { resolveUserId, spendCoins } from '../services/coins.js';

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

    const post = await prisma.communityPost.findUnique({ where: { id }, select: { id: true } });
    if (!post) throw new NotFoundError('Post', id);

    const comment = await prisma.postComment.create({
      data: { postId: id, authorId: dbUserId, body: body.body },
      include: { author: { select: { id: true, displayName: true, avatarUrl: true } } },
    });

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
            myVote: myVotes.get(p.id) || null,
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
        const guarded = await tx.user.updateMany({
          where: { id: dbUserId, coinBalance: { gte: body.coins } },
          data: { coinBalance: { decrement: body.coins } },
        });
        if (guarded.count === 0) {
          const user = await tx.user.findUnique({ where: { id: dbUserId }, select: { coinBalance: true } });
          return { ok: false, balance: user?.coinBalance ?? 0 };
        }
        await tx.coinTransaction.create({
          data: {
            userId: dbUserId,
            amount: -body.coins,
            type: 'spend',
            referenceId: id,
            description: 'Staked on prediction',
          },
        });
        await tx.predictionVote.create({
          data: {
            predictionId: id,
            userId: dbUserId,
            option: body.option,
            coinsStaked: body.coins,
          },
        });
        const user = await tx.user.findUnique({ where: { id: dbUserId }, select: { coinBalance: true } });
        return { ok: true, balance: user?.coinBalance ?? 0 };
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
      include: { author: { select: { id: true, displayName: true } } },
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

    // Atomic upsert on the (titleId, slug) unique — concurrent first-creates
    // can't collide (one wins, the other becomes an update).
    const wiki = await prisma.wikiPage.upsert({
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

    const isNew = wiki.version === 1 && wiki.createdAt.getTime() > Date.now() - 5000;
    res.status(isNew ? 201 : 200).json({
      success: true,
      data: { id: wiki.id, version: wiki.version, updated: !isNew },
    });
  } catch (err) {
    next(err);
  }
});
