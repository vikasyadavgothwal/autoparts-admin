CREATE TYPE "BusinessQueryType" AS ENUM (
  'BookDemo',
  'ScheduleDemo',
  'Contact',
  'Sales',
  'FleetDemo',
  'General'
);

CREATE TYPE "BusinessQueryStatus" AS ENUM (
  'New',
  'Reviewed',
  'Archived'
);

CREATE SEQUENCE IF NOT EXISTS business_query_public_id_seq START 1;

CREATE OR REPLACE FUNCTION next_business_query_public_id() RETURNS TEXT AS $$
  SELECT 'QRY-' || LPAD(nextval('business_query_public_id_seq')::TEXT, 5, '0');
$$ LANGUAGE SQL VOLATILE;

CREATE TABLE "business_queries" (
  "id" TEXT NOT NULL,
  "publicId" TEXT NOT NULL DEFAULT next_business_query_public_id(),
  "type" "BusinessQueryType" NOT NULL DEFAULT 'General',
  "source" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "phone" TEXT,
  "company" TEXT NOT NULL,
  "message" TEXT,
  "pagePath" TEXT,
  "userAgent" TEXT,
  "ipHash" TEXT,
  "status" "BusinessQueryStatus" NOT NULL DEFAULT 'New',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "business_queries_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "business_queries_publicId_key" ON "business_queries"("publicId");
CREATE INDEX "business_queries_type_createdAt_idx" ON "business_queries"("type", "createdAt");
CREATE INDEX "business_queries_status_createdAt_idx" ON "business_queries"("status", "createdAt");
CREATE INDEX "business_queries_email_idx" ON "business_queries"("email");
