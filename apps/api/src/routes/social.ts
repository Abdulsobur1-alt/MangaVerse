import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { requireAuth, optionalAuth } from '../middleware/auth.js';
import { NotFoundError, ConflictError } from '../lib/errors.js';
import { resolveUserId } from '../services/coins.js';
import { notifyFollowed } from '../services/notifications.js';
import { getReadingAnalytics } from '../services/analytics.js';
import { getPublicPersonality } from '../services/personality.js';
import { checkAndRecordMilestones } from '../services/journey.js';
import { tierForScore } from '../services/reputation.js';
import { readingLevel, usernameFor } from '../services/identity.js';
import { ACHIEVEMENT_CATALOG } from '../services/achievements.js';

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
      email: true,
      displayName: true,
      avatarUrl: true,
      bannerUrl: true,
      bio: true,
      location: true,
      website: true,
      socialLinks: true,
      accentColor: true,
      profileTheme: true,
      layoutStyle: true,
      cardStyle: true,
      role: true,
      streakDays: true,
      reputation: true,
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

/** Count of mutual follows (followers who the target also follows back). */
async function getMutualCount(userId: string): Promise<number> {
  const [theirFollowers, theirFollowing] = await Promise.all([
    prisma.follow.findMany({ where: { followingId: userId }, select: { followerId: true }, take: 500 }),
    prisma.follow.findMany({ where: { followerId: userId }, select: { followingId: true }, take: 500 }),
  ]);
  const followingSet = new Set(theirFollowing.map((f) => f.followingId));
  return theirFollowers.filter((f) => followingSet.has(f.followerId)).length;
}

/** Genres shared between the viewer and the target (for “Shared interests”). */
async function getSharedGenres(viewerId: string | null, targetId: string): Promise<string[]> {
  if (!viewerId || viewerId === targetId) return [];
  const [mine, theirs] = await Promise.all([
    prisma.bookmark.findMany({ where: { userId: viewerId }, select: { title: { select: { genres: true } } }, take: 200 }),
    prisma.bookmark.findMany({ where: { userId: targetId }, select: { title: { select: { genres: true } } }, take: 200 }),
  ]);
  const mySet = new Set<string>();
  for (const b of mine) for (const g of b.title.genres) mySet.add(g);
  const shared = new Set<string>();
  for (const b of theirs) for (const g of b.title.genres) if (mySet.has(g)) shared.add(g);
  return [...shared].slice(0, 6);
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
    const shareStats = prefs.shareStats !== false;
    const shareReading = prefs.shareReading !== false;
    const shareAchievements = prefs.shareAchievements !== false;
    const shareCollections = prefs.shareCollections !== false;
    const shareBookmarks = prefs.shareBookmarks !== false;
    const shareReviews = prefs.shareReviews !== false;
    const shareGoals = prefs.shareGoals !== false;

    const followState = await getFollowState(viewerId, userId);
    const username = usernameFor(user.email, user.id);
    const reputationTier = tierForScore(user.reputation);

    const base = {
      id: user.id,
      displayName: user.displayName,
      username,
      avatarUrl: user.avatarUrl,
      bannerUrl: user.bannerUrl,
      bio: user.bio,
      location: user.location,
      website: user.website,
      socialLinks: (user.socialLinks as Record<string, string>) || {},
      accentColor: user.accentColor,
      profileTheme: user.profileTheme,
      layoutStyle: user.layoutStyle,
      cardStyle: user.cardStyle,
      role: user.role,
      createdAt: user.createdAt.toISOString(),
      streakDays: user.streakDays,
      reputationTier,
      followerCount: user._count.followers,
      followingCount: user._count.following,
      reviewCount: user._count.reviews,
      postCount: user._count.communityPosts,
      achievementCount: user._count.achievements,
      isFollowing: followState.isFollowing,
      followsYou: followState.followsYou,
      mutual: followState.mutual,
    };

    // Private profile: identity + trust signal only.
    if (!publicProfile && viewerId !== userId) {
      res.json({ success: true, data: { ...base, private: true } });
      return;
    }

    const [genres, reading, activity, mutualCount, sharedGenres] = await Promise.all([
      shareStats ? getUserGenreCounts(userId) : Promise.resolve([]),
      shareReading ? getCurrentReading(userId) : Promise.resolve([]),
      viewerId === userId || shareActivity ? getActivity(userId) : Promise.resolve([]),
      getMutualCount(userId),
      getSharedGenres(viewerId, userId),
    ]);

    // ─── Gated showcase sections ───────────────────
    const sections: Record<string, unknown> = {};

    if (viewerId === userId || shareStats) {
      const stats = await getReadingAnalytics(userId);
      sections.stats = stats;
      sections.readingLevel = readingLevel(stats.totalChapters);
      sections.personality = await getPublicPersonality(userId);
    }
    if (viewerId === userId || shareAchievements) {
      const earned = await prisma.achievement.findMany({
        where: { userId },
        select: { badgeId: true, earnedAt: true },
        orderBy: { earnedAt: 'desc' },
        take: 12,
      });
      sections.achievements = earned
        .map((a) => {
          const badge = ACHIEVEMENT_CATALOG.find((b) => b.id === a.badgeId);
          if (!badge) return null;
          return { badgeId: badge.id, name: badge.name, emoji: badge.emoji, description: badge.description, category: badge.category, earnedAt: a.earnedAt.toISOString() };
        })
        .filter(Boolean);
    }
    if (viewerId === userId || shareCollections) {
      const collections = await prisma.collection.findMany({
        where: { userId, isPrivate: false },
        include: { _count: { select: { items: true } } },
        orderBy: { updatedAt: 'desc' },
        take: 6,
      });
      sections.collections = collections.map((c) => ({
        id: c.id,
        name: c.name,
        description: c.description,
        coverUrl: c.coverUrl,
        itemCount: c._count.items,
        updatedAt: c.updatedAt.toISOString(),
      }));
    }
    if (viewerId === userId || shareReviews) {
      const reviews = await prisma.review.findMany({
        where: { userId },
        include: { title: { select: { slug: true, title: true, coverUrl: true, type: true } } },
        orderBy: { createdAt: 'desc' },
        take: 6,
      });
      sections.reviews = reviews.map((r) => ({
        id: r.id,
        rating: r.rating,
        headline: r.headline,
        spoiler: r.spoiler,
        helpfulCount: r.helpfulCount,
        createdAt: r.createdAt.toISOString(),
        title: r.title,
      }));
    }
    if (viewerId === userId || shareBookmarks) {
      const bookmarks = await prisma.bookmark.findMany({
        where: { userId },
        include: { title: { select: { slug: true, title: true, coverUrl: true, type: true, rating: true, totalChapters: true } } },
        orderBy: { createdAt: 'desc' },
        take: 8,
      });
      sections.bookmarks = bookmarks.map((b) => b.title);
    }
    if (viewerId === userId || shareGoals) {
      const goals = await prisma.readingGoal.findMany({ where: { userId, active: true }, orderBy: { createdAt: 'asc' }, take: 3 });
      sections.goals = goals.map((g) => ({
        id: g.id,
        title: g.title,
        type: g.type,
        target: g.target,
        endsAt: g.endsAt ? g.endsAt.toISOString() : null,
      }));
    }

    res.json({
      success: true,
      data: {
        ...base,
        private: false,
        shareActivity,
        mutualCount,
        sharedGenres,
        favoriteGenres: genres,
        currentReading: reading,
        activity: viewerId === userId || shareActivity ? activity : [],
        sections,
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

    // Honor the shareFollowers privacy pref: non-owners get an empty list
    // when the target has turned their follower list off (Phase 9).
    if (viewerId !== userId) {
      const target = await prisma.user.findUnique({
        where: { id: userId },
        select: { prefs: true },
      });
      const prefs = (target?.prefs as Record<string, unknown>) || {};
      if (prefs.shareFollowers === false) {
        res.json({ success: true, data: [] });
        return;
      }
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

    // Honor the shareFollowing privacy pref (Phase 9).
    if (viewerId !== userId) {
      const target = await prisma.user.findUnique({
        where: { id: userId },
        select: { prefs: true },
      });
      const prefs = (target?.prefs as Record<string, unknown>) || {};
      if (prefs.shareFollowing === false) {
        res.json({ success: true, data: [] });
        return;
      }
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

    // First follower — a journey milestone for the target.
    checkAndRecordMilestones(targetId).catch(() => {});

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
