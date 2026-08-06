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
} from '@/lib/hooks/useAdmin';

const TABS = ['Overview', 'Users', 'Reports', 'Posts', 'Comments', 'Wiki', 'Clubs', 'Engagement'] as const;
type Tab = (typeof TABS)[number];

const ROLE_BADGE: Record<string, string> = {
  admin: 'bg-mv-accent/20 text-mv-accent border border-mv-accent/30',
  moderator: 'bg-mv-purple/20 text-mv-purple border border-mv-purple/30',
  user: 'bg-mv-surface text-mv-text-dim border border-mv-border',
};

const ROLE_OPTIONS = ['user', 'moderator', 'admin'];

function StatCard({ label, value, accent }: { label: string; value: number | string; accent?: string }) {
  return (
    <div className="rounded-xl border border-mv-border bg-mv-darker p-4">
      <p className="text-[9px] font-semibold uppercase tracking-wider text-mv-text-muted">{label}</p>
      <p className={`mt-1.5 text-2xl font-semibold ${accent || 'text-white'}`}>{value.toLocaleString()}</p>
    </div>
  );
}

export default function AdminPage() {
  const { user } = useAuthStore();
  const [tab, setTab] = useState<Tab>('Overview');
  const [userPage, setUserPage] = useState(1);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  const isMod = user?.role === 'moderator' || user?.role === 'admin';

  // Debounce the user search input (page reset happens in onChange)
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  // Queries are gated on role + active tab so non-mods and inactive tabs
  // don't fire wasted (and for non-mods, 403-spamming) requests.
  const { data: stats } = useAdminStats(isMod);
  const { data: usersData, isLoading: usersLoading } = useAdminUsers(
    {
      page: userPage,
      search: debouncedSearch || undefined,
    },
    isMod && tab === 'Users',
  );
  const setRole = useSetUserRole();
  const { data: postsData } = useAdminPosts(undefined, isMod && tab === 'Posts');
  const deletePost = useAdminDeletePost();
  const { data: commentsData } = useAdminComments(undefined, isMod && tab === 'Comments');
  const deleteComment = useAdminDeleteComment();
  const { data: wikiData } = useAdminWiki(undefined, isMod && tab === 'Wiki');
  const deleteWiki = useAdminDeleteWiki();
  const { data: clubsData } = useAdminClubs(undefined, isMod && tab === 'Clubs');
  const deleteClub = useAdminDeleteClub();
  const [reportStatus, setReportStatus] = useState<string | undefined>('pending');
  const { data: reportsData } = useAdminReports({ status: reportStatus }, isMod && tab === 'Reports');
  const updateReport = useAdminUpdateReport();

  const handleRoleChange = (userId: string, role: string) => {
    setRole.mutate({ userId, role });
  };

  return (
    <ProtectedRoute>
      <AppShell>
        <div className="mx-auto max-w-6xl px-5 py-8 sm:px-6 md:px-8">
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-mv-accent/20 text-mv-accent">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.573-1.066z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            </div>
            <div>
              <h1 className="text-xl font-semibold text-white">Admin Console</h1>
              <p className="text-xs text-mv-text-muted">Moderation & user management</p>
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
              {/* Tabs */}
              <div className="mb-6 flex items-center gap-1 overflow-x-auto rounded-lg border border-mv-border bg-mv-darker p-1">
                {TABS.map((t) => (
                  <button
                    key={t}
                    onClick={() => setTab(t)}
                    className={`rounded-md px-3.5 py-1.5 text-[10px] transition-colors whitespace-nowrap ${
                      tab === t ? 'bg-mv-accent text-white' : 'text-mv-text-secondary hover:text-mv-text'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>

              {/* ─── Overview ─────────────────────── */}
              {tab === 'Overview' && (
                <div>
                  {!stats ? (
                    <div className="flex items-center justify-center py-16">
                      <div className="h-7 w-7 animate-spin rounded-full border-2 border-mv-accent border-t-transparent" />
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                      <StatCard label="Total Users" value={stats.users} accent="text-mv-accent" />
                      <StatCard label="Community Posts" value={stats.posts} />
                      <StatCard label="Comments" value={stats.comments} />
                      <StatCard label="Reading Clubs" value={stats.clubs} />
                      <StatCard label="Wiki Pages" value={stats.wikiPages} />
                      <StatCard label="Predictions" value={stats.predictions} />
                      <StatCard label="Open Markets" value={stats.openPredictions} accent="text-mv-gold" />
                      {stats.pendingReports > 0 && (
                        <StatCard label="Pending Reports" value={stats.pendingReports} accent="text-red-400" />
                      )}
                      <StatCard label="Reviews" value={stats.reviews} />
                      <StatCard label="Chapters" value={stats.chapters} />
                    </div>
                  )}
                </div>
              )}

              {/* ─── Reports (flags) ──────────────── */}
              {tab === 'Reports' && (
                <div>
                  <div className="mb-4 flex items-center gap-2">
                    {['pending', 'resolved', 'dismissed'].map((s) => (
                      <button
                        key={s}
                        onClick={() => setReportStatus(s)}
                        className={`rounded-full px-3 py-1 text-[10px] transition-colors ${
                          reportStatus === s
                            ? 'bg-mv-accent text-white'
                            : 'bg-mv-surface text-mv-text-secondary hover:text-mv-text'
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
                    <div className="flex items-center justify-center py-16">
                      <div className="h-7 w-7 animate-spin rounded-full border-2 border-mv-accent border-t-transparent" />
                    </div>
                  ) : reportsData.items.length === 0 ? (
                    <p className="rounded-xl border border-mv-border bg-mv-darker p-8 text-center text-xs text-mv-text-dim">
                      No {reportStatus} reports
                    </p>
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

                                {/* Target preview */}
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
                                {!r.target && (
                                  <p className="mt-1.5 text-[10px] text-red-400/70">⚠ Target content no longer exists</p>
                                )}

                                {r.details && (
                                  <p className="mt-1 text-[9px] italic text-mv-text-muted">“{r.details}”</p>
                                )}

                                <p className="mt-1.5 text-[9px] text-mv-text-dim">
                                  Reported by {r.reporter.displayName} · {new Date(r.createdAt).toLocaleString()}
                                  {r.resolver && <> · handled by {r.resolver.displayName}</>}
                                </p>
                              </div>

                              {/* Actions */}
                              <div className="flex shrink-0 flex-col items-end gap-1.5">
                                {r.target && r.contentType === 'post' && (
                                  <a
                                    href={`/community/${r.target.id}`}
                                    className="text-[9px] text-mv-accent hover:underline"
                                  >
                                    View post →
                                  </a>
                                )}
                                {r.target && r.contentType === 'wiki' && (
                                  <a
                                    href={`/title/${r.target.titleSlug}`}
                                    className="text-[9px] text-mv-accent hover:underline"
                                  >
                                    View wiki →
                                  </a>
                                )}
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
                                  <span className={`text-[8px] font-medium ${
                                    r.status === 'resolved' ? 'text-green-400' : 'text-mv-text-dim'
                                  }`}>
                                    {r.status === 'resolved' ? '✓ Resolved' : '✕ Dismissed'}
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
              )}

              {/* ─── Users ───────────────────────── */}
              {tab === 'Users' && (
                <div>
                  <div className="mb-4 flex items-center gap-2">
                    <input
                      value={search}
                      onChange={(e) => { setSearch(e.target.value); setUserPage(1); }}
                      placeholder="Search by name or email…"
                      className="w-full max-w-xs rounded-lg border border-mv-border-light bg-mv-surface px-3 py-2 text-xs text-mv-text placeholder:text-mv-text-dim outline-none focus:border-mv-accent"
                    />
                  </div>

                  {usersLoading ? (
                    <div className="flex items-center justify-center py-16">
                      <div className="h-7 w-7 animate-spin rounded-full border-2 border-mv-accent border-t-transparent" />
                    </div>
                  ) : (
                    <div className="overflow-x-auto rounded-xl border border-mv-border bg-mv-darker">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="border-b border-mv-border text-[9px] uppercase tracking-wider text-mv-text-muted">
                            <th className="px-4 py-2.5">User</th>
                            <th className="px-4 py-2.5">Activity</th>
                            <th className="px-4 py-2.5">Joined</th>
                            <th className="px-4 py-2.5">Role</th>
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
                                    <p className="text-mv-text font-medium truncate">{u.displayName}</p>
                                    <p className="text-[9px] text-mv-text-dim truncate">{u.email}</p>
                                  </div>
                                </div>
                              </td>
                              <td className="px-4 py-3 text-[10px] text-mv-text-secondary whitespace-nowrap">
                                {u._count.communityPosts} posts · {u._count.postComments} comments · {u._count.reviews} reviews
                              </td>
                              <td className="px-4 py-3 text-[10px] text-mv-text-dim whitespace-nowrap">
                                {new Date(u.createdAt).toLocaleDateString()}
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-2">
                                  <select
                                    value={u.role}
                                    onChange={(e) => handleRoleChange(u.id, e.target.value)}
                                    disabled={u.id === user?.id || setRole.isPending}
                                    className="rounded-md border border-mv-border-light bg-mv-surface px-2 py-1 text-[10px] text-mv-text outline-none focus:border-mv-accent disabled:opacity-40"
                                  >
                                    {ROLE_OPTIONS.map((r) => (
                                      <option key={r} value={r}>{r}</option>
                                    ))}
                                  </select>
                                  {u.id === user?.id && (
                                    <span className="text-[8px] text-mv-text-dim">(you)</span>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {usersData && usersData.hasMore && (
                    <div className="mt-3 flex justify-center">
                      <button
                        onClick={() => setUserPage((p) => p + 1)}
                        className="rounded-lg border border-mv-border-light px-4 py-1.5 text-[10px] text-mv-text-secondary transition-colors hover:text-mv-text"
                      >
                        Load more
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* ─── Posts moderation ─────────────── */}
              {tab === 'Posts' && (
                !postsData ? (
                  <div className="flex items-center justify-center py-16">
                    <div className="h-7 w-7 animate-spin rounded-full border-2 border-mv-accent border-t-transparent" />
                  </div>
                ) : (
                <div className="space-y-2">
                  {postsData.items.map((p) => (
                    <div key={p.id} className="flex items-start gap-3 rounded-xl border border-mv-border bg-mv-darker p-4">
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium text-mv-text truncate">{p.title}</p>
                        <p className="text-[10px] text-mv-text-muted line-clamp-1 mt-0.5">{p.body}</p>
                        <p className="mt-1.5 text-[9px] text-mv-text-dim">
                          by {p.author.displayName} · {p.upvotes}▲ · {p.comments}💬 · {new Date(p.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      <button
                        onClick={() => deletePost.mutate(p.id)}
                        disabled={deletePost.isPending}
                        className="shrink-0 rounded-lg border border-red-900/30 px-3 py-1.5 text-[9px] font-medium text-red-400 transition-colors hover:bg-red-900/20 disabled:opacity-50"
                      >
                        Delete
                      </button>
                    </div>
                  ))}
                  {postsData.items.length === 0 && <p className="text-center py-10 text-xs text-mv-text-dim">No posts yet</p>}
                </div>
                )
              )}

              {/* ─── Comments moderation ─────────── */}
              {tab === 'Comments' && (
                !commentsData ? (
                  <div className="flex items-center justify-center py-16">
                    <div className="h-7 w-7 animate-spin rounded-full border-2 border-mv-accent border-t-transparent" />
                  </div>
                ) : (
                <div className="space-y-2">
                  {commentsData.items.map((c) => (
                    <div key={c.id} className="flex items-start gap-3 rounded-xl border border-mv-border bg-mv-darker p-4">
                      <div className="min-w-0 flex-1">
                        <p className="text-[10px] text-mv-text-muted line-clamp-2">{c.body}</p>
                        <p className="mt-1.5 text-[9px] text-mv-text-dim">
                          by {c.author.displayName} · on “{c.post.title}” · {new Date(c.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      <button
                        onClick={() => deleteComment.mutate(c.id)}
                        disabled={deleteComment.isPending}
                        className="shrink-0 rounded-lg border border-red-900/30 px-3 py-1.5 text-[9px] font-medium text-red-400 transition-colors hover:bg-red-900/20 disabled:opacity-50"
                      >
                        Delete
                      </button>
                    </div>
                  ))}
                  {commentsData.items.length === 0 && <p className="text-center py-10 text-xs text-mv-text-dim">No comments yet</p>}
                </div>
                )
              )}

              {/* ─── Wiki moderation ─────────────── */}
              {tab === 'Wiki' && (
                !wikiData ? (
                  <div className="flex items-center justify-center py-16">
                    <div className="h-7 w-7 animate-spin rounded-full border-2 border-mv-accent border-t-transparent" />
                  </div>
                ) : (
                <div className="space-y-2">
                  {wikiData.items.map((w) => (
                    <div key={w.id} className="flex items-start gap-3 rounded-xl border border-mv-border bg-mv-darker p-4">
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium text-mv-text truncate">
                          {w.title.title} <span className="text-mv-text-dim">/ {w.slug}</span>
                        </p>
                        <p className="text-[10px] text-mv-text-muted line-clamp-1 mt-0.5">{w.contentPreview}…</p>
                        <p className="mt-1.5 text-[9px] text-mv-text-dim">
                          v{w.version} · by {w.author.displayName} · {new Date(w.updatedAt).toLocaleDateString()}
                        </p>
                      </div>
                      <button
                        onClick={() => deleteWiki.mutate(w.slug)}
                        disabled={deleteWiki.isPending}
                        className="shrink-0 rounded-lg border border-red-900/30 px-3 py-1.5 text-[9px] font-medium text-red-400 transition-colors hover:bg-red-900/20 disabled:opacity-50"
                      >
                        Delete
                      </button>
                    </div>
                  ))}
                  {wikiData.items.length === 0 && <p className="text-center py-10 text-xs text-mv-text-dim">No wiki pages yet</p>}
                </div>
                )
              )}

              {/* ─── Clubs moderation ─────────────── */}
              {tab === 'Clubs' && (
                !clubsData ? (
                  <div className="flex items-center justify-center py-16">
                    <div className="h-7 w-7 animate-spin rounded-full border-2 border-mv-accent border-t-transparent" />
                  </div>
                ) : (
                <div className="space-y-2">
                  {clubsData.items.map((c) => (
                    <div key={c.id} className="flex items-start gap-3 rounded-xl border border-mv-border bg-mv-darker p-4">
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium text-mv-text">{c.name}</p>
                        <p className="mt-1 text-[9px] text-mv-text-dim">
                          {c.memberCount} members · created {new Date(c.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      <button
                        onClick={() => deleteClub.mutate(c.id)}
                        disabled={deleteClub.isPending}
                        className="shrink-0 rounded-lg border border-red-900/30 px-3 py-1.5 text-[9px] font-medium text-red-400 transition-colors hover:bg-red-900/20 disabled:opacity-50"
                      >
                        Delete
                      </button>
                    </div>
                  ))}
                  {clubsData.items.length === 0 && <p className="text-center py-10 text-xs text-mv-text-dim">No clubs yet</p>}
                </div>
                )
              )}

              {/* ─── Engagement (Phase 10) ────────── */}
              {tab === 'Engagement' && <EngagementTab />}
            </>
          )}
        </div>
      </AppShell>
    </ProtectedRoute>
  );
}

/* ═══════════════════════════════════════════════════════════════
   EngagementTab — Phase 10 admin tools: delivery analytics,
   broadcast composer, announcement manager, template editor.
   ═══════════════════════════════════════════════════════════════ */

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

  // Broadcast composer state
  const [bType, setBType] = useState('system');
  const [bTitle, setBTitle] = useState('');
  const [bBody, setBBody] = useState('');
  const [bLink, setBLink] = useState('');
  const [bPriority, setBPriority] = useState('normal');
  const [bAudience, setBAudience] = useState('all');
  const [bSent, setBSent] = useState<number | null>(null);

  // Announcement composer state
  const [aTitle, setATitle] = useState('');
  const [aBody, setABody] = useState('');
  const [aVariant, setAVariant] = useState('info');
  const [aAudience, setAAudience] = useState('all');
  const [aLink, setALink] = useState('');
  const [aCreated, setACreated] = useState(false);

  // Template editor state
  const [editKey, setEditKey] = useState<string | null>(null);
  const [tTitle, setTTitle] = useState('');
  const [tBody, setTBody] = useState('');

  const sendBroadcast = () => {
    if (!bTitle.trim()) return;
    broadcast.mutate(
      {
        type: bType,
        title: bTitle.trim(),
        body: bBody.trim() || undefined,
        link: bLink.trim() || undefined,
        priority: bPriority,
        audience: bAudience,
      },
      {
        onSuccess: (res) => {
          setBSent((res as { sent?: number })?.sent ?? null);
          setBTitle('');
          setBBody('');
          setBLink('');
        },
      },
    );
  };

  const createAnnouncement = () => {
    if (!aTitle.trim()) return;
    createAnn.mutate(
      {
        title: aTitle.trim(),
        body: aBody.trim() || undefined,
        variant: aVariant as never,
        audience: aAudience as never,
        link: aLink.trim() || undefined,
      },
      {
        onSuccess: () => {
          setACreated(true);
          setATitle('');
          setABody('');
          setALink('');
          setTimeout(() => setACreated(false), 2500);
        },
      },
    );
  };

  const openTemplate = (key: string) => {
    const t = tplData?.items.find((x) => x.key === key);
    if (!t) return;
    setEditKey(key);
    setTTitle(t.title);
    setTBody(t.body ?? '');
  };

  const saveTemplate = () => {
    if (!editKey) return;
    const t = tplData?.items.find((x) => x.key === editKey);
    saveTpl.mutate({
      key: editKey,
      name: t?.name ?? editKey,
      type: t?.type ?? 'system',
      title: tTitle,
      body: tBody || undefined,
    });
    setEditKey(null);
  };

  const maxDay = Math.max(1, ...Object.values(stats?.perDay ?? {}));
  const days = Object.entries(stats?.perDay ?? {}).sort(([a], [b]) => (a < b ? -1 : 1));

  return (
    <div className="space-y-6">
      {/* ── Delivery analytics ────────────────────── */}
      <section>
        <h3 className="mb-3 text-xs font-semibold text-white">Delivery analytics</h3>
        {!stats ? (
          <div className="flex items-center justify-center py-10">
            <div className="h-7 w-7 animate-spin rounded-full border-2 border-mv-accent border-t-transparent" />
          </div>
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
              {/* Per-day bar chart */}
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
              {/* By category + priority */}
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

      {/* ── Broadcast composer ────────────────────── */}
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

      {/* ── Announcement manager ──────────────────── */}
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

        {/* Existing announcements */}
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
                <button
                  onClick={() => notifyAnn.mutate(a.id)}
                  disabled={notifyAnn.isPending}
                  className="rounded-md bg-mv-surface px-2 py-1 text-[9px] text-mv-violet transition-colors hover:bg-mv-violet/20"
                >
                  Notify
                </button>
                <button
                  onClick={() => toggleAnn.mutate({ id: a.id, active: !a.active })}
                  className={`rounded-md px-2 py-1 text-[9px] transition-colors ${a.active ? 'bg-green-500/10 text-green-400 hover:bg-green-500/20' : 'bg-mv-surface text-mv-text-dim hover:text-mv-text'}`}
                >
                  {a.active ? 'Live' : 'Paused'}
                </button>
                <button
                  onClick={() => deleteAnn.mutate(a.id)}
                  disabled={deleteAnn.isPending}
                  className="rounded-md bg-mv-surface px-2 py-1 text-[9px] text-red-400/70 transition-colors hover:bg-red-900/20"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
          {annData && annData.items.length === 0 && (
            <p className="rounded-xl border border-mv-border bg-mv-darker p-6 text-center text-[10px] text-mv-text-dim">No announcements yet</p>
          )}
        </div>
      </section>

      {/* ── Template editor ───────────────────────── */}
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
                    <button onClick={saveTemplate} disabled={saveTpl.isPending} className="rounded-md bg-mv-accent/20 px-2 py-1 text-[9px] text-mv-accent">
                      Save
                    </button>
                    <button onClick={() => setEditKey(null)} className="rounded-md bg-mv-surface px-2 py-1 text-[9px] text-mv-text-dim">Cancel</button>
                  </div>
                ) : (
                  <button onClick={() => openTemplate(t.key)} className="rounded-md bg-mv-surface px-2 py-1 text-[9px] text-mv-text-secondary transition-colors hover:text-mv-text">
                    Edit
                  </button>
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
