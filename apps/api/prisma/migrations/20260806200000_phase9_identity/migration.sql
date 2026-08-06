-- Phase 9 — Profile, Identity & Gamification
-- Adds: rich identity fields on users (bio, banner, links, customization),
-- the reading-journey milestone timeline, and annual Wrapped reports.
-- Apply with `npx prisma migrate deploy`.

-- ─── Users — identity + customization ────────────────

-- AlterTable
ALTER TABLE "users" ADD COLUMN "bio" TEXT;
ALTER TABLE "users" ADD COLUMN "location" TEXT;
ALTER TABLE "users" ADD COLUMN "website" TEXT;
ALTER TABLE "users" ADD COLUMN "social_links" JSONB NOT NULL DEFAULT '{}';
ALTER TABLE "users" ADD COLUMN "banner_url" TEXT;
ALTER TABLE "users" ADD COLUMN "accent_color" TEXT;
ALTER TABLE "users" ADD COLUMN "profile_theme" TEXT NOT NULL DEFAULT 'aurora';
ALTER TABLE "users" ADD COLUMN "layout_style" TEXT NOT NULL DEFAULT 'editorial';
ALTER TABLE "users" ADD COLUMN "card_style" TEXT NOT NULL DEFAULT 'rounded';
ALTER TABLE "users" ADD COLUMN "reputation" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "users" ADD COLUMN "total_reading_minutes" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "users" ADD COLUMN "last_active_at" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN "pinned_items" JSONB NOT NULL DEFAULT '{}';
ALTER TABLE "users" ADD COLUMN "pinned_manga" TEXT[];

-- ─── Profile Milestones (reading journey) ────────────

-- CreateTable
CREATE TABLE "profile_milestones" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "detail" TEXT,
    "emoji" TEXT NOT NULL DEFAULT '✨',
    "data" JSONB,
    "achieved_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "profile_milestones_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "profile_milestones_user_id_type_key" ON "profile_milestones"("user_id", "type");

-- CreateIndex
CREATE INDEX "profile_milestones_user_id_achieved_at_idx" ON "profile_milestones"("user_id", "achieved_at");

-- AddForeignKey
ALTER TABLE "profile_milestones" ADD CONSTRAINT "profile_milestones_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ─── Wrapped Reports ─────────────────────────────────

-- CreateTable
CREATE TABLE "wrapped_reports" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "year" INTEGER NOT NULL,
    "data" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wrapped_reports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "wrapped_reports_user_id_year_key" ON "wrapped_reports"("user_id", "year");

-- CreateIndex
CREATE INDEX "wrapped_reports_year_idx" ON "wrapped_reports"("year");

-- AddForeignKey
ALTER TABLE "wrapped_reports" ADD CONSTRAINT "wrapped_reports_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
