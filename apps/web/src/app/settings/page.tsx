'use client';

import { useState, useEffect } from 'react';
import { TopBar } from '@/components/TopBar';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { useAuthStore } from '@/store/authStore';
import { useUpdateProfile, useDeleteAccount } from '@/lib/hooks/useSettings';

export default function SettingsPage() {
  const { user, token } = useAuthStore();
  const updateProfile = useUpdateProfile();
  const deleteAccount = useDeleteAccount();

  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [avatarUrl, setAvatarUrl] = useState(user?.avatarUrl || '');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [saved, setSaved] = useState(false);

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
      <main className="min-h-screen bg-mv-dark">
        <TopBar />
        <div className="mx-auto max-w-2xl p-6">
          <div className="mb-6">
            <h1 className="text-xl font-semibold text-white">Settings</h1>
            <p className="text-xs text-mv-text-muted mt-0.5">Manage your profile and account</p>
          </div>

          {/* ─── Profile Section ──────────────────── */}
          <section className="mb-8">
            <div className="flex items-center gap-4 mb-6">
              <div className="relative">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-mv-accent to-mv-purple text-xl font-bold text-white">
                  {displayName?.charAt(0)?.toUpperCase() || 'U'}
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
                <input
                  type="url"
                  value={avatarUrl}
                  onChange={(e) => setAvatarUrl(e.target.value)}
                  className="w-full rounded-lg border border-mv-border-light bg-mv-surface px-3 py-2 text-xs text-mv-text placeholder:text-mv-text-dim outline-none focus:border-mv-accent transition-colors"
                  placeholder="https://example.com/avatar.jpg"
                />
                <p className="mt-1 text-[9px] text-mv-text-dim">Leave empty for default avatar</p>
              </div>

              {/* Save Button */}
              <div className="flex items-center gap-3 pt-2">
                <button
                  onClick={handleSaveProfile}
                  disabled={updateProfile.isPending || !displayName.trim()}
                  className="rounded-lg bg-mv-accent px-5 py-2 text-xs font-medium text-white transition-colors hover:bg-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
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

          {/* ─── Preferences Section ──────────────── */}
          <section className="mb-8">
            <h2 className="mb-4 text-sm font-medium text-white">Notification Preferences</h2>

            <div className="rounded-xl border border-mv-border bg-mv-darker divide-y divide-mv-border">
              {[
                { id: 'new_chapter', label: 'New Chapters', desc: 'When a new chapter is added to a title in your library' },
                { id: 'reviews', label: 'Reviews & Ratings', desc: 'When someone reviews a title you bookmarked' },
                { id: 'milestones', label: 'Reading Milestones', desc: 'When you reach reading milestones' },
                { id: 'achievements', label: 'Achievements', desc: 'When you earn new badges and achievements' },
              ].map((pref) => (
                <div key={pref.id} className="flex items-center justify-between px-5 py-3.5">
                  <div>
                    <p className="text-xs font-medium text-mv-text">{pref.label}</p>
                    <p className="text-[10px] text-mv-text-muted mt-0.5">{pref.desc}</p>
                  </div>
                  <label className="relative inline-flex cursor-pointer items-center">
                    <input
                      type="checkbox"
                      defaultChecked
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
      </main>
    </ProtectedRoute>
  );
}
