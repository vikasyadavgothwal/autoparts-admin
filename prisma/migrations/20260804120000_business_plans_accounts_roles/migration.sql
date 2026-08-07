CREATE TYPE "BusinessPlanCode" AS ENUM ('Free', 'Pro', 'Enterprise');
CREATE TYPE "BusinessAccountType" AS ENUM ('Fleet', 'Garage', 'Supplier');
CREATE TYPE "BusinessMemberStatus" AS ENUM ('Invited', 'Active', 'Suspended', 'Removed');
CREATE TYPE "BusinessInvitationStatus" AS ENUM ('Pending', 'Accepted', 'Revoked', 'Expired');

CREATE TABLE "business_plans" (
  "id" TEXT NOT NULL,
  "code" "BusinessPlanCode" NOT NULL,
  "accountType" "BusinessAccountType" NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "priceAmount" INTEGER NOT NULL DEFAULT 0,
  "priceCurrency" TEXT NOT NULL DEFAULT 'AED',
  "billingPeriod" TEXT NOT NULL DEFAULT 'monthly',
  "staffLimit" INTEGER,
  "roleLimit" INTEGER,
  "permissionLimit" INTEGER,
  "vehicleLimit" INTEGER,
  "appointmentLimit" INTEGER,
  "productLimit" INTEGER,
  "dashboardReports" BOOLEAN NOT NULL DEFAULT false,
  "usageReports" BOOLEAN NOT NULL DEFAULT false,
  "activityReports" BOOLEAN NOT NULL DEFAULT false,
  "helpSupport" BOOLEAN NOT NULL DEFAULT true,
  "onboarding" BOOLEAN NOT NULL DEFAULT false,
  "training" BOOLEAN NOT NULL DEFAULT false,
  "accountAssistance" BOOLEAN NOT NULL DEFAULT false,
  "prioritySupport" BOOLEAN NOT NULL DEFAULT false,
  "emailNotifications" BOOLEAN NOT NULL DEFAULT true,
  "whatsappNotifications" BOOLEAN NOT NULL DEFAULT false,
  "enabledFeatures" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "enabledMenus" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "business_plans_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "business_accounts" (
  "id" TEXT NOT NULL,
  "publicId" TEXT NOT NULL DEFAULT ('BAC-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 8))),
  "type" "BusinessAccountType" NOT NULL,
  "name" TEXT NOT NULL,
  "ownerUserId" TEXT NOT NULL,
  "planId" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "business_accounts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "business_account_members" (
  "id" TEXT NOT NULL,
  "businessAccountId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "roleIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "status" "BusinessMemberStatus" NOT NULL DEFAULT 'Active',
  "invitedByUserId" TEXT,
  "joinedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "business_account_members_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "business_roles" (
  "id" TEXT NOT NULL,
  "businessAccountId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "permissionIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "isOwnerRole" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "business_roles_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "business_permissions" (
  "id" TEXT NOT NULL,
  "businessAccountId" TEXT,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "menuKey" TEXT,
  "featureKey" TEXT,
  "actionKey" TEXT,
  "isSystem" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "business_permissions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "business_invitations" (
  "id" TEXT NOT NULL,
  "businessAccountId" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "roleIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "tokenHash" TEXT NOT NULL,
  "invitedByUserId" TEXT NOT NULL,
  "status" "BusinessInvitationStatus" NOT NULL DEFAULT 'Pending',
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "acceptedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "business_invitations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "business_activity_logs" (
  "id" TEXT NOT NULL,
  "businessAccountId" TEXT,
  "actorUserId" TEXT,
  "action" TEXT NOT NULL,
  "entityType" TEXT,
  "entityId" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "business_activity_logs_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "user_sessions"
  ADD COLUMN "deviceMacAddress" TEXT,
  ADD COLUMN "deviceIdentifier" TEXT;

CREATE UNIQUE INDEX "business_plans_accountType_code_key" ON "business_plans"("accountType", "code");
CREATE UNIQUE INDEX "business_accounts_publicId_key" ON "business_accounts"("publicId");
CREATE UNIQUE INDEX "business_accounts_ownerUserId_type_key" ON "business_accounts"("ownerUserId", "type");
CREATE UNIQUE INDEX "business_account_members_businessAccountId_userId_key" ON "business_account_members"("businessAccountId", "userId");
CREATE UNIQUE INDEX "business_roles_businessAccountId_name_key" ON "business_roles"("businessAccountId", "name");
CREATE UNIQUE INDEX "business_permissions_businessAccountId_code_key" ON "business_permissions"("businessAccountId", "code");
CREATE UNIQUE INDEX "business_invitations_tokenHash_key" ON "business_invitations"("tokenHash");

CREATE INDEX "business_accounts_type_planId_idx" ON "business_accounts"("type", "planId");
CREATE INDEX "business_accounts_ownerUserId_idx" ON "business_accounts"("ownerUserId");
CREATE INDEX "business_account_members_userId_status_idx" ON "business_account_members"("userId", "status");
CREATE INDEX "business_account_members_businessAccountId_status_idx" ON "business_account_members"("businessAccountId", "status");
CREATE INDEX "business_roles_businessAccountId_idx" ON "business_roles"("businessAccountId");
CREATE INDEX "business_permissions_businessAccountId_idx" ON "business_permissions"("businessAccountId");
CREATE INDEX "business_permissions_code_idx" ON "business_permissions"("code");
CREATE INDEX "business_invitations_businessAccountId_status_idx" ON "business_invitations"("businessAccountId", "status");
CREATE INDEX "business_invitations_email_status_idx" ON "business_invitations"("email", "status");
CREATE INDEX "business_activity_logs_businessAccountId_createdAt_idx" ON "business_activity_logs"("businessAccountId", "createdAt");
CREATE INDEX "business_activity_logs_actorUserId_createdAt_idx" ON "business_activity_logs"("actorUserId", "createdAt");
CREATE INDEX "business_activity_logs_action_createdAt_idx" ON "business_activity_logs"("action", "createdAt");
CREATE INDEX "user_sessions_userId_deviceIdentifier_idx" ON "user_sessions"("userId", "deviceIdentifier");

ALTER TABLE "business_accounts" ADD CONSTRAINT "business_accounts_ownerUserId_fkey"
  FOREIGN KEY ("ownerUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "business_accounts" ADD CONSTRAINT "business_accounts_planId_fkey"
  FOREIGN KEY ("planId") REFERENCES "business_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "business_account_members" ADD CONSTRAINT "business_account_members_businessAccountId_fkey"
  FOREIGN KEY ("businessAccountId") REFERENCES "business_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "business_account_members" ADD CONSTRAINT "business_account_members_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "business_roles" ADD CONSTRAINT "business_roles_businessAccountId_fkey"
  FOREIGN KEY ("businessAccountId") REFERENCES "business_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "business_permissions" ADD CONSTRAINT "business_permissions_businessAccountId_fkey"
  FOREIGN KEY ("businessAccountId") REFERENCES "business_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "business_invitations" ADD CONSTRAINT "business_invitations_businessAccountId_fkey"
  FOREIGN KEY ("businessAccountId") REFERENCES "business_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "business_invitations" ADD CONSTRAINT "business_invitations_invitedByUserId_fkey"
  FOREIGN KEY ("invitedByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "business_activity_logs" ADD CONSTRAINT "business_activity_logs_businessAccountId_fkey"
  FOREIGN KEY ("businessAccountId") REFERENCES "business_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "business_activity_logs" ADD CONSTRAINT "business_activity_logs_actorUserId_fkey"
  FOREIGN KEY ("actorUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO "business_plans" (
  "id", "code", "accountType", "name", "description", "priceAmount", "priceCurrency", "billingPeriod", "staffLimit", "roleLimit",
  "permissionLimit", "vehicleLimit", "appointmentLimit", "productLimit",
  "dashboardReports", "usageReports", "activityReports", "helpSupport",
  "onboarding", "training", "accountAssistance", "prioritySupport",
  "emailNotifications", "whatsappNotifications", "enabledFeatures",
  "enabledMenus", "updatedAt"
) VALUES
  (
    'plan_fleet_free_default', 'Free', 'Fleet', 'Fleet Free', 'Starter plan for fleet accounts.',
    0, 'AED', 'monthly', 0, 0, 0, 5, NULL, NULL,
    true, false, false, true,
    false, false, false, false,
    true, false,
    ARRAY['dashboard.access']::TEXT[],
    ARRAY['overview']::TEXT[],
    CURRENT_TIMESTAMP
  ),
  (
    'plan_fleet_pro_default', 'Pro', 'Fleet', 'Fleet Pro', 'Growth plan for fleet teams.',
    29900, 'AED', 'monthly', 5, 5, 50, 50, NULL, NULL,
    true, true, true, true,
    true, false, true, false,
    true, true,
    ARRAY['dashboard.access','staff.manage','roles.manage','permissions.manage','reports.dashboard','reports.usage','reports.activity']::TEXT[],
    ARRAY['overview','staff','roles','reports','settings']::TEXT[],
    CURRENT_TIMESTAMP
  ),
  (
    'plan_fleet_enterprise_default', 'Enterprise', 'Fleet', 'Fleet Enterprise', 'Full access for large fleet teams.',
    0, 'AED', 'custom', NULL, NULL, NULL, NULL, NULL, NULL,
    true, true, true, true,
    true, true, true, true,
    true, true,
    ARRAY['dashboard.access','staff.manage','roles.manage','permissions.manage','reports.dashboard','reports.usage','reports.activity','support.priority']::TEXT[],
    ARRAY['overview','vehicles','rfqs','orders','suppliers','reports','settings','staff','roles','support']::TEXT[],
    CURRENT_TIMESTAMP
  ),
  (
    'plan_garage_free_default', 'Free', 'Garage', 'Garage Free', 'Starter plan for garage accounts.',
    0, 'AED', 'monthly', 0, 0, 0, NULL, 5, NULL,
    true, false, false, true,
    false, false, false, false,
    true, false,
    ARRAY['dashboard.access']::TEXT[],
    ARRAY['overview','bookings','services']::TEXT[],
    CURRENT_TIMESTAMP
  ),
  (
    'plan_garage_pro_default', 'Pro', 'Garage', 'Garage Pro', 'Growth plan for active garages.',
    19900, 'AED', 'monthly', 5, 5, 50, NULL, 50, NULL,
    true, true, true, true,
    true, false, true, false,
    true, true,
    ARRAY['dashboard.access','staff.manage','roles.manage','permissions.manage','reports.dashboard','reports.usage','reports.activity']::TEXT[],
    ARRAY['overview','bookings','services','schedule','reviews','reports','settings','staff','roles']::TEXT[],
    CURRENT_TIMESTAMP
  ),
  (
    'plan_garage_enterprise_default', 'Enterprise', 'Garage', 'Garage Enterprise', 'Full access for large garage operations.',
    0, 'AED', 'custom', NULL, NULL, NULL, NULL, NULL, NULL,
    true, true, true, true,
    true, true, true, true,
    true, true,
    ARRAY['dashboard.access','staff.manage','roles.manage','permissions.manage','reports.dashboard','reports.usage','reports.activity','support.priority']::TEXT[],
    ARRAY['overview','bookings','services','schedule','reviews','reports','settings','staff','roles','support']::TEXT[],
    CURRENT_TIMESTAMP
  ),
  (
    'plan_supplier_free_default', 'Free', 'Supplier', 'Supplier Free', 'Starter plan for supplier accounts.',
    0, 'AED', 'monthly', 0, 0, 0, NULL, NULL, 10,
    true, false, false, true,
    false, false, false, false,
    true, false,
    ARRAY['dashboard.access']::TEXT[],
    ARRAY['overview','inventory','rfq-inbox']::TEXT[],
    CURRENT_TIMESTAMP
  ),
  (
    'plan_supplier_pro_default', 'Pro', 'Supplier', 'Supplier Pro', 'Growth plan for supplier teams.',
    24900, 'AED', 'monthly', 5, 5, 50, NULL, NULL, 500,
    true, true, true, true,
    true, false, true, false,
    true, true,
    ARRAY['dashboard.access','staff.manage','roles.manage','permissions.manage','reports.dashboard','reports.usage','reports.activity']::TEXT[],
    ARRAY['overview','inventory','rfq-inbox','offers','orders','performance','reviews','settings','staff','roles']::TEXT[],
    CURRENT_TIMESTAMP
  ),
  (
    'plan_supplier_enterprise_default', 'Enterprise', 'Supplier', 'Supplier Enterprise', 'Full access for large supplier operations.',
    0, 'AED', 'custom', NULL, NULL, NULL, NULL, NULL, NULL,
    true, true, true, true,
    true, true, true, true,
    true, true,
    ARRAY['dashboard.access','staff.manage','roles.manage','permissions.manage','reports.dashboard','reports.usage','reports.activity','support.priority']::TEXT[],
    ARRAY['overview','inventory','rfq-inbox','offers','orders','performance','reviews','settings','staff','roles','support']::TEXT[],
    CURRENT_TIMESTAMP
  )
ON CONFLICT ("accountType", "code") DO NOTHING;
