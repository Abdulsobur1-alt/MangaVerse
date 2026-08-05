-- Phase 7 — Library, Collections & Personalization
-- Adds: custom collections (+ items), reading goals, and per-user
-- personalization prefs (JSONB). Apply with `npx prisma migrate deploy`
-- once Postgres is running (`docker compose up -d postgres`).

-- ─── Custom Collections ─────────────────────────────────

-- CreateTable
CREATE TABLE "collections" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "cover_url" TEXT,
    "tags" TEXT[],
    "is_private" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "collections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "collection_items" (
    "id" UUID NOT NULL,
    "collection_id" UUID NOT NULL,
    "title_id" UUID NOT NULL,
    "note" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "collection_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "collections_user_id_created_at_idx" ON "collections"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "collection_items_title_id_idx" ON "collection_items"("title_id");

-- CreateIndex
CREATE UNIQUE INDEX "collection_items_collection_id_title_id_key" ON "collection_items"("collection_id", "title_id");

-- AddForeignKey
ALTER TABLE "collections" ADD CONSTRAINT "collections_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collection_items" ADD CONSTRAINT "collection_items_collection_id_fkey" FOREIGN KEY ("collection_id") REFERENCES "collections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collection_items" ADD CONSTRAINT "collection_items_title_id_fkey" FOREIGN KEY ("title_id") REFERENCES "titles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ─── Reading Goals ─────────────────────────────────────

-- CreateTable
CREATE TABLE "reading_goals" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "target" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "ends_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reading_goals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "reading_goals_user_id_active_idx" ON "reading_goals"("user_id", "active");

-- AddForeignKey
ALTER TABLE "reading_goals" ADD CONSTRAINT "reading_goals_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ─── Personalization Prefs (User) ──────────────────────

-- AlterTable
ALTER TABLE "users" ADD COLUMN "prefs" JSONB DEFAULT '{}';
