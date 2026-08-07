-- Studio — staff content workspace
-- Adds: direct page image URLs on chapters so staff-uploaded content can
-- render in the reader without a MangaDex source link.
-- Apply with `npx prisma migrate deploy`.

-- AlterTable
ALTER TABLE "chapters"
    ADD COLUMN "page_urls" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
