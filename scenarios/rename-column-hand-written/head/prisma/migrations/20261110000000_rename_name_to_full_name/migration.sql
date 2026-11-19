-- Hand-written: Prisma would DROP and ADD the column instead (RULES §6 row 1).
ALTER TABLE "User" RENAME COLUMN "name" TO "fullName";
