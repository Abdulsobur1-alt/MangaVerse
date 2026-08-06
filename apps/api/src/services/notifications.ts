import { prisma } from '../lib/prisma.js';
import { sendWebPushToUser } from './webpush.js';

// ─── Types ────────────────────────────────────────────

type NotificationType = 'new_chapter' | 'review_added' | 'review_reply' | 'achievement' | 'milestone' | 'system' | 'comment' | 'prediction' | 'new_follower' | 'review_helpful' | 'reply';

interface CreateNotificationParams {
  userId: string;
  type: NotificationType;
  title: string;
  body?: string;
  link?: string;
  imageUrl?: string;
}

// ─── Core notification creator ────────────────────────

async function createNotification(params: CreateNotificationParams): Promise<void> {
  try {
    await prisma.notification.create({
      data: {
        userId: params.userId,
        type: params.type,
        title: params.title,
        body: params.body || null,
        link: params.link || null,
        imageUrl: params.imageUrl || null,
      },
    });

    // Mirror to a browser web push (fire-and-forget, pref-gated at the
    // call site). If VAPID keys aren't configured this is a no-op.
    sendWebPushToUser(params.userId, {
      title: params.title,
      body: params.body || undefined,
      link: params.link || undefined,
    }).catch(() => {});
  } catch {
    // Silently fail — notifications are non-critical
  }
}

// ─── Check if user has a notification type enabled ────

// Map notification types to preference keys
const NOTIF_TYPE_TO_PREF_KEY: Record<string, string> = {
  new_chapter: 'new_chapter',
  review_added: 'reviews',
  review_reply: 'reviews',
  review_helpful: 'reviews',
  achievement: 'achievements',
  milestone: 'milestones',
  system: 'system',
  comment: 'community',
  reply: 'community',
  new_follower: 'community',
  prediction: 'community',
};

async function userHasPrefEnabled(userId: string, type: string): Promise<boolean> {
  try {
    const prefKey = NOTIF_TYPE_TO_PREF_KEY[type];
    if (!prefKey || type === 'system') return true; // Unknown types + system always send

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { notificationPrefs: true },
    });
    if (!user) return false;

    const prefs = (user.notificationPrefs as Record<string, boolean>) || {};
    return prefs[prefKey] !== false; // Default to enabled
  } catch {
    return true; // On error, send the notification
  }
}

// ─── Notify all users who bookmarked a title ─────────

async function notifyBookmarkedUsers(
  titleId: string,
  type: NotificationType,
  title: string,
  body?: string,
  link?: string,
  imageUrl?: string,
  excludeUserId?: string,
): Promise<void> {
  try {
    const bookmarks = await prisma.bookmark.findMany({
      where: { titleId },
      select: { userId: true },
    });

    const userIds = excludeUserId
      ? bookmarks.filter((b) => b.userId !== excludeUserId).map((b) => b.userId)
      : bookmarks.map((b) => b.userId);

    // Batch-fetch all users' preferences in one query instead of N+1
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, notificationPrefs: true },
    });
    const eligibleUserIds = users
      .filter((u) => {
        const prefs = (u.notificationPrefs as Record<string, boolean>) || {};
        const prefKey = NOTIF_TYPE_TO_PREF_KEY[type];
        if (!prefKey || type === 'system') return true;
        return prefs[prefKey] !== false;
      })
      .map((u) => u.id);

    // Create notifications in parallel (limit concurrency to avoid DB pressure)
    const batchSize = 20;
    for (let i = 0; i < eligibleUserIds.length; i += batchSize) {
      const batch = eligibleUserIds.slice(i, i + batchSize);
      await Promise.all(
        batch.map((uid) =>
          createNotification({ userId: uid, type, title, body, link, imageUrl }),
        ),
      );
    }
  } catch {
    // Silently fail
  }
}

// ─── New chapter notification ─────────────────────────

export async function notifyNewChapter(
  titleId: string,
  chapterNumber: number,
  chapterTitle: string | null,
): Promise<void> {
  try {
    const title = await prisma.title.findUnique({
      where: { id: titleId },
      select: { slug: true, title: true, coverUrl: true },
    });
    if (!title) return;

    const chapterLabel = `Ch. ${chapterNumber}${chapterTitle ? ` — ${chapterTitle}` : ''}`;
    const link = `/title/${title.slug}`;
    const body = `${chapterLabel} is now available!`;

    await notifyBookmarkedUsers(
      titleId,
      'new_chapter',
      `📖 New chapter of ${title.title}`,
      body,
      link,
      title.coverUrl ?? undefined,
    );
  } catch {
    // Silently fail
  }
}

// ─── Review notification ──────────────────────────────

export async function notifyReviewAdded(
  titleId: string,
  reviewerDisplayName: string,
  reviewerId: string,
  rating: number,
): Promise<void> {
  try {
    const title = await prisma.title.findUnique({
      where: { id: titleId },
      select: { slug: true, title: true, coverUrl: true },
    });
    if (!title) return;

    const link = `/title/${title.slug}`;
    const body = `${reviewerDisplayName} rated ${title.title} ${rating}/10`;

    await notifyBookmarkedUsers(
      titleId,
      'review_added',
      `⭐ New review for ${title.title}`,
      body,
      link,
      title.coverUrl ?? undefined,
      reviewerId, // Don't notify the reviewer themselves
    );
  } catch {
    // Silently fail
  }
}

// ─── Comment notification ─────────────────────────────

/** Notify a post author that someone commented on their post. */
export async function notifyCommentAdded(
  postAuthorId: string,
  commenterDisplayName: string,
  postTitle: string,
  postId: string,
): Promise<void> {
  try {
    if (!(await userHasPrefEnabled(postAuthorId, 'comment'))) return;
    await createNotification({
      userId: postAuthorId,
      type: 'comment',
      title: `💬 ${commenterDisplayName} commented on your post`,
      body: `\"${postTitle}\"`,
      link: `/community/${postId}`,
    });
  } catch {
    // Silently fail — notifications are non-critical
  }
}

// ─── New follower notification ───────────────────────

/** Notify a user that someone followed them. */
export async function notifyFollowed(
  targetUserId: string,
  followerName: string,
  followerId: string,
): Promise<void> {
  try {
    if (!(await userHasPrefEnabled(targetUserId, 'new_follower'))) return;
    await createNotification({
      userId: targetUserId,
      type: 'new_follower',
      title: `👤 ${followerName} followed you`,
      body: 'They can now see your public activity — say hi!',
      link: `/user/${followerId}`,
    });
  } catch {
    // Silently fail — notifications are non-critical
  }
}

// ─── Review helpful notification ─────────────────────

/** Notify a review author that someone marked their review helpful. */
export async function notifyReviewHelpful(
  authorId: string,
  helperName: string,
  titleSlug: string,
): Promise<void> {
  try {
    if (!(await userHasPrefEnabled(authorId, 'review_helpful'))) return;
    await createNotification({
      userId: authorId,
      type: 'review_helpful',
      title: `👍 ${helperName} found your review helpful`,
      body: 'Your review is helping other readers decide.',
      link: `/title/${titleSlug}`,
    });
  } catch {
    // Silently fail — notifications are non-critical
  }
}

// ─── Reply notification ──────────────────────────────

/** Notify the parent-comment author when someone replies to their comment. */
export async function notifyReplyAdded(
  parentAuthorId: string,
  replierName: string,
  postTitle: string,
  postId: string,
): Promise<void> {
  try {
    if (!(await userHasPrefEnabled(parentAuthorId, 'reply'))) return;
    await createNotification({
      userId: parentAuthorId,
      type: 'reply',
      title: `💬 ${replierName} replied to your comment`,
      body: `\"${postTitle}\"`,
      link: `/community/${postId}`,
    });
  } catch {
    // Silently fail — notifications are non-critical
  }
}

// ─── Prediction resolved notification ────────────────

/** Notify a voter that a prediction market resolved (won or lost). */
export async function notifyPredictionResolved(
  userId: string,
  question: string,
  winningOption: string,
  won: boolean,
  winnings: number,
): Promise<void> {
  try {
    if (!(await userHasPrefEnabled(userId, 'prediction'))) return;
    await createNotification({
      userId,
      type: 'prediction',
      title: won ? `🎉 You won ${winnings} coins on a prediction!` : '🔮 Prediction resolved',
      body: `\"${question}\" — ${winningOption} won`,
      link: '/community',
    });
  } catch {
    // Silently fail — notifications are non-critical
  }
}

// ─── Achievement unlocked notification ───────────────

export async function notifyAchievementUnlocked(
  userId: string,
  badgeName: string,
  badgeEmoji: string,
  description: string,
): Promise<void> {
  try {
    if (!(await userHasPrefEnabled(userId, 'achievement'))) return;
    await createNotification({
      userId,
      type: 'achievement',
      title: `🏆 ${badgeEmoji} ${badgeName} unlocked!`,
      body: description,
      link: '/dashboard',
    });
  } catch {
    // Silently fail — notifications are non-critical
  }
}

// ─── Milestone notification ───────────────────────────

const MILESTONE_THRESHOLDS = [1, 5, 10, 25, 50, 100, 200, 500];

export async function checkAndNotifyMilestone(userId: string): Promise<void> {
  try {
    const completedCount = await prisma.readingProgress.count({
      where: { userId, completed: true },
    });

    for (const threshold of MILESTONE_THRESHOLDS) {
      if (completedCount === threshold) {
        const title =
          threshold === 1
            ? '🎉 Read your first chapter!'
            : `🎉 Read ${threshold} chapters!`;

        const body =
          threshold === 1
            ? 'Welcome to MangaVerse! Your reading journey begins.'
            : `You've read ${threshold} chapters. Keep it up!`;

        await createNotification({
          userId,
          type: 'milestone',
          title,
          body,
          link: '/dashboard',
        });
        break; // Only send the highest applicable milestone
      }
    }
  } catch {
    // Silently fail
  }
}

// ─── System notification (for admin/announcements) ─────

export async function createSystemNotification(
  userIds: string[],
  title: string,
  body?: string,
  link?: string,
): Promise<void> {
  await Promise.all(
    userIds.map((userId) =>
      createNotification({
        userId,
        type: 'system',
        title,
        body,
        link,
      }),
    ),
  );
}

// ─── Seed demo notifications for new users ────────────

export async function seedDemoNotifications(userId: string): Promise<void> {
  const demoNotifs: CreateNotificationParams[] = [
    {
      userId,
      type: 'system',
      title: '👋 Welcome to MangaVerse!',
      body: 'Start exploring thousands of manga, manhwa, and light novels.',
      link: '/browse',
    },
    {
      userId,
      type: 'achievement',
      title: '🏆 Reader Badge Unlocked',
      body: 'You earned the "New Reader" badge for joining MangaVerse.',
      link: '/dashboard',
    },
    {
      userId,
      type: 'milestone',
      title: '📚 Tip: Track your reading',
      body: 'Add titles to your library and we\'ll notify you about new chapters!',
      link: '/browse',
    },
  ];

  await Promise.all(
    demoNotifs.map((n) => createNotification(n)),
  );
}
