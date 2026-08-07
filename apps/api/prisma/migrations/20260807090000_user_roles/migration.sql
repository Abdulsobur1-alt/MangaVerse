-- Multi-role support: `roles` holds every role a user holds. `role`
-- remains the primary role (roles[0]) for legacy checks; new rows are
-- created with their role in `roles` by the auth flows, and existing
-- rows are backfilled below so nothing changes until an admin assigns
-- additional roles.

ALTER TABLE "users" ADD COLUMN "roles" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- Backfill: every existing account inherits its current role.
UPDATE "users" SET "roles" = ARRAY["role"] WHERE "roles" = '{}';
