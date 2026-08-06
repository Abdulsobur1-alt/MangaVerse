-- Phase 7 completion — Rich page bookmarks
-- Adds: page-level, server-synced bookmarks (quote / scene / note / panel
-- marks attached to a chapter + page, with a folder and tags).
-- Apply with `npx prisma migrate deploy` alongside the Phase 7 migration.

-- ─── Page Bookmarks ────────────────────────────────────

-- CreateTable
CREATE TABLE "page_bookmarks" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "title_id" UUID NOT NULL,
    "chapter_id" UUID NOT NULL,
    "page_number" INTEGER NOT NULL,
    "quote" TEXT,
    "note" TEXT,
    "folder" TEXT,
    "tags" TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "page_bookmarks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "page_bookmarks_user_id_created_at_idx" ON "page_bookmarks"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "page_bookmarks_user_id_folder_idx" ON "page_bookmarks"("user_id", "folder");

-- AddForeignKey
ALTER TABLE "page_bookmarks" ADD CONSTRAINT "page_bookmarks_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "page_bookmarks" ADD CONSTRAINT "page_bookmarks_title_id_fkey" FOREIGN KEY ("title_id") REFERENCES "titles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "page_bookmarks" ADD CONSTRAINT "page_bookmarks_chapter_id_fkey" FOREIGN KEY ("chapter_id") REFERENCES "chapters"("id") ON DELETE CASCADE ON UPDATE CASCADE;
