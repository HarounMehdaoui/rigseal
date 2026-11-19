-- AlterTable
ALTER TABLE "User" ALTER COLUMN "name" DROP NOT NULL;

-- Catch-up (hand-written): rows base R1 wrote during the rollout have no fullName yet.
UPDATE "User" SET "fullName" = "name" WHERE "fullName" IS NULL;
