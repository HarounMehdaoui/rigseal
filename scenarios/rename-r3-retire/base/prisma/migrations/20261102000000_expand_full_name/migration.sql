-- AlterTable
ALTER TABLE "User" ADD COLUMN     "fullName" TEXT;

-- Backfill (hand-written): copy every existing name into the new column.
UPDATE "User" SET "fullName" = "name";
