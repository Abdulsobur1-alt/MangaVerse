'use client';

import { useState, useEffect } from 'react';
import { AppShell } from '@/components/AppShell';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { useAuthStore } from '@/store/authStore';
import { useUpdateProfile, useDeleteAccount, useNotificationPrefs, useUpdateNotificationPrefs } from '@/lib/hooks/useSettings';
import { useOwnIdentity } from '@/lib/hooks/useIdentity';
import { usePrefs, useUpdatePrefs, type LibraryView, type CardDensity, type UserPrefs } from '@/lib/hooks/usePrefs';
import { GENRES_META } from '@/components/home/types';
import { toDbGenre } from '@/components/discover/utils';
import { Icon } from '@/components/ui/Icon';
import { cn } from '@/lib/cn';

export default function SettingsPage() {
  const { user, token } = useAuthStore();
  const updateProfile = useUpdateProfile();
  const deleteAccount = useDeleteAccount();

  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [avatarUrl, setAvatarUrl] = useState(user?.avatarUrl || '');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [saved, setSaved] = useState(false);
  const [previewError, setPreviewError] = useState(false);
  const { data: notifPrefs } = useNotificationPrefs();
  const updateNotifPrefs = useUpdateNotificationPrefs();
  const [localPrefs, setLocalPrefs] = useState<Record<string, boolean> | null>(null);

  const prefs = localPrefs || notifPrefs || {
    new_chapter: true,
    reviews: true,
    milestones: true,
    achievements: true,
    community: true,
  };

  const togglePref = (key: string, current: boolean) => {
    const newPrefs = { ...prefs, [key]: !current };
    setLocalPrefs(newPrefs);
    updateNotifPrefs.mutate({ [key]: !current } as Record<string, boolean>);
  };

  // Sync with user data when it loads
  useEffect(() => {
    if (user) {
      setDisplayName(user.displayName);
      setAvatarUrl(user.avatarUrl || '');
    }
  }, [user]);

  const handleSaveProfile = async () => {
    if (!token) return;
    setSaved(false);
    try {
      await updateProfile.mutateAsync({ displayName, avatarUrl: avatarUrl || null });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      // Error handled by mutation
    }
  };

  const handleDeleteAccount = async () => {
    if (!token) return;
    try {
      await deleteAccount.mutateAsync();
    } catch {
      // Error handled by mutation
    }
  };

  return (
    <ProtectedRoute>
      <AppShell>
        <div className="mx-auto max-w-2xl px-5 py-8 sm:px-6 md:px-8">
          <div className="mb-8">
            <p className="eyebrow mb-2">Preferences</p>
            <h1 className="text-3xl font-bold tracking-tight text-white md:text-4xl">
              Settings
            </h1>
            <p className="mt-1 text-xs text-mv-text-muted">Manage your profile, preferences, and account</p>
          </div>

          {/* ─── Profile Section ──────────────────── */}
          <section className="mb-8">
            <div className="flex items-center gap-4 mb-6">
              <div className="relative group">
                {/* Live avatar preview with gradient fallback */}
                {avatarUrl && !previewError ? (
                  <div className="relative h-16 w-16 overflow-hidden rounded-full ring-2 ring-mv-border-light group-hover:ring-mv-accent/50 transition-all">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={avatarUrl}
                      alt="Avatar preview"
                      className="h-full w-full object-cover"
                      onError={() => setPreviewError(true)}
                      onLoad={() => setPreviewError(false)}
                    />
                  </div>
                ) : (
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-mv-accent to-mv-purple text-xl font-bold text-white ring-2 ring-mv-border-light group-hover:ring-mv-accent/50 transition-all">
                    {displayName?.charAt(0)?.toUpperCase() || 'U'}
                  </div>
                )}
                {/* Hover tooltip */}
                <div className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-mv-accent text-[8px] text-white opacity-0 group-hover:opacity-100 transition-opacity shadow-lg">
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                </div>
              </div>
              <div>
                <h2 className="text-sm font-medium text-white">Profile</h2>
                <p className="text-[10px] text-mv-text-muted">Update your display name and avatar</p>
              </div>
            </div>

            <div className="rounded-xl border border-mv-border bg-mv-darker p-5 space-y-4">
              {/* Display Name */}
              <div>
                <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-mv-text-muted">
                  Display Name
                </label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  maxLength={50}
                  className="w-full rounded-lg border border-mv-border-light bg-mv-surface px-3 py-2 text-xs text-mv-text placeholder:text-mv-text-dim outline-none focus:border-mv-accent transition-colors"
                  placeholder="Your display name"
                />
                <p className="mt-1 text-[9px] text-mv-text-dim">{displayName.length}/50 characters</p>
              </div>

              {/* Email (read-only) */}
              <div>
                <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-mv-text-muted">
                  Email
                </label>
                <div className="w-full rounded-lg border border-mv-border-light bg-mv-surface/50 px-3 py-2 text-xs text-mv-text-dim cursor-not-allowed">
                  {user?.email || '—'}
                </div>
                <p className="mt-1 text-[9px] text-mv-text-dim">Email cannot be changed</p>
              </div>

              {/* Avatar URL */}
              <div>
                <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-mv-text-muted">
                  Avatar URL
                </label>
                <div className="relative">
                  <input
                    type="url"
                    value={avatarUrl}
                    onChange={(e) => { setAvatarUrl(e.target.value); setPreviewError(false); }}
                    className={`w-full rounded-lg border px-9 py-2 text-xs text-mv-text placeholder:text-mv-text-dim outline-none transition-colors resize-none ${
                      avatarUrl && !previewError
                        ? 'border-green-500/30 bg-green-500/5'
                        : avatarUrl && previewError
                        ? 'border-red-500/30 bg-red-500/5'
                        : 'border-mv-border-light bg-mv-surface focus:border-mv-accent'
                    }`}
                    placeholder="https://example.com/avatar.jpg"
                  />
                  {/* Status indicator */}
                  <div className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2">
                    {avatarUrl && !previewError && (
                      <svg className="h-4 w-4 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                    {avatarUrl && previewError && (
                      <svg className="h-4 w-4 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                      </svg>
                    )}
                  </div>
                </div>
                <p className="mt-1 text-[9px] text-mv-text-dim">
                  {avatarUrl && previewError
                    ? 'Image could not be loaded — check the URL'
                    : 'Enter a URL or leave empty for a gradient initial avatar'
                  }
                </p>
              </div>

              {/* Save Button */}
              <div className="flex items-center gap-3 pt-2">
                <button
                  onClick={handleSaveProfile}
                  disabled={updateProfile.isPending || !displayName.trim()}
                  className="btn-primary px-5 py-2.5 text-xs disabled:opacity-50"
                >
                  {updateProfile.isPending ? 'Saving...' : 'Save Changes'}
                </button>
                {saved && (
                  <span className="text-[10px] text-green-400 animate-fade-in">✓ Saved</span>
                )}
              </div>

              {updateProfile.isError && (
                <p className="text-[10px] text-red-400">Failed to save. Please try again.</p>
              )}
            </div>
          </section>

          {/* ─── Identity & Customization (Phase 9) ── */}
          <IdentitySection />

          {/* ─── Privacy (Phase 9) ────────────────── */}
          <PrivacySection />

          {/* ─── Personalization Section ──────────── */}
          <PersonalizationSection />

          {/* ─── Preferences Section ──────────────── */}
          <section className="mb-8">
            <h2 className="mb-4 text-sm font-medium text-white">Notification Preferences</h2>

            <div className="rounded-xl border border-mv-border bg-mv-darker divide-y divide-mv-border">
              {[
                { id: 'new_chapter', label: 'New Chapters', desc: 'When a new chapter is added to a title in your library' },
                { id: 'reviews', label: 'Reviews & Ratings', desc: 'When someone reviews a title you bookmarked' },
                { id: 'milestones', label: 'Reading Milestones', desc: 'When you reach reading milestones' },
                { id: 'achievements', label: 'Achievements', desc: 'When you earn new badges and achievements' },
                { id: 'community', label: 'Community Activity', desc: 'When someone comments on your posts' },
              ].map((pref) => (
                <div key={pref.id} className="flex items-center justify-between px-5 py-3.5">
                  <div>
                    <p className="text-xs font-medium text-mv-text">{pref.label}</p>
                    <p className="text-[10px] text-mv-text-muted mt-0.5">{pref.desc}</p>
                  </div>
                  <label className="relative inline-flex cursor-pointer items-center">
                    <input
                      type="checkbox"
                      checked={(prefs as Record<string, boolean>)[pref.id] !== false}
                      onChange={() => togglePref(pref.id, (prefs as Record<string, boolean>)[pref.id] !== false)}
                      className="peer sr-only"
                    />
                    <div className="h-5 w-9 rounded-full bg-mv-border-light after:absolute after:left-[2px] after:top-[2px] after:h-4 after:w-4 after:rounded-full after:bg-mv-text-muted after:transition-all peer-checked:bg-mv-accent/60 peer-checked:after:translate-x-full peer-checked:after:bg-mv-accent" />
                  </label>
                </div>
              ))}
            </div>
            <p className="mt-2 text-[9px] text-mv-text-dim">Notification preferences will be saved automatically</p>
          </section>

          {/* ─── Account Section ─────────────────── */}
          <section>
            <h2 className="mb-4 text-sm font-medium text-white">Account</h2>

            <div className="rounded-xl border border-red-900/30 bg-mv-darker p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-medium text-red-400">Delete Account</p>
                  <p className="text-[10px] text-mv-text-muted mt-1 leading-relaxed">
                    Permanently delete your account and all associated data. This action cannot be undone.
                  </p>
                </div>
                {!showDeleteConfirm ? (
                  <button
                    onClick={() => setShowDeleteConfirm(true)}
                    className="shrink-0 rounded-lg border border-red-900/30 px-3.5 py-2 text-[10px] font-medium text-red-400 transition-colors hover:bg-red-900/20"
                  >
                    Delete
                  </button>
                ) : null}
              </div>

              {showDeleteConfirm && (
                <div className="mt-4 animate-fade-in">
                  <div className="rounded-lg bg-red-900/10 border border-red-900/30 p-3 mb-3">
                    <p className="text-[10px] text-red-400 leading-relaxed">
                      Are you absolutely sure? This will permanently delete your account, reading history, reviews, and all associated data. This cannot be undone.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleDeleteAccount}
                      disabled={deleteAccount.isPending}
                      className="rounded-lg bg-red-600 px-4 py-2 text-[10px] font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50"
                    >
                      {deleteAccount.isPending ? 'Deleting...' : 'Yes, Delete My Account'}
                    </button>
                    <button
                      onClick={() => setShowDeleteConfirm(false)}
                      className="rounded-lg border border-mv-border-light px-4 py-2 text-[10px] text-mv-text-secondary transition-colors hover:text-mv-text"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* ─── Subscription Info ────────────────── */}
          <section className="mt-8">
            <h2 className="mb-4 text-sm font-medium text-white">Subscription</h2>
            <div className="rounded-xl border border-mv-border bg-mv-darker p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-mv-text">Current Plan</p>
                  <p className="text-[10px] text-mv-text-muted mt-0.5">
                    {user?.subscriptionTier === 'premium' ? '⭐ Premium' : 'Free Tier'}
                  </p>
                </div>
                <span className={`rounded-full px-2.5 py-1 text-[9px] font-medium ${
                  user?.subscriptionTier === 'premium'
                    ? 'bg-mv-accent/20 text-mv-accent'
                    : 'bg-mv-surface text-mv-text-muted'
                }`}>
                  {user?.subscriptionTier === 'premium' ? 'Active' : 'Free'}
                </span>
              </div>
              <p className="mt-3 text-[10px] text-mv-text-dim">
                {user?.subscriptionTier === 'premium'
                  ? 'You have access to all premium features. Manage your subscription in your account settings.'
                  : 'Upgrade to Premium for ad-free reading, early access, and exclusive content.'
                }
              </p>
            </div>
          </section>
        </div>
      </AppShell>
    </ProtectedRoute>
  );
}

/* ═══════════════════════════════════════════════════════════════
   PersonalizationSection — library view, card density, preferred
   genres and homepage recommendations. Persisted to /users/prefs
   so choices sync across devices (Phase 7).
   ═══════════════════════════════════════════════════════════════ */

const VIEW_OPTIONS: { key: LibraryView; label: string; icon: 'grid' | 'list' | 'menu' }[] = [
  { key: 'grid', label: 'Grid', icon: 'grid' },
  { key: 'list', label: 'List', icon: 'list' },
  { key: 'compact', label: 'Compact', icon: 'menu' },
];

function Segment({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-[11px] font-medium transition-all',
        active ? 'bg-gradient-to-r from-mv-purple to-mv-accent text-white shadow-glow-sm' : 'text-mv-text-secondary hover:bg-white/5 hover:text-mv-text',
      )}
    >
      {children}
    </button>
  );
}

function Toggle({ checked, onChange, label, desc }: { checked: boolean; onChange: (v: boolean) => void; label: string; desc: string }) {
  return (
    <div className="flex items-center justify-between gap-4 px-5 py-3.5">
      <div>
        <p className="text-xs font-medium text-mv-text">{label}</p>
        <p className="mt-0.5 text-[10px] text-mv-text-muted">{desc}</p>
      </div>
      <label className="relative inline-flex cursor-pointer items-center">
        <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="peer sr-only" />
        <div className="h-5 w-9 rounded-full bg-mv-border-light after:absolute after:left-[2px] after:top-[2px] after:h-4 after:w-4 after:rounded-full after:bg-mv-text-muted after:transition-all peer-checked:bg-mv-accent/60 peer-checked:after:translate-x-full peer-checked:after:bg-mv-accent" />
      </label>
    </div>
  );
}

function PersonalizationSection() {
  const { token } = useAuthStore();
  const { data: prefs } = usePrefs(!!token);
  const updatePrefs = useUpdatePrefs();

  const set = (patch: Parameters<typeof updatePrefs.mutate>[0]) => {
    if (!token) return;
    updatePrefs.mutate(patch);
  };

  const selected = prefs?.preferredGenres ?? [];
  const atCap = selected.length >= 15;

  const toggleGenre = (dbSlug: string) => {
    set({ preferredGenres: selected.includes(dbSlug) ? selected.filter((g) => g !== dbSlug) : [...selected, dbSlug] });
  };

  const density: CardDensity = prefs?.cardDensity ?? 'cozy';

  return (
    <section className="mb-8">
      <h2 className="mb-1 text-sm font-medium text-white">Personalization</h2>
      <p className="mb-4 text-[10px] text-mv-text-muted">
        Preferences sync across your devices automatically.
      </p>

      <div className="rounded-xl border border-mv-border bg-mv-darker divide-y divide-mv-border">
        {/* Library view */}
        <div className="px-5 py-3.5">
          <p className="text-xs font-medium text-mv-text">Default library view</p>
          <p className="mt-0.5 text-[10px] text-mv-text-muted">How your shelf renders when you open the library.</p>
          <div className="mt-3 flex gap-1 rounded-xl border border-mv-border-light bg-mv-surface/60 p-1">
            {VIEW_OPTIONS.map((v) => (
              <Segment key={v.key} active={(prefs?.libraryView ?? 'grid') === v.key} onClick={() => set({ libraryView: v.key })}>
                <Icon name={v.icon} size={12} />
                {v.label}
              </Segment>
            ))}
          </div>
        </div>

        {/* Card density */}
        <div className="px-5 py-3.5">
          <p className="text-xs font-medium text-mv-text">Card density</p>
          <p className="mt-0.5 text-[10px] text-mv-text-muted">Cozy shows larger covers; compact fits more on screen.</p>
          <div className="mt-3 flex gap-1 rounded-xl border border-mv-border-light bg-mv-surface/60 p-1">
            <Segment active={density === 'cozy'} onClick={() => set({ cardDensity: 'cozy' })}>Cozy</Segment>
            <Segment active={density === 'compact'} onClick={() => set({ cardDensity: 'compact' })}>Compact</Segment>
          </div>
        </div>

        {/* Preferred genres */}
        <div className="px-5 py-3.5">
          <p className="text-xs font-medium text-mv-text">Preferred genres</p>
          <p className="mt-0.5 text-[10px] text-mv-text-muted">
            Tell us what you love — future recommendations will lean into these.
          </p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {GENRES_META.map((g) => {
              const dbSlug = toDbGenre(g.key);
              const active = selected.includes(dbSlug);
              return (
                <button
                  key={g.key}
                  onClick={() => toggleGenre(dbSlug)}
                  disabled={!active && atCap}
                  aria-pressed={active}
                  className={cn(
                    'rounded-full border px-3 py-1.5 text-[10px] font-medium transition-all',
                    active
                      ? 'border-mv-violet/50 bg-mv-violet/20 text-mv-violet'
                      : 'border-mv-border-light bg-mv-surface/60 text-mv-text-secondary hover:border-mv-violet/40 hover:text-mv-text',
                    !active && atCap && 'cursor-not-allowed opacity-40 hover:border-mv-border-light hover:text-mv-text-secondary',
                  )}
                >
                  {g.emoji} {g.label}
                </button>
              );
            })}
            {prefs && prefs.preferredGenres.length >= 15 && (
              <p className="w-full pt-1 text-[9px] text-mv-text-dim">Maximum 15 genres selected.</p>
            )}
          </div>
        </div>

        {/* Homepage recommendations */}
        <Toggle
          checked={prefs?.homepageRecs ?? true}
          onChange={(v) => set({ homepageRecs: v })}
          label="Homepage recommendations"
          desc="Personalized “Recommended for you” rails (powers the future homepage)."
        />
      </div>
      {updatePrefs.isError && (
        <p className="mt-2 text-[10px] text-red-400">Failed to save preference. Please try again.</p>
      )}
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════
   IdentitySection — the Phase 9 identity + customization editor.
   Bio, location, website, social links, banner, accent color,
   profile theme, layout style, and card style — all persisted
   through the extended /users/profile endpoint.
   ═══════════════════════════════════════════════════════════════ */

const ACCENT_SWATCHES = ['#e94560', '#a78bfa', '#38bdf8', '#34d399', '#fbbf24', '#f97316', '#ec4899', '#f43f5e'];

const THEME_OPTIONS: { key: string; label: string; swatch: string }[] = [
  { key: 'aurora', label: 'Aurora', swatch: 'bg-gradient-to-br from-mv-purple via-mv-accent to-mv-orange' },
  { key: 'midnight', label: 'Midnight', swatch: 'bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-950' },
  { key: 'sunset', label: 'Sunset', swatch: 'bg-gradient-to-br from-orange-500 via-rose-500 to-purple-600' },
  { key: 'forest', label: 'Forest', swatch: 'bg-gradient-to-br from-emerald-600 via-teal-500 to-lime-700' },
  { key: 'ocean', label: 'Ocean', swatch: 'bg-gradient-to-br from-sky-600 via-blue-500 to-cyan-600' },
];

const SOCIAL_FIELDS: { key: 'x' | 'instagram' | 'discord' | 'youtube' | 'twitch'; label: string; placeholder: string }[] = [
  { key: 'x', label: 'X (Twitter)', placeholder: '@handle' },
  { key: 'instagram', label: 'Instagram', placeholder: 'handle' },
  { key: 'discord', label: 'Discord', placeholder: 'username' },
  { key: 'youtube', label: 'YouTube', placeholder: 'channel' },
  { key: 'twitch', label: 'Twitch', placeholder: 'channel' },
];

function IdentitySection() {
  const { token } = useAuthStore();
  const { data: identity } = useOwnIdentity(!!token);
  const updateProfile = useUpdateProfile();

  const [bio, setBio] = useState('');
  const [location, setLocation] = useState('');
  const [website, setWebsite] = useState('');
  const [social, setSocial] = useState<Record<string, string>>({});
  const [bannerUrl, setBannerUrl] = useState('');
  const [accentColor, setAccentColor] = useState<string | null>(null);
  const [profileTheme, setProfileTheme] = useState('aurora');
  const [layoutStyle, setLayoutStyle] = useState<'editorial' | 'compact'>('editorial');
  const [cardStyle, setCardStyle] = useState<'rounded' | 'sharp'>('rounded');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!identity) return;
    setBio(identity.user.bio ?? '');
    setLocation(identity.user.location ?? '');
    setWebsite(identity.user.website ?? '');
    setSocial(identity.user.socialLinks ?? {});
    setBannerUrl(identity.user.bannerUrl ?? '');
    setAccentColor(identity.user.accentColor);
    setProfileTheme(identity.user.profileTheme ?? 'aurora');
    setLayoutStyle((identity.user.layoutStyle as 'editorial' | 'compact') ?? 'editorial');
    setCardStyle((identity.user.cardStyle as 'rounded' | 'sharp') ?? 'rounded');
  }, [identity]);

  const save = async () => {
    if (!token) return;
    setSaved(false);
    try {
      await updateProfile.mutateAsync({
        bio: bio.trim() || null,
        location: location.trim() || null,
        website: website.trim() || null,
        socialLinks: Object.fromEntries(Object.entries(social).filter(([, v]) => v.trim().length > 0)),
        bannerUrl: bannerUrl.trim() || null,
        accentColor,
        profileTheme: profileTheme as 'aurora' | 'midnight' | 'sunset' | 'forest' | 'ocean',
        layoutStyle,
        cardStyle,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch {
      // Error handled by mutation
    }
  };

  return (
    <section className="mb-8">
      <h2 className="mb-1 text-sm font-medium text-white">Identity & Customization</h2>
      <p className="mb-4 text-[10px] text-mv-text-muted">Make your profile unmistakably yours — it's the story visitors read first.</p>

      <div className="rounded-xl border border-mv-border bg-mv-darker p-5">
        <div className="space-y-4">
          {/* Bio */}
          <div>
            <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-mv-text-muted">Bio</label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              maxLength={500}
              rows={3}
              placeholder="Tell readers who you are — what you love, what you're chasing."
              className="field resize-none"
            />
            <p className="mt-1 text-[9px] text-mv-text-dim">{bio.length}/500 characters</p>
          </div>

          {/* Location + Website */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-mv-text-muted">Location</label>
              <input type="text" value={location} onChange={(e) => setLocation(e.target.value)} maxLength={80} placeholder="Kyoto, Japan" className="field w-full" />
            </div>
            <div>
              <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-mv-text-muted">Website</label>
              <input type="url" value={website} onChange={(e) => setWebsite(e.target.value)} maxLength={300} placeholder="https://your.site" className="field w-full" />
            </div>
          </div>

          {/* Social links */}
          <div>
            <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-mv-text-muted">Social links</label>
            <div className="grid gap-3 sm:grid-cols-2">
              {SOCIAL_FIELDS.map((f) => (
                <div key={f.key}>
                  <span className="mb-1 block text-[9px] text-mv-text-dim">{f.label}</span>
                  <input
                    type="text"
                    value={social[f.key] ?? ''}
                    onChange={(e) => setSocial({ ...social, [f.key]: e.target.value })}
                    maxLength={60}
                    placeholder={f.placeholder}
                    className="field w-full"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Banner */}
          <div>
            <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-mv-text-muted">Banner image URL</label>
            <input type="url" value={bannerUrl} onChange={(e) => setBannerUrl(e.target.value)} maxLength={500} placeholder="https://example.com/banner.jpg — leave empty for a theme gradient" className="field w-full" />
          </div>

          {/* Accent color */}
          <div>
            <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-mv-text-muted">Accent color</label>
            <div className="flex flex-wrap items-center gap-2">
              {ACCENT_SWATCHES.map((c) => (
                <button
                  key={c}
                  onClick={() => setAccentColor(accentColor === c ? null : c)}
                  aria-label={`Accent ${c}`}
                  aria-pressed={accentColor === c}
                  className={cn('h-8 w-8 rounded-full transition-transform hover:scale-110', accentColor === c && 'ring-2 ring-white ring-offset-2 ring-offset-mv-darker')}
                  style={{ backgroundColor: c }}
                />
              ))}
              <button onClick={() => setAccentColor(null)} className={cn('rounded-full border border-mv-border-light px-3 py-1.5 text-[10px] font-medium transition-colors', accentColor === null ? 'text-mv-accent' : 'text-mv-text-dim hover:text-mv-text')}>Default</button>
            </div>
          </div>

          {/* Theme */}
          <div>
            <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-mv-text-muted">Profile theme</label>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
              {THEME_OPTIONS.map((t) => (
                <button
                  key={t.key}
                  onClick={() => setProfileTheme(t.key)}
                  aria-pressed={profileTheme === t.key}
                  className={cn('group overflow-hidden rounded-xl border-2 text-left transition-all', profileTheme === t.key ? 'border-mv-accent' : 'border-transparent hover:border-mv-border-light')}
                >
                  <span className={cn('block h-10 w-full', t.swatch)} />
                  <span className={cn('block px-1.5 py-1 text-[9px] font-medium', profileTheme === t.key ? 'text-mv-accent' : 'text-mv-text-dim')}>{t.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Layout + card style */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-mv-text-muted">Layout style</label>
              <div className="flex gap-1 rounded-xl border border-mv-border-light bg-mv-surface/60 p-1">
                <Segment active={layoutStyle === 'editorial'} onClick={() => setLayoutStyle('editorial')}>Editorial</Segment>
                <Segment active={layoutStyle === 'compact'} onClick={() => setLayoutStyle('compact')}>Compact</Segment>
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-mv-text-muted">Card style</label>
              <div className="flex gap-1 rounded-xl border border-mv-border-light bg-mv-surface/60 p-1">
                <Segment active={cardStyle === 'rounded'} onClick={() => setCardStyle('rounded')}>Rounded</Segment>
                <Segment active={cardStyle === 'sharp'} onClick={() => setCardStyle('sharp')}>Sharp</Segment>
              </div>
            </div>
          </div>

          {/* Save */}
          <div className="flex items-center gap-3 pt-1">
            <button onClick={save} disabled={updateProfile.isPending} className="btn-primary px-5 py-2.5 text-xs disabled:opacity-50">
              {updateProfile.isPending ? 'Saving...' : 'Save identity'}
            </button>
            {saved && <span className="text-[10px] text-green-400 animate-fade-in">✓ Saved</span>}
          </div>
          {updateProfile.isError && <p className="text-[10px] text-red-400">Failed to save. Please try again.</p>}
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════
   PrivacySection — Phase 9 per-section visibility controls.
   Privacy-first by design: each showcase section on the profile can
   be toggled independently, persisted via /users/prefs.
   ═══════════════════════════════════════════════════════════════ */

const PRIVACY_ITEMS: { key: keyof UserPrefs; label: string; desc: string }[] = [
  { key: 'publicProfile', label: 'Public profile', desc: 'Anyone can view your profile page.' },
  { key: 'shareStats', label: 'Statistics', desc: 'Pages, hours, completion rate, and analytics.' },
  { key: 'shareReading', label: 'Current reading', desc: 'What you are reading right now.' },
  { key: 'shareActivity', label: 'Recent activity', desc: 'Your activity timeline.' },
  { key: 'shareAchievements', label: 'Achievements', desc: 'Your earned badges.' },
  { key: 'shareCollections', label: 'Collections', desc: 'Public collections on your profile.' },
  { key: 'shareBookmarks', label: 'Reading shelf', desc: 'Series in your library.' },
  { key: 'shareReviews', label: 'Reviews', desc: 'Reviews you have written.' },
  { key: 'shareGoals', label: 'Goals', desc: 'Active reading goals.' },
  { key: 'shareLists', label: 'Lists', desc: 'Your public lists.' },
  { key: 'shareFollowers', label: 'Followers & following', desc: 'Who follows you and who you follow.' },
];

function PrivacySection() {
  const { token } = useAuthStore();
  const { data: prefs } = usePrefs(!!token);
  const updatePrefs = useUpdatePrefs();

  const toggle = (key: keyof UserPrefs, current: boolean) => {
    if (!token) return;
    updatePrefs.mutate({ [key]: !current } as Partial<UserPrefs>);
  };

  return (
    <section className="mb-8">
      <h2 className="mb-1 text-sm font-medium text-white">Privacy</h2>
      <p className="mb-4 text-[10px] text-mv-text-muted">Choose what visitors see on your profile. Everything is off by default when your profile is private.</p>

      <div className="rounded-xl border border-mv-border bg-mv-darker divide-y divide-mv-border">
        {PRIVACY_ITEMS.map((item) => {
          const value = prefs?.[item.key] as boolean | undefined;
          const checked = value === undefined ? true : value;
          return (
            <div key={item.key} className="flex items-center justify-between px-5 py-3.5">
              <div>
                <p className="text-xs font-medium text-mv-text">{item.label}</p>
                <p className="mt-0.5 text-[10px] text-mv-text-muted">{item.desc}</p>
              </div>
              <label className="relative inline-flex cursor-pointer items-center">
                <input type="checkbox" checked={checked} onChange={(e) => toggle(item.key, checked)} className="peer sr-only" />
                <div className="h-5 w-9 rounded-full bg-mv-border-light after:absolute after:left-[2px] after:top-[2px] after:h-4 after:w-4 after:rounded-full after:bg-mv-text-muted after:transition-all peer-checked:bg-mv-accent/60 peer-checked:after:translate-x-full peer-checked:after:bg-mv-accent" />
              </label>
            </div>
          );
        })}
      </div>
      <p className="mt-2 text-[9px] text-mv-text-dim">Privacy choices sync across devices and apply instantly.</p>
    </section>
  );
}
