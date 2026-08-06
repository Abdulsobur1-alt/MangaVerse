#!/bin/sh
# ─── MangaVerse API — container entrypoint ────────────────────────────
#
# 1) Sync the database schema to schema.prisma (`prisma db push`).
#    • The URL used here has the `pgbouncer` query parameter removed
#      (wherever it appears): Prisma refuses pooler-marked URLs for schema
#      commands, but Supabase's *session* pooler (aws-0-<region>.
#      pooler.supabase.com:5432) runs them fine in session mode — and it's
#      IPv4-reachable from Render, unlike the direct host
#      (db.<ref>.supabase.co), which resolves to IPv6-only.
#    • `db push` (not `migrate deploy`) because the checked-in migration is
#      stale vs. schema.prisma (missing tables/columns); db push converges
#      the DB to the current schema on every boot. `--skip-generate` keeps
#      boot read-only — the Prisma Client is already baked into the image.
# 2) A failed schema sync is NOT fatal: the API still boots so Render's
#    health check passes and the real database error is visible in the
#    logs — instead of a silent "no-server" deploy failure.
# 3) Start the API + workers.
set -u

# Remove the `pgbouncer` query param via node (guaranteed in the image) so
# Prisma runs schema commands in direct/session mode. Position-independent:
# works whether pgbouncer=true is the first, last, or only query parameter.
MIGRATE_URL="$(DATABASE_URL="${DATABASE_URL:-}" node -e '
  const u = process.env.DATABASE_URL || "";
  if (!u) process.exit(0);
  const q = u.indexOf("?");
  if (q === -1) { console.log(u); process.exit(0); }
  const params = u.slice(q + 1).split("&").filter((p) => p && p !== "pgbouncer" && !p.startsWith("pgbouncer="));
  console.log(params.length ? `${u.slice(0, q)}?${params.join("&")}` : u.slice(0, q));
')"

if [ -z "$MIGRATE_URL" ]; then
  echo '⚠️  DATABASE_URL is not set — skipping database sync. The API will boot, but data routes will fail.'
else
  echo '📦 Syncing database schema (prisma db push)…'
  # timeout guards against a half-open TCP connection stalling boot for
  # minutes when the host resolves but drops packets.
  if ! DATABASE_URL="$MIGRATE_URL" timeout 120 npx prisma db push --skip-generate; then
    echo '⚠️  Database sync failed — continuing anyway. Ensure DATABASE_URL is the Supabase Session pooler URI (aws-0-<region>.pooler.supabase.com:5432), then redeploy.'
  fi
fi

exec node dist/index.js
