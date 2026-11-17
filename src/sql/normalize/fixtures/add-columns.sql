-- Real output of `prisma migrate diff --script` (Prisma 7.10.1), scenario: add-columns.
-- AlterTable
ALTER TABLE "User" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "nickname" TEXT,
ADD COLUMN     "phone" TEXT NOT NULL,
ADD COLUMN     "role" TEXT NOT NULL DEFAULT 'user',
ADD COLUMN     "seq" SERIAL NOT NULL,
ADD COLUMN     "slug" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
ADD COLUMN     "tags" TEXT[];

