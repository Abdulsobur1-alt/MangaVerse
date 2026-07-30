import { prisma } from '../lib/prisma.js';

// ─── Types ────────────────────────────────────────────

type NotificationType = 'new_chapter' | 'review_added' | 'review_reply' | 'achievement' | 'milestone' | 'system';

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
  } catch {
    // Silently fail — notifications are non-critical
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

    // Create notifications in parallel (limit concurrency to avoid DB pressure)
    const batchSize = 20;
    for (let i = 0; i < userIds.length; i += batchSize) {
      const batch = userIds.slice(i, i + batchSize);
      await Promise.all(
        batch.map((userId) =>
          createNotification({ userId, type, title, body, link, imageUrl }),
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
