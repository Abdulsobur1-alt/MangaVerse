import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { requireAuth, optionalAuth } from '../middleware/auth.js';
import { NotFoundError, ConflictError } from '../lib/errors.js';
import { resolveUserId } from '../services/coins.js';
import { notifyFollowed } from '../services/notifications.js';

/* ═══════════════════════════════════════════════════════════════
   Social — the Phase 8 social graph.
   • Public profiles (/users/:id) with privacy gating
   • Follow / unfollow + follower & following lists
   • Suggested connections (shared genres + mutual follows)
   • Derived activity timeline (posts, reviews, achievements, library)
   Privacy is honoured at the data layer: a private profile returns
   only identity + counts; activity respects shareActivity.
   ═══════════════════════════════════════════════════════════════ */

export const socialRouter = Router();

// ─── Helpers ──────────────────────────────────────────

async function getPublicUser(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      displayName: true,
      avatarUrl: true,
      role: true,
      streakDays: true,
      createdAt: true,
      prefs: true,
      _count: { select: { followers: true, following: true, reviews: true, communityPosts: true, achievements: true } },
    },
  });
  if (!user) throw new NotFoundError('User');
  return user;
}

/** Genre → count histogram from a user's library (bounded). */
async function getUserGenreCounts(userId: string): Promise<{ genre: string; count: number }[]> {
  const bookmarks = await prisma.bookmark.findMany({
    where: { userId },
    select: { title: { select: { genres: true } } },
    take: 300,
  });
  const counts = new Map<string, number>();
  for (const b of bookmarks) {
    for (const g of b.title.genres) counts.set(g, (counts.get(g) || 0) + 1);
  }
  return [...counts.entries()]
    .map(([genre, count]) => ({ genre, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);
}

/** Latest in-progress chapter per series (for "Currently reading"). */
async function getCurrentReading(userId: string) {
  const progress = await prisma.readingProgress.findMany({
    where: { userId, completed: false },
    include: {
      chapter: {
        include: {
          series: { select: { id: true, slug: true, title: true, coverUrl: true, type: true } },
        },
      },
    },
    orderBy: { updatedAt: 'desc' },
    take: 300,
  });

  const bySeries = new Map<string, { series: { id: string; slug: string; title: string; coverUrl: string | null; type: string }; chapterId: string; chapterNumber: number; pct: number; touchedAt: number }>();
  for (const p of progress) {
    const series = p.chapter.series;
    const existing = bySeries.get(series.id);
    if (existing && p.chapter.number <= existing.chapterNumber) continue;
    const pageCount = p.chapter.pageCount || 20;
    const pct = p.pageNumber ? Math.min(100, Math.round((p.pageNumber / pageCount) * 100)) : 0;
    bySeries.set(series.id, {
      series,
      chapterId: p.chapter.id,
      chapterNumber: p.chapter.number,
      pct,
      touchedAt: p.updatedAt.getTime(),
    });
  }
  return [...bySeries.values()]
    .sort((a, b) => b.touchedAt - a.touchedAt)
    .slice(0, 5)
    .map((e) => ({
      slug: e.series.slug,
      title: e.series.title,
      coverUrl: e.series.coverUrl,
      type: e.series.type,
      chapterId: e.chapterId,
      chapterNumber: e.chapterNumber,
      pct: e.pct,
    }));
}

/** Derived activity timeline: posts, reviews, achievements, library adds. */
async function getActivity(userId: string) {
  const [posts, reviews, achievements, bookmarks] = await Promise.all([
    prisma.communityPost.findMany({
      where: { authorId: userId },
      select: { id: true, title: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
      take: 10,
    }),
    prisma.review.findMany({
      where: { userId },
      select: { id: true, title: { select: { slug: true, title: true } }, rating: true, headline: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
      take: 10,
    }),
    prisma.achievement.findMany({
      where: { userId },
      select: { id: true, badgeId: true, earnedAt: true },
      orderBy: { earnedAt: 'desc' },
      take: 10,
    }),
    prisma.bookmark.findMany({
      where: { userId },
      select: { id: true, title: { select: { slug: true, title: true } }, listName: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
      take: 10,
    }),
  ]);

  const activity: {
    id: string;
    type: 'post' | 'review' | 'achievement' | 'library';
    title: string;
    body?: string;
    link: string;
    at: string;
  }[] = [
    ...posts.map((p) => ({ id: `post-${p.id}`, type: 'post' as const, title: p.title, link: `/community/${p.id}`, at: p.createdAt.toISOString() })),
    ...reviews.map((r) => ({
      id: `review-${r.id}`,
      type: 'review' as const,
      title: `Rated ${r.title.title} ${r.rating}/10`,
      body: r.headline ?? undefined,
      link: `/title/${r.title.slug}`,
      at: r.createdAt.toISOString(),
    })),
    ...achievements.map((a) => ({ id: `ach-${a.id}`, type: 'achievement' as const, title: `Unlocked ${a.badgeId.replace(/_/g, ' ')}`, link: '/dashboard', at: a.earnedAt.toISOString() })),
    ...bookmarks.map((b) => ({ id: `lib-${b.id}`, type: 'library' as const, title: `Added “${b.title.title}” to ${b.listName}`, link: `/title/${b.title.slug}`, at: b.createdAt.toISOString() })),
  ];

  return activity.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime()).slice(0, 30);
}

/** Follow-state between two users (isFollowing / followsYou / mutual). */
async function getFollowState(viewerId: string | null, targetId: string) {
  if (!viewerId || viewerId === targetId) {
    return { isFollowing: false, followsYou: false, mutual: false };
  }
  const [mine, theirs] = await Promise.all([
    prisma.follow.findUnique({
      where: { followerId_followingId: { followerId: viewerId, followingId: targetId } },
    }),
    prisma.follow.findUnique({
      where: { followerId_followingId: { followerId: targetId, followingId: viewerId } },
    }),
  ]);
  return { isFollowing: !!mine, followsYou: !!theirs, mutual: !!mine && !!theirs };
}

// ─── GET /api/social/me/following ─────────────────────
// The ids the viewer follows — powers follow-state across the UI.

socialRouter.get('/me/following', requireAuth, async (req, res, next) => {
  try {
    const me = await resolveUserId(req.user!.uid);
    const rows = await prisma.follow.findMany({
      where: { followerId: me },
      select: { followingId: true },
    });
    res.json({ success: true, data: rows.map((r) => r.followingId) });
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/social/me/followers ─────────────────────

socialRouter.get('/me/followers', requireAuth, async (req, res, next) => {
  try {
    const me = await resolveUserId(req.user!.uid);
    const rows = await prisma.follow.findMany({
      where: { followingId: me },
      include: { follower: { select: { id: true, displayName: true, avatarUrl: true } } },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    const state = await getFollowState(me, me);
    void state;
    res.json({
      success: true,
      data: rows.map((r) => ({ id: r.follower.id, displayName: r.follower.displayName, avatarUrl: r.follower.avatarUrl, since: r.createdAt.toISOString() })),
    });
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/social/users/:id ────────────────────────
// Public profile. Private profiles return identity + counts only.

socialRouter.get('/users/:id', optionalAuth, async (req, res, next) => {
  try {
    const userId = req.params.id as string;
    let viewerId: string | null = null;
    if (req.user?.uid) {
      try { viewerId = await resolveUserId(req.user.uid); } catch { /* anonymous */ }
    }

    const user = await getPublicUser(userId);
    const prefs = (user.prefs as Record<string, unknown>) || {};
    const publicProfile = prefs.publicProfile !== false;
    const shareActivity = prefs.shareActivity !== false;

    const followState = await getFollowState(viewerId, userId);

    // Private profile: only identity + counts (and nothing for the owner themselves).
    if (!publicProfile && viewerId !== userId) {
      res.json({
        success: true,
        data: {
          id: user.id,
          displayName: user.displayName,
          avatarUrl: user.avatarUrl,
          role: user.role,
          createdAt: user.createdAt.toISOString(),
          streakDays: user.streakDays,
          followerCount: user._count.followers,
          followingCount: user._count.following,
          reviewCount: user._count.reviews,
          postCount: user._count.communityPosts,
          achievementCount: user._count.achievements,
          isFollowing: followState.isFollowing,
          followsYou: followState.followsYou,
          mutual: followState.mutual,
          private: true,
        },
      });
      return;
    }

    const [genres, reading, activity] = await Promise.all([
      getUserGenreCounts(userId),
      getCurrentReading(userId),
      viewerId === userId || shareActivity ? getActivity(userId) : Promise.resolve([]),
    ]);

    res.json({
      success: true,
      data: {
        id: user.id,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
        role: user.role,
        createdAt: user.createdAt.toISOString(),
        streakDays: user.streakDays,
        followerCount: user._count.followers,
        followingCount: user._count.following,
        reviewCount: user._count.reviews,
        postCount: user._count.communityPosts,
        achievementCount: user._count.achievements,
        isFollowing: followState.isFollowing,
        followsYou: followState.followsYou,
        mutual: followState.mutual,
        private: false,
        shareActivity,
        favoriteGenres: genres,
        currentReading: reading,
        activity: viewerId === userId || shareActivity ? activity : [],
      },
    });
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/social/users/:id/followers ──────────────

socialRouter.get('/users/:id/followers', optionalAuth, async (req, res, next) => {
  try {
    const userId = req.params.id as string;
    let viewerId: string | null = null;
    if (req.user?.uid) {
      try { viewerId = await resolveUserId(req.user.uid); } catch { /* anonymous */ }
    }

    const rows = await prisma.follow.findMany({
      where: { followingId: userId },
      include: { follower: { select: { id: true, displayName: true, avatarUrl: true } } },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    const withState = await Promise.all(
      rows.map(async (r) => {
        const state = await getFollowState(viewerId, r.follower.id);
        return { id: r.follower.id, displayName: r.follower.displayName, avatarUrl: r.follower.avatarUrl, ...state };
      }),
    );

    res.json({ success: true, data: withState });
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/social/users/:id/following ──────────────

socialRouter.get('/users/:id/following', optionalAuth, async (req, res, next) => {
  try {
    const userId = req.params.id as string;
    let viewerId: string | null = null;
    if (req.user?.uid) {
      try { viewerId = await resolveUserId(req.user.uid); } catch { /* anonymous */ }
    }

    const rows = await prisma.follow.findMany({
      where: { followerId: userId },
      include: { following: { select: { id: true, displayName: true, avatarUrl: true } } },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    const withState = await Promise.all(
      rows.map(async (r) => {
        const state = await getFollowState(viewerId, r.following.id);
        return { id: r.following.id, displayName: r.following.displayName, avatarUrl: r.following.avatarUrl, ...state };
      }),
    );

    res.json({ success: true, data: withState });
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/social/suggestions ──────────────────────
// Readers worth following: shared favorite genres + mutual follows
// score highest. Never suggests someone already followed.

socialRouter.get('/suggestions', requireAuth, async (req, res, next) => {
  try {
    const me = await resolveUserId(req.user!.uid);

    const [followed, myGenres, candidates] = await Promise.all([
      prisma.follow.findMany({ where: { followerId: me }, select: { followingId: true } }),
      getUserGenreCounts(me),
      prisma.user.findMany({
        where: { id: { not: me } },
        select: {
          id: true,
          displayName: true,
          avatarUrl: true,
          createdAt: true,
          _count: { select: { followers: true, communityPosts: true, reviews: true } },
          bookmarks: { select: { title: { select: { genres: true } } }, take: 150 },
        },
        take: 100,
      }),
    ]);

    const followedSet = new Set(followed.map((f) => f.followingId));
    const myGenreSet = new Set(myGenres.map((g) => g.genre));

    // Who among the candidates follows me back (mutual bonus)?
    const candidateIds = candidates.filter((c) => !followedSet.has(c.id)).map((c) => c.id);
    const backRows = await prisma.follow.findMany({
      where: { followerId: { in: candidateIds }, followingId: me },
      select: { followerId: true },
    });
    const backSet = new Set(backRows.map((r) => r.followerId));

    const scored = candidates
      .filter((c) => !followedSet.has(c.id))
      .map((c) => {
        const genreSet = new Set<string>();
        for (const b of c.bookmarks) for (const g of b.title.genres) genreSet.add(g);
        const shared = [...genreSet].filter((g) => myGenreSet.has(g)).length;
        const score =
          shared * 3 +
          (backSet.has(c.id) ? 2 : 0) +
          Math.min(c._count.followers, 20) * 0.1;
        return {
          id: c.id,
          displayName: c.displayName,
          avatarUrl: c.avatarUrl,
          createdAt: c.createdAt.toISOString(),
          followerCount: c._count.followers,
          postCount: c._count.communityPosts,
          sharedGenres: shared,
          mutual: backSet.has(c.id),
          score,
        };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 6);

    res.json({ success: true, data: scored });
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/social/users/:id/follow ────────────────

socialRouter.post('/users/:id/follow', requireAuth, async (req, res, next) => {
  try {
    const targetId = req.params.id as string;
    const me = await resolveUserId(req.user!.uid);

    if (targetId === me) throw new ConflictError('You cannot follow yourself');
    await getPublicUser(targetId);

    const existing = await prisma.follow.findUnique({
      where: { followerId_followingId: { followerId: me, followingId: targetId } },
    });
    if (existing) {
      res.json({ success: true, data: { following: true } });
      return;
    }

    await prisma.follow.create({
      data: { followerId: me, followingId: targetId },
    });

    // Fire-and-forget: tell the target someone followed them.
    const meInfo = await prisma.user.findUnique({ where: { id: me }, select: { displayName: true } });
    notifyFollowed(targetId, meInfo?.displayName || 'Someone', me).catch(() => {});

    const state = await getFollowState(me, targetId);
    res.json({ success: true, data: { following: true, ...state } });
  } catch (err) {
    next(err);
  }
});

// ─── DELETE /api/social/users/:id/follow ──────────────

socialRouter.delete('/users/:id/follow', requireAuth, async (req, res, next) => {
  try {
    const targetId = req.params.id as string;
    const me = await resolveUserId(req.user!.uid);

    const existing = await prisma.follow.findUnique({
      where: { followerId_followingId: { followerId: me, followingId: targetId } },
    });
    if (!existing) {
      res.json({ success: true, data: { following: false } });
      return;
    }

    await prisma.follow.delete({
      where: { followerId_followingId: { followerId: me, followingId: targetId } },
    });

    res.json({ success: true, data: { following: false } });
  } catch (err) {
    next(err);
  }
});
