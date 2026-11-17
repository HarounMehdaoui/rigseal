-- Real output of `prisma migrate diff --script` (Prisma 7.10.1), scenario: defaults.
-- AlterTable
ALTER TABLE "User" ALTER COLUMN "role" SET DEFAULT 'user',
ALTER COLUMN "plan" DROP DEFAULT;

