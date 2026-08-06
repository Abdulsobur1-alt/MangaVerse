-- Phase 8 continuation — User Lists
-- Adds: shareable public lists (curated reading lists), their items, and
-- per-user likes. Apply with `npx prisma migrate deploy`.

-- ─── User Lists ───────────────────────────────────────

-- CreateTable
CREATE TABLE "user_lists" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "tags" TEXT[],
    "cover_url" TEXT,
    "is_public" BOOLEAN NOT NULL DEFAULT true,
    "like_count" INTEGER NOT NULL DEFAULT 0,
    "view_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_lists_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "user_lists_user_id_created_at_idx" ON "user_lists"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "user_lists_is_public_like_count_idx" ON "user_lists"("is_public", "like_count");

-- AddForeignKey
ALTER TABLE "user_lists" ADD CONSTRAINT "user_lists_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ─── User List Items ──────────────────────────────────

-- CreateTable
CREATE TABLE "user_list_items" (
    "id" UUID NOT NULL,
    "list_id" UUID NOT NULL,
    "title_id" UUID NOT NULL,
    "note" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_list_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_list_items_list_id_title_id_key" ON "user_list_items"("list_id", "title_id");

-- CreateIndex
CREATE INDEX "user_list_items_title_id_idx" ON "user_list_items"("title_id");

-- AddForeignKey
ALTER TABLE "user_list_items" ADD CONSTRAINT "user_list_items_list_id_fkey" FOREIGN KEY ("list_id") REFERENCES "user_lists"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_list_items" ADD CONSTRAINT "user_list_items_title_id_fkey" FOREIGN KEY ("title_id") REFERENCES "titles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ─── User List Likes ──────────────────────────────────

-- CreateTable
CREATE TABLE "user_list_likes" (
    "id" UUID NOT NULL,
    "list_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_list_likes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_list_likes_list_id_user_id_key" ON "user_list_likes"("list_id", "user_id");

-- AddForeignKey
ALTER TABLE "user_list_likes" ADD CONSTRAINT "user_list_likes_list_id_fkey" FOREIGN KEY ("list_id") REFERENCES "user_lists"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_list_likes" ADD CONSTRAINT "user_list_likes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
