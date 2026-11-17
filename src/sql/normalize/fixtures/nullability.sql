-- Real output of `prisma migrate diff --script` (Prisma 7.10.1), scenario: nullability.
-- AlterTable
ALTER TABLE "User" ALTER COLUMN "name" SET NOT NULL,
ALTER COLUMN "email" DROP NOT NULL;

