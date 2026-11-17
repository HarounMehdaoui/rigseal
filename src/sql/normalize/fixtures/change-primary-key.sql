-- Real output of `prisma migrate diff --script` (Prisma 7.10.1), scenario: change-primary-key.
-- AlterTable
ALTER TABLE "Member" DROP CONSTRAINT "Member_pkey",
ADD CONSTRAINT "Member_pkey" PRIMARY KEY ("orgId", "userId");

