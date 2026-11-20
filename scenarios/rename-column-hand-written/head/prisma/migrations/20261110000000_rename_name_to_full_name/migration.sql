-- Hand-written: Prisma would DROP and ADD the column instead.
ALTER TABLE "User" RENAME COLUMN "name" TO "fullName";
