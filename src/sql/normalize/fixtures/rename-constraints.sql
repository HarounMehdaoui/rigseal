-- Real output of `prisma migrate diff --script` (Prisma 7.10.1), scenario: rename-constraints.
-- AlterTable
ALTER TABLE "User" RENAME CONSTRAINT "User_pkey" TO "user_pk";

-- RenameForeignKey
ALTER TABLE "Post" RENAME CONSTRAINT "Post_authorId_fkey" TO "post_author_fk";

