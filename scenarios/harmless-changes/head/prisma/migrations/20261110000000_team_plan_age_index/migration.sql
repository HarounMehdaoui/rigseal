-- CreateEnum
CREATE TYPE "Plan" AS ENUM ('FREE', 'PRO');

-- CreateTable
CREATE TABLE "Team" (
    "id" SERIAL NOT NULL,
    "plan" "Plan" NOT NULL DEFAULT 'FREE',

    CONSTRAINT "Team_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "User_age_idx" ON "User"("age");

