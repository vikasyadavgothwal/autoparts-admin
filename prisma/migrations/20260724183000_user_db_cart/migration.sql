CREATE TABLE "user_carts" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "items" JSONB NOT NULL DEFAULT '[]',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "user_carts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "user_carts_userId_key" ON "user_carts"("userId");
CREATE INDEX "user_carts_userId_updatedAt_idx" ON "user_carts"("userId", "updatedAt");

ALTER TABLE "user_carts"
  ADD CONSTRAINT "user_carts_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
