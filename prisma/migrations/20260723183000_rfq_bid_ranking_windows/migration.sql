ALTER TABLE "rfqs" ADD COLUMN "rankingWindowMinutes" INTEGER;
ALTER TABLE "rfqs" ADD COLUMN "rankingWindowStartedAt" TIMESTAMP(3);
ALTER TABLE "rfqs" ADD COLUMN "rankingLastCalculatedAt" TIMESTAMP(3);

UPDATE "rfqs"
SET
  "rankingWindowMinutes" = CASE WHEN "source" = 'fleet' THEN 1440 ELSE 30 END,
  "rankingWindowStartedAt" = "createdAt"
WHERE "rankingWindowMinutes" IS NULL;

ALTER TABLE "rfq_bids" ADD COLUMN "rankingVisible" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "rfq_bids" ADD COLUMN "rankingScore" DOUBLE PRECISION;
ALTER TABLE "rfq_bids" ADD COLUMN "rankingPosition" INTEGER;
ALTER TABLE "rfq_bids" ADD COLUMN "rankingCalculatedAt" TIMESTAMP(3);

CREATE INDEX "rfqs_rankingWindowStartedAt_idx" ON "rfqs"("rankingWindowStartedAt");
CREATE INDEX "rfq_bids_rankingVisible_idx" ON "rfq_bids"("rankingVisible");
CREATE INDEX "rfq_bids_rankingPosition_idx" ON "rfq_bids"("rankingPosition");
