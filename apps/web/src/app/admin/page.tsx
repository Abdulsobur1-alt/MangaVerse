'use client';

import { useState, useEffect } from 'react';
import { AppShell } from '@/components/AppShell';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { useAuthStore } from '@/store/authStore';
import {
  useAdminStats,
  useAdminUsers,
  useSetUserRole,
  useAdminPosts,
  useAdminDeletePost,
  useAdminComments,
  useAdminDeleteComment,
  useAdminWiki,
  useAdminDeleteWiki,
  useAdminClubs,
  useAdminDeleteClub,
  useAdminReports,
  useAdminUpdateReport,
  useEngagementStats,
  useAdminBroadcast,
  useAdminAnnouncements,
  useAdminCreateAnnouncement,
  useAdminToggleAnnouncement,
  useAdminDeleteAnnouncement,
  useAdminNotifyAnnouncement,
  useAdminTemplates,
  useAdminSaveTemplate,
  useAdminDashboard,
  useAdminRoles,
  useAdminTitles,
  useAdminUpdateTitle,
  useAdminReindexTitle,
  useAdminChapters,
  useAdminRevisions,
  useAdminRollbackRevision,
  useAdminPicks,
  useAdminCreatePick,
  useAdminDeletePick,
  useAdminTogglePick,
  useAdminMedia,
  useAdminCreateMedia,
  useAdminDeleteMedia,
  useAdminWarnings,
  useAdminWarnUser,
  useAdminSuspendUser,
  useAdminBanUser,
  useAdminUnbanUser,
  useAdminFlags,
  useAdminCreateFlag,
  useAdminUpdateFlag,
  useAdminDeleteFlag,
  useAdminAuditLog,
  useAdminAuditMeta,
  useAdminAuditExport,
  useAdminTickets,
  useAdminTicket,
  useAdminUpdateTicket,
  useAdminTicketNote,
  useAdminHealth,
  useAdminAnalytics,
  useAdminSettings,
  useAdminUpdateSetting,
  useAdminMaintenance,
  useAdminSetMaintenance,
  useAdminImpersonate,
} from '@/lib/hooks/useAdmin';

/* ═══════════════════════════════════════════════════════════════
   Admin Console — the Phase 11 platform control room.
   Sections split by responsibility:
   • Core (moderator+): Overview · Users · Reports · Posts ·
     Comments · Wiki · Clubs · Engagement · Moderation · Audit ·
     Tickets · Health · Analytics
   • Platform (admin only): CMS · Media · Flags · Settings
   ═══════════════════════════════════════════════════════════════ */

const MOD_TABS = ['Overview', 'Users', 'Reports', 'Posts', 'Comments', 'Wiki', 'Clubs', 'Engagement', 'Moderation', 'Audit', 'Tickets', 'Health', 'Analytics'] as const;
const ADMIN_TABS = ['CMS', 'Media', 'Flags', 'Settings'] as const;
const TABS = [...MOD_TABS, ...ADMIN_TABS];
type Tab = (typeof TABS)[number];

const ROLE_BADGE: Record<string, string> = {
  admin: 'bg-mv-accent/20 text-mv-accent border border-mv-accent/30',
  super_admin: 'bg-mv-accent/20 text-mv-accent border border-mv-accent/30',
  platform_admin: 'bg-mv-accent/20 text-mv-accent border border-mv-accent/30',
  moderator: 'bg-mv-purple/20 text-mv-purple border border-mv-purple/30',
  user: 'bg-mv-surface text-mv-text-dim border border-mv-border',
};

// The console accepts the legacy 'admin' string plus the granular
// admin-equivalent roles from the RBAC matrix (mirrors requireRole on the
// API). Any other role falls back to the mod view / access-denied state.
const ADMIN_ROLES = ['admin', 'platform_admin', 'super_admin'];
const MOD_ROLES = ['moderator', ...ADMIN_ROLES];

function StatCard({ label, value, accent }: { label: string; value: number | string; accent?: string }) {
  return (
    <div className="rounded-xl border border-mv-border bg-mv-darker p-4 transition-all duration-200 hover:border-mv-violet/30">
      <p className="text-[9px] font-semibold uppercase tracking-wider text-mv-text-muted">{label}</p>
      <p className={`mt-1.5 text-2xl font-semibold ${accent || 'text-white'}`}>{value.toLocaleString()}</p>
    </div>
  );
}

function Loading() {
  return (
    <div className="flex items-center justify-center py-16">
      <div className="h-7 w-7 animate-spin rounded-full border-2 border-mv-accent border-t-transparent" />
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="rounded-xl border border-mv-border bg-mv-darker p-8 text-center text-xs text-mv-text-dim">{text}</p>;
}

export default function AdminPage() {
  const { user } = useAuthStore();
  const [tab, setTab] = useState<Tab>('Overview');

  const isMod = user?.role ? MOD_ROLES.includes(user.role) : false;
  const isAdmin = user?.role ? ADMIN_ROLES.includes(user.role) : false;
  const visibleTabs: readonly Tab[] = isAdmin ? TABS : MOD_TABS;
  const currentTab = visibleTabs.includes(tab) ? tab : 'Overview';

  return (
    <ProtectedRoute>
      <AppShell>
        <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 md:px-8 md:py-8">
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-mv-accent/20 text-mv-accent">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.573-1.066z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            </div>
            <div>
              <h1 className="text-xl font-semibold text-white">Admin Console</h1>
              <p className="text-xs text-mv-text-muted">Platform control room — content, moderation & operations</p>
            </div>
            <span className={`ml-auto rounded-md px-2.5 py-1 text-[9px] font-medium ${ROLE_BADGE[user?.role || 'user']}`}>
              {user?.role || 'user'}
            </span>
          </div>

          {!isMod ? (
            <div className="rounded-xl border border-red-900/30 bg-mv-darker p-10 text-center">
              <p className="text-sm text-red-400">⛔ Access Denied</p>
              <p className="mt-1 text-xs text-mv-text-muted">You need a moderator or admin role to view this page.</p>
            </div>
          ) : (
            <>
              {/* Sub-nav */}
              <div className="mb-6 flex items-center gap-1 overflow-x-auto rounded-lg border border-mv-border bg-mv-darker p-1">
                {visibleTabs.map((t) => (
                  <button
                    key={t}
                    onClick={() => setTab(t)}
                    className={`rounded-md px-3.5 py-1.5 text-[10px] transition-colors whitespace-nowrap ${
                      currentTab === t ? 'bg-mv-accent text-white' : 'text-mv-text-secondary hover:text-mv-text'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>

              {currentTab === 'Overview' && <OverviewTab enabled={isMod} />}
              {currentTab === 'Users' && <UsersTab enabled={isMod} isAdmin={isAdmin} />}
              {currentTab === 'Reports' && <ReportsTab enabled={isMod} />}
              {currentTab === 'Posts' && <PostsTab enabled={isMod} />}
              {currentTab === 'Comments' && <CommentsTab enabled={isMod} />}
              {currentTab === 'Wiki' && <WikiTab enabled={isMod} />}
              {currentTab === 'Clubs' && <ClubsTab enabled={isMod} />}
              {currentTab === 'Engagement' && <EngagementTab />}
              {currentTab === 'CMS' && <CmsTab enabled={isAdmin} />}
              {currentTab === 'Media' && <MediaTab enabled={isAdmin} />}
              {currentTab === 'Moderation' && <ModerationTab enabled={isMod} />}
              {currentTab === 'Flags' && <FlagsTab enabled={isAdmin} />}
              {currentTab === 'Audit' && <AuditTab enabled={isMod} />}
              {currentTab === 'Tickets' && <TicketsTab enabled={isMod} />}
              {currentTab === 'Health' && <HealthTab enabled={isMod} />}
              {currentTab === 'Analytics' && <AnalyticsTab enabled={isMod} />}
              {currentTab === 'Settings' && <SettingsTab enabled={isAdmin} />}
            </>
          )}
        </div>
      </AppShell>
    </ProtectedRoute>
  );
}

/* ════════════════════ Overview — executive dashboard ════════════════════ */

function OverviewTab({ enabled }: { enabled: boolean }) {
  const { data: stats } = useAdminStats(enabled);
  const { data: dash } = useAdminDashboard(enabled);

  if (!stats) return <Loading />;

  return (
    <div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        <StatCard label="Total Users" value={stats.users} accent="text-mv-accent" />
        <StatCard label="Community Posts" value={stats.posts} />
        <StatCard label="Comments" value={stats.comments} />
        <StatCard label="Reading Clubs" value={stats.clubs} />
        <StatCard label="Wiki Pages" value={stats.wikiPages} />
        <StatCard label="Predictions" value={stats.predictions} />
        <StatCard label="Open Markets" value={stats.openPredictions} accent="text-mv-gold" />
        <StatCard label="Pending Reports" value={stats.pendingReports} accent="text-red-400" />
        <StatCard label="Reviews" value={stats.reviews} />
        <StatCard label="Chapters" value={stats.chapters} />
        {dash && (
          <>
            <StatCard label="Open Tickets" value={dash.stats.openTickets} accent="text-mv-violet" />
            <StatCard label="Active Flags" value={dash.stats.flagsEnabled} />
            <StatCard label="Active Warnings" value={dash.stats.activeWarnings} accent="text-mv-orange" />
          </>
        )}
      </div>

      {dash && (
        <div className="mt-5 grid gap-4 lg:grid-cols-3">
          <div className="rounded-xl border border-mv-border bg-mv-darker p-4">
            <p className="mb-3 text-[9px] font-semibold uppercase tracking-wider text-mv-text-muted">Recent signups</p>
            <div className="space-y-2">
              {dash.recentUsers.map((u) => (
                <div key={u.id} className="flex items-center gap-2.5">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-mv-accent/20 text-[10px] font-semibold text-mv-accent">
                    {u.displayName.charAt(0).toUpperCase()}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[11px] text-mv-text-secondary">{u.displayName}</span>
                  <span className="text-[9px] text-mv-text-dim">{new Date(u.createdAt).toLocaleDateString()}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-mv-border bg-mv-darker p-4">
            <p className="mb-3 text-[9px] font-semibold uppercase tracking-wider text-mv-text-muted">Top titles by saves</p>
            <div className="space-y-2">
              {dash.topTitles.map((t, i) => (
                <div key={t.id} className="flex items-center gap-2.5">
                  <span className="w-4 text-[10px] font-bold text-mv-text-dim">{i + 1}</span>
                  <span className="min-w-0 flex-1 truncate text-[11px] text-mv-text-secondary">{t.title}</span>
                  <span className="rounded-full bg-mv-surface px-2 py-0.5 text-[9px] text-mv-violet">{t.saves} saves</span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-mv-border bg-mv-darker p-4">
            <p className="mb-3 text-[9px] font-semibold uppercase tracking-wider text-mv-text-muted">Recent admin activity</p>
            <div className="space-y-2">
              {dash.recentAudit.map((a) => (
                <div key={a.id} className="flex items-center gap-2 text-[10px]">
                  <span className="shrink-0 rounded bg-mv-surface px-1.5 py-0.5 font-medium text-mv-accent">{a.action}</span>
                  <span className="min-w-0 flex-1 truncate text-mv-text-secondary">{a.actorName}</span>
                  <span className="shrink-0 text-[9px] text-mv-text-dim">
                    {new Date(a.createdAt).toLocaleDateString()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ════════════════════ Users + roles + impersonate ════════════════════ */

function UsersTab({ enabled, isAdmin }: { enabled: boolean; isAdmin: boolean }) {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const setRole = useSetUserRole();
  const impersonate = useAdminImpersonate();
  const { data: rolesData } = useAdminRoles(isAdmin);
  const { user } = useAuthStore();

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const { data: usersData, isLoading } = useAdminUsers({ page, search: debounced || undefined }, enabled);

  const roleOptions = rolesData?.items?.map((r) => r.key) ?? ['user', 'moderator', 'admin'];

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          placeholder="Search by name or email…"
          className="w-full max-w-xs rounded-lg border border-mv-border-light bg-mv-surface px-3 py-2 text-xs text-mv-text placeholder:text-mv-text-dim outline-none focus:border-mv-accent"
        />
        {isAdmin && (
          <span className="text-[9px] text-mv-text-dim">Granular roles available — impersonation is dev-only</span>
        )}
      </div>

      {isLoading ? (
        <Loading />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-mv-border bg-mv-darker">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-mv-border text-[9px] uppercase tracking-wider text-mv-text-muted">
                <th className="px-4 py-2.5">User</th>
                <th className="px-4 py-2.5">Activity</th>
                <th className="px-4 py-2.5">Status</th>
                <th className="px-4 py-2.5">Role</th>
                {isAdmin && <th className="px-4 py-2.5">Tools</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-mv-border">
              {usersData?.items.map((u) => (
                <tr key={u.id} className="transition-colors hover:bg-mv-surface/50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-mv-accent/20 text-[10px] font-semibold text-mv-accent">
                        {u.displayName.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate font-medium text-mv-text">{u.displayName}</p>
                        <p className="truncate text-[9px] text-mv-text-dim">{u.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-[10px] text-mv-text-secondary">
                    {u._count.communityPosts} posts · {u._count.postComments} comments · {u._count.reviews} reviews
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    {u.bannedAt ? (
                      <span className="rounded bg-red-900/30 px-2 py-0.5 text-[9px] font-medium text-red-400">Banned</span>
                    ) : u.suspendedUntil && new Date(u.suspendedUntil) > new Date() ? (
                      <span className="rounded bg-mv-orange/20 px-2 py-0.5 text-[9px] font-medium text-mv-orange">Suspended</span>
                    ) : (
                      <span className="rounded bg-green-500/10 px-2 py-0.5 text-[9px] font-medium text-green-400">Active</span>
                    )}
                    {u.warnings > 0 && (
                      <span className="ml-1 rounded bg-mv-surface px-1.5 py-0.5 text-[8px] text-mv-text-dim">{u.warnings} warn</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <select
                        value={roleOptions.includes(u.role) ? u.role : 'user'}
                        onChange={(e) => setRole.mutate({ userId: u.id, role: e.target.value })}
                        disabled={u.id === user?.id || setRole.isPending}
                        className="rounded-md border border-mv-border-light bg-mv-surface px-2 py-1 text-[10px] text-mv-text outline-none focus:border-mv-accent disabled:opacity-40"
                      >
                        {roleOptions.map((r) => (
                          <option key={r} value={r}>{r}</option>
                        ))}
                      </select>
                      {u.id === user?.id && <span className="text-[8px] text-mv-text-dim">(you)</span>}
                    </div>
                  </td>
                  {isAdmin && (
                    <td className="px-4 py-3">
                      <button
                        onClick={() => {
                          impersonate.mutate(u.id, {
                            onSuccess: (res) => {
                              localStorage.setItem('auth_token', (res as { token: string }).token);
                              window.location.href = '/';
                            },
                          });
                        }}
                        disabled={impersonate.isPending || u.id === user?.id}
                        className="rounded-md bg-mv-surface px-2 py-1 text-[9px] text-mv-violet transition-colors hover:bg-mv-violet/20 disabled:opacity-40"
                        title="Sign in as this user (dev only)"
                      >
                        Sign in as
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {usersData?.hasMore && (
        <div className="mt-3 flex justify-center">
          <button onClick={() => setPage((p) => p + 1)} className="rounded-lg border border-mv-border-light px-4 py-1.5 text-[10px] text-mv-text-secondary transition-colors hover:text-mv-text">
            Load more
          </button>
        </div>
      )}
    </div>
  );
}

/* ════════════════════ Reports ════════════════════ */

function ReportsTab({ enabled }: { enabled: boolean }) {
  const [status, setStatus] = useState<string | undefined>('pending');
  const { data: stats } = useAdminStats(enabled);
  const { data: reportsData } = useAdminReports({ status }, enabled);
  const updateReport = useAdminUpdateReport();

  return (
    <div>
      <div className="mb-4 flex items-center gap-2">
        {['pending', 'resolved', 'dismissed', 'escalated'].map((s) => (
          <button
            key={s}
            onClick={() => setStatus(s)}
            className={`rounded-full px-3 py-1 text-[10px] transition-colors ${
              status === s ? 'bg-mv-accent text-white' : 'bg-mv-surface text-mv-text-secondary hover:text-mv-text'
            }`}
          >
            {s.charAt(0).toUpperCase() + s.slice(1)}
            {s === 'pending' && stats?.pendingReports ? (
              <span className="ml-1 text-mv-gold">({stats.pendingReports})</span>
            ) : null}
          </button>
        ))}
      </div>

      {!reportsData ? (
        <Loading />
      ) : reportsData.items.length === 0 ? (
        <Empty text={`No ${status} reports`} />
      ) : (
        <div className="space-y-2">
          {reportsData.items.map((r) => {
            const typeEmoji = r.contentType === 'post' ? '📝' : r.contentType === 'comment' ? '💬' : '📖';
            return (
              <div key={r.id} className="rounded-xl border border-mv-border bg-mv-darker p-4">
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 text-sm">{typeEmoji}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-mv-text">
                      {r.contentType.charAt(0).toUpperCase() + r.contentType.slice(1)} report
                      <span className="ml-2 rounded bg-red-900/30 px-1.5 py-0.5 text-[8px] font-medium text-red-400">{r.reason}</span>
                    </p>
                    {r.target && r.contentType === 'post' && (
                      <p className="mt-1.5 text-[10px] text-mv-text-secondary">
                        <span className="text-mv-text">{r.target.title}</span> — {r.target.bodyPreview}…
                        <span className="ml-1 text-mv-text-dim">by {r.target.authorName}</span>
                      </p>
                    )}
                    {r.target && r.contentType === 'comment' && (
                      <p className="mt-1.5 text-[10px] text-mv-text-secondary">
                        “{r.target.bodyPreview}…”
                        <span className="ml-1 text-mv-text-dim">by {r.target.authorName} on “{r.target.postTitle}”</span>
                      </p>
                    )}
                    {r.target && r.contentType === 'wiki' && (
                      <p className="mt-1.5 text-[10px] text-mv-text-secondary">
                        Wiki page <span className="text-mv-text">{r.target.titleName}</span>
                        <span className="ml-1 text-mv-text-dim">/ {r.target.slug}</span>
                      </p>
                    )}
                    {!r.target && <p className="mt-1.5 text-[10px] text-red-400/70">⚠ Target content no longer exists</p>}
                    {r.details && <p className="mt-1 text-[9px] italic text-mv-text-muted">“{r.details}”</p>}
                    <p className="mt-1.5 text-[9px] text-mv-text-dim">
                      Reported by {r.reporter.displayName} · {new Date(r.createdAt).toLocaleString()}
                      {r.resolver && <> · handled by {r.resolver.displayName}</>}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1.5">
                    {r.status === 'pending' ? (
                      <div className="mt-1 flex gap-1.5">
                        <button
                          onClick={() => updateReport.mutate({ reportId: r.id, status: 'resolved' })}
                          disabled={updateReport.isPending}
                          className="rounded-md border border-green-900/30 bg-green-500/10 px-2 py-1 text-[8px] font-medium text-green-400 transition-colors hover:bg-green-500/20 disabled:opacity-50"
                        >
                          Resolve
                        </button>
                        <button
                          onClick={() => updateReport.mutate({ reportId: r.id, status: 'dismissed' })}
                          disabled={updateReport.isPending}
                          className="rounded-md border border-mv-border-light bg-mv-surface px-2 py-1 text-[8px] font-medium text-mv-text-dim transition-colors hover:text-mv-text disabled:opacity-50"
                        >
                          Dismiss
                        </button>
                      </div>
                    ) : (
                      <span className={`text-[8px] font-medium ${r.status === 'resolved' ? 'text-green-400' : 'text-mv-text-dim'}`}>
                        {r.status === 'resolved' ? '✓ Resolved' : r.status === 'escalated' ? '▲ Escalated' : '✕ Dismissed'}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ════════════════════ Posts / Comments / Wiki / Clubs ════════════════════ */

function PostsTab({ enabled }: { enabled: boolean }) {
  const { data: data } = useAdminPosts(undefined, enabled);
  const del = useAdminDeletePost();
  if (!data) return <Loading />;
  return (
    <div className="space-y-2">
      {data.items.map((p) => (
        <div key={p.id} className="flex items-start gap-3 rounded-xl border border-mv-border bg-mv-darker p-4">
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium text-mv-text">{p.title}</p>
            <p className="mt-0.5 line-clamp-1 text-[10px] text-mv-text-muted">{p.body}</p>
            <p className="mt-1.5 text-[9px] text-mv-text-dim">
              by {p.author.displayName} · {p.upvotes}▲ · {p.comments}💬 · {new Date(p.createdAt).toLocaleDateString()}
            </p>
          </div>
          <button
            onClick={() => del.mutate(p.id)}
            disabled={del.isPending}
            className="shrink-0 rounded-lg border border-red-900/30 px-3 py-1.5 text-[9px] font-medium text-red-400 transition-colors hover:bg-red-900/20 disabled:opacity-50"
          >
            Delete
          </button>
        </div>
      ))}
      {data.items.length === 0 && <Empty text="No posts yet" />}
    </div>
  );
}

function CommentsTab({ enabled }: { enabled: boolean }) {
  const { data: data } = useAdminComments(undefined, enabled);
  const del = useAdminDeleteComment();
  if (!data) return <Loading />;
  return (
    <div className="space-y-2">
      {data.items.map((c) => (
        <div key={c.id} className="flex items-start gap-3 rounded-xl border border-mv-border bg-mv-darker p-4">
          <div className="min-w-0 flex-1">
            <p className="line-clamp-2 text-[10px] text-mv-text-muted">{c.body}</p>
            <p className="mt-1.5 text-[9px] text-mv-text-dim">
              by {c.author.displayName} · on “{c.post.title}” · {new Date(c.createdAt).toLocaleDateString()}
            </p>
          </div>
          <button
            onClick={() => del.mutate(c.id)}
            disabled={del.isPending}
            className="shrink-0 rounded-lg border border-red-900/30 px-3 py-1.5 text-[9px] font-medium text-red-400 transition-colors hover:bg-red-900/20 disabled:opacity-50"
          >
            Delete
          </button>
        </div>
      ))}
      {data.items.length === 0 && <Empty text="No comments yet" />}
    </div>
  );
}

function WikiTab({ enabled }: { enabled: boolean }) {
  const { data: data } = useAdminWiki(undefined, enabled);
  const del = useAdminDeleteWiki();
  if (!data) return <Loading />;
  return (
    <div className="space-y-2">
      {data.items.map((w) => (
        <div key={w.id} className="flex items-start gap-3 rounded-xl border border-mv-border bg-mv-darker p-4">
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium text-mv-text">
              {w.title.title} <span className="text-mv-text-dim">/ {w.slug}</span>
            </p>
            <p className="mt-0.5 line-clamp-1 text-[10px] text-mv-text-muted">{w.contentPreview}…</p>
            <p className="mt-1.5 text-[9px] text-mv-text-dim">
              v{w.version} · by {w.author.displayName} · {new Date(w.updatedAt).toLocaleDateString()}
            </p>
          </div>
          <button
            onClick={() => del.mutate(w.slug)}
            disabled={del.isPending}
            className="shrink-0 rounded-lg border border-red-900/30 px-3 py-1.5 text-[9px] font-medium text-red-400 transition-colors hover:bg-red-900/20 disabled:opacity-50"
          >
            Delete
          </button>
        </div>
      ))}
      {data.items.length === 0 && <Empty text="No wiki pages yet" />}
    </div>
  );
}

function ClubsTab({ enabled }: { enabled: boolean }) {
  const { data: data } = useAdminClubs(undefined, enabled);
  const del = useAdminDeleteClub();
  if (!data) return <Loading />;
  return (
    <div className="space-y-2">
      {data.items.map((c) => (
        <div key={c.id} className="flex items-start gap-3 rounded-xl border border-mv-border bg-mv-darker p-4">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-mv-text">{c.name}</p>
            <p className="mt-1 text-[9px] text-mv-text-dim">
              {c.memberCount} members · created {new Date(c.createdAt).toLocaleDateString()}
            </p>
          </div>
          <button
            onClick={() => del.mutate(c.id)}
            disabled={del.isPending}
            className="shrink-0 rounded-lg border border-red-900/30 px-3 py-1.5 text-[9px] font-medium text-red-400 transition-colors hover:bg-red-900/20 disabled:opacity-50"
          >
            Delete
          </button>
        </div>
      ))}
      {data.items.length === 0 && <Empty text="No clubs yet" />}
    </div>
  );
}

/* ════════════════════ Engagement (Phase 10) ════════════════════ */

const VARIANTS = ['info', 'success', 'warning', 'seasonal', 'maintenance'];
const BROADCAST_TYPES = ['system', 'announcement', 'security', 'moderator', 'recommendation', 'milestone'];
const PRIORITIES = ['critical', 'high', 'normal', 'silent', 'background'];
const AUDIENCES = ['all', 'logged_in', 'moderators'];

function EngagementTab() {
  const { data: stats } = useEngagementStats();
  const broadcast = useAdminBroadcast();
  const { data: annData } = useAdminAnnouncements();
  const createAnn = useAdminCreateAnnouncement();
  const toggleAnn = useAdminToggleAnnouncement();
  const deleteAnn = useAdminDeleteAnnouncement();
  const notifyAnn = useAdminNotifyAnnouncement();
  const { data: tplData } = useAdminTemplates();
  const saveTpl = useAdminSaveTemplate();

  const [bType, setBType] = useState('system');
  const [bTitle, setBTitle] = useState('');
  const [bBody, setBBody] = useState('');
  const [bLink, setBLink] = useState('');
  const [bPriority, setBPriority] = useState('normal');
  const [bAudience, setBAudience] = useState('all');
  const [bSent, setBSent] = useState<number | null>(null);

  const [aTitle, setATitle] = useState('');
  const [aBody, setABody] = useState('');
  const [aVariant, setAVariant] = useState('info');
  const [aAudience, setAAudience] = useState('all');
  const [aLink, setALink] = useState('');
  const [aCreated, setACreated] = useState(false);

  const [editKey, setEditKey] = useState<string | null>(null);
  const [tTitle, setTTitle] = useState('');
  const [tBody, setTBody] = useState('');

  const sendBroadcast = () => {
    if (!bTitle.trim()) return;
    broadcast.mutate(
      { type: bType, title: bTitle.trim(), body: bBody.trim() || undefined, link: bLink.trim() || undefined, priority: bPriority, audience: bAudience },
      {
        onSuccess: (res) => {
          setBSent((res as { sent?: number })?.sent ?? null);
          setBTitle(''); setBBody(''); setBLink('');
        },
      },
    );
  };

  const createAnnouncement = () => {
    if (!aTitle.trim()) return;
    createAnn.mutate(
      { title: aTitle.trim(), body: aBody.trim() || undefined, variant: aVariant as never, audience: aAudience as never, link: aLink.trim() || undefined },
      {
        onSuccess: () => {
          setACreated(true); setATitle(''); setABody(''); setALink('');
          setTimeout(() => setACreated(false), 2500);
        },
      },
    );
  };

  const openTemplate = (key: string) => {
    const t = tplData?.items.find((x) => x.key === key);
    if (!t) return;
    setEditKey(key); setTTitle(t.title); setTBody(t.body ?? '');
  };

  const saveTemplate = () => {
    if (!editKey) return;
    const t = tplData?.items.find((x) => x.key === editKey);
    saveTpl.mutate({ key: editKey, name: t?.name ?? editKey, type: t?.type ?? 'system', title: tTitle, body: tBody || undefined });
    setEditKey(null);
  };

  const maxDay = Math.max(1, ...Object.values(stats?.perDay ?? {}));
  const days = Object.entries(stats?.perDay ?? {}).sort(([a], [b]) => (a < b ? -1 : 1));

  return (
    <div className="space-y-6">
      <section>
        <h3 className="mb-3 text-xs font-semibold text-white">Delivery analytics</h3>
        {!stats ? (
          <Loading />
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              <StatCard label="All-time notifications" value={stats.totals.notifications} accent="text-mv-accent" />
              <StatCard label="Last 7 days" value={stats.totals.last7Days} />
              <StatCard label="Push subscriptions" value={stats.totals.pushSubscriptions} accent="text-mv-violet" />
              <StatCard label="Announcements" value={stats.totals.announcements} />
              <StatCard label="Digest-enabled users" value={stats.totals.digestEnabledUsers} />
            </div>
            <div className="mt-3 grid gap-3 lg:grid-cols-2">
              <div className="rounded-xl border border-mv-border bg-mv-darker p-4">
                <p className="mb-3 text-[9px] font-semibold uppercase tracking-wider text-mv-text-muted">Notifications per day (7d)</p>
                <div className="flex h-24 items-end gap-1.5">
                  {days.map(([day, count]) => (
                    <div key={day} className="flex flex-1 flex-col items-center gap-1">
                      <span className="text-[8px] text-mv-text-dim">{count}</span>
                      <div
                        className="w-full rounded-t-md bg-gradient-to-t from-mv-purple/40 to-mv-accent/80 transition-all"
                        style={{ height: `${Math.max(4, (count / maxDay) * 72)}px` }}
                      />
                      <span className="text-[7px] text-mv-text-dim">{day.slice(5)}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded-xl border border-mv-border bg-mv-darker p-4">
                <p className="mb-3 text-[9px] font-semibold uppercase tracking-wider text-mv-text-muted">By category</p>
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(stats.byCategory).map(([cat, count]) => (
                    <span key={cat} className="rounded-full bg-mv-surface px-2.5 py-1 text-[10px] text-mv-text-secondary">
                      {cat} · <span className="text-mv-text">{count}</span>
                    </span>
                  ))}
                </div>
                <p className="mb-2 mt-4 text-[9px] font-semibold uppercase tracking-wider text-mv-text-muted">By priority</p>
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(stats.byPriority).map(([pr, count]) => (
                    <span key={pr} className="rounded-full bg-mv-surface px-2.5 py-1 text-[10px] text-mv-text-secondary">
                      {pr} · <span className="text-mv-text">{count}</span>
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}
      </section>

      <section className="rounded-xl border border-mv-border bg-mv-darker p-5">
        <h3 className="mb-1 text-xs font-semibold text-white">Broadcast notification</h3>
        <p className="mb-4 text-[10px] text-mv-text-muted">Send a notification to an entire audience — connected users see it live.</p>
        <div className="grid gap-3 lg:grid-cols-2">
          <div>
            <label className="mb-1 block text-[9px] uppercase tracking-wider text-mv-text-dim">Type</label>
            <select value={bType} onChange={(e) => setBType(e.target.value)} className="field w-full">
              {BROADCAST_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-[9px] uppercase tracking-wider text-mv-text-dim">Priority</label>
            <select value={bPriority} onChange={(e) => setBPriority(e.target.value)} className="field w-full">
              {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-[9px] uppercase tracking-wider text-mv-text-dim">Audience</label>
            <select value={bAudience} onChange={(e) => setBAudience(e.target.value)} className="field w-full">
              {AUDIENCES.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-[9px] uppercase tracking-wider text-mv-text-dim">Link (optional)</label>
            <input value={bLink} onChange={(e) => setBLink(e.target.value)} placeholder="/browse" className="field w-full" />
          </div>
          <div className="lg:col-span-2">
            <label className="mb-1 block text-[9px] uppercase tracking-wider text-mv-text-dim">Title</label>
            <input value={bTitle} onChange={(e) => setBTitle(e.target.value)} maxLength={140} placeholder="Important announcement…" className="field w-full" />
          </div>
          <div className="lg:col-span-2">
            <label className="mb-1 block text-[9px] uppercase tracking-wider text-mv-text-dim">Body (optional)</label>
            <textarea value={bBody} onChange={(e) => setBBody(e.target.value)} rows={2} maxLength={1000} placeholder="Details…" className="field w-full resize-none" />
          </div>
        </div>
        <div className="mt-4 flex items-center gap-3">
          <button onClick={sendBroadcast} disabled={broadcast.isPending || !bTitle.trim()} className="btn-primary px-5 py-2 text-xs disabled:opacity-50">
            {broadcast.isPending ? 'Sending…' : 'Send broadcast'}
          </button>
          {bSent !== null && broadcast.isSuccess && (
            <span className="animate-fade-in text-[10px] text-green-400">✓ Sent to {bSent} user{bSent === 1 ? '' : 's'}</span>
          )}
          {broadcast.isError && <span className="text-[10px] text-red-400">Failed to send</span>}
        </div>
      </section>

      <section>
        <h3 className="mb-3 text-xs font-semibold text-white">Announcements</h3>
        <div className="rounded-xl border border-mv-border bg-mv-darker p-5">
          <div className="grid gap-3 lg:grid-cols-2">
            <div>
              <label className="mb-1 block text-[9px] uppercase tracking-wider text-mv-text-dim">Title</label>
              <input value={aTitle} onChange={(e) => setATitle(e.target.value)} maxLength={140} placeholder="Banner title…" className="field w-full" />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="mb-1 block text-[9px] uppercase tracking-wider text-mv-text-dim">Variant</label>
                <select value={aVariant} onChange={(e) => setAVariant(e.target.value)} className="field w-full">
                  {VARIANTS.map((v) => <option key={v} value={v}>{v}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-[9px] uppercase tracking-wider text-mv-text-dim">Audience</label>
                <select value={aAudience} onChange={(e) => setAAudience(e.target.value)} className="field w-full">
                  {AUDIENCES.map((a) => <option key={a} value={a}>{a}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-[9px] uppercase tracking-wider text-mv-text-dim">Link</label>
                <input value={aLink} onChange={(e) => setALink(e.target.value)} placeholder="/browse" className="field w-full" />
              </div>
            </div>
            <div className="lg:col-span-2">
              <label className="mb-1 block text-[9px] uppercase tracking-wider text-mv-text-dim">Body</label>
              <textarea value={aBody} onChange={(e) => setABody(e.target.value)} rows={2} maxLength={2000} placeholder="Optional details…" className="field w-full resize-none" />
            </div>
          </div>
          <div className="mt-3 flex items-center gap-3">
            <button onClick={createAnnouncement} disabled={createAnn.isPending || !aTitle.trim()} className="btn-ghost px-4 py-2 text-[10px] disabled:opacity-50">
              {createAnn.isPending ? 'Creating…' : 'Create announcement'}
            </button>
            {aCreated && <span className="animate-fade-in text-[10px] text-green-400">✓ Live (visible to matching visitors)</span>}
          </div>
        </div>

        <div className="mt-3 space-y-2">
          {(annData?.items ?? []).map((a) => (
            <div key={a.id} className="flex items-start gap-3 rounded-xl border border-mv-border bg-mv-darker p-4">
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-mv-text">
                  {a.title}
                  <span className="ml-2 rounded bg-mv-surface px-1.5 py-0.5 text-[8px] text-mv-text-muted">{a.variant}</span>
                  <span className="ml-1 rounded bg-mv-surface px-1.5 py-0.5 text-[8px] text-mv-text-muted">{a.audience}</span>
                </p>
                {a.body && <p className="mt-0.5 line-clamp-1 text-[10px] text-mv-text-muted">{a.body}</p>}
                <p className="mt-1 text-[9px] text-mv-text-dim">
                  {a.dismissals} dismissals · created {new Date(a.createdAt).toLocaleDateString()}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <button onClick={() => notifyAnn.mutate(a.id)} disabled={notifyAnn.isPending} className="rounded-md bg-mv-surface px-2 py-1 text-[9px] text-mv-violet transition-colors hover:bg-mv-violet/20">
                  Notify
                </button>
                <button
                  onClick={() => toggleAnn.mutate({ id: a.id, active: !a.active })}
                  className={`rounded-md px-2 py-1 text-[9px] transition-colors ${a.active ? 'bg-green-500/10 text-green-400 hover:bg-green-500/20' : 'bg-mv-surface text-mv-text-dim hover:text-mv-text'}`}
                >
                  {a.active ? 'Live' : 'Paused'}
                </button>
                <button onClick={() => deleteAnn.mutate(a.id)} disabled={deleteAnn.isPending} className="rounded-md bg-mv-surface px-2 py-1 text-[9px] text-red-400/70 transition-colors hover:bg-red-900/20">
                  Delete
                </button>
              </div>
            </div>
          ))}
          {annData && annData.items.length === 0 && <Empty text="No announcements yet" />}
        </div>
      </section>

      <section>
        <h3 className="mb-3 text-xs font-semibold text-white">Notification templates</h3>
        <div className="rounded-xl border border-mv-border bg-mv-darker p-4">
          <p className="mb-3 text-[10px] text-mv-text-muted">
            Edit the copy behind system-led notifications. Tokens like <code className="rounded bg-mv-surface px-1 text-mv-violet">{"{series}"}</code>,{' '}
            <code className="rounded bg-mv-surface px-1 text-mv-violet">{"{chapter}"}</code> are substituted at send time.
          </p>
          <div className="max-h-64 space-y-1 overflow-y-auto">
            {(tplData?.items ?? []).map((t) => (
              <div key={t.key} className="flex items-start gap-3 rounded-lg border border-mv-border/60 bg-mv-surface/40 p-3">
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-medium text-mv-text">{t.key}</p>
                  <p className="mt-0.5 truncate text-[9px] text-mv-text-muted">{t.title}</p>
                </div>
                {editKey === t.key ? (
                  <div className="flex items-center gap-1.5">
                    <button onClick={saveTemplate} disabled={saveTpl.isPending} className="rounded-md bg-mv-accent/20 px-2 py-1 text-[9px] text-mv-accent">Save</button>
                    <button onClick={() => setEditKey(null)} className="rounded-md bg-mv-surface px-2 py-1 text-[9px] text-mv-text-dim">Cancel</button>
                  </div>
                ) : (
                  <button onClick={() => openTemplate(t.key)} className="rounded-md bg-mv-surface px-2 py-1 text-[9px] text-mv-text-secondary transition-colors hover:text-mv-text">Edit</button>
                )}
              </div>
            ))}
          </div>
          {editKey && (
            <div className="mt-3 space-y-2 border-t border-mv-border pt-3">
              <p className="text-[10px] font-medium text-mv-violet">Editing: {editKey}</p>
              <input value={tTitle} onChange={(e) => setTTitle(e.target.value)} placeholder="Title template" className="field w-full" />
              <textarea value={tBody} onChange={(e) => setTBody(e.target.value)} rows={2} placeholder="Body template" className="field w-full resize-none" />
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

/* ════════════════════ CMS (admin) ════════════════════ */

function CmsTab({ enabled }: { enabled: boolean }) {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [debounced, setDebounced] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [pickTitleId, setPickTitleId] = useState('');
  const [pickLabel, setPickLabel] = useState('');
  const updateTitle = useAdminUpdateTitle();
  const reindex = useAdminReindexTitle();
  const rollback = useAdminRollbackRevision();
  const { data: picks, isLoading: picksLoading } = useAdminPicks(enabled);
  const createPick = useAdminCreatePick();
  const deletePick = useAdminDeletePick();
  const togglePick = useAdminTogglePick();

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const { data: titlesData, isLoading } = useAdminTitles({ search: debounced || undefined, status: status || undefined }, enabled);
  const { data: chapters } = useAdminChapters(expandedId, enabled && !!expandedId);
  const { data: revisions } = useAdminRevisions('title', expandedId, enabled && !!expandedId);

  return (
    <div className="space-y-6">
      <section>
        <h3 className="mb-3 text-xs font-semibold text-white">Titles</h3>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search titles…"
            className="w-full max-w-xs rounded-lg border border-mv-border-light bg-mv-surface px-3 py-2 text-xs text-mv-text placeholder:text-mv-text-dim outline-none focus:border-mv-accent"
          />
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="field w-40">
            <option value="">All statuses</option>
            <option value="ongoing">Ongoing</option>
            <option value="completed">Completed</option>
            <option value="hiatus">Hiatus</option>
            <option value="dropped">Dropped</option>
          </select>
        </div>

        {isLoading ? (
          <Loading />
        ) : (
          <div className="space-y-2">
            {titlesData?.items.map((t) => (
              <div key={t.id} className="rounded-xl border border-mv-border bg-mv-darker">
                <div className="flex items-center gap-3 p-4">
                  {t.coverUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={t.coverUrl} alt="" className="h-12 w-9 shrink-0 rounded-md object-cover" />
                  ) : (
                    <span className="flex h-12 w-9 shrink-0 items-center justify-center rounded-md bg-mv-surface text-mv-text-dim">📖</span>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium text-mv-text">
                      {t.title}
                      <span className="ml-2 rounded bg-mv-surface px-1.5 py-0.5 text-[8px] text-mv-text-muted">{t.type}</span>
                      <span className={`ml-1 rounded px-1.5 py-0.5 text-[8px] font-medium ${t.status === 'ongoing' ? 'bg-green-500/10 text-green-400' : 'bg-mv-surface text-mv-text-dim'}`}>
                        {t.status}
                      </span>
                    </p>
                    <p className="mt-1 text-[9px] text-mv-text-dim">
                      {t.chapters} chapters · {t.saves} saves · {t.reviews} reviews · rating {t.rating?.toFixed(1) ?? '—'}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <button onClick={() => setExpandedId(expandedId === t.id ? null : t.id)} className="rounded-md bg-mv-surface px-2.5 py-1 text-[9px] text-mv-violet transition-colors hover:bg-mv-violet/20">
                      {expandedId === t.id ? 'Close' : 'Manage'}
                    </button>
                    <button onClick={() => reindex.mutate(t.id)} disabled={reindex.isPending} className="rounded-md bg-mv-surface px-2.5 py-1 text-[9px] text-mv-text-secondary transition-colors hover:text-mv-text">
                      Reindex
                    </button>
                  </div>
                </div>

                {expandedId === t.id && (
                  <div className="space-y-4 border-t border-mv-border p-4">
                    {/* Quick edit */}
                    <div className="grid gap-2 lg:grid-cols-2">
                      <label className="text-[9px] uppercase tracking-wider text-mv-text-dim">
                        Status
                        <select
                          defaultValue={t.status}
                          onChange={(e) => updateTitle.mutate({ id: t.id, patch: { status: e.target.value, note: 'Status change from console' } })}
                          className="field mt-1 w-full"
                        >
                          <option value="ongoing">Ongoing</option>
                          <option value="completed">Completed</option>
                          <option value="hiatus">Hiatus</option>
                          <option value="dropped">Dropped</option>
                        </select>
                      </label>
                      <label className="text-[9px] uppercase tracking-wider text-mv-text-dim">
                        Rating (0–10)
                        <input
                          type="number"
                          min={0}
                          max={10}
                          step={0.1}
                          defaultValue={t.rating ?? ''}
                          onBlur={(e) => {
                            const v = parseFloat(e.target.value);
                            if (!Number.isNaN(v)) updateTitle.mutate({ id: t.id, patch: { rating: Math.min(10, Math.max(0, v)), note: 'Rating updated from console' } });
                          }}
                          className="field mt-1 w-full"
                        />
                      </label>
                    </div>

                    {/* Chapters */}
                    <div>
                      <p className="mb-2 text-[9px] font-semibold uppercase tracking-wider text-mv-text-muted">Chapters ({chapters?.length ?? t.chapters})</p>
                      <div className="scrollbar-none flex gap-1.5 overflow-x-auto pb-1">
                        {(chapters ?? []).map((c: { id: string; number: number; title: string | null; pageCount: number | null; coinLocked: boolean }) => (
                          <span key={c.id} className="shrink-0 rounded-lg bg-mv-surface px-2.5 py-1 text-[9px] text-mv-text-secondary">
                            {c.number}
                            {c.coinLocked ? ' 🔒' : ''}
                          </span>
                        ))}
                        {chapters && chapters.length === 0 && <span className="text-[9px] text-mv-text-dim">No chapters</span>}
                      </div>
                    </div>

                    {/* Revisions */}
                    <div>
                      <p className="mb-2 text-[9px] font-semibold uppercase tracking-wider text-mv-text-muted">Version history</p>
                      <div className="space-y-1">
                        {(revisions ?? []).slice(0, 6).map((r) => (
                          <div key={r.id} className="flex items-center gap-2 rounded-lg border border-mv-border/60 bg-mv-surface/40 px-3 py-1.5 text-[10px]">
                            <span className="shrink-0 rounded bg-mv-surface px-1.5 py-0.5 font-medium text-mv-accent">v{r.version}</span>
                            <span className="min-w-0 flex-1 truncate text-mv-text-secondary">{r.note || r.actorName}</span>
                            <span className="shrink-0 text-[9px] text-mv-text-dim">{new Date(r.createdAt).toLocaleDateString()}</span>
                            <button
                              onClick={() => { if (confirm(`Roll back to v${r.version}?`)) rollback.mutate(r.id); }}
                              className="shrink-0 text-[9px] text-mv-violet hover:underline"
                            >
                              Rollback
                            </button>
                          </div>
                        ))}
                        {revisions && revisions.length === 0 && <span className="text-[9px] text-mv-text-dim">No revisions yet</span>}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
            {titlesData && titlesData.items.length === 0 && <Empty text="No titles match" />}
          </div>
        )}
      </section>

      {/* Editorial picks */}
      <section>
        <h3 className="mb-3 text-xs font-semibold text-white">Editorial picks</h3>
        <div className="mb-3 flex flex-wrap items-end gap-2 rounded-xl border border-mv-border bg-mv-darker p-4">
          <div className="min-w-0 flex-1">
            <label className="mb-1 block text-[9px] uppercase tracking-wider text-mv-text-dim">Title id</label>
            <input value={pickTitleId} onChange={(e) => setPickTitleId(e.target.value)} placeholder="UUID of the title to feature" className="field w-full" />
          </div>
          <div className="w-40">
            <label className="mb-1 block text-[9px] uppercase tracking-wider text-mv-text-dim">Label</label>
            <input value={pickLabel} onChange={(e) => setPickLabel(e.target.value)} placeholder="e.g. Staff pick" className="field w-full" />
          </div>
          <button
            onClick={() => {
              if (!pickTitleId) return;
              createPick.mutate({ titleId: pickTitleId, label: pickLabel.trim() || null });
              setPickTitleId(''); setPickLabel('');
            }}
            disabled={createPick.isPending || !pickTitleId}
            className="btn-primary px-4 py-2 text-[10px] disabled:opacity-50"
          >
            Add pick
          </button>
        </div>

        {picksLoading ? (
          <Loading />
        ) : (
          <div className="space-y-2">
            {(picks ?? []).map((p) => (
              <div key={p.id} className="flex items-center gap-3 rounded-xl border border-mv-border bg-mv-darker p-4">
                <span className="w-6 text-center text-xs font-bold text-mv-text-dim">{p.position}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-medium text-mv-text">{p.title.title}</span>
                  <span className="text-[9px] text-mv-text-dim">
                    {p.label ?? 'unlabeled'} · by {p.createdByName} · {new Date(p.createdAt).toLocaleDateString()}
                  </span>
                </span>
                <button onClick={() => togglePick.mutate({ id: p.id, active: !p.active })} className={`rounded-md px-2 py-1 text-[9px] transition-colors ${p.active ? 'bg-green-500/10 text-green-400' : 'bg-mv-surface text-mv-text-dim'}`}>
                  {p.active ? 'Live' : 'Hidden'}
                </button>
                <button onClick={() => deletePick.mutate(p.id)} className="rounded-md bg-mv-surface px-2 py-1 text-[9px] text-red-400/70 hover:bg-red-900/20">
                  Delete
                </button>
              </div>
            ))}
            {picks && picks.length === 0 && <Empty text="No editorial picks yet" />}
          </div>
        )}
      </section>
    </div>
  );
}

/* ════════════════════ Media (admin) ════════════════════ */

function MediaTab({ enabled }: { enabled: boolean }) {
  const [type, setType] = useState('');
  const [url, setUrl] = useState('');
  const [name, setName] = useState('');
  const [folder, setFolder] = useState('');
  const { data: data } = useAdminMedia({ type: type || undefined }, enabled);
  const create = useAdminCreateMedia();
  const del = useAdminDeleteMedia();

  return (
    <div>
      <div className="mb-4 rounded-xl border border-mv-border bg-mv-darker p-4">
        <p className="mb-3 text-[9px] font-semibold uppercase tracking-wider text-mv-text-muted">Register an asset</p>
        <div className="flex flex-wrap items-end gap-2">
          <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…/asset.png" className="field w-full flex-1" />
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" className="field w-40" />
          <select value={type} onChange={(e) => setType(e.target.value)} className="field w-32">
            <option value="">Type…</option>
            <option value="image">image</option>
            <option value="banner">banner</option>
            <option value="cover">cover</option>
            <option value="icon">icon</option>
            <option value="video">video</option>
          </select>
          <input value={folder} onChange={(e) => setFolder(e.target.value)} placeholder="Folder (optional)" className="field w-40" />
          <button
            onClick={() => {
              if (!url) return;
              create.mutate({ url, type: type || 'image', name: name || null, folder: folder || null });
              setUrl(''); setName(''); setFolder('');
            }}
            disabled={create.isPending || !url}
            className="btn-primary px-4 py-2 text-[10px] disabled:opacity-50"
          >
            Add
          </button>
        </div>
      </div>

      {!data ? (
        <Loading />
      ) : (
        <>
          <div className="mb-3 flex flex-wrap gap-1.5">
            <button onClick={() => setType('')} className={`rounded-full px-3 py-1 text-[10px] ${type === '' ? 'bg-mv-accent text-white' : 'bg-mv-surface text-mv-text-secondary'}`}>All ({data.total})</button>
            {Object.entries(data.byType ?? {}).map(([t, count]) => (
              <button key={t} onClick={() => setType(t)} className={`rounded-full px-3 py-1 text-[10px] ${type === t ? 'bg-mv-accent text-white' : 'bg-mv-surface text-mv-text-secondary'}`}>
                {t} ({count})
              </button>
            ))}
          </div>
          {data.items.length === 0 ? (
            <Empty text="No assets yet" />
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {data.items.map((m) => (
                <div key={m.id} className="group relative overflow-hidden rounded-xl border border-mv-border bg-mv-darker transition-colors hover:border-mv-violet/40">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={m.url} alt={m.name ?? 'asset'} className="h-32 w-full object-cover" loading="lazy" />
                  <div className="p-3">
                    <p className="truncate text-[11px] font-medium text-mv-text">{m.name ?? m.type}</p>
                    <p className="mt-0.5 text-[9px] text-mv-text-dim">
                      {m.type}{m.folder ? ` · ${m.folder}` : ''} · {m.usageCount} uses
                    </p>
                  </div>
                  <button
                    onClick={() => del.mutate(m.id)}
                    disabled={del.isPending}
                    className="absolute right-2 top-2 rounded-md bg-black/70 px-2 py-1 text-[9px] text-red-400 opacity-0 transition-opacity hover:bg-black/90 group-hover:opacity-100"
                  >
                    Delete
                  </button>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ════════════════════ Moderation (warn/suspend/ban) ════════════════════ */

function ModerationTab({ enabled }: { enabled: boolean }) {
  const [userId, setUserId] = useState('');
  const [userSearch, setUserSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [severity, setSeverity] = useState('warning');
  const [reason, setReason] = useState('');
  const [hours, setHours] = useState('24');
  const warn = useAdminWarnUser();
  const suspend = useAdminSuspendUser();
  const ban = useAdminBanUser();
  const unban = useAdminUnbanUser();
  const { data: usersData } = useAdminUsers({ search: debounced || undefined }, enabled && debounced.length > 0);
  const { data: warnings } = useAdminWarnings(userId || null, enabled && !!userId);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(userSearch), 300);
    return () => clearTimeout(t);
  }, [userSearch]);

  const applyAction = (action: 'warn' | 'suspend' | 'ban') => {
    if (!userId || !reason.trim()) return;
    if (action === 'warn') warn.mutate({ userId, severity, reason: reason.trim(), durationHours: severity === 'suspend' || severity === 'mute' ? parseInt(hours, 10) : null });
    if (action === 'suspend') suspend.mutate({ userId, hours: parseInt(hours, 10) || 24, reason: reason.trim() });
    if (action === 'ban') ban.mutate({ userId, reason: reason.trim() });
  };

  return (
    <div className="space-y-5">
      <section className="rounded-xl border border-mv-border bg-mv-darker p-5">
        <h3 className="mb-1 text-xs font-semibold text-white">Target user</h3>
        <p className="mb-3 text-[10px] text-mv-text-muted">Find a user by name or email — then apply a warning, suspension, or ban.</p>
        <input
          value={userSearch}
          onChange={(e) => setUserSearch(e.target.value)}
          placeholder="Search users…"
          className="field w-full max-w-md"
        />
        {usersData && usersData.items.length > 0 && (
          <div className="mt-2 space-y-1">
            {usersData.items.map((u) => (
              <button
                key={u.id}
                onClick={() => { setUserId(u.id); setUserSearch(''); }}
                className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left transition-colors ${userId === u.id ? 'bg-mv-violet/15' : 'hover:bg-mv-surface'}`}
              >
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-mv-accent/20 text-[9px] font-semibold text-mv-accent">
                  {u.displayName.charAt(0).toUpperCase()}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[11px] text-mv-text">{u.displayName}</span>
                  <span className="text-[9px] text-mv-text-dim">{u.email}</span>
                </span>
                <span className="text-[9px] text-mv-text-dim">{u.role}</span>
              </button>
            ))}
          </div>
        )}
        {!userId && <p className="mt-2 text-[9px] text-mv-text-dim">Select a user to continue.</p>}
      </section>

      {userId && (
        <>
          <section className="rounded-xl border border-mv-border bg-mv-darker p-5">
            <h3 className="mb-3 text-xs font-semibold text-white">Apply moderation action</h3>
            <div className="flex flex-wrap items-end gap-2">
              <select value={severity} onChange={(e) => setSeverity(e.target.value)} className="field w-36">
                <option value="notice">Notice</option>
                <option value="warning">Warning</option>
                <option value="mute">Mute</option>
                <option value="suspend">Suspend</option>
                <option value="ban">Ban</option>
              </select>
              <input
                type="number"
                value={hours}
                onChange={(e) => setHours(e.target.value)}
                min={1}
                placeholder="Hours"
                className="field w-28"
              />
              <input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Reason (required)"
                className="field min-w-48 flex-1"
              />
              <button onClick={() => applyAction('warn')} disabled={warn.isPending || !reason.trim()} className="btn-primary px-4 py-2 text-[10px] disabled:opacity-50">
                Warn
              </button>
              <button onClick={() => applyAction('suspend')} disabled={suspend.isPending || !reason.trim()} className="rounded-lg border border-mv-orange/40 bg-mv-orange/10 px-4 py-2 text-[10px] font-medium text-mv-orange transition-colors hover:bg-mv-orange/20 disabled:opacity-50">
                Suspend
              </button>
              <button onClick={() => applyAction('ban')} disabled={ban.isPending || !reason.trim()} className="rounded-lg border border-red-900/40 bg-red-900/10 px-4 py-2 text-[10px] font-medium text-red-400 transition-colors hover:bg-red-900/20 disabled:opacity-50">
                Ban
              </button>
              <button onClick={() => { if (confirm('Lift all bans/suspensions for this user?')) unban.mutate(userId); }} disabled={unban.isPending} className="rounded-lg border border-mv-border-light px-4 py-2 text-[10px] text-mv-text-secondary transition-colors hover:text-mv-text disabled:opacity-50">
                Unban / clear
              </button>
            </div>
            {(warn.isError || suspend.isError || ban.isError) && <p className="mt-2 text-[10px] text-red-400">Action failed — check permissions or target.</p>}
          </section>

          <section className="rounded-xl border border-mv-border bg-mv-darker p-5">
            <h3 className="mb-3 text-xs font-semibold text-white">Warning history</h3>
            {!warnings ? (
              <Loading />
            ) : warnings.length === 0 ? (
              <p className="text-[10px] text-mv-text-dim">No warnings on record.</p>
            ) : (
              <div className="space-y-2">
                {warnings.map((w) => (
                  <div key={w.id} className="flex items-start gap-3 rounded-lg border border-mv-border/60 bg-mv-surface/40 p-3">
                    <span className={`mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-[8px] font-semibold ${w.active ? 'bg-red-900/30 text-red-400' : 'bg-mv-surface text-mv-text-dim'}`}>
                      {w.severity}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] text-mv-text-secondary">{w.reason}</p>
                      <p className="mt-0.5 text-[9px] text-mv-text-dim">
                        by {w.actorName} · {new Date(w.createdAt).toLocaleString()}
                        {w.durationHours ? ` · ${w.durationHours}h` : ''}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}

/* ════════════════════ Feature flags (admin) ════════════════════ */

function FlagsTab({ enabled }: { enabled: boolean }) {
  const [key, setKey] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const { data: flags, isLoading } = useAdminFlags(enabled);
  const create = useAdminCreateFlag();
  const update = useAdminUpdateFlag();
  const del = useAdminDeleteFlag();

  return (
    <div>
      <div className="mb-4 rounded-xl border border-mv-border bg-mv-darker p-4">
        <p className="mb-3 text-[9px] font-semibold uppercase tracking-wider text-mv-text-muted">Create flag</p>
        <div className="flex flex-wrap items-end gap-2">
          <input value={key} onChange={(e) => setKey(e.target.value)} placeholder="key (e.g. beta.new_reader)" className="field w-64" />
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Display name" className="field w-48" />
          <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description" className="field min-w-48 flex-1" />
          <button
            onClick={() => {
              if (!key || !name) return;
              create.mutate({ key, name, description: description.trim() || null });
              setKey(''); setName(''); setDescription('');
            }}
            disabled={create.isPending || !key || !name}
            className="btn-primary px-4 py-2 text-[10px] disabled:opacity-50"
          >
            Create
          </button>
        </div>
      </div>

      {isLoading ? (
        <Loading />
      ) : (
        <div className="space-y-2">
          {(flags ?? []).map((f) => (
            <div key={f.id} className="flex items-center gap-3 rounded-xl border border-mv-border bg-mv-darker p-4">
              <label className="relative inline-flex cursor-pointer items-center">
                <input
                  type="checkbox"
                  checked={f.enabled}
                  onChange={(e) => update.mutate({ id: f.id, patch: { enabled: e.target.checked } })}
                  className="peer sr-only"
                />
                <div className="h-5 w-9 rounded-full bg-mv-border-light after:absolute after:left-[2px] after:top-[2px] after:h-4 after:w-4 after:rounded-full after:bg-mv-text-muted after:transition-all peer-checked:bg-mv-accent/60 peer-checked:after:translate-x-full peer-checked:after:bg-mv-accent" />
              </label>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium text-mv-text">
                  {f.name} <span className="text-mv-text-dim">({f.key})</span>
                </p>
                {f.description && <p className="mt-0.5 truncate text-[10px] text-mv-text-muted">{f.description}</p>}
                <p className="mt-0.5 text-[9px] text-mv-text-dim">
                  {f.rolloutPct}% rollout · {f.overrideCount} overrides{f.environments.length ? ` · ${f.environments.join(', ')}` : ''}
                </p>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={f.rolloutPct}
                onChange={(e) => update.mutate({ id: f.id, patch: { rolloutPct: parseInt(e.target.value, 10) } })}
                className="w-28 accent-[#e94560]"
                title="Rollout percentage"
              />
              <button onClick={() => del.mutate(f.id)} className="rounded-md bg-mv-surface px-2 py-1 text-[9px] text-red-400/70 hover:bg-red-900/20">
                Delete
              </button>
            </div>
          ))}
          {flags && flags.length === 0 && <Empty text="No feature flags yet" />}
        </div>
      )}
    </div>
  );
}

/* ════════════════════ Audit log ════════════════════ */

function AuditTab({ enabled }: { enabled: boolean }) {
  const [resource, setResource] = useState('');
  const [action, setAction] = useState('');
  const [page, setPage] = useState(1);
  const { data: meta } = useAdminAuditMeta(enabled);
  const { data: data, isLoading } = useAdminAuditLog({ page, resource: resource || undefined, action: action || undefined }, enabled);
  const exportAudit = useAdminAuditExport();

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <select value={resource} onChange={(e) => { setResource(e.target.value); setPage(1); }} className="field w-44">
          <option value="">All resources</option>
          {(meta?.resources ?? []).map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
        <select value={action} onChange={(e) => { setAction(e.target.value); setPage(1); }} className="field w-56">
          <option value="">All actions</option>
          {(meta?.actions ?? []).map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
        <button
          onClick={() => {
            exportAudit.mutate(undefined, {
              onSuccess: (res) => {
                const blob = new Blob([JSON.stringify(res, null, 2)], { type: 'application/json' });
                const a = document.createElement('a');
                a.href = URL.createObjectURL(blob);
                a.download = 'audit-export.json';
                a.click();
                URL.revokeObjectURL(a.href);
              },
            });
          }}
          disabled={exportAudit.isPending}
          className="ml-auto rounded-lg border border-mv-border-light px-3 py-1.5 text-[10px] text-mv-text-secondary transition-colors hover:text-mv-text disabled:opacity-50"
        >
          {exportAudit.isPending ? 'Exporting…' : '⬇ Export JSON'}
        </button>
      </div>

      {isLoading ? (
        <Loading />
      ) : data && data.items.length === 0 ? (
        <Empty text="No audit events match" />
      ) : (
        <div className="space-y-2">
          {(data?.items ?? []).map((a) => (
            <div key={a.id} className="flex items-start gap-3 rounded-xl border border-mv-border bg-mv-darker p-3.5">
              <span className="mt-0.5 shrink-0 rounded bg-mv-surface px-2 py-0.5 text-[9px] font-medium text-mv-accent">{a.action}</span>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] text-mv-text-secondary">
                  <span className="text-mv-text">{a.actorName}</span> on <span className="text-mv-violet">{a.resource}</span>
                  {a.targetUser ? <> → <span className="text-mv-text">{a.targetUser.displayName}</span></> : null}
                </p>
                {a.details && (
                  <p className="mt-0.5 truncate text-[9px] text-mv-text-dim">{JSON.stringify(a.details).slice(0, 140)}</p>
                )}
                <p className="mt-0.5 text-[9px] text-mv-text-dim">{new Date(a.createdAt).toLocaleString()}{a.ip ? ` · ${a.ip}` : ''}</p>
              </div>
            </div>
          ))}
          {data?.hasMore && (
            <div className="flex justify-center pt-2">
              <button onClick={() => setPage((p) => p + 1)} className="rounded-lg border border-mv-border-light px-4 py-1.5 text-[10px] text-mv-text-secondary transition-colors hover:text-mv-text">
                Load more
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ════════════════════ Support tickets ════════════════════ */

function TicketsTab({ enabled }: { enabled: boolean }) {
  const [status, setStatus] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const { data: data } = useAdminTickets({ status: status || undefined }, enabled);
  const { data: ticketDetail } = useAdminTicket(openId, enabled && !!openId);
  const update = useAdminUpdateTicket();
  const addNote = useAdminTicketNote();

  const detail = ticketDetail as unknown as {
    id: string; subject: string; body: string; status: string; priority: string;
    user: { displayName: string; email: string };
    assignee: { displayName: string } | null;
    internalNotes: { actorName: string; body: string; at: string }[];
  } | undefined;

  return (
    <div>
      <div className="mb-4 flex items-center gap-2">
        <button onClick={() => setStatus('')} className={`rounded-full px-3 py-1 text-[10px] ${status === '' ? 'bg-mv-accent text-white' : 'bg-mv-surface text-mv-text-secondary'}`}>All</button>
        {['open', 'in_progress', 'resolved', 'closed'].map((s) => (
          <button key={s} onClick={() => setStatus(s)} className={`rounded-full px-3 py-1 text-[10px] capitalize ${status === s ? 'bg-mv-accent text-white' : 'bg-mv-surface text-mv-text-secondary'}`}>
            {s.replace('_', ' ')}
          </button>
        ))}
      </div>

      {!data ? (
        <Loading />
      ) : (
        <div className="space-y-2">
          {data.items.map((t) => (
            <div key={t.id} className="rounded-xl border border-mv-border bg-mv-darker">
              <button onClick={() => setOpenId(openId === t.id ? null : t.id)} className="flex w-full items-center gap-3 p-4 text-left">
                <span className={`shrink-0 rounded px-2 py-0.5 text-[8px] font-semibold ${
                  t.priority === 'urgent' ? 'bg-red-900/30 text-red-400' : t.priority === 'high' ? 'bg-mv-orange/20 text-mv-orange' : 'bg-mv-surface text-mv-text-dim'
                }`}>
                  {t.priority}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-medium text-mv-text">{t.subject}</span>
                  <span className="text-[9px] text-mv-text-dim">
                    {t.user.displayName} · {t.status} · {t.noteCount} notes · {new Date(t.createdAt).toLocaleDateString()}
                  </span>
                </span>
                <span className="text-[10px] text-mv-text-dim">{openId === t.id ? '▲' : '▼'}</span>
              </button>

              {openId === t.id && detail && (
                <div className="space-y-3 border-t border-mv-border p-4">
                  <div>
                    <p className="text-[10px] text-mv-text-secondary">{detail.body}</p>
                    <p className="mt-1 text-[9px] text-mv-text-dim">
                      from {detail.user.displayName} ({detail.user.email}){detail.assignee ? ` · assigned to ${detail.assignee.displayName}` : ' · unassigned'}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      value={detail.status}
                      onChange={(e) => update.mutate({ id: detail.id, patch: { status: e.target.value } })}
                      className="field w-40"
                    >
                      <option value="open">Open</option>
                      <option value="in_progress">In progress</option>
                      <option value="resolved">Resolved</option>
                      <option value="closed">Closed</option>
                    </select>
                    <span className="text-[9px] text-mv-text-dim">priority: {detail.priority}</span>
                  </div>
                  <div>
                    <p className="mb-1.5 text-[9px] font-semibold uppercase tracking-wider text-mv-text-muted">Internal notes ({detail.internalNotes.length})</p>
                    <div className="max-h-40 space-y-1 overflow-y-auto">
                      {detail.internalNotes.map((n, i) => (
                        <div key={i} className="rounded-lg border border-mv-border/60 bg-mv-surface/40 px-3 py-2">
                          <p className="text-[10px] text-mv-text-secondary">{n.body}</p>
                          <p className="mt-0.5 text-[8px] text-mv-text-dim">{n.actorName} · {new Date(n.at).toLocaleString()}</p>
                        </div>
                      ))}
                    </div>
                    <div className="mt-2 flex gap-2">
                      <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add an internal note…" className="field flex-1" />
                      <button
                        onClick={() => { if (note.trim()) { addNote.mutate({ id: detail.id, body: note.trim() }); setNote(''); } }}
                        disabled={addNote.isPending || !note.trim()}
                        className="btn-primary px-4 py-2 text-[10px] disabled:opacity-50"
                      >
                        Add
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
          {data.items.length === 0 && <Empty text="No tickets" />}
        </div>
      )}
    </div>
  );
}

/* ════════════════════ System health ════════════════════ */

function HealthTab({ enabled }: { enabled: boolean }) {
  const { data } = useAdminHealth(enabled);

  if (!data) return <Loading />;
  const order = ['database', 'redis', 'meilisearch', 'realtime'];

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-3">
        <StatCard label="Status" value={data.status} accent={data.status === 'healthy' ? 'text-green-400' : 'text-mv-orange'} />
        <StatCard label="Uptime" value={`${Math.floor(data.uptime / 60)}m`} />
        <StatCard label="Memory" value={`${data.memory} MB`} />
        <StatCard label="Environment" value={data.environment} />
        <StatCard label="Response" value={`${data.totalMs}ms`} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {order.map((name) => {
          const c = data.checks[name];
          return (
            <div key={name} className="flex items-center justify-between rounded-xl border border-mv-border bg-mv-darker p-4">
              <div>
                <p className="text-xs font-medium capitalize text-mv-text">{name}</p>
                {c?.detail && <p className="mt-0.5 text-[9px] text-mv-text-dim">{c.detail}</p>}
                {c?.latencyMs !== undefined && <p className="mt-0.5 text-[9px] text-mv-text-dim">{c.latencyMs}ms</p>}
              </div>
              <span className={`flex h-3 w-3 rounded-full ${c?.ok ? 'bg-green-400 shadow-[0_0_8px_rgba(74,222,128,0.8)]' : 'bg-red-400 shadow-[0_0_8px_rgba(248,113,113,0.8)]'}`} />
            </div>
          );
        })}
      </div>
      <p className="mt-3 text-[9px] text-mv-text-dim">Auto-refreshes every 30 seconds.</p>
    </div>
  );
}

/* ════════════════════ Platform analytics ════════════════════ */

function AnalyticsTab({ enabled }: { enabled: boolean }) {
  const { data } = useAdminAnalytics(enabled);
  if (!data) return <Loading />;

  return (
    <div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        <StatCard label="Total users" value={data.users.total} accent="text-mv-accent" />
        <StatCard label="New today" value={data.users.newToday} accent="text-green-400" />
        <StatCard label="New this week" value={data.users.newWeek} />
        <StatCard label="Active users (7d)" value={data.engagement.activeUsers7d} accent="text-mv-violet" />
        <StatCard label="Reads (7d)" value={data.engagement.reads7d} />
        <StatCard label="Saves (7d)" value={data.engagement.bookmarks7d} />
        <StatCard label="Titles" value={data.content.titles} />
        <StatCard label="Chapters" value={data.content.chapters} />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-mv-border bg-mv-darker p-4">
          <p className="mb-3 text-[9px] font-semibold uppercase tracking-wider text-mv-text-muted">Top titles (30d saves)</p>
          <div className="space-y-2">
            {data.topTitles.map((t, i) => (
              <div key={t.id} className="flex items-center gap-2.5">
                <span className="w-4 text-[10px] font-bold text-mv-text-dim">{i + 1}</span>
                <span className="min-w-0 flex-1 truncate text-[11px] text-mv-text-secondary">{t.title}</span>
                <span className="rounded-full bg-mv-violet/15 px-2 py-0.5 text-[9px] font-medium text-mv-violet">{t.saves}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-xl border border-mv-border bg-mv-darker p-4">
          <p className="mb-3 text-[9px] font-semibold uppercase tracking-wider text-mv-text-muted">Top authors by saves</p>
          <div className="space-y-2">
            {data.topAuthors.map((a, i) => (
              <div key={a.author} className="flex items-center gap-2.5">
                <span className="w-4 text-[10px] font-bold text-mv-text-dim">{i + 1}</span>
                <span className="min-w-0 flex-1 truncate text-[11px] text-mv-text-secondary">{a.author}</span>
                <span className="rounded-full bg-mv-surface px-2 py-0.5 text-[9px] text-mv-text-secondary">{a.saves}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ════════════════════ Platform settings (admin) ════════════════════ */

function SettingsTab({ enabled }: { enabled: boolean }) {
  const { data: maint } = useAdminMaintenance(enabled);
  const setMaint = useAdminSetMaintenance();
  const { data: settings } = useAdminSettings(enabled);
  const updateSetting = useAdminUpdateSetting();
  const [maintMessage, setMaintMessage] = useState('');
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');

  return (
    <div className="space-y-5">
      <section className="rounded-xl border border-mv-border bg-mv-darker p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-xs font-semibold text-white">Maintenance mode</h3>
            <p className="mt-0.5 text-[10px] text-mv-text-muted">
              When on, all non-admin API traffic returns 503 (health/auth/admin stay up). Takes effect within ~30s.
            </p>
          </div>
          <label className="relative inline-flex cursor-pointer items-center">
            <input
              type="checkbox"
              checked={maint?.enabled === true}
              onChange={(e) => setMaint.mutate({ enabled: e.target.checked, message: maintMessage || null })}
              className="peer sr-only"
            />
            <div className="h-5 w-9 rounded-full bg-mv-border-light after:absolute after:left-[2px] after:top-[2px] after:h-4 after:w-4 after:rounded-full after:bg-mv-text-muted after:transition-all peer-checked:bg-mv-accent/60 peer-checked:after:translate-x-full peer-checked:after:bg-mv-accent" />
          </label>
        </div>
        <input
          value={maintMessage}
          onChange={(e) => setMaintMessage(e.target.value)}
          placeholder="Maintenance message shown to users (optional)"
          className="field mt-3 w-full"
        />
        {setMaint.isSuccess && <p className="mt-2 text-[10px] text-green-400">✓ Maintenance mode updated</p>}
      </section>

      <section className="rounded-xl border border-mv-border bg-mv-darker p-5">
        <h3 className="mb-1 text-xs font-semibold text-white">Key / value settings</h3>
        <p className="mb-3 text-[10px] text-mv-text-muted">Branding, homepage, SEO and integration configuration.</p>
        <div className="mb-4 flex flex-wrap items-end gap-2">
          <input value={newKey} onChange={(e) => setNewKey(e.target.value)} placeholder="key (e.g. homepage.hero_title)" className="field w-64" />
          <input value={newValue} onChange={(e) => setNewValue(e.target.value)} placeholder="value" className="field min-w-40 flex-1" />
          <button
            onClick={() => {
              if (!newKey) return;
              updateSetting.mutate({ key: newKey, value: newValue });
              setNewKey(''); setNewValue('');
            }}
            disabled={updateSetting.isPending || !newKey}
            className="btn-primary px-4 py-2 text-[10px] disabled:opacity-50"
          >
            Save
          </button>
        </div>
        <div className="space-y-1">
          {(settings ?? []).map((s) => (
            <div key={s.key} className="flex items-center gap-3 rounded-lg border border-mv-border/60 bg-mv-surface/40 px-3 py-2">
              <span className="w-44 shrink-0 truncate text-[10px] font-medium text-mv-text">{s.key}</span>
              <span className="min-w-0 flex-1 truncate text-[10px] text-mv-text-secondary">
                {typeof s.value === 'object' ? JSON.stringify(s.value) : String(s.value)}
              </span>
              <span className="shrink-0 text-[9px] text-mv-text-dim">{new Date(s.updatedAt).toLocaleDateString()}</span>
            </div>
          ))}
          {settings && settings.length === 0 && <p className="text-[10px] text-mv-text-dim">No custom settings yet.</p>}
        </div>
      </section>
    </div>
  );
}
