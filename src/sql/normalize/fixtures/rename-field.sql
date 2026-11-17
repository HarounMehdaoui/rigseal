-- Real output of `prisma migrate diff --script` (Prisma 7.10.1), scenario: rename-field.
-- AlterTable
ALTER TABLE "User" DROP COLUMN "name",
ADD COLUMN     "fullName" TEXT NOT NULL;

