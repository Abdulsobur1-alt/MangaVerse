import { prisma } from '../lib/prisma.js';
import { sendWebPushToUser } from './webpush.js';
import { broadcastToUser, broadcastToMany, type RealtimeEvent } from '../lib/realtime.js';

/* ═══════════════════════════════════════════════════════════════
   Notifications — the Phase 10 engagement engine.
   Philosophy: every notification must earn its interruption.
   • Priorities (critical > high > normal > silent > background) drive
     push behavior: silent/background are in-app only, silent/background
     never push, 'important' push mode only pushes high/critical.
   • Categories group the center (chapters/social/community/
     achievements/system/reminders).
   • Dedupe keys coalesce burst events (e.g. multiple new chapters of
     the same series) into one live entry.
   • Quiet hours + Do-Not-Disturb gate push delivery.
   • Digests summarize missed notifications; reminders nudge streaks,
     goals, and abandoned reads — every reminder is daily-deduped.
   • Templates let admins edit copy; {tokens} are substituted at send.
   ═══════════════════════════════════════════════════════════════ */

// ─── Types ────────────────────────────────────────────

export type NotificationType =
  | 'new_chapter'
  | 'review_added'
  | 'review_reply'
  | 'review_helpful'
  | 'comment'
  | 'reply'
  | 'new_follower'
  | 'achievement'
  | 'milestone'
  | 'reminder'
  | 'recommendation'
  | 'announcement'
  | 'security'
  | 'moderator'
  | 'prediction'
  | 'system';

export type NotificationPriority = 'critical' | 'high' | 'normal' | 'silent' | 'background';
export type NotificationCategory = 'chapters' | 'social' | 'community' | 'achievements' | 'system' | 'reminders';

interface TypeMeta {
  category: NotificationCategory;
  priority: NotificationPriority;
  prefKey: string;
}

const TYPE_META: Record<NotificationType, TypeMeta> = {
  new_chapter: { category: 'chapters', priority: 'normal', prefKey: 'new_chapter' },
  review_added: { category: 'community', priority: 'normal', prefKey: 'reviews' },
  review_reply: { category: 'community', priority: 'normal', prefKey: 'reviews' },
  review_helpful: { category: 'community', priority: 'normal', prefKey: 'reviews' },
  comment: { category: 'community', priority: 'normal', prefKey: 'community' },
  reply: { category: 'community', priority: 'normal', prefKey: 'community' },
  new_follower: { category: 'social', priority: 'normal', prefKey: 'community' },
  achievement: { category: 'achievements', priority: 'normal', prefKey: 'achievements' },
  milestone: { category: 'achievements', priority: 'normal', prefKey: 'milestones' },
  reminder: { category: 'reminders', priority: 'silent', prefKey: 'reminders' },
  recommendation: { category: 'reminders', priority: 'background', prefKey: 'recommendations' },
  announcement: { category: 'system', priority: 'high', prefKey: 'system' },
  security: { category: 'system', priority: 'critical', prefKey: 'system' },
  moderator: { category: 'system', priority: 'high', prefKey: 'system' },
  prediction: { category: 'community', priority: 'normal', prefKey: 'community' },
  system: { category: 'system', priority: 'normal', prefKey: 'system' },
};

// ─── Preferences ──────────────────────────────────────

export interface NotificationPrefs {
  // Category toggles (legacy keys preserved for backwards compat)
  new_chapter: boolean;
  reviews: boolean;
  milestones: boolean;
  achievements: boolean;
  community: boolean;
  system: boolean;
  reminders: boolean;
  recommendations: boolean;
  // Channels — which priorities may use each channel
  push: 'all' | 'important' | 'off';
  email: 'all' | 'important' | 'off';
  // Digest frequency
  digest: 'off' | 'daily' | 'weekly' | 'monthly';
  // Quiet hours (HH:MM local) — no pushes during this window
  quietHours: { enabled: boolean; start: string; end: string };
  // Do-Not-Disturb until epoch ms (0 = not active)
  dndUntil: number;
  // Announcement visibility
  announcementVisibility: 'all' | 'important' | 'off';
  // Internal: last digest run (epoch ms)
  lastDigestAt?: number;
}

export const DEFAULT_NOTIF_PREFS: NotificationPrefs = {
  new_chapter: true,
  reviews: true,
  milestones: true,
  achievements: true,
  community: true,
  system: true,
  reminders: true,
  recommendations: true,
  push: 'all',
  email: 'off',
  digest: 'weekly',
  quietHours: { enabled: false, start: '22:00', end: '08:00' },
  dndUntil: 0,
  announcementVisibility: 'all',
};

export function normalizeNotifPrefs(raw: unknown): NotificationPrefs {
  const r = (raw ?? {}) as Record<string, unknown>;
  const qh = (r.quietHours ?? {}) as Record<string, unknown>;
  return {
    ...DEFAULT_NOTIF_PREFS,
    ...r,
    quietHours: {
      enabled: qh.enabled === true,
      start: typeof qh.start === 'string' ? qh.start : DEFAULT_NOTIF_PREFS.quietHours.start,
      end: typeof qh.end === 'string' ? qh.end : DEFAULT_NOTIF_PREFS.quietHours.end,
    },
    dndUntil: typeof r.dndUntil === 'number' ? r.dndUntil : 0,
  };
}

export async function loadNotifPrefs(userId: string): Promise<NotificationPrefs> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { notificationPrefs: true },
    });
    return normalizeNotifPrefs(user?.notificationPrefs);
  } catch {
    return DEFAULT_NOTIF_PREFS;
  }
}

// ─── Quiet hours / DND helpers ────────────────────────

/** True when pushes should be suppressed right now (quiet hours or DND). */
export function isPushWindowBlocked(prefs: NotificationPrefs, now = new Date()): boolean {
  if (prefs.dndUntil > now.getTime()) return true;
  if (!prefs.quietHours.enabled) return false;
  const minutes = now.getHours() * 60 + now.getMinutes();
  const [sh, sm] = prefs.quietHours.start.split(':').map(Number);
  const [eh, em] = prefs.quietHours.end.split(':').map(Number);
  const start = sh * 60 + sm;
  const end = eh * 60 + em;
  if (start === end) return false;
  // Window may cross midnight
  return start < end ? minutes >= start && minutes < end : minutes >= start || minutes < end;
}

/** Which priorities are allowed to push for a user right now. */
export function pushPriorityAllowed(prefs: NotificationPrefs, priority: NotificationPriority, now = new Date()): boolean {
  if (prefs.push === 'off') return false;
  if (isPushWindowBlocked(prefs, now)) return false;
  if (priority === 'critical' || priority === 'high') return true;
  return prefs.push === 'all';
}

// ─── Templates ────────────────────────────────────────

export interface TemplateTokens {
  [key: string]: string;
}

export function renderTemplate(text: string, tokens: TemplateTokens): string {
  return text.replace(/\{(\w+)\}/g, (match, key: string) => (key in tokens ? tokens[key] : match));
}

const FALLBACK_TEMPLATES: Record<string, { title: string; body: string | null; link: string | null }> = {
  new_chapter: { title: '📖 New chapter of {series}', body: 'Ch. {chapter} is now available!', link: '/title/{slug}' },
  review_added: { title: '⭐ New review for {series}', body: '{reviewer} rated {series} {rating}/10', link: '/title/{slug}' },
  comment: { title: '💬 {name} commented on your post', body: '"{post}"', link: '/community/{postId}' },
  reply: { title: '💬 {name} replied to your comment', body: '"{post}"', link: '/community/{postId}' },
  new_follower: { title: '👤 {name} followed you', body: 'They can now see your public activity.', link: '/user/{userId}' },
  review_helpful: { title: '👍 {name} found your review helpful', body: 'Your review is helping other readers decide.', link: '/title/{slug}' },
  achievement: { title: '🏆 {badge} unlocked!', body: '{description}', link: '/dashboard' },
  milestone: { title: '🎉 {message}', body: null, link: '/dashboard' },
  prediction: { title: '🔮 {message}', body: '{detail}', link: '/community' },
  reminder_streak: { title: '🔥 Don\'t lose your {days}-day streak!', body: 'Read one chapter today to keep it alive.', link: '/history' },
  reminder_continue: { title: '📚 Pick up where you left off', body: 'You haven\'t read in a while — {series} is waiting.', link: '/reader/{chapterId}' },
  reminder_goal: { title: '🎯 You\'re {remaining} chapters from your goal', body: 'A quick chapter would put you on track for this {period}.', link: '/goals' },
  digest: { title: '📬 Your {period} digest', body: '{highlights} highlights while you were away.', link: '/notifications' },
  announcement: { title: '📣 {title}', body: '{body}', link: '{link}' },
};

/** Fetch an admin template (falls back to built-in copy). */
export async function renderFromTemplate(
  key: string,
  tokens: TemplateTokens,
): Promise<{ title: string; body: string | null; link: string | null }> {
  try {
    const tpl = await prisma.notificationTemplate.findUnique({ where: { key } });
    if (tpl?.active) {
      return {
        title: renderTemplate(tpl.title, tokens),
        body: tpl.body ? renderTemplate(tpl.body, tokens) : null,
        link: tpl.link ? renderTemplate(tpl.link, tokens) : null,
      };
    }
  } catch {
    // Fall through to built-in
  }
  const fallback = FALLBACK_TEMPLATES[key];
  if (!fallback) return { title: '🔔 New notification', body: null, link: null };
  return {
    title: renderTemplate(fallback.title, tokens),
    body: fallback.body ? renderTemplate(fallback.body, tokens) : null,
    link: fallback.link ? renderTemplate(fallback.link, tokens) : null,
  };
}

// ─── Core creator ─────────────────────────────────────

export interface CreateNotificationParams {
  userId: string;
  type: NotificationType;
  title: string;
  body?: string;
  link?: string;
  imageUrl?: string;
  data?: Record<string, unknown>;
  /** Coalesces bursts — an unread notification with the same key is bumped instead of duplicated. */
  dedupeKey?: string;
  /** Overrides for the type's defaults. */
  priority?: NotificationPriority;
  category?: NotificationCategory;
}

interface NotificationRow {
  id: string;
  type: string;
  category: string;
  priority: string;
  title: string;
  body: string | null;
  link: string | null;
  imageUrl: string | null;
  data: unknown;
  read: boolean;
  pinnedAt: Date | null;
  archivedAt: Date | null;
  createdAt: Date;
}

function toPublicRow(n: NotificationRow) {
  return {
    id: n.id,
    type: n.type,
    category: n.category,
    priority: n.priority,
    title: n.title,
    body: n.body,
    link: n.link,
    imageUrl: n.imageUrl,
    data: n.data ?? null,
    read: n.read,
    pinnedAt: n.pinnedAt ? n.pinnedAt.toISOString() : null,
    archivedAt: n.archivedAt ? n.archivedAt.toISOString() : null,
    createdAt: n.createdAt.toISOString(),
  };
}

/**
 * Create a notification (in-app always) and, if its priority deserves it,
 * mirror it to a browser push. Respects category prefs, channel mode,
 * quiet hours and DND. Broadcasts a realtime event to live clients.
 */
async function createNotification(params: CreateNotificationParams): Promise<NotificationRow | null> {
  try {
    const meta = TYPE_META[params.type];
    const priority = params.priority ?? meta.priority;
    const category = params.category ?? meta.category;

    if (params.dedupeKey) {
      // reminder:* keys are daily-deduped retention nudges: if an unread
      // one already exists for this user+day, SKIP — never spam.
      // Everything else coalesces bursts: bump the existing unread entry
      // instead of stacking duplicates (e.g. several new chapters of the
      // same series collapse into one live row).
      const existing = await prisma.notification.findFirst({
        where: { userId: params.userId, dedupeKey: params.dedupeKey, read: false },
        orderBy: { createdAt: 'desc' },
      });
      if (existing) {
        if (params.dedupeKey.startsWith('reminder:')) return null;
        const updated = await prisma.notification.update({
          where: { id: existing.id },
          data: {
            title: params.title,
            body: params.body || null,
            link: params.link || null,
            imageUrl: params.imageUrl ?? existing.imageUrl,
            data: (params.data as never) ?? existing.data,
            createdAt: new Date(),
          },
        });
        emitLive(params.userId, 'notification:update', updated);
        return updated as unknown as NotificationRow;
      }
    }

    const created = await prisma.notification.create({
      data: {
        userId: params.userId,
        type: params.type,
        category,
        priority,
        title: params.title,
        body: params.body || null,
        link: params.link || null,
        imageUrl: params.imageUrl || null,
        data: (params.data ?? undefined) as never,
        dedupeKey: params.dedupeKey || null,
      },
    });

    emitLive(params.userId, 'notification:new', created);

    // Push mirroring (background/silent never push; gated by channel mode,
    // quiet hours and DND)
    const prefs = await loadNotifPrefs(params.userId);
    if (priority !== 'silent' && priority !== 'background' && pushPriorityAllowed(prefs, priority)) {
      sendWebPushToUser(params.userId, {
        title: params.title,
        body: params.body || undefined,
        link: params.link || undefined,
      }).catch(() => {});
    }

    return created as unknown as NotificationRow;
  } catch {
    return null; // Notifications are non-critical
  }
}

function emitLive(userId: string, type: string, row: unknown): void {
  const event: RealtimeEvent = { type, data: { item: toPublicRow(row as NotificationRow) }, at: Date.now() };
  broadcastToUser(userId, event);
}

export { toPublicRow };

// ─── Pref gating ──────────────────────────────────────

async function userHasPrefEnabled(userId: string, type: NotificationType): Promise<boolean> {
  try {
    const meta = TYPE_META[type];
    if (!meta || type === 'system' || type === 'security' || type === 'moderator') return true;
    const prefs = await loadNotifPrefs(userId);
    return prefs[meta.prefKey as keyof NotificationPrefs] !== false;
  } catch {
    return true;
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
  dedupeKey?: string,
): Promise<void> {
  try {
    const bookmarks = await prisma.bookmark.findMany({
      where: { titleId },
      select: { userId: true },
    });

    const userIds = excludeUserId
      ? bookmarks.filter((b) => b.userId !== excludeUserId).map((b) => b.userId)
      : bookmarks.map((b) => b.userId);
    if (userIds.length === 0) return;

    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true },
    });
    const eligible = users.filter((u) => u.id !== excludeUserId).map((u) => u.id);

    const batchSize = 20;
    for (let i = 0; i < eligible.length; i += batchSize) {
      const batch = eligible.slice(i, i + batchSize);
      await Promise.all(
        batch.map((uid) =>
          createNotification({ userId: uid, type, title, body, link, imageUrl, dedupeKey }),
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

    const rendered = await renderFromTemplate('new_chapter', {
      series: title.title,
      chapter: String(chapterNumber),
      slug: title.slug,
    });
    const chapterLabel = `Ch. ${chapterNumber}${chapterTitle ? ` — ${chapterTitle}` : ''}`;
    const body = `${chapterLabel} is now available!`;

    await notifyBookmarkedUsers(
      titleId,
      'new_chapter',
      rendered.title,
      body,
      rendered.link ?? `/title/${title.slug}`,
      title.coverUrl ?? undefined,
      undefined,
      `new_chapter:${titleId}`,
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

    const rendered = await renderFromTemplate('review_added', {
      series: title.title,
      reviewer: reviewerDisplayName,
      rating: String(rating),
      slug: title.slug,
    });

    await notifyBookmarkedUsers(
      titleId,
      'review_added',
      rendered.title,
      rendered.body ?? `${reviewerDisplayName} rated ${title.title} ${rating}/10`,
      rendered.link ?? `/title/${title.slug}`,
      title.coverUrl ?? undefined,
      reviewerId,
    );
  } catch {
    // Silently fail
  }
}

// ─── Comment notification ─────────────────────────────

export async function notifyCommentAdded(
  postAuthorId: string,
  commenterDisplayName: string,
  postTitle: string,
  postId: string,
): Promise<void> {
  try {
    if (!(await userHasPrefEnabled(postAuthorId, 'comment'))) return;
    const rendered = await renderFromTemplate('comment', {
      name: commenterDisplayName,
      post: postTitle,
      postId,
    });
    await createNotification({
      userId: postAuthorId,
      type: 'comment',
      title: rendered.title,
      body: rendered.body ?? `"${postTitle}"`,
      link: rendered.link ?? `/community/${postId}`,
    });
  } catch {
    // Silently fail
  }
}

// ─── New follower notification ───────────────────────

export async function notifyFollowed(
  targetUserId: string,
  followerName: string,
  followerId: string,
): Promise<void> {
  try {
    if (!(await userHasPrefEnabled(targetUserId, 'new_follower'))) return;
    const rendered = await renderFromTemplate('new_follower', {
      name: followerName,
      userId: followerId,
    });
    await createNotification({
      userId: targetUserId,
      type: 'new_follower',
      title: rendered.title,
      body: rendered.body ?? 'They can now see your public activity — say hi!',
      link: rendered.link ?? `/user/${followerId}`,
    });
  } catch {
    // Silently fail
  }
}

// ─── Review helpful notification ─────────────────────

export async function notifyReviewHelpful(
  authorId: string,
  helperName: string,
  titleSlug: string,
): Promise<void> {
  try {
    if (!(await userHasPrefEnabled(authorId, 'review_helpful'))) return;
    const rendered = await renderFromTemplate('review_helpful', {
      name: helperName,
      slug: titleSlug,
    });
    await createNotification({
      userId: authorId,
      type: 'review_helpful',
      title: rendered.title,
      body: rendered.body ?? 'Your review is helping other readers decide.',
      link: rendered.link ?? `/title/${titleSlug}`,
    });
  } catch {
    // Silently fail
  }
}

// ─── Reply notification ──────────────────────────────

export async function notifyReplyAdded(
  parentAuthorId: string,
  replierName: string,
  postTitle: string,
  postId: string,
): Promise<void> {
  try {
    if (!(await userHasPrefEnabled(parentAuthorId, 'reply'))) return;
    const rendered = await renderFromTemplate('reply', {
      name: replierName,
      post: postTitle,
      postId,
    });
    await createNotification({
      userId: parentAuthorId,
      type: 'reply',
      title: rendered.title,
      body: rendered.body ?? `"${postTitle}"`,
      link: rendered.link ?? `/community/${postId}`,
    });
  } catch {
    // Silently fail
  }
}

// ─── Prediction resolved notification ────────────────

export async function notifyPredictionResolved(
  userId: string,
  question: string,
  winningOption: string,
  won: boolean,
  winnings: number,
): Promise<void> {
  try {
    if (!(await userHasPrefEnabled(userId, 'prediction'))) return;
    const rendered = await renderFromTemplate('prediction', {
      message: won ? `You won ${winnings} coins on a prediction!` : 'Prediction resolved',
      detail: `"${question}" — ${winningOption} won`,
    });
    await createNotification({
      userId,
      type: 'prediction',
      title: rendered.title,
      body: rendered.body ?? `"${question}" — ${winningOption} won`,
      link: '/community',
    });
  } catch {
    // Silently fail
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
    const rendered = await renderFromTemplate('achievement', {
      badge: `${badgeEmoji} ${badgeName}`,
      description,
    });
    await createNotification({
      userId,
      type: 'achievement',
      title: rendered.title,
      body: rendered.body ?? description,
      link: rendered.link ?? '/dashboard',
    });
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
          dedupeKey: `milestone:${threshold}`,
        });
        break;
      }
    }
  } catch {
    // Silently fail
  }
}

// ─── System notification (admin/announcements) ─────────

export async function createSystemNotification(
  userIds: string[],
  title: string,
  body?: string,
  link?: string,
  data?: Record<string, unknown>,
): Promise<void> {
  await Promise.all(
    userIds.map((userId) =>
      createNotification({ userId, type: 'system', title, body, link, data }),
    ),
  );
}

// ─── Broadcast (admin tool) ───────────────────────────

export interface BroadcastInput {
  type: NotificationType;
  title: string;
  body?: string;
  link?: string;
  imageUrl?: string;
  priority?: NotificationPriority;
  category?: NotificationCategory;
  audience: 'all' | 'logged_in' | 'moderators';
}

/**
 * Push a notification to an entire audience. Uses createMany for scale
 * (live users still get the realtime event so the bell updates instantly).
 */
export async function broadcastNotification(input: BroadcastInput): Promise<number> {
  try {
    const meta = TYPE_META[input.type];
    const priority = input.priority ?? meta.priority;
    const category = input.category ?? meta.category;

    const audienceWhere =
      input.audience === 'moderators'
        ? { role: { in: ['moderator', 'admin'] as string[] } }
        : input.audience === 'logged_in'
          ? { firebaseUid: { not: null } }
          : {};

    const users = await prisma.user.findMany({
      where: audienceWhere,
      select: { id: true },
    });
    const ids = users.map((u) => u.id);
    if (ids.length === 0) return 0;

    // Critical/high broadcasts also push (createMany bypasses the per-row
    // push path). Fire-and-forget, gated by channel mode + quiet hours.
    if (priority === 'critical' || priority === 'high') {
      void (async () => {
        for (const userId of ids) {
          try {
            const prefs = await loadNotifPrefs(userId);
            if (prefs.push === 'off' || isPushWindowBlocked(prefs)) continue;
            await sendWebPushToUser(userId, {
              title: input.title,
              body: input.body || undefined,
              link: input.link || undefined,
            });
          } catch {
            // per-user best effort
          }
        }
      })();
    }

    // Batch createMany (1000 per chunk) — bulk inserts don't run our
    // per-row push logic; we fire pushes for the connected subset above.
    const CHUNK = 1000;
    for (let i = 0; i < ids.length; i += CHUNK) {
      const chunk = ids.slice(i, i + CHUNK);
      await prisma.notification.createMany({
        data: chunk.map((userId) => ({
          userId,
          type: input.type,
          category,
          priority,
          title: input.title,
          body: input.body || null,
          link: input.link || null,
          imageUrl: input.imageUrl || null,
        })),
      });
      broadcastToMany(chunk, {
        type: 'notification:new',
        data: {
          item: {
            id: 'bulk',
            type: input.type,
            category,
            priority,
            title: input.title,
            body: input.body || null,
            link: input.link || null,
            imageUrl: input.imageUrl || null,
            data: null,
            read: false,
            pinnedAt: null,
            archivedAt: null,
            createdAt: new Date().toISOString(),
          },
        },
        at: Date.now(),
      });
    }
    return ids.length;
  } catch {
    return 0;
  }
}

// ─── Digest system ────────────────────────────────────

const DIGEST_PERIODS: Record<string, { days: number; label: string }> = {
  daily: { days: 1, label: 'daily' },
  weekly: { days: 7, label: 'weekly' },
  monthly: { days: 30, label: 'monthly' },
};

/**
 * Generate an in-app digest notification for one user, summarizing
 * notifications received since their last digest. This is the delivery
 * vehicle today; an email renderer can be added behind the same data.
 */
export async function generateDigestForUser(userId: string): Promise<void> {
  try {
    const prefs = await loadNotifPrefs(userId);
    const period = DIGEST_PERIODS[prefs.digest];
    if (!period) return;

    const lastDigestAt = typeof prefs.lastDigestAt === 'number' ? prefs.lastDigestAt : 0;
    const since = lastDigestAt > 0 ? new Date(lastDigestAt) : new Date(Date.now() - period.days * 86_400_000);

    const notifs = await prisma.notification.findMany({
      where: { userId, createdAt: { gt: since } },
      orderBy: { createdAt: 'desc' },
      take: 30,
    });
    if (notifs.length === 0) return;

    const grouped = new Map<string, number>();
    for (const n of notifs) {
      grouped.set(n.category, (grouped.get(n.category) || 0) + 1);
    }

    await createNotification({
      userId,
      type: 'system',
      title: `📬 Your ${period.label} digest`,
      body: `${notifs.length} highlight${notifs.length === 1 ? '' : 's'} while you were away`,
      link: '/notifications',
      data: {
        digest: true,
        period: period.label,
        highlights: notifs.slice(0, 8).map((n) => ({
          id: n.id,
          type: n.type,
          title: n.title,
          body: n.body,
          link: n.link,
          category: n.category,
          createdAt: n.createdAt.toISOString(),
        })),
        byCategory: Object.fromEntries(grouped),
      },
      dedupeKey: `digest:${userId}:${prefs.digest}`,
    });

    // Record the run so the next digest only covers new activity
    await prisma.user.update({
      where: { id: userId },
      data: { notificationPrefs: { ...prefs, lastDigestAt: Date.now() } as never },
    });
  } catch {
    // Silently fail — digests are best-effort
  }
}

/** Run digest generation for all users with a digest frequency set. */
export async function runDigests(): Promise<number> {
  const users = await prisma.user.findMany({
    where: { notificationPrefs: { path: ['digest'], not: 'off' } },
    select: { id: true },
  });
  let ran = 0;
  for (const u of users) {
    await generateDigestForUser(u.id);
    ran += 1;
  }
  return ran;
}

// ─── Reminders (retention system) ─────────────────────

const DAY_MS = 86_400_000;

function dayKey(offsetDays = 0): string {
  return new Date(Date.now() - offsetDays * DAY_MS).toISOString().slice(0, 10);
}

/**
 * Scan readers and send tasteful, daily-deduped reminders:
 *  • Streak at risk — a streak exists but nothing was read today.
 *  • Continue reading — the user fell away after being active.
 *  • Daily goal — an active chapters-per-day goal is behind schedule.
 * In-app priority is silent; pushes only go out for 'all' push mode
 * (never during quiet hours / DND).
 */
export async function generateReadingReminders(): Promise<number> {
  let sent = 0;
  try {
    const progress = await prisma.readingProgress.findMany({
      where: { updatedAt: { gte: new Date(Date.now() - 14 * DAY_MS) } },
      select: { userId: true, updatedAt: true, chapterId: true },
      orderBy: { updatedAt: 'desc' },
    });

    const byUser = new Map<string, { lastRead: Date; chapterId: string }>();
    for (const p of progress) {
      if (!byUser.has(p.userId) || p.updatedAt > byUser.get(p.userId)!.lastRead) {
        byUser.set(p.userId, { lastRead: p.updatedAt, chapterId: p.chapterId });
      }
    }

    const users = await prisma.user.findMany({
      where: { id: { in: [...byUser.keys()] } },
      select: { id: true, streakDays: true },
    });

    // Daily goals (chapters per day)
    const goals = await prisma.readingGoal.findMany({
      where: { active: true, type: 'chapters_day' },
      select: { userId: true, target: true },
    });

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const readTodayRows = await prisma.readingProgress.findMany({
      where: { userId: { in: users.map((u) => u.id) }, updatedAt: { gte: todayStart } },
      select: { userId: true },
    });
    const readTodayUsers = new Set(readTodayRows.map((r) => r.userId));

    for (const user of users) {
      const entry = byUser.get(user.id);
      if (!entry) continue;
      const prefs = await loadNotifPrefs(user.id);
      if (prefs.reminders === false) continue;
      const now = Date.now();
      const today = dayKey();
      const hasReadToday = readTodayUsers.has(user.id);

      // 1. Streak at risk
      if (user.streakDays > 0 && !hasReadToday) {
        const rendered = await renderFromTemplate('reminder_streak', { days: String(user.streakDays) });
        await createNotification({
          userId: user.id,
          type: 'reminder',
          title: rendered.title,
          body: rendered.body ?? 'Read one chapter today to keep it alive.',
          link: '/history',
          dedupeKey: `reminder:streak:${user.id}:${today}`,
        });
        sent += 1;
      }

      // 2. Fell away — last read more than 2 days ago
      const awayDays = Math.floor((now - entry.lastRead.getTime()) / DAY_MS);
      if (awayDays >= 2) {
        const chapter = await prisma.chapter.findUnique({
          where: { id: entry.chapterId },
          select: { id: true, series: { select: { title: true, slug: true } } },
        });
        if (chapter) {
          const rendered = await renderFromTemplate('reminder_continue', {
            series: chapter.series.title,
            chapterId: chapter.id,
          });
          await createNotification({
            userId: user.id,
            type: 'reminder',
            title: rendered.title,
            body: rendered.body ?? `${chapter.series.title} is waiting.`,
            link: `/title/${chapter.series.slug}`,
            dedupeKey: `reminder:continue:${user.id}:${today}`,
          });
          sent += 1;
        }
      }

      // 3. Daily goal behind schedule
      const goal = goals.find((g) => g.userId === user.id);
      if (goal) {
        const progressToday = await prisma.readingProgress.count({
          where: { userId: user.id, updatedAt: { gte: todayStart } },
        });
        if (progressToday > 0 && progressToday < goal.target) {
          const rendered = await renderFromTemplate('reminder_goal', {
            remaining: String(goal.target - progressToday),
            period: 'day',
          });
          await createNotification({
            userId: user.id,
            type: 'reminder',
            title: rendered.title,
            body: rendered.body ?? 'A quick chapter would put you on track.',
            link: '/goals',
            dedupeKey: `reminder:goal:${user.id}:${today}`,
          });
          sent += 1;
        }
      }
    }
  } catch {
    // Silently fail
  }
  return sent;
}

// ─── Seed demo notifications for new users ────────────

export async function seedDemoNotifications(userId: string): Promise<void> {
  await Promise.all([
    createNotification({
      userId,
      type: 'system',
      title: '👋 Welcome to MangaVerse!',
      body: 'Start exploring thousands of manga, manhwa, and light novels.',
      link: '/browse',
      dedupeKey: `welcome:${userId}`,
    }),
    createNotification({
      userId,
      type: 'achievement',
      title: '🏆 Reader Badge Unlocked',
      body: 'You earned the "New Reader" badge for joining MangaVerse.',
      link: '/dashboard',
      dedupeKey: `badge-new-reader:${userId}`,
    }),
  ]);
}
