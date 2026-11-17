-- Real output of `prisma migrate diff --script` (Prisma 7.10.1), scenario: rename-enum.
-- CreateEnum
CREATE TYPE "user_role" AS ENUM ('ADMIN');

-- AlterTable
ALTER TABLE "User" DROP COLUMN "role",
ADD COLUMN     "role" "user_role" NOT NULL;

-- DropEnum
DROP TYPE "Role";

