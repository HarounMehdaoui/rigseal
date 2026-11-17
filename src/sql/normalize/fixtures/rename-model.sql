-- Real output of `prisma migrate diff --script` (Prisma 7.10.1), scenario: rename-model.
-- DropTable
DROP TABLE "User";

-- CreateTable
CREATE TABLE "Person" (
    "id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Person_pkey" PRIMARY KEY ("id")
);

