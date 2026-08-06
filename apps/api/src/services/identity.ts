import { prisma } from '../lib/prisma.js';
import { getReadingAnalytics, type AnalyticsData } from './analytics.js';
import { getJourney, type JourneyData } from './journey.js';
import { computePersonality, type PersonalityData } from './personality.js';
import { computeReputation, type ReputationData } from './reputation.js';
import { getLatestWrapped, type WrappedData } from './wrapped.js';

/* ═══════════════════════════════════════════════════════════════
   Identity — one composed payload for the reader's own dashboard
   (Phase 9). Everything a premium profile needs in a single round
   trip: identity fields, reading level, reputation, personality,
   journey, and the full analytics engine.
   ═══════════════════════════════════════════════════════════════ */

export interface ReadingLevel {
  current: { key: string; label: string; emoji: string; min: number };
  next: { key: string; label: string; emoji: string; min: number } | null;
  /** 0-100 progress toward the next level. */
  progress: number;
}

const LEVELS = [
  { key: 'novice', label: 'Novice Reader', emoji: '🌱', min: 0 },
  { key: 'regular', label: 'Regular Reader', emoji: '📖', min: 50 },
  { key: 'avid', label: 'Avid Reader', emoji: '📚', min: 200 },
  { key: 'expert', label: 'Expert Reader', emoji: '🏆', min: 500 },
  { key: 'master', label: 'Master Reader', emoji: '👑', min: 1000 },
  { key: 'legend', label: 'Legendary Reader', emoji: '🌟', min: 2500 },
] as const;

export function readingLevel(chapters: number): ReadingLevel {
  const current = [...LEVELS].reverse().find((l) => chapters >= l.min) ?? LEVELS[0];
  const next = LEVELS.find((l) => l.min > current.min) ?? null;
  const progress = next
    ? Math.min(100, Math.round(((chapters - current.min) / (next.min - current.min)) * 100))
    : 100;
  return { current, next, progress };
}

/** A stable, public-safe handle derived from the email (no new column). */
export function usernameFor(email: string, id: string): string {
  const fromEmail = email.split('@')[0]?.toLowerCase().replace(/[^a-z0-9_]/g, '') || '';
  return fromEmail.length >= 3 ? fromEmail : `reader_${id.slice(0, 6)}`;
}

export interface OwnIdentity {
  user: {
    id: string;
    email: string;
    displayName: string;
    avatarUrl: string | null;
    bannerUrl: string | null;
    bio: string | null;
    location: string | null;
    website: string | null;
    socialLinks: Record<string, string>;
    accentColor: string | null;
    profileTheme: string;
    layoutStyle: string;
    cardStyle: string;
    role: string;
    subscriptionTier: string;
    streakDays: number;
    reputation: number;
    totalReadingMinutes: number;
    lastActiveAt: string | null;
    pinnedItems: Record<string, string[]>;
    pinnedManga: string[];
    createdAt: string;
  };
  username: string;
  prefs: Record<string, unknown>;
  readingLevel: ReadingLevel;
  reputation: ReputationData;
  personality: PersonalityData;
  journey: JourneyData;
  stats: AnalyticsData;
  wrapped: WrappedData | null;
}

export async function getOwnIdentity(dbUserId: string): Promise<OwnIdentity> {
  const [user, reputation, personality, journey, stats, wrapped] = await Promise.all([
    prisma.user.findUnique({ where: { id: dbUserId } }),
    computeReputation(dbUserId),
    computePersonality(dbUserId),
    getJourney(dbUserId),
    getReadingAnalytics(dbUserId),
    getLatestWrapped(dbUserId),
  ]);

  if (!user) throw new Error('User not found');

  const prefs = (user.prefs as Record<string, unknown>) || {};

  return {
    user: {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
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
      subscriptionTier: user.subscriptionTier,
      streakDays: user.streakDays,
      reputation: user.reputation,
      totalReadingMinutes: user.totalReadingMinutes,
      lastActiveAt: user.lastActiveAt ? user.lastActiveAt.toISOString() : null,
      pinnedItems: (user.pinnedItems as Record<string, string[]>) || {},
      pinnedManga: user.pinnedManga,
      createdAt: user.createdAt.toISOString(),
    },
    username: usernameFor(user.email, user.id),
    prefs,
    readingLevel: readingLevel(stats.totalChapters),
    reputation,
    personality,
    journey,
    stats,
    wrapped,
  };
}
