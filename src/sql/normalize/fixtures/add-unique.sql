-- Real output of `prisma migrate diff --script` (Prisma 7.10.1), scenario: add-unique.
-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

