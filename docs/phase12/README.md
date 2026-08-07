# Phase 12 — Production Excellence & Launch Readiness

Audit of the MangaVerse platform conducted against the Phase 12 charter
(no new end-user features; harden, optimize, validate, document, and
prepare for production launch).

## Deliverables map

| # | Deliverable | Where |
|---|-------------|-------|
| 1 | Production Readiness Report | `README.md` (this file, §Findings) |
| 2 | Technical Debt Report | `README.md` §Findings (Technical debt) |
| 3 | Security Audit | `README.md` §Findings (Security) |
| 4 | Performance Audit | `README.md` §Findings (Performance) |
| 5 | Accessibility Audit | `README.md` §Findings (Accessibility) |
| 6 | SEO Audit | `README.md` §Findings (SEO) |
| 7 | Architecture Review | `README.md` §Architecture |
| 8 | Testing Strategy | `testing-strategy.md` |
| 9 | DevOps Review | `README.md` §Findings (DevOps) |
| 10 | Documentation Suite | repo root (`README.md`, `DEPLOYMENT.md`, `DESIGN_SYSTEM.md`, …) |
| 11 | Launch Checklist | `launch-checklist.md` |
| 12 | Future Roadmap | `roadmap.md` |
| 13 | Refactoring Plan | `README.md` §Refactoring plan |
| 14 | Risk Assessment | `README.md` §Top risks |
| 15 | Production-ready implementation | see §Implemented in this phase |

## Architecture

Monorepo (pnpm workspaces + Turborepo), three apps, one shared package:

- **`apps/api`** — Express 5, Prisma (Supabase Postgres), ioredis (Upstash),
  BullMQ workers (scraper/predictions/engagement), GoTrue JWT verification
  (jose/JWKS), WebSocket realtime hub, Meilisearch (optional, DB fallback),
  web-push. Dockerized, deployed on Render free tier.
- **`apps/web`** — Next.js 15 App Router, standalone output, Tailwind v4,
  Zustand + TanStack Query, GoTrue REST client (no Supabase JS SDK),
  custom service worker (push + offline reading). Deployed on Render.
- **`apps/mobile`** — Expo/React Native, same API surface.
- **`packages/shared`** — shared types/utils.

**Strengths observed**: coherent API error envelope; zod validation on most
routes; helmet + CORS with explicit origin; unified rate limiter; RBAC with
granular permissions + audit logging; maintenance-mode gate; health endpoint
exposing auth + database status; boot-time schema sync (`prisma db push`);
documented deployment footguns (session-pooler IPv6, `NEXT_PUBLIC_*` bake
times).

## Findings (prioritized)

Priority legend: **P0** launch blocker / high impact · **P1** should fix
before scale · **P2** nice-to-have.

### P0 — fixed in this phase

| Finding | Impact | Fix |
|---------|--------|-----|
| No CI pipeline (no `.github/workflows`) | Every merge unverified | Added GitHub Actions: install → `prisma validate` → typecheck → unit tests |
| Zero automated tests | Regressions invisible | Added vitest (API: RBAC, errors; web: GoTrue error mapping) + testing strategy |
| Admin role string mismatch: console + `/api/admin` gates accept only `admin`/`moderator`; RBAC matrix roles (`platform_admin`, `super_admin`) lock users out | Admin misconfiguration locks you out of the console | `requireRole` and the console now accept the admin-equivalent roles |
| Missing web security headers | Clickjacking/MIME-sniffing/referrer leakage | `next.config.ts` headers: `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, `Permissions-Policy` |
| No sitemap/robots | Weak SEO discovery | `sitemap.ts` (static + popular titles, hourly revalidate), `robots.ts` |
| No PWA manifest | Not installable despite working service worker | `manifest.webmanifest` + theme-color/apple meta |
| Missing env vars fail silently (the production DB outage we shipped) | Opaque 500s | Boot-time env warnings in `config/index.ts` (production only) |

### P1 — next (documented, not yet implemented)

- **Observability**: replace ad-hoc `console.*` with a tiny structured logger
  (JSON lines + request id + duration); expose `/api/health` metrics for
  queue depth, DB latency.
- **CSP**: a strict Content-Security-Policy needs a nonce strategy for Next
  inline scripts — do this deliberately (breaks rendering if wrong).
- **API**: add request-id correlation middleware; document all endpoints
  (OpenAPI); consistent pagination metadata across routes; API versioning.
- **Database**: review indexes on hot query paths (`title.slug`, `chapter.titleId`, `readingProgress`); migrate from boot-time `prisma db push` to `prisma migrate deploy` once the baseline is re-baselined; automated backup/restore runbook (Supabase PITR).
- **Tests**: expand to route-level integration tests (supertest) and a Playwright smoke suite against the deployed app.
- **Error tracking**: wire an error tracker (e.g. Sentry) — free tier, one env key.
- **Reader pages**: server-component metadata wrappers for title/chapter SEO (JSON-LD).
- **PWA icons**: generate 192/512 PNG icons (from `icon.svg`) so the install
  prompt and iOS home-screen icon work (SVG-only is spotty on iOS).

### P2 — backlog

- Split the ~2,000-line `apps/web/src/app/admin/page.tsx` into per-tab
  components (the file exceeded the tooling read limit).
- Remove `as any` casts (~58, concentrated in mobile + Prisma where-clauses)
  by typing the dynamic query builders.
- `next lint` is deprecated (Next 15) — adopt flat ESLint config (`eslint.config.mjs`) for the web app.
- Full WCAG AA audit pass with axe; automated a11y checks in CI.
- Lighthouse budget + CI performance regression guard.
- i18n architecture (next-intl), RTL, currency/timezone readiness.
- Privacy-first analytics + consent management.

## Top risks

1. **Render free tier** — cold starts (~1 min), 750 h/month cap, no IPv6
   egress (DB must stay on the session pooler), no zero-downtime deploys.
   Mitigation: documented; monitor instance-hours.
2. **Boot-time `prisma db push`** — converges schema but writes no migration
   history; a future `migrate deploy` needs a re-baselined DB. Mitigation:
   re-baseline before switching.
3. **No backups tested** — Supabase provides PITR/backups; runbook exists in
   DEPLOYMENT.md but a restore drill is unexercised.
4. **Auth trust model** — access tokens stored in localStorage (XSS-exposed).
   Acceptable for v1; revisit httpOnly-cookie sessions when a real backend
   session store exists.
5. **Scraper dependency on MangaDex** — upstream rate limits/availability
   gate the content pipeline; queues degrade gracefully.

## Refactoring plan (sequenced)

1. Extract shared API client + types for web/mobile (dedupe `supabaseClient`).
2. Typed query builders to kill `as any` in route `where`/`orderBy`.
3. Split admin console into feature modules.
4. Structured logger + request-id middleware.
5. Flat ESLint config + pre-commit hooks (husky/lint-staged).

## Implemented in this phase

- `.github/workflows/ci.yml`
- Unit tests: `apps/api/src/services/rbac.test.ts`, `apps/api/src/lib/errors.test.ts`, `apps/web/src/lib/supabaseClient.test.ts` (+ `vitest` dev dep)
- Security headers in `apps/web/next.config.ts`
- `apps/web/src/app/sitemap.ts`, `apps/web/src/app/robots.ts`
- `apps/web/public/manifest.webmanifest` + layout metadata
- Admin-role equivalence fix (`middleware/auth.ts`, admin console)
- Boot-time env warnings (`apps/api/src/config/index.ts`)
- Health endpoint DB probe (earlier in this session)
