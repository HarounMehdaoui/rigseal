-- Hand-written: Prisma never emits this.
ALTER TABLE "User" ADD CONSTRAINT "User_age_check" CHECK ("age" >= 0);
