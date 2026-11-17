-- Real output of `prisma migrate diff --script` (Prisma 7.10.1), scenario: add-foreign-key.
-- AddForeignKey
ALTER TABLE "Post" ADD CONSTRAINT "Post_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

