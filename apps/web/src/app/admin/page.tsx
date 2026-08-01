'use client';

import { useState, useEffect } from 'react';
import { TopBar } from '@/components/TopBar';
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
} from '@/lib/hooks/useAdmin';

const TABS = ['Overview', 'Users', 'Posts', 'Comments', 'Wiki', 'Clubs'] as const;
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

  const handleRoleChange = (userId: string, role: string) => {
    setRole.mutate({ userId, role });
  };

  return (
    <ProtectedRoute>
      <main className="min-h-screen bg-mv-dark">
        <TopBar />

        <div className="mx-auto max-w-6xl p-6">
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
                      <StatCard label="Reviews" value={stats.reviews} />
                      <StatCard label="Chapters" value={stats.chapters} />
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
                <div className="space-y-2">
                  {postsData?.items.map((p) => (
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
                  {postsData?.items.length === 0 && <p className="text-center py-10 text-xs text-mv-text-dim">No posts yet</p>}
                </div>
              )}

              {/* ─── Comments moderation ─────────── */}
              {tab === 'Comments' && (
                <div className="space-y-2">
                  {commentsData?.items.map((c) => (
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
                  {commentsData?.items.length === 0 && <p className="text-center py-10 text-xs text-mv-text-dim">No comments yet</p>}
                </div>
              )}

              {/* ─── Wiki moderation ─────────────── */}
              {tab === 'Wiki' && (
                <div className="space-y-2">
                  {wikiData?.items.map((w) => (
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
                  {wikiData?.items.length === 0 && <p className="text-center py-10 text-xs text-mv-text-dim">No wiki pages yet</p>}
                </div>
              )}

              {/* ─── Clubs moderation ─────────────── */}
              {tab === 'Clubs' && (
                <div className="space-y-2">
                  {clubsData?.items.map((c) => (
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
                  {clubsData?.items.length === 0 && <p className="text-center py-10 text-xs text-mv-text-dim">No clubs yet</p>}
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </ProtectedRoute>
  );
}
