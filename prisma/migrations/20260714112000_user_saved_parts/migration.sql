CREATE TABLE "user_saved_parts" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "partUid" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "user_saved_parts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "user_saved_parts_userId_partUid_key" ON "user_saved_parts"("userId", "partUid");
CREATE INDEX "user_saved_parts_userId_createdAt_idx" ON "user_saved_parts"("userId", "createdAt");
CREATE INDEX "user_saved_parts_partUid_idx" ON "user_saved_parts"("partUid");

ALTER TABLE "user_saved_parts" ADD CONSTRAINT "user_saved_parts_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "user_saved_parts" ADD CONSTRAINT "user_saved_parts_partUid_fkey"
FOREIGN KEY ("partUid") REFERENCES "part_master"("partUid") ON DELETE CASCADE ON UPDATE CASCADE;
