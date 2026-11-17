-- Real output of `prisma migrate diff --script` (Prisma 7.10.1), scenario: drop-enum.
-- AlterTable
ALTER TABLE "User" DROP COLUMN "role";

-- DropEnum
DROP TYPE "Role";

