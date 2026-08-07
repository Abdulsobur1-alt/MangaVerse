# Testing Strategy — MangaVerse

Target: **meaningful coverage of risk, not 100% line coverage.** Prioritize
the money paths: auth, RBAC, reading flow, payments-adjacent coin logic,
admin moderation, and the deploy pipeline itself.

## Test pyramid

```
        ▲  E2E (Playwright)         — smoke the deployed app
       ▲   Integration (supertest)  — API routes against a test DB
      ▲    Unit (vitest)            — pure logic, fast, in CI
```

## Current state (Phase 12 baseline)

| Layer | Status |
|-------|--------|
| Unit | ✅ vitest added; RBAC, errors, GoTrue error mapping covered |
| Integration | ❌ planned — supertest against a scratch Postgres |
| E2E | ❌ planned — Playwright smoke on the Render deployment |
| A11y/Perf/Security | ❌ axe-core in E2E; Lighthouse budget; `pnpm audit` in CI |

## Unit (vitest) — implemented

- `apps/api/src/services/rbac.test.ts` — role mapping, overrides, wildcards.
- `apps/api/src/lib/errors.test.ts` — status codes / shapes.
- `apps/web/src/lib/supabaseClient.test.ts` — GoTrue error-code → friendly
  message mapping (fetch stubbed).

## Integration (next)

- Boot the Express app against a scratch Postgres (`DATABASE_URL` override).
- Cover: `/auth/login` (valid/invalid/expired token), `/titles` pagination,
  `/admin/*` role gates (user vs moderator vs admin), moderation actions,
  coin spend/lock on chapters.
- Assert the error envelope (`{success, error:{code,message}}`), status codes,
  pagination metadata.

## E2E (next)

Playwright smoke against the deployed web app:
1. Anonymous browse → title → chapter page.
2. Sign up (disposable email) → login → library add.
3. Admin: login, open console, view users.
4. A11y: run `@axe-core/playwright` on the 5 most-trafficked routes.

## CI integration

`ci.yml` runs unit tests on every push/PR. Integration + E2E run nightly or
on demand (they need a DB / deployed app).

## Coverage policy

- New **pure logic** must ship with unit tests.
- New **route handlers** must ship with an integration test for the
  happy + error paths.
- No blanket thresholds; review coverage on the paths above each quarter.
