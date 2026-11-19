-- Hand-written: Prisma would DROP and ADD the column instead.
ALTER TABLE "User" ALTER COLUMN "note" TYPE INTEGER USING "note"::integer;
