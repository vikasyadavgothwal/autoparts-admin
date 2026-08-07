import { createHash, randomBytes } from "node:crypto"

import { sendSmtpMail } from "@/lib/email/smtp"
import { getFirebaseAuth } from "@/lib/firebase/admin"
import { hashPassword } from "@/lib/auth/password"
import { db } from "@/lib/database/prisma"
import {
  BusinessAccountType,
  BusinessAddOnRequestStatus,
  BusinessMemberStatus,
  BusinessInvitationStatus,
  BusinessPlanCode,
  BusinessSupportTicketPriority,
  BusinessSupportTicketStatus,
  OrderStatus,
  RfqBidStatus,
  RfqSource,
  RfqStatus,
  UserRole,
  type Prisma,
} from "@/lib/generated/prisma/client"

const businessRoles = new Set<UserRole>([
  UserRole.Fleet,
  UserRole.Garage,
  UserRole.Supplier,
])

const staffPasswordAlphabet =
  "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*"

const generateStaffPassword = () => {
  const bytes = randomBytes(14)
  return Array.from(bytes, (byte) => staffPasswordAlphabet[byte % staffPasswordAlphabet.length]).join("")
}

const accountTypeToUserRole = (type: BusinessAccountType): UserRole => {
  if (type === BusinessAccountType.Fleet) return UserRole.Fleet
  if (type === BusinessAccountType.Garage) return UserRole.Garage
  return UserRole.Supplier
}

const defaultPermissionTemplates: Record<
  BusinessAccountType,
  Array<{
    code: string
    name: string
    menuKey?: string
    featureKey?: string
    actionKey?: string
  }>
> = {
  Fleet: [
    { code: "fleet.dashboard.view", name: "View dashboard", menuKey: "overview" },
    { code: "fleet.vehicles.view", name: "View vehicles", menuKey: "vehicles", featureKey: "vehicles", actionKey: "view" },
    { code: "fleet.vehicles.manage", name: "Add and edit vehicles", menuKey: "vehicles", featureKey: "vehicles", actionKey: "manage" },
    { code: "fleet.rfqs.create", name: "Create RFQs", menuKey: "rfqs", featureKey: "rfqs", actionKey: "create" },
    { code: "fleet.bids.accept", name: "Accept bids", menuKey: "rfqs", featureKey: "rfqs", actionKey: "accept_bid" },
    { code: "fleet.reports.view", name: "View reports", menuKey: "reports", featureKey: "reports", actionKey: "view" },
  ],
  Garage: [
    { code: "garage.dashboard.view", name: "View dashboard", menuKey: "overview" },
    { code: "garage.bookings.view", name: "View bookings", menuKey: "bookings", featureKey: "bookings", actionKey: "view" },
    { code: "garage.bookings.manage", name: "Manage bookings", menuKey: "bookings", featureKey: "bookings", actionKey: "manage" },
    { code: "garage.services.manage", name: "Manage services", menuKey: "services", featureKey: "services", actionKey: "manage" },
    { code: "garage.schedule.manage", name: "Manage schedule", menuKey: "schedule", featureKey: "schedule", actionKey: "manage" },
    { code: "garage.reports.view", name: "View reports", menuKey: "reports", featureKey: "reports", actionKey: "view" },
  ],
  Supplier: [
    { code: "supplier.dashboard.view", name: "View dashboard", menuKey: "overview" },
    { code: "supplier.inventory.view", name: "View inventory", menuKey: "inventory", featureKey: "inventory", actionKey: "view" },
    { code: "supplier.inventory.manage", name: "Upload and edit products", menuKey: "inventory", featureKey: "inventory", actionKey: "manage" },
    { code: "supplier.rfqs.quote", name: "Quote RFQs", menuKey: "rfq-inbox", featureKey: "rfqs", actionKey: "quote" },
    { code: "supplier.orders.manage", name: "Manage orders", menuKey: "orders", featureKey: "orders", actionKey: "manage" },
    { code: "supplier.reports.view", name: "View reports", menuKey: "performance", featureKey: "reports", actionKey: "view" },
  ],
}

const defaultPlanSeeds: Array<Prisma.BusinessPlanUncheckedCreateInput> = [
  {
    code: BusinessPlanCode.Free,
    accountType: BusinessAccountType.Fleet,
    name: "Fleet Free",
    description: "Starter plan for fleet accounts.",
    priceAmount: 0,
    priceCurrency: "AED",
    billingPeriod: "monthly",
    staffLimit: 0,
    roleLimit: 0,
    permissionLimit: 0,
    vehicleLimit: 5,
    rfqLimit: 3,
    orderLimit: 3,
    savedSearchLimit: 2,
    wishlistLimit: 10,
    integrationLimit: 0,
    appointmentLimit: null,
    productLimit: null,
    dashboardReports: true,
    enabledFeatures: ["dashboard.access"],
    enabledMenus: ["overview", "vehicles", "rfqs", "saved-searches", "integrations", "security", "support"],
  },
  {
    code: BusinessPlanCode.Pro,
    accountType: BusinessAccountType.Fleet,
    name: "Fleet Pro",
    description: "Growth plan for fleet teams.",
    priceAmount: 29900,
    yearlyPriceAmount: 23900,
    priceCurrency: "AED",
    billingPeriod: "monthly",
    staffLimit: 5,
    roleLimit: 5,
    permissionLimit: 50,
    vehicleLimit: 50,
    rfqLimit: 100,
    orderLimit: 100,
    savedSearchLimit: 25,
    wishlistLimit: 200,
    integrationLimit: 2,
    appointmentLimit: null,
    productLimit: null,
    dashboardReports: true,
    usageReports: true,
    activityReports: true,
    onboarding: true,
    accountAssistance: true,
    whatsappNotifications: true,
    approvalWorkflowEnabled: true,
    customRolesEnabled: true,
    apiAccessLevel: "standard",
    enabledFeatures: ["dashboard.access", "staff.manage", "roles.manage", "permissions.manage", "reports.dashboard", "reports.usage", "reports.activity"],
    enabledMenus: ["overview", "vehicles", "rfqs", "orders", "suppliers", "saved-searches", "integrations", "security", "support", "reports", "settings", "staff", "roles"],
  },
  {
    code: BusinessPlanCode.Enterprise,
    accountType: BusinessAccountType.Fleet,
    name: "Fleet Enterprise",
    description: "Full access for large fleet teams.",
    priceAmount: 99900,
    yearlyPriceAmount: 79900,
    priceCurrency: "AED",
    billingPeriod: "custom",
    staffLimit: null,
    roleLimit: null,
    permissionLimit: null,
    vehicleLimit: null,
    rfqLimit: null,
    orderLimit: null,
    savedSearchLimit: null,
    wishlistLimit: null,
    integrationLimit: null,
    appointmentLimit: null,
    productLimit: null,
    dashboardReports: true,
    usageReports: true,
    activityReports: true,
    onboarding: true,
    training: true,
    accountAssistance: true,
    prioritySupport: true,
    whatsappNotifications: true,
    approvalWorkflowEnabled: true,
    customRolesEnabled: true,
    apiAccessLevel: "enterprise",
    enabledFeatures: ["dashboard.access", "staff.manage", "roles.manage", "permissions.manage", "reports.dashboard", "reports.usage", "reports.activity", "support.priority"],
    enabledMenus: ["overview", "vehicles", "rfqs", "orders", "suppliers", "saved-searches", "integrations", "security", "support", "reports", "settings", "staff", "roles"],
  },
  {
    code: BusinessPlanCode.Free,
    accountType: BusinessAccountType.Garage,
    name: "Garage Free",
    description: "Starter plan for garage accounts.",
    priceAmount: 0,
    priceCurrency: "AED",
    billingPeriod: "monthly",
    staffLimit: 0,
    roleLimit: 0,
    permissionLimit: 0,
    vehicleLimit: null,
    appointmentLimit: 5,
    serviceLimit: 3,
    orderLimit: 5,
    savedSearchLimit: 2,
    integrationLimit: 0,
    productLimit: null,
    dashboardReports: true,
    enabledFeatures: ["dashboard.access"],
    enabledMenus: ["overview", "bookings", "services", "saved-searches", "integrations", "security", "support"],
  },
  {
    code: BusinessPlanCode.Pro,
    accountType: BusinessAccountType.Garage,
    name: "Garage Pro",
    description: "Growth plan for active garages.",
    priceAmount: 19900,
    yearlyPriceAmount: 15900,
    priceCurrency: "AED",
    billingPeriod: "monthly",
    staffLimit: 5,
    roleLimit: 5,
    permissionLimit: 50,
    vehicleLimit: null,
    appointmentLimit: 50,
    serviceLimit: 25,
    orderLimit: 100,
    savedSearchLimit: 25,
    integrationLimit: 2,
    productLimit: null,
    dashboardReports: true,
    usageReports: true,
    activityReports: true,
    onboarding: true,
    accountAssistance: true,
    whatsappNotifications: true,
    approvalWorkflowEnabled: true,
    customRolesEnabled: true,
    apiAccessLevel: "standard",
    enabledFeatures: ["dashboard.access", "staff.manage", "roles.manage", "permissions.manage", "reports.dashboard", "reports.usage", "reports.activity"],
    enabledMenus: ["overview", "bookings", "services", "schedule", "reviews", "saved-searches", "integrations", "security", "support", "reports", "settings", "staff", "roles"],
  },
  {
    code: BusinessPlanCode.Enterprise,
    accountType: BusinessAccountType.Garage,
    name: "Garage Enterprise",
    description: "Full access for large garage operations.",
    priceAmount: 69900,
    yearlyPriceAmount: 55900,
    priceCurrency: "AED",
    billingPeriod: "custom",
    staffLimit: null,
    roleLimit: null,
    permissionLimit: null,
    vehicleLimit: null,
    appointmentLimit: null,
    serviceLimit: null,
    orderLimit: null,
    savedSearchLimit: null,
    integrationLimit: null,
    productLimit: null,
    dashboardReports: true,
    usageReports: true,
    activityReports: true,
    onboarding: true,
    training: true,
    accountAssistance: true,
    prioritySupport: true,
    whatsappNotifications: true,
    approvalWorkflowEnabled: true,
    customRolesEnabled: true,
    apiAccessLevel: "enterprise",
    enabledFeatures: ["dashboard.access", "staff.manage", "roles.manage", "permissions.manage", "reports.dashboard", "reports.usage", "reports.activity", "support.priority"],
    enabledMenus: ["overview", "bookings", "services", "schedule", "reviews", "saved-searches", "integrations", "security", "support", "reports", "settings", "staff", "roles"],
  },
  {
    code: BusinessPlanCode.Free,
    accountType: BusinessAccountType.Supplier,
    name: "Supplier Free",
    description: "Starter plan for supplier accounts.",
    priceAmount: 0,
    priceCurrency: "AED",
    billingPeriod: "monthly",
    staffLimit: 0,
    roleLimit: 0,
    permissionLimit: 0,
    brandLimit: 3,
    categoryLimit: 3,
    vehicleLimit: null,
    appointmentLimit: null,
    productLimit: 10,
    rfqLimit: 10,
    orderLimit: 10,
    savedSearchLimit: 2,
    wishlistLimit: 10,
    integrationLimit: 0,
    dashboardReports: true,
    enabledFeatures: ["dashboard.access"],
    enabledMenus: ["overview", "inventory", "rfq-inbox", "saved-searches", "integrations", "security", "support"],
  },
  {
    code: BusinessPlanCode.Pro,
    accountType: BusinessAccountType.Supplier,
    name: "Supplier Pro",
    description: "Growth plan for supplier teams.",
    priceAmount: 24900,
    yearlyPriceAmount: 19900,
    priceCurrency: "AED",
    billingPeriod: "monthly",
    staffLimit: 5,
    roleLimit: 5,
    permissionLimit: 50,
    brandLimit: 25,
    categoryLimit: 25,
    vehicleLimit: null,
    appointmentLimit: null,
    productLimit: 500,
    rfqLimit: 200,
    orderLimit: 200,
    savedSearchLimit: 25,
    wishlistLimit: 200,
    integrationLimit: 2,
    dashboardReports: true,
    usageReports: true,
    activityReports: true,
    onboarding: true,
    accountAssistance: true,
    whatsappNotifications: true,
    featuredVendor: true,
    searchBoostLevel: 1,
    approvalWorkflowEnabled: true,
    customRolesEnabled: true,
    apiAccessLevel: "standard",
    enabledFeatures: ["dashboard.access", "staff.manage", "roles.manage", "permissions.manage", "reports.dashboard", "reports.usage", "reports.activity"],
    enabledMenus: ["overview", "inventory", "rfq-inbox", "offers", "orders", "performance", "reviews", "saved-searches", "integrations", "security", "support", "settings", "staff", "roles"],
  },
  {
    code: BusinessPlanCode.Enterprise,
    accountType: BusinessAccountType.Supplier,
    name: "Supplier Enterprise",
    description: "Full access for large supplier operations.",
    priceAmount: 89900,
    yearlyPriceAmount: 71900,
    priceCurrency: "AED",
    billingPeriod: "custom",
    staffLimit: null,
    roleLimit: null,
    permissionLimit: null,
    brandLimit: null,
    categoryLimit: null,
    vehicleLimit: null,
    appointmentLimit: null,
    productLimit: null,
    rfqLimit: null,
    orderLimit: null,
    savedSearchLimit: null,
    wishlistLimit: null,
    integrationLimit: null,
    dashboardReports: true,
    usageReports: true,
    activityReports: true,
    onboarding: true,
    training: true,
    accountAssistance: true,
    prioritySupport: true,
    whatsappNotifications: true,
    featuredVendor: true,
    searchBoostLevel: 2,
    approvalWorkflowEnabled: true,
    customRolesEnabled: true,
    apiAccessLevel: "enterprise",
    enabledFeatures: ["dashboard.access", "staff.manage", "roles.manage", "permissions.manage", "reports.dashboard", "reports.usage", "reports.activity", "support.priority"],
    enabledMenus: ["overview", "inventory", "rfq-inbox", "offers", "orders", "performance", "reviews", "saved-searches", "integrations", "security", "support", "settings", "staff", "roles"],
  },
]

const planInclude = {
  _count: { select: { businessAccounts: true } },
} satisfies Prisma.BusinessPlanInclude

const accountInclude = {
  plan: true,
  owner: {
    select: {
      id: true,
      publicId: true,
      email: true,
      phone: true,
      firstName: true,
      lastName: true,
      companyName: true,
      sessions: {
        orderBy: { lastUsedAt: "desc" },
        take: 20,
        select: {
          id: true,
          deviceName: true,
          deviceMacAddress: true,
          deviceIdentifier: true,
          userAgent: true,
          ipHash: true,
          lastUsedAt: true,
          expiresAt: true,
          revokedAt: true,
          createdAt: true,
        },
      },
    },
  },
  members: {
    include: {
      user: {
        select: {
          id: true,
          publicId: true,
          email: true,
          phone: true,
          firstName: true,
          lastName: true,
          companyName: true,
          sessions: {
            orderBy: { lastUsedAt: "desc" },
            take: 10,
            select: {
              id: true,
              deviceName: true,
              deviceMacAddress: true,
              deviceIdentifier: true,
              userAgent: true,
              ipHash: true,
              lastUsedAt: true,
              expiresAt: true,
              revokedAt: true,
              createdAt: true,
            },
          },
        },
      },
    },
    orderBy: { createdAt: "asc" },
  },
  roles: { orderBy: { createdAt: "asc" } },
  permissions: { orderBy: { code: "asc" } },
  invitations: {
    orderBy: { createdAt: "desc" },
    take: 20,
  },
  _count: {
    select: {
      members: true,
      roles: true,
      permissions: true,
      invitations: true,
    },
  },
} satisfies Prisma.BusinessAccountInclude

type BusinessPlanWithCount = Prisma.BusinessPlanGetPayload<{ include: typeof planInclude }>
type BusinessAccountFull = Prisma.BusinessAccountGetPayload<{ include: typeof accountInclude }>

const defaultPlanUpdateData = (
  plan: Prisma.BusinessPlanUncheckedCreateInput,
): Prisma.BusinessPlanUncheckedUpdateInput => {
  const data: Prisma.BusinessPlanUncheckedUpdateInput = { ...plan }
  delete data.id
  delete data.code
  delete data.accountType
  return data
}

export const businessEntitlementFeatures = {
  Fleet: [
    "dashboard.access",
    "fleet.vehicles.manage",
    "fleet.rfqs.create",
    "fleet.orders.create",
    "business.saved-searches.create",
    "business.wishlist.create",
    "integrations.manage",
    "api.standard",
    "api.enterprise",
    "approval-workflows.manage",
    "staff.manage",
    "roles.manage",
    "permissions.manage",
    "reports.dashboard",
    "reports.usage",
    "reports.activity",
    "support.priority",
  ],
  Garage: [
    "dashboard.access",
    "garage.bookings.manage",
    "garage.services.manage",
    "business.saved-searches.create",
    "integrations.manage",
    "api.standard",
    "api.enterprise",
    "approval-workflows.manage",
    "staff.manage",
    "roles.manage",
    "permissions.manage",
    "reports.dashboard",
    "reports.usage",
    "reports.activity",
    "support.priority",
  ],
  Supplier: [
    "dashboard.access",
    "supplier.inventory.manage",
    "supplier.rfqs.quote",
    "supplier.orders.manage",
    "business.saved-searches.create",
    "business.wishlist.create",
    "integrations.manage",
    "api.standard",
    "api.enterprise",
    "approval-workflows.manage",
    "staff.manage",
    "roles.manage",
    "permissions.manage",
    "reports.dashboard",
    "reports.usage",
    "reports.activity",
    "support.priority",
    "marketplace.featured-vendor",
    "marketplace.search-boost",
  ],
} satisfies Record<BusinessAccountType, string[]>

export const businessRequestableFeatureLabels = {
  "staff.manage": "Staff users",
  "roles.manage": "Custom roles",
  "permissions.manage": "Custom permissions",
  "reports.usage": "Usage reports",
  "reports.activity": "Activity reports",
  "support.priority": "Priority support",
  "integrations.manage": "Integrations",
  "api.standard": "API access",
  "api.enterprise": "Enterprise API access",
  "approval-workflows.manage": "Approval workflows",
  "marketplace.featured-vendor": "Featured vendor placement",
  "marketplace.search-boost": "Marketplace search boost",
} satisfies Record<string, string>

const cleanText = (value: unknown, max = 120): string | null => {
  if (typeof value !== "string") return null
  const normalized = value.replace(/[\r\n\t]+/g, " ").replace(/\s+/g, " ").trim()
  return normalized ? normalized.slice(0, max) : null
}

const cleanTextArray = (value: unknown): string[] =>
  Array.isArray(value)
    ? Array.from(
        new Set(
          value
            .map((item) => cleanText(item, 120))
            .filter((item): item is string => Boolean(item)),
        ),
      )
    : []

const toIso = (value: Date | null | undefined) => value?.toISOString() ?? null

const fullName = (user: {
  firstName: string | null
  lastName: string | null
  companyName: string | null
  email: string | null
  phone: string | null
}) =>
  [user.firstName, user.lastName].filter(Boolean).join(" ") ||
  user.companyName ||
  user.email ||
  user.phone ||
  "Unnamed user"

const assertBusinessAccountOwnership = async (input: {
  ownerUserId: string
  businessAccountId: unknown
  includeMembers?: boolean
}): Promise<BusinessAccountFull> => {
  const businessAccountId = cleanText(input.businessAccountId, 80)
  if (!businessAccountId) throw new Error("Business account id is required")

  if (input.includeMembers) {
    const account = await db.businessAccount.findFirst({
      where: { id: businessAccountId, ownerUserId: input.ownerUserId, isActive: true },
      include: {
        ...accountInclude,
        members: {
          ...accountInclude.members,
          where: {
            status: { in: [BusinessMemberStatus.Active, BusinessMemberStatus.Invited] },
          },
        },
      },
    })
    if (!account) throw new Error("Business account was not found")
    return account
  }

  const account = await db.businessAccount.findFirst({
    where: { id: businessAccountId, ownerUserId: input.ownerUserId, isActive: true },
    include: accountInclude,
  })
  if (!account) throw new Error("Business account was not found")
  return account
}

const mapPlan = (plan: BusinessPlanWithCount) => ({
  id: plan.id,
  code: plan.code,
  accountType: plan.accountType,
  name: plan.name,
  description: plan.description,
  price: {
    amount: plan.priceAmount,
    yearlyAmount: plan.yearlyPriceAmount,
    currency: plan.priceCurrency,
    billingPeriod: plan.billingPeriod,
  },
  limits: {
    staff: plan.staffLimit,
    roles: plan.roleLimit,
    permissions: plan.permissionLimit,
    brands: plan.brandLimit,
    categories: plan.categoryLimit,
    vehicles: plan.vehicleLimit,
    appointments: plan.appointmentLimit,
    products: plan.productLimit,
    rfqs: plan.rfqLimit,
    orders: plan.orderLimit,
    services: plan.serviceLimit,
    savedSearches: plan.savedSearchLimit,
    wishlist: plan.wishlistLimit,
    integrations: plan.integrationLimit,
  },
  support: {
    help: plan.helpSupport,
    onboarding: plan.onboarding,
    training: plan.training,
    accountAssistance: plan.accountAssistance,
    priority: plan.prioritySupport,
  },
  notifications: {
    email: plan.emailNotifications,
    whatsapp: plan.whatsappNotifications,
  },
  reports: {
    dashboard: plan.dashboardReports,
    usage: plan.usageReports,
    activity: plan.activityReports,
  },
  marketplace: {
    featuredVendor: plan.featuredVendor,
    searchBoostLevel: plan.searchBoostLevel,
  },
  apiAccessLevel: plan.apiAccessLevel,
  approvalWorkflowEnabled: plan.approvalWorkflowEnabled,
  customRolesEnabled: plan.customRolesEnabled,
  enabledFeatures: plan.enabledFeatures,
  enabledMenus: plan.enabledMenus,
  isActive: plan.isActive,
  businessAccountCount: plan._count.businessAccounts,
  createdAt: plan.createdAt.toISOString(),
  updatedAt: plan.updatedAt.toISOString(),
})

const mapSessions = (
  sessions: BusinessAccountFull["owner"]["sessions"],
) =>
  sessions.map((session) => ({
    id: session.id,
    deviceName: session.deviceName,
    deviceMacAddress: session.deviceMacAddress,
    deviceIdentifier: session.deviceIdentifier,
    userAgent: session.userAgent,
    ipHash: session.ipHash,
    createdAt: session.createdAt.toISOString(),
    lastUsedAt: toIso(session.lastUsedAt),
    expiresAt: session.expiresAt.toISOString(),
    revokedAt: toIso(session.revokedAt),
  }))

const mapAccount = (account: BusinessAccountFull) => ({
  id: account.id,
  publicId: account.publicId,
  type: account.type,
  name: account.name,
  isActive: account.isActive,
  plan: mapPlan({ ...account.plan, _count: { businessAccounts: 0 } }),
  owner: {
    id: account.owner.id,
    publicId: account.owner.publicId,
    name: fullName(account.owner),
    email: account.owner.email,
    phone: account.owner.phone,
    sessions: mapSessions(account.owner.sessions),
  },
  members: account.members.map((member) => ({
    id: member.id,
    userId: member.userId,
    roleIds: member.roleIds,
    status: member.status,
    joinedAt: toIso(member.joinedAt),
    createdAt: member.createdAt.toISOString(),
    user: {
      id: member.user.id,
      publicId: member.user.publicId,
      name: fullName(member.user),
      email: member.user.email,
      phone: member.user.phone,
      sessions: mapSessions(member.user.sessions),
    },
  })),
  roles: account.roles.map((role) => ({
    id: role.id,
    name: role.name,
    description: role.description,
    permissionIds: role.permissionIds,
    isOwnerRole: role.isOwnerRole,
  })),
  permissions: account.permissions.map((permission) => ({
    id: permission.id,
    code: permission.code,
    name: permission.name,
    description: permission.description,
    menuKey: permission.menuKey,
    featureKey: permission.featureKey,
    actionKey: permission.actionKey,
    isSystem: permission.isSystem,
  })),
  invitations: account.invitations.map((invitation) => ({
    id: invitation.id,
    email: invitation.email,
    roleIds: invitation.roleIds,
    status: invitation.status,
    expiresAt: invitation.expiresAt.toISOString(),
    acceptedAt: toIso(invitation.acceptedAt),
    createdAt: invitation.createdAt.toISOString(),
  })),
  counts: account._count,
  createdAt: account.createdAt.toISOString(),
  updatedAt: account.updatedAt.toISOString(),
})

const assertBusinessAccountReader = async (input: {
  userId: string
  businessAccountId: unknown
}) => {
  const businessAccountId = cleanText(input.businessAccountId, 80)
  if (!businessAccountId) throw new Error("Business account id is required")

  const account = await db.businessAccount.findFirst({
    where: {
      id: businessAccountId,
      isActive: true,
      OR: [
        { ownerUserId: input.userId },
        {
          members: {
            some: {
              userId: input.userId,
              status: BusinessMemberStatus.Active,
            },
          },
        },
      ],
    },
    include: {
      ...accountInclude,
    },
  })

  if (!account) {
    throw new Error("Business account was not found")
  }

  return {
    ...account,
    isOwner: account.ownerUserId === input.userId,
  }
}

export async function logBusinessActivity(input: {
  businessAccountId?: string | null
  actorUserId?: string | null
  action: string
  entityType?: string | null
  entityId?: string | null
  metadata?: Prisma.InputJsonValue
}) {
  await db.businessActivityLog.create({
    data: {
      businessAccountId: input.businessAccountId ?? null,
      actorUserId: input.actorUserId ?? null,
      action: input.action,
      entityType: input.entityType ?? null,
      entityId: input.entityId ?? null,
      metadata: input.metadata ?? undefined,
    },
  })
}

export async function ensureDefaultBusinessPlans() {
  await Promise.all(
    defaultPlanSeeds.map((plan) =>
      db.businessPlan.upsert({
        where: {
          accountType_code: {
            accountType: plan.accountType,
            code: plan.code,
          },
        },
        update: defaultPlanUpdateData(plan),
        create: plan,
      }),
    ),
  )
}

export async function ensureFreeBusinessAccountsForExistingUsers() {
  await ensureDefaultBusinessPlans()
  const users = await db.user.findMany({
    where: {
      isActive: true,
      OR: [
        { roles: { has: UserRole.Fleet } },
        { roles: { has: UserRole.Garage } },
        { roles: { has: UserRole.Supplier } },
      ],
    },
    select: {
      id: true,
      roles: true,
      companyName: true,
      firstName: true,
      lastName: true,
      email: true,
    },
  })

  for (const user of users) {
    const name =
      user.companyName ||
      [user.firstName, user.lastName].filter(Boolean).join(" ") ||
      user.email
    for (const role of user.roles) {
      if (businessRoles.has(role)) {
        await ensureBusinessAccountForOwner({
          userId: user.id,
          role,
          name,
          planCode: BusinessPlanCode.Free,
        })
      }
    }
  }
}

export async function listBusinessPlans() {
  await ensureDefaultBusinessPlans()
  const plans = await db.businessPlan.findMany({
    include: planInclude,
    orderBy: [{ accountType: "asc" }, { code: "asc" }],
  })
  return plans.map(mapPlan)
}

export async function updateBusinessPlan(
  idOrCode: string,
  input: Record<string, unknown>,
) {
  await ensureDefaultBusinessPlans()
  const where = { id: idOrCode }

  const data: Prisma.BusinessPlanUpdateInput = {}
  const name = cleanText(input.name)
  if (name) data.name = name
  if (input.description !== undefined) data.description = cleanText(input.description, 500)
  if (Number.isInteger(input.priceAmount) && Number(input.priceAmount) >= 0) {
    data.priceAmount = Number(input.priceAmount)
  }
  if (Number.isInteger(input.yearlyPriceAmount) && Number(input.yearlyPriceAmount) >= 0) {
    data.yearlyPriceAmount = Number(input.yearlyPriceAmount)
  }
  const priceCurrency = cleanText(input.priceCurrency, 10)
  if (priceCurrency) data.priceCurrency = priceCurrency.toUpperCase()
  const billingPeriod = cleanText(input.billingPeriod, 30)
  if (billingPeriod) data.billingPeriod = billingPeriod

  for (const [inputKey, modelKey] of [
    ["staffLimit", "staffLimit"],
    ["roleLimit", "roleLimit"],
    ["permissionLimit", "permissionLimit"],
    ["brandLimit", "brandLimit"],
    ["categoryLimit", "categoryLimit"],
    ["vehicleLimit", "vehicleLimit"],
    ["appointmentLimit", "appointmentLimit"],
    ["productLimit", "productLimit"],
    ["rfqLimit", "rfqLimit"],
    ["orderLimit", "orderLimit"],
    ["serviceLimit", "serviceLimit"],
    ["savedSearchLimit", "savedSearchLimit"],
    ["wishlistLimit", "wishlistLimit"],
    ["integrationLimit", "integrationLimit"],
  ] as const) {
    if (input[inputKey] === null) data[modelKey] = null
    if (Number.isInteger(input[inputKey]) && Number(input[inputKey]) >= 0) {
      data[modelKey] = Number(input[inputKey])
    }
  }
  if (Number.isInteger(input.searchBoostLevel) && Number(input.searchBoostLevel) >= 0) {
    data.searchBoostLevel = Number(input.searchBoostLevel)
  }

  for (const key of [
    "dashboardReports",
    "usageReports",
    "activityReports",
    "helpSupport",
    "onboarding",
    "training",
    "accountAssistance",
    "prioritySupport",
    "emailNotifications",
    "whatsappNotifications",
    "featuredVendor",
    "approvalWorkflowEnabled",
    "customRolesEnabled",
    "isActive",
  ] as const) {
    if (typeof input[key] === "boolean") data[key] = input[key]
  }

  const apiAccessLevel = cleanText(input.apiAccessLevel, 30)
  if (apiAccessLevel) data.apiAccessLevel = apiAccessLevel.toLowerCase()

  if (input.enabledFeatures !== undefined) data.enabledFeatures = cleanTextArray(input.enabledFeatures)
  if (input.enabledMenus !== undefined) data.enabledMenus = cleanTextArray(input.enabledMenus)

  const plan = await db.businessPlan.update({
    where,
    data,
    include: planInclude,
  })
  await logBusinessActivity({
    action: "business_plan.updated",
    entityType: "business_plan",
    entityId: plan.id,
    metadata: { plan: plan.name, code: plan.code, accountType: plan.accountType },
  })
  return mapPlan(plan)
}

const usageForAccount = async (account: {
  id: string
  type: BusinessAccountType
  ownerUserId: string
}) => {
  const monthStart = new Date()
  monthStart.setUTCDate(1)
  monthStart.setUTCHours(0, 0, 0, 0)
  const [
    staff,
    roles,
    permissions,
    vehicles,
    appointments,
    products,
    brands,
    categories,
    rfqs,
    orders,
    services,
    savedSearches,
    wishlistItems,
  ] = await Promise.all([
    db.businessAccountMember.count({
      where: { businessAccountId: account.id, status: BusinessMemberStatus.Active },
    }),
    db.businessRole.count({ where: { businessAccountId: account.id } }),
    db.businessPermission.count({ where: { businessAccountId: account.id } }),
    account.type === BusinessAccountType.Fleet
      ? db.fleetVehicle.count({ where: { fleetId: account.ownerUserId } })
      : Promise.resolve(0),
    account.type === BusinessAccountType.Garage
      ? db.garageBooking.count({ where: { garageId: account.ownerUserId, createdAt: { gte: monthStart } } })
      : Promise.resolve(0),
    account.type === BusinessAccountType.Supplier
      ? db.supplierPart.count({ where: { supplierId: account.ownerUserId } })
      : Promise.resolve(0),
    account.type === BusinessAccountType.Supplier
      ? db.supplierPart.findMany({
          where: { supplierId: account.ownerUserId, originalBrand: { not: null } },
          select: { originalBrand: true },
          distinct: ["originalBrand"],
        }).then((rows) => rows.length)
      : Promise.resolve(0),
    account.type === BusinessAccountType.Supplier
      ? db.supplierPart.findMany({
          where: { supplierId: account.ownerUserId, category: { not: null } },
          select: { category: true },
          distinct: ["category"],
        }).then((rows) => rows.length)
      : Promise.resolve(0),
    account.type === BusinessAccountType.Fleet
      ? db.rfq.count({ where: { requesterId: account.ownerUserId, source: RfqSource.fleet, status: { not: RfqStatus.cancelled } } })
      : account.type === BusinessAccountType.Supplier
        ? db.rfqBid.count({ where: { supplierId: account.ownerUserId, status: { not: RfqBidStatus.withdrawn } } })
        : Promise.resolve(0),
    account.type === BusinessAccountType.Fleet
      ? db.order.count({ where: { buyerId: account.ownerUserId, status: { not: OrderStatus.cancelled } } })
      : account.type === BusinessAccountType.Supplier
        ? db.order.count({ where: { supplierId: account.ownerUserId, status: { not: OrderStatus.cancelled } } })
        : Promise.resolve(0),
    account.type === BusinessAccountType.Garage
      ? db.garageService.count({ where: { garageId: account.ownerUserId } })
      : Promise.resolve(0),
    db.businessSavedSearch.count({ where: { businessAccountId: account.id } }),
    db.businessWishlistItem.count({ where: { businessAccountId: account.id } }),
  ])
  return {
    staff,
    roles,
    permissions,
    vehicles,
    appointments,
    products,
    brands,
    categories,
    rfqs,
    orders,
    services,
    savedSearches,
    wishlistItems,
  }
}

type BusinessUsage = Awaited<ReturnType<typeof usageForAccount>>

const limitsForPlan = (plan: {
  staffLimit: number | null
  roleLimit: number | null
  permissionLimit: number | null
  brandLimit: number | null
  categoryLimit: number | null
  vehicleLimit: number | null
  appointmentLimit: number | null
  productLimit: number | null
  rfqLimit: number | null
  orderLimit: number | null
  serviceLimit: number | null
  savedSearchLimit: number | null
  wishlistLimit: number | null
  integrationLimit: number | null
}) => ({
  staff: plan.staffLimit,
  roles: plan.roleLimit,
  permissions: plan.permissionLimit,
  brands: plan.brandLimit,
  categories: plan.categoryLimit,
  vehicles: plan.vehicleLimit,
  appointments: plan.appointmentLimit,
  products: plan.productLimit,
  rfqs: plan.rfqLimit,
  orders: plan.orderLimit,
  services: plan.serviceLimit,
  savedSearches: plan.savedSearchLimit,
  wishlist: plan.wishlistLimit,
  integrations: plan.integrationLimit,
})

type BusinessLimits = ReturnType<typeof limitsForPlan>
type BusinessUsageCounts = ReturnType<typeof usageWithZeroes>
type BusinessActionRule = {
  feature?: string
  metric?: keyof BusinessUsageCounts
  limit?: keyof BusinessLimits
  flag?: "customRolesEnabled" | "approvalWorkflowEnabled"
}

const usageWithZeroes = (usage: BusinessUsage) => ({
  staff: usage.staff,
  roles: usage.roles,
  permissions: usage.permissions,
  brands: usage.brands,
  categories: usage.categories,
  vehicles: usage.vehicles,
  appointments: usage.appointments,
  products: usage.products,
  rfqs: usage.rfqs,
  orders: usage.orders,
  services: usage.services,
  savedSearches: usage.savedSearches,
  wishlist: usage.wishlistItems,
  integrations: 0,
})

const hasCapacity = (used: number, limit: number | null | undefined) =>
  limit === null || limit === undefined || used < limit

export const businessEntitlementActionRules = {
  Fleet: {
    "staff.invite": { feature: "staff.manage", metric: "staff", limit: "staff" },
    "roles.create": { feature: "roles.manage", metric: "roles", limit: "roles", flag: "customRolesEnabled" },
    "vehicles.create": { feature: "fleet.vehicles.manage", metric: "vehicles", limit: "vehicles" },
    "rfqs.create": { feature: "fleet.rfqs.create", metric: "rfqs", limit: "rfqs" },
    "orders.create": { feature: "fleet.orders.create", metric: "orders", limit: "orders" },
    "saved-searches.create": { feature: "business.saved-searches.create", metric: "savedSearches", limit: "savedSearches" },
    "wishlist.create": { feature: "business.wishlist.create", metric: "wishlist", limit: "wishlist" },
    "integrations.connect": { feature: "integrations.manage", metric: "integrations", limit: "integrations" },
    "api.access": { feature: "api.standard" },
    "approval-workflows.create": { feature: "approval-workflows.manage", flag: "approvalWorkflowEnabled" },
  },
  Garage: {
    "staff.invite": { feature: "staff.manage", metric: "staff", limit: "staff" },
    "roles.create": { feature: "roles.manage", metric: "roles", limit: "roles", flag: "customRolesEnabled" },
    "appointments.create": { feature: "garage.bookings.manage", metric: "appointments", limit: "appointments" },
    "bookings.create": { feature: "garage.bookings.manage", metric: "appointments", limit: "appointments" },
    "schedule.manage": { feature: "garage.schedule.manage" },
    "services.create": { feature: "garage.services.manage", metric: "services", limit: "services" },
    "services.update": { feature: "garage.services.manage" },
    "services.delete": { feature: "garage.services.manage" },
    "reports.view": { feature: "reports.dashboard" },
    "reports.usage": { feature: "reports.usage" },
    "reports.activity": { feature: "reports.activity" },
    "saved-searches.create": { feature: "business.saved-searches.create", metric: "savedSearches", limit: "savedSearches" },
    "integrations.connect": { feature: "integrations.manage", metric: "integrations", limit: "integrations" },
    "api.access": { feature: "api.standard" },
    "approval-workflows.create": { feature: "approval-workflows.manage", flag: "approvalWorkflowEnabled" },
  },
  Supplier: {
    "staff.invite": { feature: "staff.manage", metric: "staff", limit: "staff" },
    "roles.create": { feature: "roles.manage", metric: "roles", limit: "roles", flag: "customRolesEnabled" },
    "products.create": { feature: "supplier.inventory.manage", metric: "products", limit: "products" },
    "rfqs.quote": { feature: "supplier.rfqs.quote", metric: "rfqs", limit: "rfqs" },
    "saved-searches.create": { feature: "business.saved-searches.create", metric: "savedSearches", limit: "savedSearches" },
    "wishlist.create": { feature: "business.wishlist.create", metric: "wishlist", limit: "wishlist" },
    "integrations.connect": { feature: "integrations.manage", metric: "integrations", limit: "integrations" },
    "api.access": { feature: "api.standard" },
    "approval-workflows.create": { feature: "approval-workflows.manage", flag: "approvalWorkflowEnabled" },
  },
} satisfies Record<
  BusinessAccountType,
  Record<
    string,
    {
      feature?: string
      metric?: keyof ReturnType<typeof usageWithZeroes>
      limit?: keyof BusinessLimits
      flag?: "customRolesEnabled" | "approvalWorkflowEnabled"
    }
  >
>

const featureSetForPlan = (plan: {
  enabledFeatures: string[]
  dashboardReports: boolean
  usageReports: boolean
  activityReports: boolean
  prioritySupport: boolean
  customRolesEnabled: boolean
  savedSearchLimit: number | null
  wishlistLimit: number | null
  integrationLimit: number | null
  apiAccessLevel: string
  approvalWorkflowEnabled: boolean
  featuredVendor: boolean
  searchBoostLevel: number
}) => {
  const features = new Set(plan.enabledFeatures)
  if (plan.dashboardReports) features.add("reports.dashboard")
  if (plan.usageReports) features.add("reports.usage")
  if (plan.activityReports) features.add("reports.activity")
  if (plan.prioritySupport) features.add("support.priority")
  if (plan.savedSearchLimit === null || plan.savedSearchLimit > 0) features.add("business.saved-searches.create")
  if (plan.wishlistLimit === null || plan.wishlistLimit > 0) features.add("business.wishlist.create")
  if (plan.integrationLimit === null || plan.integrationLimit > 0) features.add("integrations.manage")
  if (plan.apiAccessLevel === "standard" || plan.apiAccessLevel === "enterprise") features.add("api.standard")
  if (plan.apiAccessLevel === "enterprise") features.add("api.enterprise")
  if (plan.approvalWorkflowEnabled) features.add("approval-workflows.manage")
  if (plan.customRolesEnabled) {
    features.add("roles.manage")
    features.add("permissions.manage")
  }
  if (plan.featuredVendor) features.add("marketplace.featured-vendor")
  if (plan.searchBoostLevel > 0) features.add("marketplace.search-boost")
  return features
}

const allowedActionFor = (
  action: string,
  account: {
    type: BusinessAccountType
    plan: {
      enabledFeatures: string[]
      dashboardReports: boolean
      usageReports: boolean
      activityReports: boolean
      prioritySupport: boolean
      customRolesEnabled: boolean
      savedSearchLimit: number | null
      wishlistLimit: number | null
      approvalWorkflowEnabled: boolean
      integrationLimit: number | null
      apiAccessLevel: string
      featuredVendor: boolean
      searchBoostLevel: number
    }
  },
  usage: ReturnType<typeof usageWithZeroes>,
  limits: BusinessLimits,
) => {
  const rules = businessEntitlementActionRules[account.type] as Record<string, BusinessActionRule>
  const rule = rules[action]
  if (!rule) return { allowed: false, reason: "Unknown action" }
  const features = featureSetForPlan(account.plan)
  if (rule.feature && !features.has(rule.feature)) {
    return { allowed: false, reason: `${rule.feature} is not enabled for this plan` }
  }
  if (rule.flag && !account.plan[rule.flag]) {
    return { allowed: false, reason: `${rule.flag} is not enabled for this plan` }
  }
  if (rule.metric && rule.limit && !hasCapacity(usage[rule.metric], limits[rule.limit])) {
    return { allowed: false, reason: `${rule.metric} limit reached` }
  }
  return { allowed: true, reason: null }
}

const buildEntitlementPayload = (
  account: BusinessAccountFull | Prisma.BusinessAccountGetPayload<{
    include: { plan: true; roles: true; permissions: true }
  }>,
  usage: BusinessUsage,
) => {
  const limits = limitsForPlan(account.plan)
  const usageCounts = usageWithZeroes(usage)
  const enabledFeatures = Array.from(featureSetForPlan(account.plan)).sort()
  const knownFeatures = businessEntitlementFeatures[account.type]
  const requestableLabels = businessRequestableFeatureLabels as Record<string, string>
  const lockedFeatures = knownFeatures
    .filter((feature) => !enabledFeatures.includes(feature))
    .map((feature) => ({
      key: feature,
      label: requestableLabels[feature] ?? feature,
    }))
  const requestableFeatures = lockedFeatures.filter((feature) =>
    Boolean(requestableLabels[feature.key]),
  )
  const actions = Object.fromEntries(
    Object.keys(businessEntitlementActionRules[account.type]).map((action) => [
      action,
      allowedActionFor(action, account, usageCounts, limits),
    ]),
  )

  return {
    plan: mapPlan({ ...account.plan, _count: { businessAccounts: 0 } }),
    usage: usageCounts,
    limits,
    enabledMenus: account.plan.enabledMenus,
    enabledFeatures,
    lockedFeatures,
    requestableFeatures,
    addOns: requestableFeatures,
    actions,
  }
}

const assertUsageFitsPlan = (
  usage: Awaited<ReturnType<typeof usageForAccount>>,
  plan: {
    staffLimit: number | null
    roleLimit: number | null
    permissionLimit: number | null
    brandLimit: number | null
    categoryLimit: number | null
    vehicleLimit: number | null
    appointmentLimit: number | null
    productLimit: number | null
    rfqLimit: number | null
    orderLimit: number | null
    serviceLimit: number | null
    savedSearchLimit: number | null
    wishlistLimit: number | null
  },
) => {
  for (const [label, used, limit] of [
    ["staff users", usage.staff, plan.staffLimit],
    ["roles", usage.roles, plan.roleLimit],
    ["permissions", usage.permissions, plan.permissionLimit],
    ["brands", usage.brands, plan.brandLimit],
    ["categories", usage.categories, plan.categoryLimit],
    ["vehicles", usage.vehicles, plan.vehicleLimit],
    ["monthly bookings", usage.appointments, plan.appointmentLimit],
    ["products", usage.products, plan.productLimit],
    ["RFQs", usage.rfqs, plan.rfqLimit],
    ["orders", usage.orders, plan.orderLimit],
    ["services", usage.services, plan.serviceLimit],
    ["saved searches", usage.savedSearches, plan.savedSearchLimit],
    ["wishlist items", usage.wishlistItems, plan.wishlistLimit],
  ] as const) {
    if (limit !== null && used > limit) {
      throw new Error(`Cannot change plan. Current ${label} usage is ${used}, but selected plan allows ${limit}.`)
    }
  }
}

export async function changeBusinessAccountPlan(input: {
  ownerUserId: string
  businessAccountId: unknown
  planId: unknown
}) {
  const businessAccountId = cleanText(input.businessAccountId, 80)
  const planId = cleanText(input.planId, 80)
  if (!businessAccountId) throw new Error("Business account id is required")
  if (!planId) throw new Error("Plan id is required")

  const account = await db.businessAccount.findFirst({
    where: {
      id: businessAccountId,
      ownerUserId: input.ownerUserId,
      isActive: true,
    },
    include: { plan: true },
  })
  if (!account) throw new Error("Only the account owner can change this plan")

  const nextPlan = await db.businessPlan.findFirst({
    where: {
      id: planId,
      accountType: account.type,
      isActive: true,
    },
    include: planInclude,
  })
  if (!nextPlan) throw new Error("Selected plan is not available for this business")
  if (nextPlan.id === account.planId) return mapPlan(nextPlan)

  const usage = await usageForAccount(account)
  assertUsageFitsPlan(usage, nextPlan)

  await db.businessAccount.update({
    where: { id: account.id },
    data: { planId: nextPlan.id },
  })
  await logBusinessActivity({
    businessAccountId: account.id,
    actorUserId: input.ownerUserId,
    action: "business_plan.changed",
    entityType: "business_plan",
    entityId: nextPlan.id,
    metadata: {
      fromPlan: account.plan.name,
      toPlan: nextPlan.name,
      accountType: account.type,
    },
  })
  return mapPlan(nextPlan)
}

async function findUserBusinessAccount(userId: string, accountType: BusinessAccountType) {
  await ensureFreeBusinessAccountsForExistingUsers()
  return db.businessAccount.findFirst({
    where: {
      type: accountType,
      isActive: true,
      members: {
        some: {
          userId,
          status: BusinessMemberStatus.Active,
        },
      },
    },
    include: { plan: true },
  })
}

export async function assertBusinessPlanLimit(input: {
  userId: string
  accountType: BusinessAccountType
  limit:
    | "vehicleLimit"
    | "appointmentLimit"
    | "productLimit"
    | "rfqLimit"
    | "orderLimit"
    | "serviceLimit"
    | "savedSearchLimit"
    | "wishlistLimit"
  currentCount: number
}) {
  const account = await findUserBusinessAccount(input.userId, input.accountType)
  if (!account) {
    throw new Error("Business account plan is required")
  }
  const limit = account.plan[input.limit]
  if (limit !== null && input.currentCount >= limit) {
    const label = input.limit
      .replace("Limit", "")
      .replace(/([A-Z])/g, " $1")
      .toLowerCase()
    throw new Error(`${account.plan.name} ${label} limit reached. Upgrade your plan.`)
  }
  return account
}

async function findWritableBusinessAccount(userId: string, businessAccountId: unknown) {
  const id = cleanText(businessAccountId, 80)
  if (!id) throw new Error("Business account id is required")

  const account = await db.businessAccount.findFirst({
    where: {
      id,
      isActive: true,
      members: {
        some: {
          userId,
          status: BusinessMemberStatus.Active,
        },
      },
    },
    include: { plan: true },
  })
  if (!account) throw new Error("Business account was not found")
  return account
}

const asJsonObject = (value: unknown): Prisma.InputJsonObject => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {}
  return value as Prisma.InputJsonObject
}

const mapSavedSearch = (row: {
  id: string
  businessAccountId: string
  name: string
  scope: string
  query: Prisma.JsonValue
  createdByUserId: string | null
  createdAt: Date
  updatedAt: Date
}) => ({
  id: row.id,
  businessAccountId: row.businessAccountId,
  name: row.name,
  scope: row.scope,
  query: row.query,
  createdByUserId: row.createdByUserId,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
})

const mapWishlistItem = (row: {
  id: string
  businessAccountId: string
  itemType: string
  itemId: string
  title: string | null
  metadata: Prisma.JsonValue | null
  createdByUserId: string | null
  createdAt: Date
  updatedAt: Date
}) => ({
  id: row.id,
  businessAccountId: row.businessAccountId,
  itemType: row.itemType,
  itemId: row.itemId,
  title: row.title,
  metadata: row.metadata,
  createdByUserId: row.createdByUserId,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
})

export async function listBusinessSavedSearches(input: {
  userId: string
  businessAccountId: unknown
  scope?: unknown
}) {
  const account = await findWritableBusinessAccount(input.userId, input.businessAccountId)
  const scope = cleanText(input.scope, 80)
  const rows = await db.businessSavedSearch.findMany({
    where: {
      businessAccountId: account.id,
      ...(scope ? { scope } : {}),
    },
    orderBy: { createdAt: "desc" },
  })
  return rows.map(mapSavedSearch)
}

export async function createBusinessSavedSearch(input: {
  userId: string
  businessAccountId: unknown
  name: unknown
  scope: unknown
  query: unknown
}) {
  const account = await findWritableBusinessAccount(input.userId, input.businessAccountId)
  const currentCount = await db.businessSavedSearch.count({
    where: { businessAccountId: account.id },
  })
  if (account.plan.savedSearchLimit !== null && currentCount >= account.plan.savedSearchLimit) {
    throw new Error(`${account.plan.name} saved search limit reached. Upgrade your plan.`)
  }

  const name = cleanText(input.name, 120)
  if (!name) throw new Error("Saved search name is required")
  const scope = cleanText(input.scope, 80) ?? "general"

  const row = await db.businessSavedSearch.create({
    data: {
      businessAccountId: account.id,
      name,
      scope,
      query: asJsonObject(input.query),
      createdByUserId: input.userId,
    },
  })
  await logBusinessActivity({
    businessAccountId: account.id,
    actorUserId: input.userId,
    action: "business_saved_search.created",
    entityType: "business_saved_search",
    entityId: row.id,
    metadata: { scope },
  })
  return mapSavedSearch(row)
}

export async function deleteBusinessSavedSearch(input: {
  userId: string
  businessAccountId: unknown
  id: unknown
}) {
  const account = await findWritableBusinessAccount(input.userId, input.businessAccountId)
  const id = cleanText(input.id, 80)
  if (!id) throw new Error("Saved search id is required")
  await db.businessSavedSearch.deleteMany({
    where: { id, businessAccountId: account.id },
  })
  await logBusinessActivity({
    businessAccountId: account.id,
    actorUserId: input.userId,
    action: "business_saved_search.deleted",
    entityType: "business_saved_search",
    entityId: id,
  })
  return { id }
}

export async function requestBusinessAddOn(input: {
  userId: string
  businessAccountId: unknown
  featureKey: unknown
  note?: unknown
}) {
  const account = await findWritableBusinessAccount(input.userId, input.businessAccountId)
  const featureKey = cleanText(input.featureKey, 120)
  if (!featureKey) throw new Error("Feature key is required")
  const label = (businessRequestableFeatureLabels as Record<string, string>)[featureKey] ?? featureKey
  const note = cleanText(input.note, 500)

  const row = await db.businessAddOnRequest.upsert({
    where: {
      businessAccountId_featureKey: {
        businessAccountId: account.id,
        featureKey,
      },
    },
    create: {
      businessAccountId: account.id,
      featureKey,
      label,
      note,
      requestedByUserId: input.userId,
      status: BusinessAddOnRequestStatus.Requested,
    },
    update: {
      label,
      note,
      requestedByUserId: input.userId,
      status: BusinessAddOnRequestStatus.Requested,
      decidedByAdminId: null,
      decidedAt: null,
    },
  })

  await logBusinessActivity({
    businessAccountId: account.id,
    actorUserId: input.userId,
    action: "business_addon.requested",
    entityType: "business_addon",
    entityId: row.id,
    metadata: {
      featureKey,
      label,
      note,
      status: "requested",
      accountType: account.type,
      planName: account.plan.name,
    },
  })

  return {
    id: row.id,
    featureKey,
    label,
    status: row.status,
  }
}

const mapAddOnRequest = (row: Prisma.BusinessAddOnRequestGetPayload<{
  include: { businessAccount: { include: { plan: true } }; requestedBy: true; decidedBy: true }
}>) => ({
  id: row.id,
  featureKey: row.featureKey,
  label: row.label,
  note: row.note,
  status: row.status,
  requestedBy: row.requestedBy ? { id: row.requestedBy.id, name: fullName(row.requestedBy), email: row.requestedBy.email } : null,
  decidedBy: row.decidedBy ? { id: row.decidedBy.id, name: row.decidedBy.name, email: row.decidedBy.email } : null,
  decidedAt: toIso(row.decidedAt),
  businessAccount: {
    id: row.businessAccount.id,
    publicId: row.businessAccount.publicId,
    name: row.businessAccount.name,
    type: row.businessAccount.type,
    plan: mapPlan({ ...row.businessAccount.plan, _count: { businessAccounts: 0 } }),
  },
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
})

export async function listMyBusinessAddOnRequests(input: {
  userId: string
  businessAccountId: unknown
}) {
  const account = await findWritableBusinessAccount(input.userId, input.businessAccountId)
  const rows = await db.businessAddOnRequest.findMany({
    where: { businessAccountId: account.id },
    include: { businessAccount: { include: { plan: true } }, requestedBy: true, decidedBy: true },
    orderBy: { createdAt: "desc" },
  })
  return rows.map(mapAddOnRequest)
}

export async function listAdminBusinessAddOnRequests(status?: unknown) {
  const statusText = cleanText(status, 40)
  const statuses = Object.values(BusinessAddOnRequestStatus)
  const rows = await db.businessAddOnRequest.findMany({
    where: statuses.includes(statusText as BusinessAddOnRequestStatus) ? { status: statusText as BusinessAddOnRequestStatus } : {},
    include: { businessAccount: { include: { plan: true } }, requestedBy: true, decidedBy: true },
    orderBy: { createdAt: "desc" },
    take: 100,
  })
  return rows.map(mapAddOnRequest)
}

export async function updateAdminBusinessAddOnRequest(input: {
  adminId: string
  id: unknown
  status: unknown
}) {
  const id = cleanText(input.id, 80)
  if (!id) throw new Error("Add-on request id is required")
  const status = cleanText(input.status, 40) as BusinessAddOnRequestStatus | null
  if (!status || !Object.values(BusinessAddOnRequestStatus).includes(status)) {
    throw new Error("Valid add-on status is required")
  }
  const row = await db.businessAddOnRequest.update({
    where: { id },
    data: {
      status,
      decidedByAdminId: input.adminId,
      decidedAt: new Date(),
    },
    include: { businessAccount: { include: { plan: true } }, requestedBy: true, decidedBy: true },
  })
  await logBusinessActivity({
    businessAccountId: row.businessAccountId,
    action: "business_addon.status_changed",
    entityType: "business_addon",
    entityId: row.id,
    metadata: { featureKey: row.featureKey, label: row.label, status },
  })
  return mapAddOnRequest(row)
}

const ticketPriorityForPlan = (account: { plan: { prioritySupport: boolean } }) =>
  account.plan.prioritySupport ? BusinessSupportTicketPriority.Priority : BusinessSupportTicketPriority.Standard

const mapSupportTicket = (row: Prisma.BusinessSupportTicketGetPayload<{
  include: { businessAccount: { include: { plan: true } }; createdBy: true; assignedAdmin: true }
}>) => ({
  id: row.id,
  subject: row.subject,
  message: row.message,
  status: row.status,
  priority: row.priority,
  createdBy: row.createdBy ? { id: row.createdBy.id, name: fullName(row.createdBy), email: row.createdBy.email } : null,
  assignedAdmin: row.assignedAdmin ? { id: row.assignedAdmin.id, name: row.assignedAdmin.name, email: row.assignedAdmin.email } : null,
  businessAccount: {
    id: row.businessAccount.id,
    publicId: row.businessAccount.publicId,
    name: row.businessAccount.name,
    type: row.businessAccount.type,
    plan: mapPlan({ ...row.businessAccount.plan, _count: { businessAccounts: 0 } }),
  },
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
})

export async function listBusinessSupportTickets(input: {
  userId: string
  businessAccountId: unknown
}) {
  const account = await findWritableBusinessAccount(input.userId, input.businessAccountId)
  const rows = await db.businessSupportTicket.findMany({
    where: { businessAccountId: account.id },
    include: { businessAccount: { include: { plan: true } }, createdBy: true, assignedAdmin: true },
    orderBy: { createdAt: "desc" },
    take: 50,
  })
  return rows.map(mapSupportTicket)
}

export async function createBusinessSupportTicket(input: {
  userId: string
  businessAccountId: unknown
  subject: unknown
  message: unknown
}) {
  const account = await findWritableBusinessAccount(input.userId, input.businessAccountId)
  const subject = cleanText(input.subject, 160)
  const message = cleanText(input.message, 2000)
  if (!subject) throw new Error("Support subject is required")
  if (!message) throw new Error("Support message is required")

  const row = await db.businessSupportTicket.create({
    data: {
      businessAccountId: account.id,
      subject,
      message,
      priority: ticketPriorityForPlan(account),
      createdByUserId: input.userId,
    },
    include: { businessAccount: { include: { plan: true } }, createdBy: true, assignedAdmin: true },
  })
  await logBusinessActivity({
    businessAccountId: account.id,
    actorUserId: input.userId,
    action: "business_support_ticket.created",
    entityType: "business_support_ticket",
    entityId: row.id,
    metadata: { subject, priority: row.priority },
  })
  return mapSupportTicket(row)
}

export async function listAdminBusinessSupportTickets(status?: unknown) {
  const statusText = cleanText(status, 40)
  const statuses = Object.values(BusinessSupportTicketStatus)
  const rows = await db.businessSupportTicket.findMany({
    where: statuses.includes(statusText as BusinessSupportTicketStatus) ? { status: statusText as BusinessSupportTicketStatus } : {},
    include: { businessAccount: { include: { plan: true } }, createdBy: true, assignedAdmin: true },
    orderBy: { createdAt: "desc" },
    take: 100,
  })
  return rows.map(mapSupportTicket)
}

export async function updateAdminBusinessSupportTicket(input: {
  adminId: string
  id: unknown
  status: unknown
}) {
  const id = cleanText(input.id, 80)
  if (!id) throw new Error("Support ticket id is required")
  const status = cleanText(input.status, 40) as BusinessSupportTicketStatus | null
  if (!status || !Object.values(BusinessSupportTicketStatus).includes(status)) {
    throw new Error("Valid support ticket status is required")
  }
  const row = await db.businessSupportTicket.update({
    where: { id },
    data: {
      status,
      assignedAdminId: input.adminId,
    },
    include: { businessAccount: { include: { plan: true } }, createdBy: true, assignedAdmin: true },
  })
  await logBusinessActivity({
    businessAccountId: row.businessAccountId,
    action: "business_support_ticket.status_changed",
    entityType: "business_support_ticket",
    entityId: row.id,
    metadata: { subject: row.subject, status },
  })
  return mapSupportTicket(row)
}

const mapActivityLog = (row: Prisma.BusinessActivityLogGetPayload<{
  include: { actorUser: true; businessAccount: true }
}>) => ({
  id: row.id,
  action: row.action,
  entityType: row.entityType,
  entityId: row.entityId,
  metadata: row.metadata,
  actor: row.actorUser ? { id: row.actorUser.id, name: fullName(row.actorUser), email: row.actorUser.email } : null,
  businessAccount: row.businessAccount ? { id: row.businessAccount.id, publicId: row.businessAccount.publicId, name: row.businessAccount.name, type: row.businessAccount.type } : null,
  createdAt: row.createdAt.toISOString(),
})

export async function listBusinessAuditLogs(input: {
  userId: string
  businessAccountId: unknown
}) {
  const account = await findWritableBusinessAccount(input.userId, input.businessAccountId)
  const rows = await db.businessActivityLog.findMany({
    where: { businessAccountId: account.id },
    include: { actorUser: true, businessAccount: true },
    orderBy: { createdAt: "desc" },
    take: 100,
  })
  return rows.map(mapActivityLog)
}

export async function businessAuditLogsCsv(input: {
  userId: string
  businessAccountId: unknown
}) {
  const rows = await listBusinessAuditLogs(input)
  const escapeCsv = (value: unknown) => `"${String(value ?? "").replace(/"/g, '""')}"`
  return [
    ["Created At", "Action", "Entity Type", "Entity ID", "Actor", "Actor Email", "Metadata"].map(escapeCsv).join(","),
    ...rows.map((row) => [
      row.createdAt,
      row.action,
      row.entityType,
      row.entityId,
      row.actor?.name,
      row.actor?.email,
      JSON.stringify(row.metadata ?? {}),
    ].map(escapeCsv).join(",")),
  ].join("\n")
}

export async function listBusinessWishlistItems(input: {
  userId: string
  businessAccountId: unknown
  itemType?: unknown
}) {
  const account = await findWritableBusinessAccount(input.userId, input.businessAccountId)
  const itemType = cleanText(input.itemType, 80)
  const rows = await db.businessWishlistItem.findMany({
    where: {
      businessAccountId: account.id,
      ...(itemType ? { itemType } : {}),
    },
    orderBy: { createdAt: "desc" },
  })
  return rows.map(mapWishlistItem)
}

export async function createBusinessWishlistItem(input: {
  userId: string
  businessAccountId: unknown
  itemType: unknown
  itemId: unknown
  title?: unknown
  metadata?: unknown
}) {
  const account = await findWritableBusinessAccount(input.userId, input.businessAccountId)
  const itemType = cleanText(input.itemType, 80)
  const itemId = cleanText(input.itemId, 160)
  if (!itemType) throw new Error("Wishlist item type is required")
  if (!itemId) throw new Error("Wishlist item id is required")

  const existing = await db.businessWishlistItem.findUnique({
    where: {
      businessAccountId_itemType_itemId: {
        businessAccountId: account.id,
        itemType,
        itemId,
      },
    },
  })
  if (existing) return mapWishlistItem(existing)

  const currentCount = await db.businessWishlistItem.count({
    where: { businessAccountId: account.id },
  })
  if (account.plan.wishlistLimit !== null && currentCount >= account.plan.wishlistLimit) {
    throw new Error(`${account.plan.name} wishlist limit reached. Upgrade your plan.`)
  }

  const row = await db.businessWishlistItem.create({
    data: {
      businessAccountId: account.id,
      itemType,
      itemId,
      title: cleanText(input.title, 200),
      metadata: input.metadata === undefined ? undefined : asJsonObject(input.metadata),
      createdByUserId: input.userId,
    },
  })
  await logBusinessActivity({
    businessAccountId: account.id,
    actorUserId: input.userId,
    action: "business_wishlist_item.created",
    entityType: "business_wishlist_item",
    entityId: row.id,
    metadata: { itemType, itemId },
  })
  return mapWishlistItem(row)
}

export async function deleteBusinessWishlistItem(input: {
  userId: string
  businessAccountId: unknown
  id: unknown
}) {
  const account = await findWritableBusinessAccount(input.userId, input.businessAccountId)
  const id = cleanText(input.id, 80)
  if (!id) throw new Error("Wishlist item id is required")
  await db.businessWishlistItem.deleteMany({
    where: { id, businessAccountId: account.id },
  })
  await logBusinessActivity({
    businessAccountId: account.id,
    actorUserId: input.userId,
    action: "business_wishlist_item.deleted",
    entityType: "business_wishlist_item",
    entityId: id,
  })
  return { id }
}

const normalizedCatalogValue = (value: unknown) =>
  cleanText(value, 120)?.toLowerCase() ?? null

export async function assertSupplierCatalogPlanLimits(input: {
  userId: string
  brands?: unknown[]
  categories?: unknown[]
}) {
  const account = await findUserBusinessAccount(input.userId, BusinessAccountType.Supplier)
  if (!account) {
    throw new Error("Business account plan is required")
  }

  const [existingBrands, existingCategories] = await Promise.all([
    db.supplierPart.findMany({
      where: { supplierId: input.userId, originalBrand: { not: null } },
      select: { originalBrand: true },
      distinct: ["originalBrand"],
    }),
    db.supplierPart.findMany({
      where: { supplierId: input.userId, category: { not: null } },
      select: { category: true },
      distinct: ["category"],
    }),
  ])

  const brandValues = new Set(
    existingBrands
      .map((row) => normalizedCatalogValue(row.originalBrand))
      .filter((value): value is string => Boolean(value)),
  )
  const categoryValues = new Set(
    existingCategories
      .map((row) => normalizedCatalogValue(row.category))
      .filter((value): value is string => Boolean(value)),
  )

  for (const brand of input.brands ?? []) {
    const normalized = normalizedCatalogValue(brand)
    if (normalized) brandValues.add(normalized)
  }
  for (const category of input.categories ?? []) {
    const normalized = normalizedCatalogValue(category)
    if (normalized) categoryValues.add(normalized)
  }

  if (account.plan.brandLimit !== null && brandValues.size > account.plan.brandLimit) {
    throw new Error(`${account.plan.name} brand limit reached. Upgrade your plan.`)
  }
  if (account.plan.categoryLimit !== null && categoryValues.size > account.plan.categoryLimit) {
    throw new Error(`${account.plan.name} category limit reached. Upgrade your plan.`)
  }

  return account
}

export async function listBusinessAccounts() {
  await ensureFreeBusinessAccountsForExistingUsers()
  const accounts = await db.businessAccount.findMany({
    include: accountInclude,
    orderBy: { createdAt: "desc" },
  })
  return accounts.map(mapAccount)
}

export async function getBusinessAccount(id: string) {
  await ensureDefaultBusinessPlans()
  const account = await db.businessAccount.findUnique({
    where: { id },
    include: accountInclude,
  })
  return account ? mapAccount(account) : null
}

export async function ensureBusinessAccountForOwner(input: {
  userId: string
  role: UserRole
  name: string | null
  planCode?: BusinessPlanCode
}) {
  if (!businessRoles.has(input.role)) return null

  const type = input.role as BusinessAccountType
  const planCode = input.planCode ?? BusinessPlanCode.Free
  const name = cleanText(input.name) ?? `${type} account`

  return db.$transaction(async (tx) => {
    const plan = await tx.businessPlan.findUnique({
      where: { accountType_code: { accountType: type, code: planCode } },
    })
    if (!plan) throw new Error(`${planCode} plan is not configured`)

    const existing = await tx.businessAccount.findUnique({
      where: { ownerUserId_type: { ownerUserId: input.userId, type } },
      include: { roles: true, permissions: true },
    })
    if (existing) return existing

    const account = await tx.businessAccount.create({
      data: {
        type,
        name,
        ownerUserId: input.userId,
        planId: plan.id,
      },
    })

    const templates = defaultPermissionTemplates[type]
    const permissions = await Promise.all(
      templates.map((permission) =>
        tx.businessPermission.create({
          data: {
            businessAccountId: account.id,
            code: permission.code,
            name: permission.name,
            menuKey: permission.menuKey,
            featureKey: permission.featureKey,
            actionKey: permission.actionKey,
            isSystem: true,
          },
        }),
      ),
    )
    const ownerRole = await tx.businessRole.create({
      data: {
        businessAccountId: account.id,
        name: "Owner",
        description: "Full business account access",
        permissionIds: permissions.map((permission) => permission.id),
        isOwnerRole: true,
      },
    })
    await tx.businessAccountMember.create({
      data: {
        businessAccountId: account.id,
        userId: input.userId,
        roleIds: [ownerRole.id],
        status: BusinessMemberStatus.Active,
        joinedAt: new Date(),
      },
    })

    return account
  })
}

export async function getMyBusinessAccess(userId: string) {
  const memberships = await db.businessAccountMember.findMany({
    where: { userId, status: BusinessMemberStatus.Active },
    include: {
      businessAccount: {
        include: {
          plan: true,
          roles: true,
          permissions: true,
        },
      },
    },
    orderBy: { createdAt: "asc" },
  })

  return Promise.all(memberships.map(async (membership) => {
    const roleIds = new Set(membership.roleIds)
    const roles = membership.businessAccount.roles.filter((role) => roleIds.has(role.id))
    const permissionIds = new Set(roles.flatMap((role) => role.permissionIds))
    const permissions = membership.businessAccount.permissions.filter((permission) =>
      permissionIds.has(permission.id),
    )
    const account = membership.businessAccount
    const isOwner = account.ownerUserId === userId
    const usage = await usageForAccount(account)
    const entitlements = buildEntitlementPayload(account, usage)
    const permissionCodes = new Set(permissions.map((permission) => permission.code))
    const permissionFeatures = new Set(permissions.map((permission) => permission.featureKey).filter(Boolean))
    const roleMenuKeys = permissions.map((permission) => permission.menuKey).filter(Boolean)
    const actionRules = businessEntitlementActionRules[account.type] as Record<
      string,
      BusinessActionRule
    >
    const actions = isOwner
      ? entitlements.actions
      : Object.fromEntries(
          Object.entries(entitlements.actions).map(([action, result]) => {
            const rule = actionRules[action]
            const hasPermission =
              !rule?.feature ||
              permissionCodes.has(rule.feature) ||
              permissionFeatures.has(rule.feature)
            return [
              action,
              hasPermission
                ? result
                : {
                    allowed: false,
                    reason: "You do not have permission for this action",
                  },
            ]
          }),
        )

    return {
      businessAccount: {
        id: account.id,
        publicId: account.publicId,
        type: account.type,
        name: account.name,
        ownerUserId: account.ownerUserId,
        isOwner,
        plan: entitlements.plan,
        usage: entitlements.usage,
        limits: entitlements.limits,
      },
      member: {
        id: membership.id,
        status: membership.status,
        roleIds: membership.roleIds,
      },
      roles: roles.map((role) => ({
        id: role.id,
        name: role.name,
        description: role.description,
        permissionIds: role.permissionIds,
        isOwnerRole: role.isOwnerRole,
      })),
      permissions: permissions.map((permission) => ({
        id: permission.id,
        code: permission.code,
        name: permission.name,
        menuKey: permission.menuKey,
        featureKey: permission.featureKey,
        actionKey: permission.actionKey,
      })),
      visibleMenus: Array.from(
        new Set(isOwner ? [...entitlements.enabledMenus, ...roleMenuKeys] : roleMenuKeys),
      ),
      enabledFeatures: entitlements.enabledFeatures,
      lockedFeatures: entitlements.lockedFeatures,
      requestableFeatures: entitlements.requestableFeatures,
      addOns: entitlements.addOns,
      actions,
      entitlements,
    }
  }))
}

export async function listBusinessUsage(userId: string) {
  const access = await getMyBusinessAccess(userId)
  return access.map((item) => ({
    businessAccountId: item.businessAccount.id,
    publicId: item.businessAccount.publicId,
    type: item.businessAccount.type,
    name: item.businessAccount.name,
    plan: item.businessAccount.plan,
    usage: item.entitlements.usage,
    limits: item.entitlements.limits,
  }))
}

export async function listBusinessEntitlements(userId: string, action?: unknown) {
  const actionKey = cleanText(action, 120)
  const access = await getMyBusinessAccess(userId)
  return access.map((item) => ({
    businessAccountId: item.businessAccount.id,
    publicId: item.businessAccount.publicId,
    type: item.businessAccount.type,
    name: item.businessAccount.name,
    isOwner: item.businessAccount.isOwner,
    entitlements: item.entitlements,
    ...(actionKey
      ? {
          action: {
            key: actionKey,
            ...(item.entitlements.actions[actionKey] ?? {
              allowed: false,
              reason: "Unknown action",
            }),
          },
        }
      : {}),
  }))
}

export async function createBusinessRole(input: {
  ownerUserId: string
  businessAccountId: string
  name: unknown
  description: unknown
  permissionIds: unknown
}) {
  const account = await assertBusinessAccountOwnership(input)
  if (!account.plan.customRolesEnabled) {
    throw new Error("Custom roles are not enabled for this plan")
  }
  if (account.plan.roleLimit !== null && account.roles.length >= account.plan.roleLimit) {
    throw new Error("Role limit reached for this plan")
  }

  const name = cleanText(input.name)
  if (!name) throw new Error("Role name is required")
  const duplicateRole = account.roles.find(
    (role) => role.name.trim().toLowerCase() === name.toLowerCase(),
  )
  if (duplicateRole) {
    throw new Error("A role with this name already exists")
  }
  const validPermissionIds = new Set(account.permissions.map((permission) => permission.id))
  const permissionIds = cleanTextArray(input.permissionIds).filter((id) => validPermissionIds.has(id))
  if (
    account.plan.permissionLimit !== null &&
    permissionIds.length > account.plan.permissionLimit
  ) {
    throw new Error("Permission limit reached for this plan")
  }

  const role = await db.businessRole.create({
    data: {
      businessAccountId: account.id,
      name,
      description: cleanText(input.description, 500),
      permissionIds,
    },
  })
  await logBusinessActivity({
    businessAccountId: account.id,
    actorUserId: input.ownerUserId,
    action: "business_role.created",
    entityType: "business_role",
    entityId: role.id,
    metadata: {
      name: role.name,
      permissionCount: role.permissionIds.length,
      permissionIds: role.permissionIds,
    },
  })

  return role
}

export async function inviteBusinessStaff(input: {
  ownerUserId: string
  businessAccountId: string
  firstName?: unknown
  lastName?: unknown
  email: unknown
  roleIds: unknown
}) {
  const account = await assertBusinessAccountOwnership({
    ownerUserId: input.ownerUserId,
    businessAccountId: input.businessAccountId,
    includeMembers: true,
  })
  const staffCount = account.members.filter(
    (member) => member.userId !== account.ownerUserId,
  ).length
  if (account.plan.staffLimit !== null && staffCount >= account.plan.staffLimit) {
    throw new Error("Staff limit reached for this plan")
  }

  const email = cleanText(input.email, 254)?.toLowerCase()
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("Valid staff email is required")
  }
  const firstName = cleanText(input.firstName, 100)
  if (!firstName) throw new Error("Staff first name is required")
  const lastName = cleanText(input.lastName, 100)
  if (!lastName) throw new Error("Staff last name is required")
  const existingUser = await db.user.findUnique({
    where: { email },
    select: { id: true },
  })
  if (existingUser) {
    throw new Error("This email is already used by another account")
  }

  const ownerRoleIds = new Set(account.roles.filter((role) => role.isOwnerRole).map((role) => role.id))
  const submittedRoleIds = cleanTextArray(input.roleIds)
  if (submittedRoleIds.some((id) => ownerRoleIds.has(id))) {
    throw new Error("Owner role cannot be assigned to staff")
  }
  const validRoleIds = new Set(account.roles.filter((role) => !role.isOwnerRole).map((role) => role.id))
  const roleIds = submittedRoleIds.filter((id) => validRoleIds.has(id))
  if (!roleIds.length) {
    throw new Error("Select at least one role for this staff account")
  }

  const password = generateStaffPassword()
  const userRole = accountTypeToUserRole(account.type)
  let firebaseUid: string | null = null
  try {
    const firebaseUser = await getFirebaseAuth().createUser({
      email,
      password,
      displayName: `${firstName} ${lastName}`,
      emailVerified: true,
      disabled: false,
    })
    firebaseUid = firebaseUser.uid
  } catch (error) {
    const code =
      error && typeof error === "object" && "code" in error
        ? String(error.code)
        : ""
    if (code === "auth/email-already-exists") {
      throw new Error("This email is already used by another account")
    }
    throw new Error("Unable to create Firebase staff account")
  }

  try {
    const staffUser = await db.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          firebaseUid,
          email,
          passwordHash: hashPassword(password),
          firstName,
          lastName,
          roles: [userRole],
          activeRole: userRole,
          emailVerifiedAt: new Date(),
        },
      })
      await tx.businessAccountMember.create({
        data: {
          businessAccountId: account.id,
          userId: user.id,
          roleIds,
          invitedByUserId: input.ownerUserId,
          status: BusinessMemberStatus.Active,
          joinedAt: new Date(),
        },
      })
      return user
    })

    await sendSmtpMail({
      to: email,
      subject: "Your AutoParts Pro staff account is ready",
      text: [
        "Your staff account has been created on AutoParts Pro.",
        "",
        `Name: ${firstName} ${lastName}`,
        `Email: ${email}`,
        `Password: ${password}`,
        "",
        "Sign in to your dashboard and change this password after your first login.",
      ].join("\n"),
      html: `
        <p>Your staff account has been created on AutoParts Pro.</p>
        <p><strong>Name:</strong> ${firstName} ${lastName}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Password:</strong> ${password}</p>
        <p>Sign in to your dashboard and change this password after your first login.</p>
      `,
    })

    await logBusinessActivity({
      businessAccountId: account.id,
      actorUserId: input.ownerUserId,
      action: "business_staff.created",
      entityType: "business_account_member",
      entityId: staffUser.id,
      metadata: {
        email,
        firstName,
        lastName,
        roleCount: roleIds.length,
        roles: roleIds,
      },
    })

    return {
      id: staffUser.id,
      email,
      roleIds,
      status: BusinessMemberStatus.Active,
      expiresAt: new Date().toISOString(),
    }
  } catch (error) {
    if (firebaseUid) {
      await db.user.delete({ where: { firebaseUid } }).catch(() => undefined)
      await getFirebaseAuth().deleteUser(firebaseUid).catch(() => undefined)
    }
    throw error
  }
}

export async function listBusinessRoles(input: {
  ownerUserId: string
  businessAccountId: unknown
}) {
  const account = await assertBusinessAccountOwnership(input)
  return account.roles.map((role) => ({
    id: role.id,
    name: role.name,
    description: role.description,
    permissionIds: role.permissionIds,
    isOwnerRole: role.isOwnerRole,
  }))
}

export async function listBusinessPermissions(input: {
  ownerUserId: string
  businessAccountId: unknown
}) {
  const account = await assertBusinessAccountOwnership(input)
  return account.permissions.map((permission) => ({
    id: permission.id,
    code: permission.code,
    name: permission.name,
    description: permission.description,
    menuKey: permission.menuKey,
    featureKey: permission.featureKey,
    actionKey: permission.actionKey,
    isSystem: permission.isSystem,
  }))
}

export async function listBusinessMembers(input: {
  ownerUserId: string
  businessAccountId: unknown
}) {
  const account = await assertBusinessAccountReader({
    userId: input.ownerUserId,
    businessAccountId: input.businessAccountId,
  })
  const members = account.members.filter((member) => {
    if (account.isOwner) return true
    return member.status === BusinessMemberStatus.Active
  })
  const invitations = account.isOwner
    ? account.invitations
    : account.invitations.filter((invitation) => invitation.status === BusinessInvitationStatus.Pending)

  return {
    members: members.map((member) => ({
      id: member.id,
      userId: member.userId,
      roleIds: member.roleIds,
      status: member.status,
      joinedAt: toIso(member.joinedAt),
      createdAt: member.createdAt.toISOString(),
      user: {
        id: member.user.id,
        publicId: member.user.publicId,
        name: fullName(member.user),
        firstName: member.user.firstName,
        lastName: member.user.lastName,
        email: member.user.email,
        phone: member.user.phone,
        sessions: mapSessions(member.user.sessions),
      },
    })),
    invitations: invitations.map((invitation) => ({
      id: invitation.id,
      email: invitation.email,
      roleIds: invitation.roleIds,
      status: invitation.status,
      expiresAt: invitation.expiresAt.toISOString(),
      acceptedAt: toIso(invitation.acceptedAt),
      createdAt: invitation.createdAt.toISOString(),
    })),
  }
}

export async function acceptBusinessInvitation(input: {
  userId: string
  userEmail: string | null
  invitationToken: unknown
}) {
  const token = cleanText(input.invitationToken, 128)
  if (!token) throw new Error("Invitation token is required")
  if (!/^[a-f0-9]{64}$/i.test(token)) {
    throw new Error("Invalid invitation token")
  }

  const normalizedEmail = input.userEmail?.toLowerCase().trim()
  if (!normalizedEmail) {
    throw new Error("User email is required to accept the invitation")
  }

  const tokenHash = createHash("sha256").update(token).digest("hex")
  const result = await db.$transaction(async (tx) => {
    const invitation = await tx.businessInvitation.findUnique({
      where: { tokenHash },
      include: {
        businessAccount: {
          include: {
            plan: true,
            roles: {
              orderBy: { createdAt: "asc" },
            },
          },
        },
      },
    })

    if (!invitation) {
      throw new Error("Invalid invitation token")
    }

    if (invitation.businessAccount.isActive === false) {
      throw new Error("Business account is not active")
    }

    if (invitation.status !== BusinessInvitationStatus.Pending) {
      if (invitation.status === BusinessInvitationStatus.Accepted) {
        throw new Error("Invitation already accepted")
      }
      if (invitation.status === BusinessInvitationStatus.Expired) {
        throw new Error("Invitation has expired")
      }
      throw new Error("Invitation is no longer valid")
    }

    if (invitation.expiresAt < new Date()) {
      await tx.businessInvitation.update({
        where: { id: invitation.id },
        data: { status: BusinessInvitationStatus.Expired },
      })
      throw new Error("Invitation has expired")
    }

    if (invitation.email.toLowerCase() !== normalizedEmail) {
      throw new Error("This invitation was sent to a different email address")
    }

    const activeMembers = await tx.businessAccountMember.count({
      where: {
        businessAccountId: invitation.businessAccountId,
        status: {
          in: [BusinessMemberStatus.Active, BusinessMemberStatus.Invited],
        },
      },
    })

    const hasExistingSeat = !!(await tx.businessAccountMember.findUnique({
      where: {
        businessAccountId_userId: {
          businessAccountId: invitation.businessAccountId,
          userId: input.userId,
        },
      },
      select: { id: true, status: true },
    }))

    const roleIds = new Set(invitation.roleIds)
    const validRoleIds = new Set(
      invitation.businessAccount.roles
        .filter((role) => !role.isOwnerRole)
        .map((role) => role.id),
    )
    const assignedRoleIds = [...roleIds].filter((id) => validRoleIds.has(id))

    if (!hasExistingSeat && invitation.businessAccount.plan.staffLimit !== null && activeMembers >= invitation.businessAccount.plan.staffLimit) {
      throw new Error("Staff limit reached for this plan")
    }

    const member = await tx.businessAccountMember.upsert({
      where: {
        businessAccountId_userId: {
          businessAccountId: invitation.businessAccountId,
          userId: input.userId,
        },
      },
      create: {
        businessAccountId: invitation.businessAccountId,
        userId: input.userId,
        roleIds: assignedRoleIds,
        invitedByUserId: invitation.invitedByUserId,
        status: BusinessMemberStatus.Active,
        joinedAt: new Date(),
      },
      update: {
        roleIds: assignedRoleIds,
        status: BusinessMemberStatus.Active,
        joinedAt: new Date(),
      },
    })

    const acceptedInvitation = await tx.businessInvitation.update({
      where: { id: invitation.id },
      data: {
        status: BusinessInvitationStatus.Accepted,
        acceptedAt: new Date(),
      },
    })

    await logBusinessActivity({
      businessAccountId: invitation.businessAccountId,
      actorUserId: input.userId,
      action: "business_staff.accepted",
      entityType: "business_invitation",
      entityId: acceptedInvitation.id,
      metadata: {
        memberId: member.id,
        email: acceptedInvitation.email,
        roleIds: assignedRoleIds,
      },
    })

    return {
      account: {
        id: invitation.businessAccountId,
        type: invitation.businessAccount.type,
      },
      member: {
        id: member.id,
        userId: member.userId,
        roleIds: member.roleIds,
        status: member.status,
        joinedAt: toIso(member.joinedAt),
        createdAt: member.createdAt.toISOString(),
      },
      invitation: {
        id: acceptedInvitation.id,
        email: acceptedInvitation.email,
        roleIds: acceptedInvitation.roleIds,
        status: acceptedInvitation.status,
        acceptedAt: toIso(acceptedInvitation.acceptedAt),
        expiresAt: acceptedInvitation.expiresAt.toISOString(),
      },
    }
  })

  return result
}

export async function setBusinessMemberRoleIds(input: {
  ownerUserId: string
  businessAccountId: unknown
  memberId: unknown
  firstName?: unknown
  lastName?: unknown
  roleIds: unknown
}) {
  const account = await assertBusinessAccountOwnership({
    ownerUserId: input.ownerUserId,
    businessAccountId: input.businessAccountId,
    includeMembers: true,
  })
  if (!account.plan.customRolesEnabled) {
    throw new Error("Custom roles are not enabled for this plan")
  }

  const memberId = cleanText(input.memberId, 80)
  if (!memberId) throw new Error("Member id is required")

  const member = account.members.find((row) => row.id === memberId)
  if (!member) throw new Error("Business member was not found")
  if (member.userId === account.ownerUserId) {
    throw new Error("Owner role assignments cannot be updated")
  }
  const firstName = input.firstName === undefined ? undefined : cleanText(input.firstName, 100)
  if (input.firstName !== undefined && !firstName) {
    throw new Error("Staff first name is required")
  }
  const lastName = input.lastName === undefined ? undefined : cleanText(input.lastName, 100)
  if (input.lastName !== undefined && !lastName) {
    throw new Error("Staff last name is required")
  }

  const ownerRoleIds = new Set(account.roles.filter((role) => role.isOwnerRole).map((role) => role.id))
  const submittedRoleIds = cleanTextArray(input.roleIds)
  if (submittedRoleIds.some((id) => ownerRoleIds.has(id))) {
    throw new Error("Owner role cannot be assigned to staff")
  }
  const validRoleIds = new Set(account.roles.filter((role) => !role.isOwnerRole).map((role) => role.id))
  const nextRoleIds = submittedRoleIds.filter((id) => validRoleIds.has(id))

  const updatedMember = await db.businessAccountMember.update({
    where: { id: member.id },
    data: { roleIds: nextRoleIds },
    include: {
      user: {
        select: {
          id: true,
          publicId: true,
          email: true,
          phone: true,
          firstName: true,
          lastName: true,
          firebaseUid: true,
        },
      },
    },
  })
  if (firstName !== undefined || lastName !== undefined) {
    const nextFirstName = firstName ?? updatedMember.user.firstName
    const nextLastName = lastName ?? updatedMember.user.lastName
    if (updatedMember.user.firebaseUid) {
      await getFirebaseAuth().updateUser(updatedMember.user.firebaseUid, {
        displayName: [nextFirstName, nextLastName].filter(Boolean).join(" "),
      }).catch(() => undefined)
    }
    await db.user.update({
      where: { id: updatedMember.user.id },
      data: {
        ...(firstName !== undefined ? { firstName } : {}),
        ...(lastName !== undefined ? { lastName } : {}),
      },
    })
  }

  await logBusinessActivity({
    businessAccountId: account.id,
    actorUserId: input.ownerUserId,
    action: "business_member.roles_updated",
    entityType: "business_account_member",
    entityId: updatedMember.id,
    metadata: {
      userId: member.userId,
      roleIds: nextRoleIds,
      previousRoleIds: member.roleIds,
      ...(firstName !== undefined || lastName !== undefined
        ? {
            firstName,
            lastName,
          }
        : {}),
    },
  })

  return {
    id: updatedMember.id,
    userId: updatedMember.userId,
    roleIds: updatedMember.roleIds,
    status: updatedMember.status,
    user: {
      id: updatedMember.user.id,
      publicId: updatedMember.user.publicId,
      email: updatedMember.user.email,
      phone: updatedMember.user.phone,
      firstName: firstName ?? updatedMember.user.firstName,
      lastName: lastName ?? updatedMember.user.lastName,
    },
  }
}

export async function setBusinessMemberStatus(input: {
  ownerUserId: string
  businessAccountId: unknown
  memberId: unknown
  status: unknown
}) {
  const account = await assertBusinessAccountOwnership({
    ownerUserId: input.ownerUserId,
    businessAccountId: input.businessAccountId,
    includeMembers: true,
  })

  const memberId = cleanText(input.memberId, 80)
  if (!memberId) throw new Error("Member id is required")

  const member = account.members.find((row) => row.id === memberId)
  if (!member) throw new Error("Business member was not found")
  if (member.userId === account.ownerUserId) {
    throw new Error("Owner member cannot be deactivated")
  }

  const status = cleanText(input.status, 32)
  if (status !== BusinessMemberStatus.Active && status !== BusinessMemberStatus.Suspended) {
    throw new Error("Invalid member status")
  }

  const updatedMember = await db.businessAccountMember.update({
    where: { id: member.id },
    data: { status },
  })

  await logBusinessActivity({
    businessAccountId: account.id,
    actorUserId: input.ownerUserId,
    action: "business_member.status_updated",
    entityType: "business_account_member",
    entityId: updatedMember.id,
    metadata: {
      userId: updatedMember.userId,
      status: updatedMember.status,
      previousStatus: member.status,
    },
  })

  return {
    id: updatedMember.id,
    userId: updatedMember.userId,
    roleIds: updatedMember.roleIds,
    status: updatedMember.status,
  }
}

export async function deleteBusinessMember(input: {
  ownerUserId: string
  businessAccountId: unknown
  memberId: unknown
}) {
  const account = await assertBusinessAccountOwnership({
    ownerUserId: input.ownerUserId,
    businessAccountId: input.businessAccountId,
    includeMembers: true,
  })

  const memberId = cleanText(input.memberId, 80)
  if (!memberId) throw new Error("Member id is required")

  const member = account.members.find((row) => row.id === memberId)
  if (!member) throw new Error("Business member was not found")
  if (member.userId === account.ownerUserId) {
    throw new Error("Owner member cannot be deleted")
  }

  const deletedMember = await db.businessAccountMember.delete({
    where: { id: member.id },
    include: {
      user: {
        select: {
          id: true,
          firebaseUid: true,
        },
      },
    },
  })

  if (deletedMember.user.firebaseUid) {
    await getFirebaseAuth().deleteUser(deletedMember.user.firebaseUid).catch(() => undefined)
  }
  await db.user.delete({ where: { id: deletedMember.user.id } }).catch(() => undefined)

  await logBusinessActivity({
    businessAccountId: account.id,
    actorUserId: input.ownerUserId,
    action: "business_member.deleted",
    entityType: "business_account_member",
    entityId: deletedMember.id,
    metadata: {
      userId: deletedMember.userId,
      roleIds: deletedMember.roleIds,
      status: deletedMember.status,
    },
  })

  return {
    id: deletedMember.id,
    userId: deletedMember.userId,
    roleIds: deletedMember.roleIds,
    status: deletedMember.status,
  }
}

export async function updateBusinessRole(input: {
  ownerUserId: string
  businessAccountId: unknown
  roleId: unknown
  name?: unknown
  description?: unknown
  permissionIds?: unknown
}) {
  const account = await assertBusinessAccountOwnership({
    ownerUserId: input.ownerUserId,
    businessAccountId: input.businessAccountId,
  })
  if (!account.plan.customRolesEnabled) {
    throw new Error("Custom roles are not enabled for this plan")
  }

  const roleId = cleanText(input.roleId, 80)
  if (!roleId) throw new Error("Role id is required")

  const role = account.roles.find((row) => row.id === roleId)
  if (!role) throw new Error("Business role was not found")
  if (role.isOwnerRole) throw new Error("Owner role cannot be updated")

  const nextName = input.name !== undefined ? cleanText(input.name) : role.name
  if (nextName === null) throw new Error("Role name is required")
  const duplicateRole = account.roles.find(
    (row) =>
      row.id !== role.id &&
      row.name.trim().toLowerCase() === nextName.toLowerCase(),
  )
  if (duplicateRole) {
    throw new Error("A role with this name already exists")
  }
  const validPermissionIds = new Set(account.permissions.map((permission) => permission.id))
  const permissionIds = input.permissionIds === undefined
    ? role.permissionIds
    : cleanTextArray(input.permissionIds).filter((id) => validPermissionIds.has(id))
  if (
    account.plan.permissionLimit !== null &&
    permissionIds.length > account.plan.permissionLimit
  ) {
    throw new Error("Permission limit reached for this plan")
  }

  const nextRole = await db.businessRole.update({
    where: { id: role.id },
    data: {
      name: nextName,
      description: cleanText(input.description ?? role.description, 500),
      permissionIds,
    },
  })
  await logBusinessActivity({
    businessAccountId: account.id,
    actorUserId: input.ownerUserId,
    action: "business_role.updated",
    entityType: "business_role",
    entityId: nextRole.id,
    metadata: {
      name: nextRole.name,
      previousName: role.name,
      previousPermissionIds: role.permissionIds,
      permissionIds: nextRole.permissionIds,
    },
  })

  return nextRole
}

export async function deleteBusinessRole(input: {
  ownerUserId: string
  businessAccountId: unknown
  roleId: unknown
}) {
  const account = await assertBusinessAccountOwnership({
    ownerUserId: input.ownerUserId,
    businessAccountId: input.businessAccountId,
    includeMembers: true,
  })
  if (!account.plan.customRolesEnabled) {
    throw new Error("Custom roles are not enabled for this plan")
  }

  const roleId = cleanText(input.roleId, 80)
  if (!roleId) throw new Error("Role id is required")

  const role = account.roles.find((row) => row.id === roleId)
  if (!role) throw new Error("Business role was not found")
  if (role.isOwnerRole) throw new Error("Owner role cannot be deleted")

  const impactedMembers = account.members.filter((member) => member.roleIds.includes(roleId))
  await Promise.all(
    impactedMembers.map((member) =>
      db.businessAccountMember.update({
        where: { id: member.id },
        data: { roleIds: member.roleIds.filter((id) => id !== roleId) },
      }),
    ),
  )
  await db.businessRole.delete({
    where: { id: role.id },
  })
  await logBusinessActivity({
    businessAccountId: account.id,
    actorUserId: input.ownerUserId,
    action: "business_role.deleted",
    entityType: "business_role",
    entityId: role.id,
    metadata: { name: role.name },
  })
  return { roleId: role.id }
}
