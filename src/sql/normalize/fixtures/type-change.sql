-- Real output of `prisma migrate diff --script` (Prisma 7.10.1), scenario: type-change.
-- AlterTable
ALTER TABLE "User" ALTER COLUMN "name" SET DATA TYPE VARCHAR(255),
ALTER COLUMN "age" SET DATA TYPE BIGINT,
ALTER COLUMN "price" SET DATA TYPE DECIMAL(10,2),
ALTER COLUMN "born" SET DATA TYPE TIMESTAMPTZ(6);

