CREATE TYPE "BusinessAddOnRequestStatus" AS ENUM ('Requested', 'Approved', 'Enabled', 'Rejected');

CREATE TYPE "BusinessSupportTicketStatus" AS ENUM ('Open', 'InProgress', 'Resolved', 'Closed');

CREATE TYPE "BusinessSupportTicketPriority" AS ENUM ('Standard', 'Priority', 'Urgent');

CREATE TABLE "business_add_on_requests" (
  "id" TEXT NOT NULL,
  "businessAccountId" TEXT NOT NULL,
  "featureKey" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "note" TEXT,
  "status" "BusinessAddOnRequestStatus" NOT NULL DEFAULT 'Requested',
  "requestedByUserId" TEXT,
  "decidedByAdminId" TEXT,
  "decidedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "business_add_on_requests_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "business_support_tickets" (
  "id" TEXT NOT NULL,
  "businessAccountId" TEXT NOT NULL,
  "subject" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "status" "BusinessSupportTicketStatus" NOT NULL DEFAULT 'Open',
  "priority" "BusinessSupportTicketPriority" NOT NULL DEFAULT 'Standard',
  "createdByUserId" TEXT,
  "assignedAdminId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "business_support_tickets_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "business_add_on_requests_businessAccountId_featureKey_key"
ON "business_add_on_requests"("businessAccountId", "featureKey");

CREATE INDEX "business_add_on_requests_businessAccountId_status_idx"
ON "business_add_on_requests"("businessAccountId", "status");

CREATE INDEX "business_add_on_requests_status_createdAt_idx"
ON "business_add_on_requests"("status", "createdAt");

CREATE INDEX "business_support_tickets_businessAccountId_status_idx"
ON "business_support_tickets"("businessAccountId", "status");

CREATE INDEX "business_support_tickets_status_createdAt_idx"
ON "business_support_tickets"("status", "createdAt");

ALTER TABLE "business_add_on_requests"
ADD CONSTRAINT "business_add_on_requests_businessAccountId_fkey"
FOREIGN KEY ("businessAccountId") REFERENCES "business_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "business_add_on_requests"
ADD CONSTRAINT "business_add_on_requests_requestedByUserId_fkey"
FOREIGN KEY ("requestedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "business_add_on_requests"
ADD CONSTRAINT "business_add_on_requests_decidedByAdminId_fkey"
FOREIGN KEY ("decidedByAdminId") REFERENCES "admin"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "business_support_tickets"
ADD CONSTRAINT "business_support_tickets_businessAccountId_fkey"
FOREIGN KEY ("businessAccountId") REFERENCES "business_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "business_support_tickets"
ADD CONSTRAINT "business_support_tickets_createdByUserId_fkey"
FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "business_support_tickets"
ADD CONSTRAINT "business_support_tickets_assignedAdminId_fkey"
FOREIGN KEY ("assignedAdminId") REFERENCES "admin"("id") ON DELETE SET NULL ON UPDATE CASCADE;
