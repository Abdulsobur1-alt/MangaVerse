import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { validate } from '../middleware/validate.js';
import { optionalAuth } from '../middleware/auth.js';
import { NotFoundError } from '../lib/errors.js';

export const activityRouter = Router();

/* ═══════════════════════════════════════════════════════════════
   Activity feed (Phase 10) — composed live from existing social data,
   so there's no separate events table to keep in sync:
   • friends   — reviews, posts, milestones and lists from people I follow
   • highlights — top community posts + active platform announcements
   • mine      — my own milestones, reviews and posts
   • all       — friends + highlights merged (default)
   ═══════════════════════════════════════════════════════════════ */

const FeedQuery = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  kind: z.enum(['all', 'friends', 'highlights', 'mine']).default('all'),
});

interface FeedItem {
  id: string;
  kind: 'friend' | 'highlight' | 'mine' | 'platform';
  type: string; // review | post | milestone | list | announcement
  actor: { id: string; name: string; avatar: string | null } | null;
  emoji: string;
  title: string;
  body: string | null;
  link: string | null;
  time: string;
}

async function resolveViewerUid(firebaseUid?: string) {
  if (!firebaseUid) return null;
  const user = await prisma.user.findUnique({
    where: { firebaseUid },
    select: { id: true },
  });
  return user?.id ?? null;
}

async function loadFollowingIds(userId: string | null): Promise<string[]> {
  if (!userId) return [];
  const rows = await prisma.follow.findMany({
    where: { followerId: userId },
    select: { followingId: true },
  });
  return rows.map((r) => r.followingId);
}

async function loadFriendsItems(followingIds: string[]): Promise<FeedItem[]> {
  if (followingIds.length === 0) return [];
  const items: FeedItem[] = [];

  // Respect each followed user's profile privacy: a private profile (or
  // per-section hidden stats/reviews) must not leak into the feed even
  // though we follow them.
  const followed = await prisma.user.findMany({
    where: { id: { in: followingIds } },
    select: { id: true, prefs: true },
  });
  const visibleIds = new Set(
    followed
      .filter((u) => {
        const prefs = (u.prefs ?? {}) as Record<string, unknown>;
        return prefs.publicProfile !== false && prefs.shareActivity !== false;
      })
      .map((u) => u.id),
  );
  const visibleFollowing = followingIds.filter((id) => visibleIds.has(id));
  if (visibleFollowing.length === 0) return [];
  // Reviews additionally respect the shareReviews toggle
  const reviewVisibleIds = new Set(
    followed
      .filter((u) => {
        const prefs = (u.prefs ?? {}) as Record<string, unknown>;
        return prefs.publicProfile !== false && prefs.shareReviews !== false;
      })
      .map((u) => u.id),
  );

  const [reviews, posts, milestones, lists] = await Promise.all([
    prisma.review
      .findMany({
        where: { userId: { in: followingIds } },
        orderBy: { createdAt: 'desc' },
        take: 20,
        include: {
          user: { select: { id: true, displayName: true, avatarUrl: true } },
          title: { select: { slug: true, title: true, coverUrl: true } },
        },
      })
      .then((rows) => rows.filter((r) => reviewVisibleIds.has(r.userId))),
    prisma.communityPost.findMany({
      where: { authorId: { in: visibleFollowing } },
      orderBy: { createdAt: 'desc' },
      take: 20,
      include: { author: { select: { id: true, displayName: true, avatarUrl: true } } },
    }),
    prisma.profileMilestone.findMany({
      where: { userId: { in: visibleFollowing } },
      orderBy: { achievedAt: 'desc' },
      take: 20,
      include: { user: { select: { id: true, displayName: true, avatarUrl: true } } },
    }),
    prisma.userList.findMany({
      where: { userId: { in: visibleFollowing }, isPublic: true },
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: { user: { select: { id: true, displayName: true, avatarUrl: true } } },
    }),
  ]);

  for (const r of reviews) {
    items.push({
      id: `review-${r.id}`,
      kind: 'friend',
      type: 'review',
      actor: { id: r.user.id, name: r.user.displayName, avatar: r.user.avatarUrl },
      emoji: '⭐',
      title: `${r.user.displayName} rated ${r.title.title} ${r.rating}/10`,
      body: r.headline || (r.body ? r.body.slice(0, 140) : null),
      link: `/title/${r.title.slug}`,
      time: r.createdAt.toISOString(),
    });
  }
  for (const p of posts) {
    items.push({
      id: `post-${p.id}`,
      kind: 'friend',
      type: 'post',
      actor: { id: p.author.id, name: p.author.displayName, avatar: p.author.avatarUrl },
      emoji: '💬',
      title: `${p.author.displayName} posted “${p.title}”`,
      body: p.body.slice(0, 140),
      link: `/community/${p.id}`,
      time: p.createdAt.toISOString(),
    });
  }
  for (const m of milestones) {
    items.push({
      id: `milestone-${m.id}`,
      kind: 'friend',
      type: 'milestone',
      actor: { id: m.user.id, name: m.user.displayName, avatar: m.user.avatarUrl },
      emoji: m.emoji,
      title: `${m.user.displayName} ${m.title}`,
      body: m.detail || null,
      link: `/user/${m.user.id}`,
      time: m.achievedAt.toISOString(),
    });
  }
  for (const l of lists) {
    items.push({
      id: `list-${l.id}`,
      kind: 'friend',
      type: 'list',
      actor: { id: l.user.id, name: l.user.displayName, avatar: l.user.avatarUrl },
      emoji: '📚',
      title: `${l.user.displayName} shared a list: “${l.name}”`,
      body: l.description ? l.description.slice(0, 140) : null,
      link: `/list/${l.id}`,
      time: l.createdAt.toISOString(),
    });
  }
  return items;
}

async function loadHighlightItems(): Promise<FeedItem[]> {
  const items: FeedItem[] = [];

  const [topPosts, announcements] = await Promise.all([
    prisma.communityPost.findMany({
      orderBy: { createdAt: 'desc' },
      take: 12,
      include: {
        author: { select: { id: true, displayName: true, avatarUrl: true } },
        _count: { select: { votes: true, comments: true } },
      },
    }),
    prisma.announcement.findMany({
      where: {
        active: true,
        OR: [{ startsAt: null }, { startsAt: { lte: new Date() } }],
        AND: [{ OR: [{ endsAt: null }, { endsAt: { gte: new Date() } }] }],
        audience: 'all',
      },
      orderBy: { createdAt: 'desc' },
      take: 6,
    }),
  ]);

  for (const p of topPosts) {
    items.push({
      id: `post-${p.id}`,
      kind: 'highlight',
      type: 'post',
      actor: { id: p.author.id, name: p.author.displayName, avatar: p.author.avatarUrl },
      emoji: '🔥',
      title: `Trending: “${p.title}”`,
      body: p.body.slice(0, 140),
      link: `/community/${p.id}`,
      time: p.createdAt.toISOString(),
    });
  }
  for (const a of announcements) {
    items.push({
      id: `ann-${a.id}`,
      kind: 'platform',
      type: 'announcement',
      actor: null,
      emoji: a.variant === 'warning' ? '⚠️' : a.variant === 'maintenance' ? '🛠️' : '📣',
      title: a.title,
      body: a.body ? a.body.slice(0, 160) : null,
      link: a.link || null,
      time: a.createdAt.toISOString(),
    });
  }
  return items;
}

async function loadMyItems(userId: string): Promise<FeedItem[]> {
  const items: FeedItem[] = [];

  const [milestones, reviews, posts] = await Promise.all([
    prisma.profileMilestone.findMany({
      where: { userId },
      orderBy: { achievedAt: 'desc' },
      take: 25,
    }),
    prisma.review.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: { title: { select: { slug: true, title: true } } },
    }),
    prisma.communityPost.findMany({
      where: { authorId: userId },
      orderBy: { createdAt: 'desc' },
      take: 10,
    }),
  ]);

  for (const m of milestones) {
    items.push({
      id: `milestone-${m.id}`,
      kind: 'mine',
      type: 'milestone',
      actor: null,
      emoji: m.emoji,
      title: m.title,
      body: m.detail || null,
      link: '/dashboard',
      time: m.achievedAt.toISOString(),
    });
  }
  for (const r of reviews) {
    items.push({
      id: `review-${r.id}`,
      kind: 'mine',
      type: 'review',
      actor: null,
      emoji: '⭐',
      title: `You rated ${r.title.title} ${r.rating}/10`,
      body: r.headline || null,
      link: `/title/${r.title.slug}`,
      time: r.createdAt.toISOString(),
    });
  }
  for (const p of posts) {
    items.push({
      id: `post-${p.id}`,
      kind: 'mine',
      type: 'post',
      actor: null,
      emoji: '💬',
      title: `You posted “${p.title}”`,
      body: p.body.slice(0, 140),
      link: `/community/${p.id}`,
      time: p.createdAt.toISOString(),
    });
  }
  return items;
}

// ─── GET /api/activity ────────────────────────────────

activityRouter.get('/', optionalAuth, validate({ query: FeedQuery }), async (req, res, next) => {
  try {
    const q = req.query as unknown as z.infer<typeof FeedQuery>;
    const viewerId = await resolveViewerUid(req.user?.uid);
    const followingIds = await loadFollowingIds(viewerId);

    let items: FeedItem[] = [];
    if (q.kind === 'friends') {
      items = await loadFriendsItems(followingIds);
    } else if (q.kind === 'highlights') {
      items = await loadHighlightItems();
    } else if (q.kind === 'mine') {
      if (!viewerId) throw new NotFoundError('User');
      items = await loadMyItems(viewerId);
    } else {
      const [friends, highlights, mine] = await Promise.all([
        loadFriendsItems(followingIds),
        loadHighlightItems(),
        viewerId ? loadMyItems(viewerId) : Promise.resolve([] as FeedItem[]),
      ]);
      items = [...friends, ...mine, ...highlights];
    }

    items.sort((a, b) => (a.time < b.time ? 1 : -1));
    const skip = (q.page - 1) * q.limit;
    const pageItems = items.slice(skip, skip + q.limit);

    res.json({
      success: true,
      data: {
        items: pageItems,
        total: items.length,
        page: q.page,
        limit: q.limit,
        hasMore: skip + pageItems.length < items.length,
        sources: { following: followingIds.length },
      },
    });
  } catch (err) {
    next(err);
  }
});
