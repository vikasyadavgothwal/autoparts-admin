import { createHash, randomBytes } from "node:crypto"

import { sendSmtpMail } from "@/lib/email/smtp"
import { getFirebaseAuth } from "@/lib/firebase/admin"
import { hashPassword } from "@/lib/auth/password"
import { db } from "@/lib/database/prisma"
import { logError } from "@/lib/logger"
import { createSignedS3ObjectUrl, deleteObjectFromS3, getS3ObjectKeyFromUrl } from "@/lib/storage/s3"
import { createNotificationsSafely } from "@/services/notifications/notification-service"
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

type BusinessUserRole = Extract<UserRole, "Fleet" | "Garage" | "Supplier">

const isBusinessUserRole = (role: UserRole): role is BusinessUserRole =>
  role === UserRole.Fleet || role === UserRole.Garage || role === UserRole.Supplier

const userRoleToAccountType = (role: BusinessUserRole): BusinessAccountType => {
  if (role === UserRole.Fleet) return BusinessAccountType.Fleet
  if (role === UserRole.Garage) return BusinessAccountType.Garage
  return BusinessAccountType.Supplier
}

const allowedSecurityTiers = ["Basic", "Standard", "Premium"] as const
const allowedSupportTiers = ["Basic", "Standard", "Premium"] as const
const allowedLoginSecurityModes = ["password", "otp"] as const
const allowedReportLevels = ["dashboard", "standard", "premium"] as const
const faqQuestionMinWords = 3
const faqQuestionMaxWords = 40
const faqAnswerMinWords = 6
const faqAnswerMaxWords = 250

const pickAllowed = <T extends readonly string[]>(values: T, value: string | null): T[number] | undefined =>
  values.includes(value as T[number]) ? value as T[number] : undefined

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
    savedSearchLimit: 0,
    wishlistLimit: 0,
    integrationLimit: 0,
    appointmentLimit: null,
    productLimit: null,
    dashboardReports: true,
    enabledFeatures: ["dashboard.access"],
    enabledMenus: ["overview", "vehicles", "rfqs", "integrations", "support"],
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
    savedSearchLimit: 0,
    wishlistLimit: 0,
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
    enabledMenus: ["overview", "vehicles", "rfqs", "orders", "suppliers", "integrations", "support", "reports", "settings", "staff", "roles"],
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
    savedSearchLimit: 0,
    wishlistLimit: 0,
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
    enabledMenus: ["overview", "vehicles", "rfqs", "orders", "suppliers", "integrations", "support", "reports", "settings", "staff", "roles"],
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
    savedSearchLimit: 0,
    integrationLimit: 0,
    productLimit: null,
    dashboardReports: true,
    enabledFeatures: ["dashboard.access"],
    enabledMenus: ["overview", "bookings", "services", "integrations", "support"],
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
    savedSearchLimit: 0,
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
    enabledMenus: ["overview", "bookings", "services", "schedule", "reviews", "integrations", "support", "reports", "settings", "staff", "roles"],
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
    savedSearchLimit: 0,
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
    enabledMenus: ["overview", "bookings", "services", "schedule", "reviews", "integrations", "support", "reports", "settings", "staff", "roles"],
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
    savedSearchLimit: 0,
    wishlistLimit: 0,
    integrationLimit: 0,
    dashboardReports: true,
    enabledFeatures: ["dashboard.access"],
    enabledMenus: ["overview", "inventory", "rfq-inbox", "integrations", "support"],
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
    savedSearchLimit: 0,
    wishlistLimit: 0,
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
    enabledMenus: ["overview", "inventory", "rfq-inbox", "offers", "orders", "performance", "reviews", "integrations", "support", "settings", "staff", "roles"],
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
    savedSearchLimit: 0,
    wishlistLimit: 0,
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
    enabledMenus: ["overview", "inventory", "rfq-inbox", "offers", "orders", "performance", "reviews", "integrations", "support", "settings", "staff", "roles"],
  },
]

const planInclude = {
  _count: { select: { businessAccounts: true } },
} satisfies Prisma.BusinessPlanInclude

const activeAddOnStatuses: BusinessAddOnRequestStatus[] = [
  BusinessAddOnRequestStatus.Approved,
  BusinessAddOnRequestStatus.Enabled,
]

const isRetiredBusinessFeatureKey = (key: string) =>
  key === "business.saved-searches.create" ||
  key === "business.wishlist.create" ||
  key === "approval-workflows.manage" ||
  key === "permissions.manage" ||
  key.startsWith("limit.savedSearches.") ||
  key.startsWith("limit.wishlist.")

const isApiFeatureKey = (key: string) => key === "api.standard" || key === "api.enterprise"

const apiAccessLevelForPlanCode = (code: BusinessPlanCode) =>
  code === BusinessPlanCode.Enterprise ? "enterprise" : code === BusinessPlanCode.Pro ? "standard" : "none"

const activeAddOnRequestWhere = (): Prisma.BusinessAddOnRequestWhereInput => {
  const now = new Date()
  return {
    status: { in: activeAddOnStatuses },
    AND: [
      { OR: [{ validFrom: null }, { validFrom: { lte: now } }] },
      { OR: [{ validUntil: null }, { validUntil: { gt: now } }] },
    ],
  }
}

const isActiveAddOnRequest = (request: { status: BusinessAddOnRequestStatus; validFrom?: Date | null; validUntil?: Date | null }) => {
  if (!activeAddOnStatuses.includes(request.status)) return false
  const now = Date.now()
  if (request.validFrom && request.validFrom.getTime() > now) return false
  return !request.validUntil || request.validUntil.getTime() > now
}

const activeAddOnRequestSelect = {
  id: true,
  label: true,
  featureKey: true,
  status: true,
  note: true,
  validFrom: true,
  validUntil: true,
  renewalAt: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.BusinessAddOnRequestSelect

const accountInclude = () => ({
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
        where: {
          revokedAt: null,
          expiresAt: { gt: new Date() },
        },
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
            where: {
              revokedAt: null,
              expiresAt: { gt: new Date() },
            },
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
  addOnRequests: { where: activeAddOnRequestWhere(), select: activeAddOnRequestSelect },
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
}) satisfies Prisma.BusinessAccountInclude

type BusinessPlanWithCount = Prisma.BusinessPlanGetPayload<{ include: typeof planInclude }>
type BusinessAccountFull = Prisma.BusinessAccountGetPayload<{ include: ReturnType<typeof accountInclude> }>

export const businessEntitlementFeatures = {
  Fleet: [
    "dashboard.access",
    "fleet.vehicles.manage",
    "fleet.rfqs.create",
    "fleet.orders.create",
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
    "garage.schedule.manage",
    "garage.services.manage",
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
  "reports.usage": "Usage reports",
  "reports.activity": "Activity reports",
  "support.priority": "Priority support",
  "integrations.manage": "Integrations",
  "garage.schedule.manage": "Garage schedule management",
  "api.standard": "API access",
  "api.enterprise": "Enterprise API access",
  "marketplace.featured-vendor": "Featured vendor placement",
  "marketplace.search-boost": "Marketplace search boost",
} satisfies Record<string, string>

const cleanText = (value: unknown, max = 120): string | null => {
  if (typeof value !== "string") return null
  const normalized = value.replace(/[\r\n\t]+/g, " ").replace(/\s+/g, " ").trim()
  return normalized ? normalized.slice(0, max) : null
}

const normalizeText = (value: unknown): string | null => {
  if (typeof value !== "string") return null
  const normalized = value.replace(/[\r\n\t]+/g, " ").replace(/\s+/g, " ").trim()
  return normalized || null
}

const wordCount = (value: string) => value.trim().split(/\s+/).filter(Boolean).length

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (character) => ({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#039;",
})[character] ?? character)

const supportTicketStatusLabel = (status: BusinessSupportTicketStatus) =>
  status === BusinessSupportTicketStatus.InProgress ? "In Progress" : status

const supportTicketStatusColor = (status: BusinessSupportTicketStatus) => {
  if (status === BusinessSupportTicketStatus.Resolved) return "#047857"
  if (status === BusinessSupportTicketStatus.Closed) return "#475569"
  if (status === BusinessSupportTicketStatus.InProgress) return "#b45309"
  return "#2563eb"
}

const supportTicketCode = (id: string) => `AUTO-${(id.replace(/[^a-z0-9]/gi, "").slice(-8) || id.slice(-8)).toUpperCase()}`
const staffNamePattern = /^[A-Za-z][A-Za-z\s.'-]*$/
const roleNamePattern = /^[A-Za-z0-9][A-Za-z0-9\s._/-]*$/

const textLength = (value: unknown) =>
  typeof value === "string"
    ? value.replace(/[\r\n\t]+/g, " ").replace(/\s+/g, " ").trim().length
    : 0

const validateStaffName = (value: string, label: string) => {
  if (value.length > 50) throw new Error(`${label} cannot exceed 50 characters`)
  if (!staffNamePattern.test(value)) {
    throw new Error("Name can contain only letters, spaces, apostrophes, periods, and hyphens")
  }
}

const validateBusinessRoleInput = (input: { name: unknown; description?: unknown; permissionIds: string[] }) => {
  const nameLength = textLength(input.name)
  if (nameLength < 3 || nameLength > 80) {
    throw new Error("Role name must be between 3 and 80 characters")
  }
  const name = cleanText(input.name, 80)
  if (!name || !roleNamePattern.test(name)) {
    throw new Error("Role name contains invalid characters")
  }
  if (textLength(input.description) > 240) {
    throw new Error("Description cannot exceed 240 characters")
  }
  if (!input.permissionIds.length) {
    throw new Error("Select at least one permission")
  }
  return {
    name,
    description: cleanText(input.description, 240),
  }
}

const addOnStatusColor = (status: BusinessAddOnRequestStatus) => {
  if (status === BusinessAddOnRequestStatus.Rejected) return "#dc2626"
  if (activeAddOnStatuses.includes(status)) return "#047857"
  return "#2563eb"
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

const cleanDate = (value: unknown, label: string, endOfDay = false) => {
  if (value === null || value === undefined || value === "") return null
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) throw new Error(`${label} must be a valid date`)
    return value
  }
  if (typeof value !== "string") throw new Error(`${label} must be a valid date`)
  const normalized = value.trim()
  if (!normalized) return null
  const date = new Date(
    /^\d{4}-\d{2}-\d{2}$/.test(normalized)
      ? `${normalized}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}Z`
      : normalized,
  )
  if (Number.isNaN(date.getTime())) throw new Error(`${label} must be a valid date`)
  return date
}

const cleanAddOnValidity = (input: { validFrom?: unknown; validUntil?: unknown; renewalAt?: unknown }) => {
  const validFrom = cleanDate(input.validFrom, "Valid from")
  const validUntil = cleanDate(input.validUntil, "Valid until", true)
  const renewalAt = cleanDate(input.renewalAt, "Renewal date")
  if (validFrom && validUntil && validUntil <= validFrom) {
    throw new Error("Valid until must be after valid from")
  }
  return { validFrom, validUntil, renewalAt }
}

const addDaysUtc = (date: Date, days: number) => {
  const next = new Date(date)
  next.setUTCDate(next.getUTCDate() + Math.max(1, days))
  return next
}

const sameDateValue = (left: Date | null | undefined, right: Date | null | undefined) =>
  (left?.getTime() ?? null) === (right?.getTime() ?? null)

const formatMailDate = (value: Date | null | undefined) =>
  value ? value.toLocaleDateString("en-GB", { day: "2-digit", month: "short", timeZone: "UTC", year: "numeric" }) : "Not set"

const addPlanPeriod = (date: Date, plan: { billingPeriod: string; monthlyBillingDays: number }) => {
  const next = new Date(date)
  const period = plan.billingPeriod.toLowerCase()
  if (period.includes("year")) {
    next.setFullYear(next.getFullYear() + 1)
    return next
  }
  if (period.includes("month")) {
    next.setDate(next.getDate() + plan.monthlyBillingDays)
    return next
  }
  return null
}

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
    const include = accountInclude()
    const account = await db.businessAccount.findFirst({
      where: { id: businessAccountId, ownerUserId: input.ownerUserId, isActive: true },
      include: {
        ...include,
        members: include.members,
      },
    })
    if (!account) throw new Error("Business account was not found")
    return account
  }

  const account = await db.businessAccount.findFirst({
    where: { id: businessAccountId, ownerUserId: input.ownerUserId, isActive: true },
    include: accountInclude(),
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
    monthlyBillingDays: plan.monthlyBillingDays,
  },
  securityTier: pickAllowed(allowedSecurityTiers, plan.securityTier),
  supportTier: pickAllowed(allowedSupportTiers, plan.supportTier),
  loginSecurityMode: pickAllowed(allowedLoginSecurityModes, plan.loginSecurityMode),
  reportLevel: pickAllowed(allowedReportLevels, plan.reportLevel),
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
  apiAccessLevel: apiAccessLevelForPlanCode(plan.code),
  approvalWorkflowEnabled: plan.approvalWorkflowEnabled,
  customRolesEnabled: plan.customRolesEnabled,
  enabledFeatures: plan.enabledFeatures.filter(
    (feature) =>
      !isRetiredBusinessFeatureKey(feature) &&
      (plan.code !== BusinessPlanCode.Free || !isApiFeatureKey(feature)),
  ),
  enabledMenus: plan.enabledMenus.filter(
    (menu) => menu !== "saved-searches" && menu !== "wishlist" && menu !== "security" && menu !== "api-keys",
  ),
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

type BusinessActiveAddOnRow = {
  id: string
  label: string
  featureKey: string
  status: BusinessAddOnRequestStatus
  note: string | null
  validFrom: Date | null
  validUntil: Date | null
  renewalAt: Date | null
  createdAt: Date
  updatedAt: Date
}

const mapActiveAddOn = (request: BusinessActiveAddOnRow) => ({
  id: request.id,
  label: request.label,
  featureKey: request.featureKey,
  status: request.status,
  note: request.note,
  validFrom: toIso(request.validFrom),
  validUntil: toIso(request.validUntil),
  renewalAt: toIso(request.renewalAt),
  createdAt: request.createdAt.toISOString(),
  updatedAt: request.updatedAt.toISOString(),
})

const mapBusinessPaymentTransaction = (row: {
  id: string
  type: string
  sourceId: string | null
  sourceKey: string | null
  description: string
  amount: number
  currency: string
  status: string
  createdAt: Date
}) => ({
  id: row.id,
  type: row.type,
  sourceId: row.sourceId,
  sourceKey: row.sourceKey,
  description: row.description,
  amount: row.amount,
  currency: row.currency,
  status: row.status,
  createdAt: row.createdAt.toISOString(),
})

async function recordBusinessPaymentTransaction(input: {
  businessAccountId: string
  payerUserId?: string | null
  type: "plan" | "add_on"
  sourceId?: string | null
  sourceKey?: string | null
  description: string
  amount: number
  currency?: string | null
  metadata?: Prisma.InputJsonValue
}) {
  return db.businessPaymentTransaction.create({
    data: {
      businessAccountId: input.businessAccountId,
      payerUserId: input.payerUserId ?? null,
      type: input.type,
      sourceId: input.sourceId ?? null,
      sourceKey: input.sourceKey ?? null,
      description: input.description,
      amount: Math.max(0, Math.round(input.amount)),
      currency: input.currency ?? defaultAddOnPriceCurrency,
      status: "Paid",
      metadata: input.metadata,
    },
  })
}

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
  activeAddOns: account.addOnRequests.filter((item) => !isRetiredBusinessFeatureKey(item.featureKey)).map(mapActiveAddOn),
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
    include: accountInclude(),
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
  const tierForPlan = (code: BusinessPlanCode) =>
    code === BusinessPlanCode.Enterprise
      ? { securityTier: "Premium", supportTier: "Premium", loginSecurityMode: "otp", reportLevel: "premium" }
      : code === BusinessPlanCode.Pro
        ? { securityTier: "Standard", supportTier: "Standard", loginSecurityMode: "otp", reportLevel: "standard" }
        : { securityTier: "Basic", supportTier: "Basic", loginSecurityMode: "password", reportLevel: "dashboard" }
  await Promise.all(
    defaultPlanSeeds.map((plan) =>
      db.businessPlan.upsert({
        where: {
          accountType_code: {
            accountType: plan.accountType,
            code: plan.code,
          },
        },
        update: {},
        create: { ...tierForPlan(plan.code), ...plan },
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
      if (isBusinessUserRole(role)) {
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
  const currentPlan = await db.businessPlan.findUniqueOrThrow({ where, select: { code: true } })

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
  if (Number.isInteger(input.monthlyBillingDays) && Number(input.monthlyBillingDays) >= 1 && Number(input.monthlyBillingDays) <= 366) {
    data.monthlyBillingDays = Number(input.monthlyBillingDays)
  }
  const securityTier = cleanText(input.securityTier, 30)
  if (securityTier && ["Basic", "Standard", "Premium"].includes(securityTier)) data.securityTier = securityTier
  const supportTier = cleanText(input.supportTier, 30)
  if (supportTier && ["Basic", "Standard", "Premium"].includes(supportTier)) data.supportTier = supportTier
  const loginSecurityMode = cleanText(input.loginSecurityMode, 30)
  if (loginSecurityMode && ["password", "otp"].includes(loginSecurityMode)) data.loginSecurityMode = loginSecurityMode
  const reportLevel = cleanText(input.reportLevel, 30)
  if (reportLevel && ["dashboard", "standard", "premium"].includes(reportLevel)) data.reportLevel = reportLevel

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

  data.apiAccessLevel = apiAccessLevelForPlanCode(currentPlan.code)

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
  ] = await Promise.all([
    db.businessAccountMember.count({
      where: { businessAccountId: account.id, status: BusinessMemberStatus.Active },
    }),
    db.businessRole.count({ where: { businessAccountId: account.id } }),
    db.businessPermission.count({ where: { businessAccountId: account.id, isSystem: false } }),
    account.type === BusinessAccountType.Fleet
      ? db.fleetVehicle.count({ where: { fleetId: account.ownerUserId, status: { not: "plan_suspended" } } })
      : Promise.resolve(0),
    account.type === BusinessAccountType.Garage
      ? db.garageBooking.count({ where: { garageId: account.ownerUserId, createdAt: { gte: monthStart } } })
      : Promise.resolve(0),
    account.type === BusinessAccountType.Supplier
      ? db.supplierPart.count({ where: { supplierId: account.ownerUserId, isActive: true } })
      : Promise.resolve(0),
    account.type === BusinessAccountType.Supplier
      ? db.supplierPart.findMany({
          where: { supplierId: account.ownerUserId, isActive: true, originalBrand: { not: null } },
          select: { originalBrand: true },
          distinct: ["originalBrand"],
        }).then((rows) => rows.length)
    : Promise.resolve(0),
    account.type === BusinessAccountType.Supplier
      ? db.supplierPart.findMany({
          where: { supplierId: account.ownerUserId, isActive: true, category: { not: null } },
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
      ? db.garageService.count({ where: { garageId: account.ownerUserId, status: { not: "plan_suspended" } } })
      : Promise.resolve(0),
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
  integrations: plan.integrationLimit,
})

type BusinessLimits = ReturnType<typeof limitsForPlan>
type BusinessLimitMetric = keyof BusinessLimits
type BusinessUsageCounts = ReturnType<typeof usageWithZeroes>
type BusinessActionRule = {
  feature?: string
  metric?: keyof BusinessUsageCounts
  limit?: keyof BusinessLimits
  flag?: "customRolesEnabled" | "approvalWorkflowEnabled"
}

const limitAddOnMetrics = {
  Garage: ["services", "appointments", "staff", "roles", "integrations"],
  Fleet: ["vehicles", "rfqs", "orders", "staff", "roles", "integrations"],
  Supplier: ["products", "brands", "categories", "rfqs", "orders", "staff", "roles", "integrations"],
} satisfies Record<BusinessAccountType, BusinessLimitMetric[]>

const limitAddOnLabels = {
  staff: "staff users",
  roles: "custom roles",
  permissions: "custom permissions",
  brands: "brands",
  categories: "categories",
  vehicles: "vehicles",
  appointments: "appointments",
  products: "products",
  rfqs: "RFQs",
  orders: "orders",
  services: "services",
  integrations: "integrations",
} satisfies Record<BusinessLimitMetric, string>

const limitMetricFeatures = {
  staff: ["staff.manage"],
  roles: ["roles.manage"],
  permissions: ["permissions.manage"],
  vehicles: ["fleet.vehicles.manage"],
  rfqs: ["fleet.rfqs.create", "supplier.rfqs.quote"],
  orders: ["fleet.orders.create", "supplier.orders.manage"],
  services: ["garage.services.manage"],
  appointments: ["garage.bookings.manage", "garage.schedule.manage"],
  products: ["supplier.inventory.manage"],
  integrations: ["integrations.manage"],
  brands: [],
  categories: [],
} satisfies Record<BusinessLimitMetric, string[]>

const isLimitMetric = (value: string): value is BusinessLimitMetric =>
  Object.prototype.hasOwnProperty.call(limitAddOnLabels, value)

const limitAddOnKey = (metric: BusinessLimitMetric, extraUnits: number) => `limit.${metric}.${extraUnits}`

const parseLimitAddOnKey = (featureKey: string) => {
  const [prefix, metric, extra] = featureKey.split(".")
  const extraUnits = Number(extra)
  if (prefix !== "limit" || !isLimitMetric(metric) || !Number.isInteger(extraUnits) || extraUnits < 1 || extraUnits > 100000) return null
  return { metric, extraUnits }
}
type ParsedLimitAddOn = NonNullable<ReturnType<typeof parseLimitAddOnKey>>
type AddOnPricingModel = "fixed" | "per_unit"
type AddOnCatalogItem = {
  accountType: BusinessAccountType
  featureKey: string
  label: string
  pricingModel: AddOnPricingModel
}
type AddOnPriceMap = Map<string, { priceAmount: number; priceCurrency: string; validityDays: number }>
type StoredAddOnPriceRow = AddOnCatalogItem & {
  priceAmount: number
  priceCurrency: string
  validityDays: number
}

const limitPriceKey = (metric: BusinessLimitMetric) => `limit.${metric}`
const addOnPriceMapKey = (accountType: BusinessAccountType, featureKey: string) => `${accountType}:${featureKey}`
const defaultAddOnPriceCurrency = "AED"
const defaultAddOnValidityDays = 30
const addOnPriceStorageNotReadyMessage =
  "Add-on price storage is not ready. Run `npx prisma migrate deploy` in auto_parts_admin, then restart the Admin backend."

const cleanPriceCurrency = (value: unknown) => {
  const currency = cleanText(value, 3)?.toUpperCase()
  return currency && /^[A-Z]{3}$/.test(currency) ? currency : defaultAddOnPriceCurrency
}
const cleanPriceAmount = (value: unknown) => {
  const amount = typeof value === "number" ? value : Number(value)
  if (!Number.isInteger(amount) || amount < 0 || amount > 100000000) throw new Error("Price amount must be a valid non-negative amount")
  return amount
}
const cleanValidityDays = (value: unknown) => {
  const days = typeof value === "number" ? value : Number(value)
  if (!Number.isInteger(days) || days < 1 || days > 3650) throw new Error("Validity must be between 1 and 3650 days")
  return days
}
const formatMoneyText = (amount = 0, currency = defaultAddOnPriceCurrency) =>
  `${currency} ${(amount / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const addOnCatalogForAccountType = (accountType: BusinessAccountType): AddOnCatalogItem[] => {
  const requestableLabels = businessRequestableFeatureLabels as Record<string, string>
  const featureItems = businessEntitlementFeatures[accountType]
    .filter((featureKey) => !isRetiredBusinessFeatureKey(featureKey) && Boolean(requestableLabels[featureKey]))
    .map((featureKey) => ({
      accountType,
      featureKey,
      label: requestableLabels[featureKey],
      pricingModel: "fixed" as const,
    }))
  const limitItems = limitAddOnMetrics[accountType].map((metric) => ({
    accountType,
    featureKey: limitPriceKey(metric),
    label: `Add extra ${limitAddOnLabels[metric]} capacity`,
    pricingModel: "per_unit" as const,
  }))
  return [...featureItems, ...limitItems]
}

const addOnCatalogItemFor = (accountType: BusinessAccountType, featureKey: string) =>
  addOnCatalogForAccountType(accountType).find((item) => item.featureKey === featureKey) ?? null

const addOnPriceStorageError = (error: unknown) => {
  const message = error instanceof Error ? error.message : String(error)
  if (message.includes("business_add_on_prices") || message.includes("BusinessAccountType") || message.includes("validityDays")) {
    return new Error(addOnPriceStorageNotReadyMessage)
  }
  return error
}

const readBusinessAddOnPriceRows = async (accountType?: BusinessAccountType): Promise<StoredAddOnPriceRow[]> => {
  if (accountType) {
    return db.$queryRaw<StoredAddOnPriceRow[]>`
      SELECT "accountType", "featureKey", "label", "pricingModel", "priceAmount", "priceCurrency", "validityDays"
      FROM "business_add_on_prices"
      WHERE "accountType"::text = ${accountType}
    `
  }

  return db.$queryRaw<StoredAddOnPriceRow[]>`
    SELECT "accountType", "featureKey", "label", "pricingModel", "priceAmount", "priceCurrency", "validityDays"
    FROM "business_add_on_prices"
  `
}

const upsertBusinessAddOnPriceRows = async (rows: StoredAddOnPriceRow[]) => {
  if (!rows.length) return

  try {
    await db.$transaction(rows.map((row) =>
      db.$executeRaw`
        INSERT INTO "business_add_on_prices" (
          "id", "accountType", "featureKey", "label", "pricingModel", "priceAmount", "priceCurrency", "validityDays", "createdAt", "updatedAt"
        )
        VALUES (
          ${`baop_${randomBytes(12).toString("hex")}`},
          ${row.accountType}::"BusinessAccountType",
          ${row.featureKey},
          ${row.label},
          ${row.pricingModel},
          ${row.priceAmount},
          ${row.priceCurrency},
          ${row.validityDays},
          CURRENT_TIMESTAMP,
          CURRENT_TIMESTAMP
        )
        ON CONFLICT ("accountType", "featureKey") DO UPDATE SET
          "label" = EXCLUDED."label",
          "pricingModel" = EXCLUDED."pricingModel",
          "priceAmount" = EXCLUDED."priceAmount",
          "priceCurrency" = EXCLUDED."priceCurrency",
          "validityDays" = EXCLUDED."validityDays",
          "updatedAt" = CURRENT_TIMESTAMP
      `,
    ))
  } catch (error) {
    throw addOnPriceStorageError(error)
  }
}

const getAddOnPriceMap = async (accountType: BusinessAccountType): Promise<AddOnPriceMap> => {
  let rows: StoredAddOnPriceRow[] = []
  try {
    rows = await readBusinessAddOnPriceRows(accountType)
  } catch (error) {
    logError("Unable to load business add-on price map; continuing without add-on prices", error)
  }
  return new Map(rows.map((row) => [addOnPriceMapKey(row.accountType, row.featureKey), {
    priceAmount: row.priceAmount,
    priceCurrency: row.priceCurrency,
    validityDays: row.validityDays,
  }]))
}

const priceForCatalogItem = (item: AddOnCatalogItem, prices: AddOnPriceMap) => {
  const price = prices.get(addOnPriceMapKey(item.accountType, item.featureKey))
  return {
    pricingModel: item.pricingModel,
    priceAmount: price?.priceAmount ?? 0,
    priceCurrency: price?.priceCurrency ?? defaultAddOnPriceCurrency,
    validityDays: price?.validityDays ?? defaultAddOnValidityDays,
  }
}

const calculateAddOnPrice = (input: {
  pricingModel: AddOnPricingModel
  quantity: number
  priceAmount?: number | null
  priceCurrency?: string | null
  validityDays?: number | null
}) => {
  const unitPriceAmount = input.priceAmount ?? 0
  const priceQuantity = input.pricingModel === "per_unit" ? Math.max(1, input.quantity) : 1
  return {
    priceAmount: input.pricingModel === "per_unit" ? unitPriceAmount * priceQuantity : unitPriceAmount,
    priceCurrency: input.priceCurrency ?? defaultAddOnPriceCurrency,
    validityDays: input.validityDays ?? defaultAddOnValidityDays,
    priceQuantity,
    unitPriceAmount: input.pricingModel === "per_unit" ? unitPriceAmount : null,
  }
}

const addOnFeatureSet = (addOnKeys: string[], accountType: BusinessAccountType) => {
  const features = new Set(addOnKeys.filter((key) => !isRetiredBusinessFeatureKey(key)))
  if (features.has("api.enterprise")) features.add("api.standard")
  for (const key of addOnKeys) {
    const parsed = parseLimitAddOnKey(key)
    if (!parsed) continue
    for (const feature of limitMetricFeatures[parsed.metric]) {
      if (businessEntitlementFeatures[accountType].includes(feature)) features.add(feature)
    }
  }
  return features
}

const applyLimitAddOns = (limits: BusinessLimits, addOnKeys: string[]) => {
  const next = { ...limits }
  for (const key of addOnKeys) {
    const parsed = parseLimitAddOnKey(key)
    if (!parsed) continue
    const current = next[parsed.metric]
    if (current !== null) next[parsed.metric] = current + parsed.extraUnits
  }
  return next
}

const effectiveLimitsForAccount = (account: { plan: Parameters<typeof limitsForPlan>[0]; addOnRequests?: Array<{ featureKey: string }> }) =>
  applyLimitAddOns(limitsForPlan(account.plan), account.addOnRequests?.map((request) => request.featureKey) ?? [])

const limitNameToMetric = (limit: string): BusinessLimitMetric => ({
  staffLimit: "staff",
  roleLimit: "roles",
  permissionLimit: "permissions",
  brandLimit: "brands",
  categoryLimit: "categories",
  vehicleLimit: "vehicles",
  appointmentLimit: "appointments",
  productLimit: "products",
  rfqLimit: "rfqs",
  orderLimit: "orders",
  serviceLimit: "services",
  integrationLimit: "integrations",
} as Record<string, BusinessLimitMetric>)[limit]

const limitAddOnOptions = (
  accountType: BusinessAccountType,
  baseLimits: BusinessLimits,
  limits: BusinessLimits,
  usage: BusinessUsageCounts,
  enabledAddOnKeys: string[],
  addOnPrices: AddOnPriceMap,
) =>
  limitAddOnMetrics[accountType]
    .filter((metric) => baseLimits[metric] !== null)
    .map((metric) => {
      const priceItem = addOnCatalogItemFor(accountType, limitPriceKey(metric))
      const price = priceItem ? priceForCatalogItem(priceItem, addOnPrices) : null
      const currentLimit = limits[metric]
      const currentUsage = usage[metric]
      const enabledExtraUnits = enabledAddOnKeys
        .map((key) => parseLimitAddOnKey(key))
        .filter((item): item is ParsedLimitAddOn => item !== null && item.metric === metric)
        .reduce((total, item) => total + item.extraUnits, 0)
      const suggestedExtraUnits = Math.max(5, currentUsage + 1 - (currentLimit ?? 0))
      return {
        key: limitAddOnKey(metric, suggestedExtraUnits),
        metric,
        label: `Add extra ${limitAddOnLabels[metric]} capacity`,
        currentLimit,
        currentUsage,
        suggestedExtraUnits,
        suggestedLimit: (currentLimit ?? 0) + suggestedExtraUnits,
        enabledExtraUnits,
        pricingModel: price?.pricingModel ?? "per_unit",
        unitPriceAmount: price?.priceAmount ?? 0,
        priceCurrency: price?.priceCurrency ?? defaultAddOnPriceCurrency,
        validityDays: price?.validityDays ?? defaultAddOnValidityDays,
      }
    })

const featureBlockedReason = (feature: string) => {
  if (feature === "garage.services.manage") {
    return "Service management is not included in your current plan or assigned role."
  }
  if (feature === "garage.bookings.manage") {
    return "Appointment management is not included in your current plan or assigned role."
  }
  if (feature === "garage.schedule.manage") {
    return "Schedule management is not included in your current plan or assigned role."
  }
  return `${feature} is not enabled for this plan`
}

const limitBlockedReason = (metric: keyof BusinessUsageCounts, limit: number | null | undefined) => {
  if (metric === "services") return `Your current plan allows up to ${limit ?? "unlimited"} active services. Extra services are temporarily inactive and not deleted.`
  if (metric === "appointments") return `Your current plan allows up to ${limit ?? "unlimited"} appointments for this period. Upgrade your plan or wait for the next cycle.`
  return `${metric} limit reached`
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
  integrations: 0,
})

const hasCapacity = (used: number, limit: number | null | undefined) =>
  limit === null || limit === undefined || used < limit

export const businessEntitlementActionRules = {
  Fleet: {
    "staff.invite": { feature: "staff.manage", metric: "staff", limit: "staff" },
    "roles.create": { feature: "roles.manage", metric: "roles", limit: "roles", flag: "customRolesEnabled" },
    "vehicles.create": { feature: "fleet.vehicles.manage" },
    "vehicles.update": { feature: "fleet.vehicles.manage" },
    "vehicles.delete": { feature: "fleet.vehicles.manage" },
    "rfqs.create": { feature: "fleet.rfqs.create" },
    "orders.create": { feature: "fleet.orders.create" },
    "reports.view": { feature: "reports.dashboard" },
    "reports.usage": { feature: "reports.usage" },
    "reports.activity": { feature: "reports.activity" },
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
    "integrations.connect": { feature: "integrations.manage", metric: "integrations", limit: "integrations" },
    "api.access": { feature: "api.standard" },
    "approval-workflows.create": { feature: "approval-workflows.manage", flag: "approvalWorkflowEnabled" },
  },
  Supplier: {
    "staff.invite": { feature: "staff.manage", metric: "staff", limit: "staff" },
    "roles.create": { feature: "roles.manage", metric: "roles", limit: "roles", flag: "customRolesEnabled" },
    "products.create": { feature: "supplier.inventory.manage" },
    "products.update": { feature: "supplier.inventory.manage" },
    "products.delete": { feature: "supplier.inventory.manage" },
    "rfqs.quote": { feature: "supplier.rfqs.quote" },
    "orders.manage": { feature: "supplier.orders.manage" },
    "reports.view": { feature: "reports.dashboard" },
    "reports.usage": { feature: "reports.usage" },
    "reports.activity": { feature: "reports.activity" },
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
  integrationLimit: number | null
  vehicleLimit: number | null
  productLimit: number | null
  rfqLimit: number | null
  orderLimit: number | null
  serviceLimit: number | null
  appointmentLimit: number | null
  apiAccessLevel: string
  approvalWorkflowEnabled: boolean
  featuredVendor: boolean
  searchBoostLevel: number
  code?: BusinessPlanCode
}, accountType?: BusinessAccountType) => {
  const isFreePlan = plan.code === BusinessPlanCode.Free
  const features = new Set(plan.enabledFeatures.filter((feature) => !isApiFeatureKey(feature)))
  if (plan.dashboardReports) features.add("reports.dashboard")
  if (plan.usageReports) features.add("reports.usage")
  if (plan.activityReports) features.add("reports.activity")
  if (plan.prioritySupport) features.add("support.priority")
  if (plan.integrationLimit === null || plan.integrationLimit > 0) features.add("integrations.manage")
  const apiAccessLevel = plan.code ? apiAccessLevelForPlanCode(plan.code) : plan.apiAccessLevel
  if (!isFreePlan && (apiAccessLevel === "standard" || apiAccessLevel === "enterprise")) features.add("api.standard")
  if (!isFreePlan && apiAccessLevel === "enterprise") features.add("api.enterprise")
  if (plan.approvalWorkflowEnabled) features.add("approval-workflows.manage")
  if (plan.serviceLimit === null || plan.serviceLimit > 0) features.add("garage.services.manage")
  if (plan.appointmentLimit === null || plan.appointmentLimit > 0) {
    features.add("garage.bookings.manage")
    features.add("garage.schedule.manage")
  }
  if (accountType === BusinessAccountType.Fleet) {
    if (plan.vehicleLimit === null || plan.vehicleLimit > 0) features.add("fleet.vehicles.manage")
    if (plan.rfqLimit === null || plan.rfqLimit > 0) features.add("fleet.rfqs.create")
    if (plan.orderLimit === null || plan.orderLimit > 0) features.add("fleet.orders.create")
  }
  if (accountType === BusinessAccountType.Supplier) {
    if (plan.productLimit === null || plan.productLimit > 0) features.add("supplier.inventory.manage")
    if (plan.rfqLimit === null || plan.rfqLimit > 0) features.add("supplier.rfqs.quote")
    if (plan.orderLimit === null || plan.orderLimit > 0) features.add("supplier.orders.manage")
  }
  if (plan.customRolesEnabled) {
    features.add("roles.manage")
    features.add("permissions.manage")
  }
  if (plan.featuredVendor) features.add("marketplace.featured-vendor")
  if (plan.searchBoostLevel > 0) features.add("marketplace.search-boost")
  return features
}

const menuKeysForFeatureSet = (accountType: BusinessAccountType, featureSet: Set<string>) => {
  const menus: string[] = []
  const add = (featureKey: string, menuKey: string) => {
    if (featureSet.has(featureKey)) menus.push(menuKey)
  }

  add("staff.manage", "staff")
  add("roles.manage", "roles")
  add("integrations.manage", "integrations")
  add("api.standard", "api-keys")
  add("api.enterprise", "api-keys")

  if (featureSet.has("reports.dashboard") || featureSet.has("reports.usage") || featureSet.has("reports.activity")) {
    menus.push(accountType === BusinessAccountType.Supplier ? "performance" : "reports")
  }

  if (accountType === BusinessAccountType.Garage) {
    add("garage.bookings.manage", "bookings")
    add("garage.schedule.manage", "schedule")
    add("garage.services.manage", "services")
  }
  if (accountType === BusinessAccountType.Fleet) {
    add("fleet.vehicles.manage", "vehicles")
    add("fleet.rfqs.create", "rfqs")
    add("fleet.orders.create", "orders")
  }
  if (accountType === BusinessAccountType.Supplier) {
    add("supplier.inventory.manage", "inventory")
    add("supplier.rfqs.quote", "rfq-inbox")
    add("supplier.orders.manage", "orders")
  }

  return menus
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
      approvalWorkflowEnabled: boolean
      integrationLimit: number | null
      vehicleLimit: number | null
      productLimit: number | null
      rfqLimit: number | null
      orderLimit: number | null
      serviceLimit: number | null
      appointmentLimit: number | null
      apiAccessLevel: string
      featuredVendor: boolean
      searchBoostLevel: number
      code: BusinessPlanCode
    }
  },
  usage: ReturnType<typeof usageWithZeroes>,
  limits: BusinessLimits,
  addOnFeatures = new Set<string>(),
) => {
  const rules = businessEntitlementActionRules[account.type] as Record<string, BusinessActionRule>
  const rule = rules[action]
  if (!rule) return { allowed: false, reason: "Unknown action" }
  const features = featureSetForPlan(account.plan, account.type)
  addOnFeatures.forEach((feature) => features.add(feature))
  if (rule.feature && !features.has(rule.feature)) {
    return { allowed: false, reason: featureBlockedReason(rule.feature) }
  }
  if (rule.flag && !account.plan[rule.flag] && !(rule.feature && addOnFeatures.has(rule.feature))) {
    return { allowed: false, reason: `${rule.flag} is not enabled for this plan` }
  }
  if (rule.metric && rule.limit && !(rule.feature && addOnFeatures.has(rule.feature)) && !hasCapacity(usage[rule.metric], limits[rule.limit])) {
    return { allowed: false, reason: limitBlockedReason(rule.metric, limits[rule.limit]) }
  }
  return { allowed: true, reason: null }
}

const buildEntitlementPayload = async (
  account: BusinessAccountFull | Prisma.BusinessAccountGetPayload<{
    include: { plan: true; roles: true; permissions: true }
  }>,
  usage: BusinessUsage,
  enabledAddOnFeatures: string[] = [],
  activeAddOns: BusinessActiveAddOnRow[] = [],
) => {
  const baseLimits = limitsForPlan(account.plan)
  const limits = applyLimitAddOns(baseLimits, enabledAddOnFeatures)
  const usageCounts = usageWithZeroes(usage)
  const addOnPrices = await getAddOnPriceMap(account.type)
  const featureSet = featureSetForPlan(account.plan, account.type)
  const addOnFeatures = addOnFeatureSet(enabledAddOnFeatures, account.type)
  addOnFeatures.forEach((feature) => featureSet.add(feature))
  const enabledFeatures = Array.from(featureSet).sort()
  const knownFeatures = businessEntitlementFeatures[account.type]
  const requestableLabels = businessRequestableFeatureLabels as Record<string, string>
  const lockedFeatures = knownFeatures
    .filter((feature) => !enabledFeatures.includes(feature))
    .map((feature) => {
      const priceItem = addOnCatalogItemFor(account.type, feature)
      const price = priceItem ? priceForCatalogItem(priceItem, addOnPrices) : null
      return {
        key: feature,
        label: requestableLabels[feature] ?? feature,
        pricingModel: price?.pricingModel ?? "fixed",
        priceAmount: price?.priceAmount ?? 0,
        priceCurrency: price?.priceCurrency ?? defaultAddOnPriceCurrency,
        validityDays: price?.validityDays ?? defaultAddOnValidityDays,
      }
    })
  const isEnterprisePlan = account.plan.code === BusinessPlanCode.Enterprise
  const requestableFeatures = isEnterprisePlan
    ? []
    : lockedFeatures.filter((feature) => Boolean(requestableLabels[feature.key]))
  const actions = Object.fromEntries(
    Object.keys(businessEntitlementActionRules[account.type]).map((action) => [
      action,
      allowedActionFor(action, account, usageCounts, limits, addOnFeatures),
    ]),
  )
  const limitAddOns = isEnterprisePlan
    ? []
    : limitAddOnOptions(account.type, baseLimits, limits, usageCounts, enabledAddOnFeatures, addOnPrices)

  const enabledMenus = account.plan.enabledMenus.filter(
    (menu) => menu !== "saved-searches" && menu !== "wishlist" && menu !== "security" && menu !== "api-keys",
  )
  enabledMenus.push(...menuKeysForFeatureSet(account.type, featureSet))

  return {
    plan: mapPlan({ ...account.plan, _count: { businessAccounts: 0 } }),
    subscription: {
      activatedAt: account.updatedAt.toISOString(),
      endsAt: toIso(addPlanPeriod(account.updatedAt, account.plan)),
    },
    usage: usageCounts,
    limits,
    enabledMenus: Array.from(new Set(enabledMenus)),
    enabledFeatures,
    lockedFeatures,
    requestableFeatures,
    limitAddOns,
    addOns: requestableFeatures,
    activeAddOns: activeAddOns.filter((item) => !isRetiredBusinessFeatureKey(item.featureKey)).map(mapActiveAddOn),
    actions,
  }
}

const planLimitMessage = (planName: string, itemLabel: string, limit: number) =>
  `Your ${planName} plan/add-ons allow up to ${limit} active ${itemLabel}. Extra ${itemLabel} were temporarily inactive and were not deleted. Increase your limit to restore more.`

const supplierPlanSuspensionMessage = (input: {
  planName: string
  productLimit: number | null
  brandLimit: number | null
  categoryLimit: number | null
}) => {
  const limits = [
    input.productLimit === null ? null : `${input.productLimit} active products`,
    input.brandLimit === null ? null : `${input.brandLimit} brands`,
    input.categoryLimit === null ? null : `${input.categoryLimit} categories`,
  ].filter((value): value is string => Boolean(value))

  return `Your ${input.planName} plan allows up to ${limits.join(", ")}. Products outside these limits were temporarily inactive and were not deleted. Upgrade your plan to restore them.`
}

const normalizeSupplierCatalogValue = (value: string | null) =>
  value?.trim().toLowerCase() || null

async function enforcePlanLimitedRecords(input: {
  account: { id: string; type: BusinessAccountType; ownerUserId: string }
  plan: {
    name: string
    vehicleLimit: number | null
    productLimit: number | null
    brandLimit: number | null
    categoryLimit: number | null
    serviceLimit: number | null
  }
}) {
  const now = new Date()
  if (input.account.type === BusinessAccountType.Garage) {
    const limit = input.plan.serviceLimit
    if (limit === null) {
      await db.garageService.updateMany({
        where: { garageId: input.account.ownerUserId, status: "plan_suspended" },
        data: { status: "active", planSuspendedAt: null, planSuspensionReason: null },
      })
      return
    }
    const services = await db.garageService.findMany({
      where: { garageId: input.account.ownerUserId, status: { in: ["active", "plan_suspended"] } },
      orderBy: [{ status: "asc" }, { bookingsCount: "desc" }, { updatedAt: "desc" }],
      select: { id: true, status: true },
    })
    const keepIds = services.slice(0, limit).map((item) => item.id)
    const reason = planLimitMessage(input.plan.name, "services", limit)
    await db.garageService.updateMany({
      where: { garageId: input.account.ownerUserId, id: { in: keepIds }, status: "plan_suspended" },
      data: { status: "active", planSuspendedAt: null, planSuspensionReason: null },
    })
    await db.garageService.updateMany({
      where: { garageId: input.account.ownerUserId, id: { notIn: keepIds }, status: "active" },
      data: { status: "plan_suspended", planSuspendedAt: now, planSuspensionReason: reason },
    })
    await db.garageService.updateMany({
      where: { garageId: input.account.ownerUserId, id: { notIn: keepIds }, status: "plan_suspended" },
      data: { planSuspendedAt: now, planSuspensionReason: reason },
    })
  }

  if (input.account.type === BusinessAccountType.Supplier) {
    const productLimit = input.plan.productLimit
    const brandLimit = input.plan.brandLimit
    const categoryLimit = input.plan.categoryLimit
    const parts = await db.supplierPart.findMany({
      where: {
        supplierId: input.account.ownerUserId,
      },
      orderBy: [{ isActive: "desc" }, { updatedAt: "desc" }],
      select: {
        id: true,
        isActive: true,
        mappingStatus: true,
        originalBrand: true,
        category: true,
      },
    })
    parts.sort((left, right) => {
      const mappedPriority =
        Number(right.mappingStatus === "mapped") -
        Number(left.mappingStatus === "mapped")
      if (mappedPriority !== 0) return mappedPriority
      return Number(right.isActive) - Number(left.isActive)
    })
    const selectedIds: string[] = []
    const selectedBrands = new Set<string>()
    const selectedCategories = new Set<string>()

    for (const part of parts) {
      if (productLimit !== null && selectedIds.length >= productLimit) break

      const brand = normalizeSupplierCatalogValue(part.originalBrand)
      const category = normalizeSupplierCatalogValue(part.category)
      if (
        brand &&
        brandLimit !== null &&
        !selectedBrands.has(brand) &&
        selectedBrands.size >= brandLimit
      ) {
        continue
      }
      if (
        category &&
        categoryLimit !== null &&
        !selectedCategories.has(category) &&
        selectedCategories.size >= categoryLimit
      ) {
        continue
      }

      selectedIds.push(part.id)
      if (brand) selectedBrands.add(brand)
      if (category) selectedCategories.add(category)
    }

    const selectedIdSet = new Set(selectedIds)
    const suspendedIds = parts
      .filter((part) => !selectedIdSet.has(part.id))
      .map((part) => part.id)
    if (selectedIds.length > 0) {
      await db.supplierPart.updateMany({
        where: {
          supplierId: input.account.ownerUserId,
          id: { in: selectedIds },
          isActive: false,
        },
        data: { isActive: true, planSuspendedAt: null, planSuspensionReason: null },
      })
    }
    if (suspendedIds.length > 0) {
      await db.supplierPart.updateMany({
        where: { supplierId: input.account.ownerUserId, id: { in: suspendedIds } },
        data: {
          isActive: false,
          planSuspendedAt: now,
          planSuspensionReason: supplierPlanSuspensionMessage({
            planName: input.plan.name,
            productLimit,
            brandLimit,
            categoryLimit,
          }),
        },
      })
    }
  }

  if (input.account.type === BusinessAccountType.Fleet) {
    const limit = input.plan.vehicleLimit
    if (limit === null) {
      await db.fleetVehicle.updateMany({
        where: { fleetId: input.account.ownerUserId, status: "plan_suspended" },
        data: { status: "active", planSuspendedAt: null, planSuspensionReason: null },
      })
      return
    }
    const vehicles = await db.fleetVehicle.findMany({
      where: { fleetId: input.account.ownerUserId },
      orderBy: [{ status: "asc" }, { isPrimary: "desc" }, { updatedAt: "desc" }],
      select: { id: true, status: true },
    })
    const keepIds = vehicles.slice(0, limit).map((item) => item.id)
    await db.fleetVehicle.updateMany({
      where: { fleetId: input.account.ownerUserId, id: { in: keepIds }, status: "plan_suspended" },
      data: { status: "active", planSuspendedAt: null, planSuspensionReason: null },
    })
    await db.fleetVehicle.updateMany({
      where: { fleetId: input.account.ownerUserId, id: { notIn: keepIds }, status: { in: ["active", "maintenance"] } },
      data: { status: "plan_suspended", planSuspendedAt: now, planSuspensionReason: planLimitMessage(input.plan.name, "vehicles", limit) },
    })
  }
}

export async function reconcileSupplierProductPlan(supplierId: string) {
  const account = await db.businessAccount.findFirst({
    where: {
      type: BusinessAccountType.Supplier,
      isActive: true,
      OR: [
        { ownerUserId: supplierId },
        {
          members: {
            some: {
              userId: supplierId,
              status: BusinessMemberStatus.Active,
            },
          },
        },
      ],
    },
    include: {
      plan: true,
      addOnRequests: { where: activeAddOnRequestWhere(), select: activeAddOnRequestSelect },
    },
  })
  if (!account) return

  const limits = effectiveLimitsForAccount(account)
  await enforcePlanLimitedRecords({
    account,
    plan: {
      ...account.plan,
      productLimit: limits.products,
      brandLimit: limits.brands,
      categoryLimit: limits.categories,
      serviceLimit: limits.services,
      vehicleLimit: limits.vehicles,
    },
  })
}

export async function reconcileGarageServicePlan(userId: string) {
  const account = await db.businessAccount.findFirst({
    where: {
      type: BusinessAccountType.Garage,
      isActive: true,
      OR: [
        { ownerUserId: userId },
        {
          members: {
            some: {
              userId,
              status: BusinessMemberStatus.Active,
            },
          },
        },
      ],
    },
    include: {
      plan: true,
      addOnRequests: { where: activeAddOnRequestWhere(), select: activeAddOnRequestSelect },
    },
  })
  if (!account) return

  const limits = effectiveLimitsForAccount(account)
  await enforcePlanLimitedRecords({
    account,
    plan: {
      ...account.plan,
      serviceLimit: limits.services,
      vehicleLimit: limits.vehicles,
      productLimit: limits.products,
      brandLimit: limits.brands,
      categoryLimit: limits.categories,
    },
  })
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

  await db.businessAccount.update({
    where: { id: account.id },
    data: { planId: nextPlan.id },
  })
  if (nextPlan.priceAmount > account.plan.priceAmount) {
    await recordBusinessPaymentTransaction({
      businessAccountId: account.id,
      payerUserId: input.ownerUserId,
      type: "plan",
      sourceId: nextPlan.id,
      sourceKey: nextPlan.code,
      description: `Plan upgraded from ${account.plan.name} to ${nextPlan.name}`,
      amount: nextPlan.priceAmount,
      currency: nextPlan.priceCurrency,
      metadata: {
        fromPlanId: account.plan.id,
        fromPlanName: account.plan.name,
        fromPlanPriceAmount: account.plan.priceAmount,
        toPlanId: nextPlan.id,
        toPlanName: nextPlan.name,
        toPlanPriceAmount: nextPlan.priceAmount,
        accountType: account.type,
      },
    })
  }
  await enforcePlanLimitedRecords({ account, plan: nextPlan })
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

export async function assignAdminBusinessAccountPlan(input: {
  adminId: string
  businessAccountId: unknown
  planId: unknown
}) {
  const businessAccountId = cleanText(input.businessAccountId, 80)
  const planId = cleanText(input.planId, 80)
  if (!businessAccountId) throw new Error("Business account id is required")
  if (!planId) throw new Error("Plan id is required")

  const account = await db.businessAccount.findFirst({
    where: { id: businessAccountId, isActive: true },
    include: { plan: true },
  })
  if (!account) throw new Error("Business account was not found")

  const nextPlan = await db.businessPlan.findFirst({
    where: { id: planId, accountType: account.type, isActive: true },
    include: planInclude,
  })
  if (!nextPlan) throw new Error("Selected plan is not available for this business type")
  if (nextPlan.id === account.planId) return mapPlan(nextPlan)

  await db.businessAccount.update({
    where: { id: account.id },
    data: { planId: nextPlan.id },
  })
  await enforcePlanLimitedRecords({ account, plan: nextPlan })
  await logBusinessActivity({
    businessAccountId: account.id,
    actorUserId: null,
    action: "business_plan.admin_assigned",
    entityType: "business_plan",
    entityId: nextPlan.id,
    metadata: {
      fromPlan: account.plan.name,
      toPlan: nextPlan.name,
      accountType: account.type,
      assignedBy: "admin",
      adminId: input.adminId,
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
    include: { plan: true, addOnRequests: { where: activeAddOnRequestWhere(), select: activeAddOnRequestSelect } },
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
  currentCount: number
}) {
  const account = await findUserBusinessAccount(input.userId, input.accountType)
  if (!account) {
    throw new Error("Business account plan is required")
  }
  const metric = limitNameToMetric(input.limit)
  const limit = metric ? effectiveLimitsForAccount(account)[metric] : account.plan[input.limit]
  if (limit !== null && input.currentCount >= limit) {
    const label = input.limit
      .replace("Limit", "")
      .replace(/([A-Z])/g, " $1")
      .toLowerCase()
    throw new Error(`${account.plan.name} ${label} limit reached. Request an add-on or upgrade your plan.`)
  }
  return account
}

export async function getEffectiveBusinessLimits(input: { userId: string; accountType: BusinessAccountType }) {
  const account = await findUserBusinessAccount(input.userId, input.accountType)
  if (!account) throw new Error("Business account plan is required")
  return {
    account,
    limits: effectiveLimitsForAccount(account),
  }
}

export async function listMyBusinessPaymentTransactions(input: {
  userId: string
  businessAccountId?: unknown
}) {
  const businessAccountId = cleanText(input.businessAccountId, 80)
  const access = await getMyBusinessAccess(input.userId)
  const account = access.find((item) => !businessAccountId || item.businessAccount.id === businessAccountId)
  if (!account) throw new Error("Business account was not found")

  const rows = await db.businessPaymentTransaction.findMany({
    where: { businessAccountId: account.businessAccount.id },
    orderBy: { createdAt: "desc" },
    take: 50,
  })
  return rows.map(mapBusinessPaymentTransaction)
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
    include: { plan: true, addOnRequests: { where: activeAddOnRequestWhere(), select: activeAddOnRequestSelect } },
  })
  if (!account) throw new Error("Business account was not found")
  return account
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
  void input
  throw new Error("Saved Searches are not available in business dashboards")
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

type BusinessPlanForAddOn = Parameters<typeof limitsForPlan>[0] & Parameters<typeof featureSetForPlan>[0]

const businessAddOnDetailsForAccount = (
  account: {
    type: BusinessAccountType
    plan: BusinessPlanForAddOn
    addOnRequests?: Array<{ featureKey: string }>
  },
  featureKey: string,
) => {
  if (account.plan.code === BusinessPlanCode.Enterprise) {
    throw new Error("Paid add-ons are not available for Enterprise plans")
  }
  const limitAddOn = parseLimitAddOnKey(featureKey)
  if (limitAddOn) {
    if (!(limitAddOnMetrics[account.type] as readonly BusinessLimitMetric[]).includes(limitAddOn.metric)) {
      throw new Error("This limit is not available for this dashboard")
    }
    const baseLimit = limitsForPlan(account.plan)[limitAddOn.metric]
    if (baseLimit === null) throw new Error("This limit is already unlimited in the current plan")
    return {
      label: `Add ${limitAddOn.extraUnits} extra ${limitAddOnLabels[limitAddOn.metric]}`,
      pricingKey: limitPriceKey(limitAddOn.metric),
      pricingModel: "per_unit" as const,
      priceQuantity: limitAddOn.extraUnits,
    }
  }

  const featureLabel = (businessRequestableFeatureLabels as Record<string, string>)[featureKey]
  if (!featureLabel || !businessEntitlementFeatures[account.type].includes(featureKey)) {
    throw new Error("This feature is not available as an add-on")
  }
  if (featureSetForPlan(account.plan).has(featureKey)) {
    throw new Error("This feature is already included in the current plan")
  }
  return {
    label: featureLabel,
    pricingKey: featureKey,
    pricingModel: "fixed" as const,
    priceQuantity: 1,
  }
}

const priceQuoteForAddOnDetails = async (
  accountType: BusinessAccountType,
  details: ReturnType<typeof businessAddOnDetailsForAccount>,
) => {
  const catalogItem = addOnCatalogItemFor(accountType, details.pricingKey)
  const rows = await readBusinessAddOnPriceRows(accountType).catch((error) => {
    logError("Unable to load business add-on price quote; continuing without add-on price", error)
    return []
  })
  const row = rows.find((item) => item.featureKey === details.pricingKey)
  return calculateAddOnPrice({
    pricingModel: catalogItem?.pricingModel ?? details.pricingModel,
    quantity: details.priceQuantity,
    priceAmount: row?.priceAmount ?? 0,
    priceCurrency: row?.priceCurrency ?? defaultAddOnPriceCurrency,
    validityDays: row?.validityDays ?? defaultAddOnValidityDays,
  })
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
  const addOnDetails = businessAddOnDetailsForAccount(account, featureKey)
  const { label } = addOnDetails
  const priceQuote = await priceQuoteForAddOnDetails(account.type, addOnDetails)
  const currentRequest = await db.businessAddOnRequest.findUnique({
    where: { businessAccountId_featureKey: { businessAccountId: account.id, featureKey } },
  })
  if (currentRequest && isActiveAddOnRequest(currentRequest)) {
    throw new Error("This add-on is already added")
  }
  const note = cleanText(input.note, 500)
  const enabledAt = new Date()
  const validUntil = addDaysUtc(enabledAt, priceQuote.validityDays)

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
      priceAmount: priceQuote.priceAmount,
      priceCurrency: priceQuote.priceCurrency,
      priceQuantity: priceQuote.priceQuantity,
      unitPriceAmount: priceQuote.unitPriceAmount,
      requestedByUserId: input.userId,
      status: BusinessAddOnRequestStatus.Enabled,
      decidedAt: enabledAt,
      validFrom: enabledAt,
      validUntil,
      renewalAt: validUntil,
    },
    update: {
      label,
      note,
      priceAmount: priceQuote.priceAmount,
      priceCurrency: priceQuote.priceCurrency,
      priceQuantity: priceQuote.priceQuantity,
      unitPriceAmount: priceQuote.unitPriceAmount,
      requestedByUserId: input.userId,
      status: BusinessAddOnRequestStatus.Enabled,
      decidedByAdminId: null,
      decidedAt: enabledAt,
      validFrom: enabledAt,
      validUntil,
      renewalAt: validUntil,
    },
  })

  await recordBusinessPaymentTransaction({
    businessAccountId: account.id,
    payerUserId: input.userId,
    type: "add_on",
    sourceId: row.id,
    sourceKey: featureKey,
    description: `Add-on enabled: ${label}`,
    amount: priceQuote.priceAmount,
    currency: priceQuote.priceCurrency,
    metadata: {
      featureKey,
      label,
      note,
      priceQuantity: priceQuote.priceQuantity,
      unitPriceAmount: priceQuote.unitPriceAmount,
      validityDays: priceQuote.validityDays,
      validFrom: toIso(row.validFrom),
      validUntil: toIso(row.validUntil),
      renewalAt: toIso(row.renewalAt),
      accountType: account.type,
      planName: account.plan.name,
    },
  })

  await logBusinessActivity({
    businessAccountId: account.id,
    actorUserId: input.userId,
    action: "business_addon.enabled",
    entityType: "business_addon",
    entityId: row.id,
    metadata: {
      featureKey,
      label,
      note,
      priceAmount: priceQuote.priceAmount,
      priceCurrency: priceQuote.priceCurrency,
      priceQuantity: priceQuote.priceQuantity,
      unitPriceAmount: priceQuote.unitPriceAmount,
      validityDays: priceQuote.validityDays,
      validFrom: toIso(row.validFrom),
      validUntil: toIso(row.validUntil),
      renewalAt: toIso(row.renewalAt),
      status: row.status,
      accountType: account.type,
      planName: account.plan.name,
    },
  })

  await createNotificationsSafely([{
    recipientUserId: input.userId,
    type: "business.addon.enabled",
    title: "Add-on enabled",
    body: `${label} is now enabled for your ${account.type} account.`,
    linkUrl: "/add-ons",
    entityType: "business_addon",
    entityId: row.id,
  }])

  const requester = await db.user.findUnique({
    where: { id: input.userId },
    select: { id: true, email: true, phone: true, firstName: true, lastName: true, companyName: true },
  })
  if (requester?.email) {
    await sendSmtpMail({
      to: requester.email,
      subject: `AutoParts Pro add-on enabled - ${label}`,
      text: [
        "Hello,",
        "",
        `Your AutoParts Pro add-on "${label}" is now enabled for "${account.name}".`,
        `Plan: ${account.plan.name}`,
        `Price: ${formatMoneyText(priceQuote.priceAmount, priceQuote.priceCurrency)}`,
        `Validity: ${priceQuote.validityDays} days`,
        `Valid until: ${formatMailDate(validUntil)}`,
        "",
        "You can use this feature from your dashboard now.",
        "",
        "AutoParts Pro Support",
      ].join("\n"),
      html: [
        `<div style="margin:0;background:#f8fafc;padding:24px 0;font-family:Arial,Helvetica,sans-serif;color:#111827">`,
        `<div style="max-width:640px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden">`,
        `<div style="background:#0f172a;color:#ffffff;padding:24px 28px">`,
        `<p style="margin:0 0 8px;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#cbd5e1">AutoParts Pro Add-ons</p>`,
        `<h1 style="margin:0;font-size:22px;line-height:1.3">Add-on enabled</h1>`,
        `</div>`,
        `<div style="padding:28px">`,
        `<p style="margin:0 0 14px;font-size:15px;line-height:1.6">Hello ${escapeHtml(fullName(requester))},</p>`,
        `<p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#334155">Your add-on is enabled and ready to use from your dashboard.</p>`,
        `<table role="presentation" style="width:100%;border-collapse:collapse;table-layout:fixed;margin:0 0 22px">`,
        `<tr><td style="width:36%;padding:10px 0;color:#64748b;vertical-align:top">Add-on</td><td style="padding:10px 0;font-weight:600;word-break:break-word">${escapeHtml(label)}</td></tr>`,
        `<tr><td style="width:36%;padding:10px 0;color:#64748b;vertical-align:top">Business</td><td style="padding:10px 0;word-break:break-word">${escapeHtml(account.name)}</td></tr>`,
        `<tr><td style="width:36%;padding:10px 0;color:#64748b;vertical-align:top">Plan</td><td style="padding:10px 0">${escapeHtml(account.plan.name)}</td></tr>`,
        `<tr><td style="width:36%;padding:10px 0;color:#64748b;vertical-align:top">Price</td><td style="padding:10px 0">${escapeHtml(formatMoneyText(priceQuote.priceAmount, priceQuote.priceCurrency))}</td></tr>`,
        `<tr><td style="width:36%;padding:10px 0;color:#64748b;vertical-align:top">Validity</td><td style="padding:10px 0">${priceQuote.validityDays} days</td></tr>`,
        `<tr><td style="width:36%;padding:10px 0;color:#64748b;vertical-align:top">Valid until</td><td style="padding:10px 0">${escapeHtml(formatMailDate(validUntil))}</td></tr>`,
        `</table>`,
        `<p style="margin:0;font-size:14px;line-height:1.6;color:#64748b">You can use this feature from your dashboard now.</p>`,
        `<p style="margin:22px 0 0;font-size:14px;color:#334155">AutoParts Pro Support</p>`,
        `</div></div></div>`,
      ].join(""),
    }).catch((error) => logError("Unable to email add-on enabled confirmation", error))
  }

  return {
    id: row.id,
    featureKey,
    label,
    status: row.status,
    priceAmount: row.priceAmount,
    priceCurrency: row.priceCurrency,
    priceQuantity: row.priceQuantity,
    unitPriceAmount: row.unitPriceAmount,
    validityDays: priceQuote.validityDays,
    validFrom: toIso(row.validFrom),
    validUntil: toIso(row.validUntil),
    renewalAt: toIso(row.renewalAt),
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
  priceAmount: row.priceAmount,
  priceCurrency: row.priceCurrency,
  priceQuantity: row.priceQuantity,
  unitPriceAmount: row.unitPriceAmount,
  requestedBy: row.requestedBy ? { id: row.requestedBy.id, name: fullName(row.requestedBy), email: row.requestedBy.email } : null,
  decidedBy: row.decidedBy ? { id: row.decidedBy.id, name: row.decidedBy.name, email: row.decidedBy.email } : null,
  decidedAt: toIso(row.decidedAt),
  validFrom: toIso(row.validFrom),
  validUntil: toIso(row.validUntil),
  renewalAt: toIso(row.renewalAt),
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

const defaultBusinessAddOnPrices = () =>
  Object.values(BusinessAccountType).flatMap((accountType) =>
    addOnCatalogForAccountType(accountType).map((item) => ({
      accountType,
      featureKey: item.featureKey,
      label: item.label,
      pricingModel: item.pricingModel,
      priceAmount: 0,
      priceCurrency: defaultAddOnPriceCurrency,
      validityDays: defaultAddOnValidityDays,
    })),
  )

export async function listAdminBusinessAddOnPrices() {
  let rows: StoredAddOnPriceRow[] = []
  try {
    rows = await readBusinessAddOnPriceRows()
  } catch (error) {
    logError("Unable to load business add-on prices; returning default catalog", error)
    return defaultBusinessAddOnPrices()
  }
  const prices = new Map(rows.map((row) => [addOnPriceMapKey(row.accountType, row.featureKey), row]))
  return defaultBusinessAddOnPrices().map((item) => {
    const row = prices.get(addOnPriceMapKey(item.accountType, item.featureKey))
    return {
      accountType: item.accountType,
      featureKey: item.featureKey,
      label: row?.label ?? item.label,
      pricingModel: item.pricingModel,
      priceAmount: row?.priceAmount ?? 0,
      priceCurrency: row?.priceCurrency ?? defaultAddOnPriceCurrency,
      validityDays: row?.validityDays ?? defaultAddOnValidityDays,
    }
  })
}

export async function updateAdminBusinessAddOnPrices(input: {
  prices: unknown
}) {
  if (!Array.isArray(input.prices)) throw new Error("Prices must be an array")
  const rows = input.prices.map((price) => {
    if (!price || typeof price !== "object") throw new Error("Each price row must be an object")
    const payload = price as Record<string, unknown>
    const accountType = cleanText(payload.accountType, 40) as BusinessAccountType | null
    if (!accountType || !Object.values(BusinessAccountType).includes(accountType)) throw new Error("Valid business type is required")
    const featureKey = cleanText(payload.featureKey, 120)
    if (!featureKey) throw new Error("Add-on key is required")
    const catalogItem = addOnCatalogItemFor(accountType, featureKey)
    if (!catalogItem) throw new Error(`${featureKey} is not a valid add-on for ${accountType}`)
    return {
      ...catalogItem,
      priceAmount: cleanPriceAmount(payload.priceAmount),
      priceCurrency: cleanPriceCurrency(payload.priceCurrency),
      validityDays: cleanValidityDays(payload.validityDays ?? defaultAddOnValidityDays),
    }
  })

  await upsertBusinessAddOnPriceRows(rows)

  return listAdminBusinessAddOnPrices()
}

export async function listAdminBusinessAddOnRequestsPage(input: {
  page?: number
  pageSize?: number
  query?: string
  status?: string
  accountType?: string
}) {
  const page = Math.max(1, input.page ?? 1)
  const pageSize = Math.min(50, Math.max(1, input.pageSize ?? 20))
  const query = cleanText(input.query, 120)
  const statuses = Object.values(BusinessAddOnRequestStatus)
  const accountTypes = Object.values(BusinessAccountType)
  const where: Prisma.BusinessAddOnRequestWhereInput = {
    ...(statuses.includes(input.status as BusinessAddOnRequestStatus) ? { status: input.status as BusinessAddOnRequestStatus } : {}),
    ...(accountTypes.includes(input.accountType as BusinessAccountType) ? { businessAccount: { type: input.accountType as BusinessAccountType } } : {}),
    ...(query ? { OR: [
      { label: { contains: query, mode: "insensitive" } },
      { featureKey: { contains: query, mode: "insensitive" } },
      { businessAccount: { name: { contains: query, mode: "insensitive" } } },
      { businessAccount: { publicId: { contains: query, mode: "insensitive" } } },
      { requestedBy: { email: { contains: query, mode: "insensitive" } } },
    ] } : {}),
  }
  const [rows, total] = await Promise.all([
    db.businessAddOnRequest.findMany({
      where,
      include: { businessAccount: { include: { plan: true } }, requestedBy: true, decidedBy: true },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    db.businessAddOnRequest.count({ where }),
  ])
  return { items: rows.map(mapAddOnRequest), total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) }
}

export async function createAdminBusinessAddOnRequest(input: {
  adminId: string
  businessAccountId: unknown
  featureKey: unknown
  note?: unknown
  status?: unknown
  validFrom?: unknown
  validUntil?: unknown
  renewalAt?: unknown
}) {
  const businessAccountId = cleanText(input.businessAccountId, 80)
  if (!businessAccountId) throw new Error("Business account ID or public ID is required")
  const featureKey = cleanText(input.featureKey, 120)
  if (!featureKey) throw new Error("Feature key is required")
  const status = (cleanText(input.status, 40) as BusinessAddOnRequestStatus | null) ?? BusinessAddOnRequestStatus.Enabled
  if (!Object.values(BusinessAddOnRequestStatus).includes(status)) {
    throw new Error("Valid add-on status is required")
  }
  const requestedValidity = cleanAddOnValidity(input)

  const account = await db.businessAccount.findFirst({
    where: {
      isActive: true,
      OR: [{ id: businessAccountId }, { publicId: businessAccountId }],
    },
    include: {
      plan: true,
      owner: { select: { id: true, email: true, phone: true, firstName: true, lastName: true, companyName: true } },
      addOnRequests: { where: activeAddOnRequestWhere(), select: activeAddOnRequestSelect },
    },
  })
  if (!account) throw new Error("Business account was not found")

  const addOnDetails = businessAddOnDetailsForAccount(account, featureKey)
  const { label } = addOnDetails
  const priceQuote = await priceQuoteForAddOnDetails(account.type, addOnDetails)
  const current = await db.businessAddOnRequest.findUnique({
    where: { businessAccountId_featureKey: { businessAccountId: account.id, featureKey } },
    select: { status: true },
  })

  const decidedAt = status === BusinessAddOnRequestStatus.Requested ? null : new Date()
  const validFrom = activeAddOnStatuses.includes(status)
    ? requestedValidity.validFrom ?? decidedAt ?? new Date()
    : requestedValidity.validFrom
  const validUntil = activeAddOnStatuses.includes(status) && !requestedValidity.validUntil
    ? addDaysUtc(validFrom ?? new Date(), priceQuote.validityDays)
    : requestedValidity.validUntil
  const validity = {
    validFrom,
    validUntil,
    renewalAt: requestedValidity.renewalAt ?? validUntil,
  }
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
      status,
      priceAmount: priceQuote.priceAmount,
      priceCurrency: priceQuote.priceCurrency,
      priceQuantity: priceQuote.priceQuantity,
      unitPriceAmount: priceQuote.unitPriceAmount,
      decidedByAdminId: decidedAt ? input.adminId : null,
      decidedAt,
      validFrom: validity.validFrom,
      validUntil: validity.validUntil,
      renewalAt: validity.renewalAt,
    },
    update: {
      label,
      note,
      status,
      priceAmount: priceQuote.priceAmount,
      priceCurrency: priceQuote.priceCurrency,
      priceQuantity: priceQuote.priceQuantity,
      unitPriceAmount: priceQuote.unitPriceAmount,
      decidedByAdminId: decidedAt ? input.adminId : null,
      decidedAt,
      validFrom: validity.validFrom,
      validUntil: validity.validUntil,
      renewalAt: validity.renewalAt,
    },
    include: {
      businessAccount: {
        include: {
          plan: true,
          owner: { select: { id: true, email: true, phone: true, firstName: true, lastName: true, companyName: true } },
          addOnRequests: { where: activeAddOnRequestWhere(), select: activeAddOnRequestSelect },
        },
      },
      requestedBy: true,
      decidedBy: true,
    },
  })

  const limitAddOn = parseLimitAddOnKey(row.featureKey)
  if (activeAddOnStatuses.includes(status) && limitAddOn && ["services", "products", "vehicles"].includes(limitAddOn.metric)) {
    const limits = effectiveLimitsForAccount(row.businessAccount)
    await enforcePlanLimitedRecords({
      account: row.businessAccount,
      plan: {
        ...row.businessAccount.plan,
        serviceLimit: limits.services,
        productLimit: limits.products,
        vehicleLimit: limits.vehicles,
      },
    })
  }

  await logBusinessActivity({
    businessAccountId: row.businessAccountId,
    action: "business_addon.admin_created",
    entityType: "business_addon",
    entityId: row.id,
    metadata: {
      featureKey,
      label,
      note,
      priceAmount: row.priceAmount,
      priceCurrency: row.priceCurrency,
      priceQuantity: row.priceQuantity,
      unitPriceAmount: row.unitPriceAmount,
      validityDays: priceQuote.validityDays,
      previousStatus: current?.status ?? null,
      status,
      validFrom: toIso(row.validFrom),
      validUntil: toIso(row.validUntil),
      renewalAt: toIso(row.renewalAt),
      adminId: input.adminId,
    },
  })

  const recipient = row.requestedBy ?? row.businessAccount.owner
  await createNotificationsSafely([{
    recipientUserId: recipient.id,
    actorAdminId: input.adminId,
    type: "business.addon.status.updated",
    title: "Add-on permission updated",
    body: `${row.label} is now ${status}.`,
    linkUrl: "/add-ons",
    entityType: "business_addon",
    entityId: row.id,
  }])
  if (recipient.email) {
    const safeLabel = escapeHtml(row.label)
    const safeBusiness = escapeHtml(row.businessAccount.name)
    const safeStatus = escapeHtml(status)
    const validFromText = formatMailDate(row.validFrom)
    const validUntilText = formatMailDate(row.validUntil)
    const renewalText = formatMailDate(row.renewalAt)
    const statusColor = addOnStatusColor(status)
    await sendSmtpMail({
      to: recipient.email,
      subject: `AutoParts Pro add-on permission update - ${row.label}`,
      text: [
        "Hello,",
        "",
        `AutoParts Pro Admin updated an add-on permission for "${row.businessAccount.name}".`,
        "",
        `Add-on: ${row.label}`,
        `Business: ${row.businessAccount.name}`,
        `Status: ${status}`,
        `Valid from: ${validFromText}`,
        `Expires on: ${validUntilText}`,
        `Renewal date: ${renewalText}`,
        "",
        activeAddOnStatuses.includes(status)
          ? "This add-on is now active for your business account. Sign in to your dashboard to use the enabled feature."
          : "Sign in to your dashboard and open Add-ons to review the request.",
        "",
        "AutoParts Pro Support",
      ].join("\n"),
      html: [
        `<div style="margin:0;background:#f8fafc;padding:24px 0;font-family:Arial,Helvetica,sans-serif;color:#111827">`,
        `<div style="max-width:640px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden">`,
        `<div style="background:#0f172a;color:#ffffff;padding:24px 28px">`,
        `<p style="margin:0 0 8px;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#cbd5e1">AutoParts Pro Add-ons</p>`,
        `<h1 style="margin:0;font-size:22px;line-height:1.3">Add-on permission updated</h1>`,
        `</div>`,
        `<div style="padding:28px">`,
        `<p style="margin:0 0 14px;font-size:15px;line-height:1.6">Hello,</p>`,
        `<p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#334155">AutoParts Pro Admin updated an add-on permission for your business account.</p>`,
        `<div style="margin:0 0 22px;padding:16px;border:1px solid #e5e7eb;border-radius:10px;background:#f8fafc">`,
        `<p style="margin:0 0 6px;font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#64748b">Current status</p>`,
        `<p style="margin:0;font-size:20px;font-weight:700;color:${statusColor}">${safeStatus}</p>`,
        `</div>`,
        `<table role="presentation" style="width:100%;border-collapse:collapse;table-layout:fixed;margin:0 0 22px">`,
        `<tr><td style="width:36%;padding:10px 0;color:#64748b;vertical-align:top">Add-on</td><td style="padding:10px 0;font-weight:600;word-break:break-word">${safeLabel}</td></tr>`,
        `<tr><td style="width:36%;padding:10px 0;color:#64748b;vertical-align:top">Business</td><td style="padding:10px 0;word-break:break-word">${safeBusiness}</td></tr>`,
        `<tr><td style="width:36%;padding:10px 0;color:#64748b;vertical-align:top">Status</td><td style="padding:10px 0;font-weight:600;color:${statusColor}">${safeStatus}</td></tr>`,
        `<tr><td style="width:36%;padding:10px 0;color:#64748b;vertical-align:top">Valid from</td><td style="padding:10px 0">${escapeHtml(validFromText)}</td></tr>`,
        `<tr><td style="width:36%;padding:10px 0;color:#64748b;vertical-align:top">Expires on</td><td style="padding:10px 0">${escapeHtml(validUntilText)}</td></tr>`,
        `<tr><td style="width:36%;padding:10px 0;color:#64748b;vertical-align:top">Renewal date</td><td style="padding:10px 0">${escapeHtml(renewalText)}</td></tr>`,
        `</table>`,
        `<p style="margin:0;font-size:14px;line-height:1.6;color:#64748b">${
          activeAddOnStatuses.includes(status)
            ? "This add-on is now active for your business account. Sign in to your dashboard to use the enabled feature."
            : "Sign in to your dashboard and open Add-ons to review the request."
        }</p>`,
        `<p style="margin:22px 0 0;font-size:14px;color:#334155">AutoParts Pro Support</p>`,
        `</div></div></div>`,
      ].join(""),
    }).catch((error) => logError("Unable to email admin-created add-on update", error))
  }

  return mapAddOnRequest(row)
}

export async function updateAdminBusinessAddOnRequest(input: {
  adminId: string
  id: unknown
  status: unknown
  validFrom?: unknown
  validUntil?: unknown
  renewalAt?: unknown
}) {
  const id = cleanText(input.id, 80)
  if (!id) throw new Error("Add-on request id is required")
  const status = cleanText(input.status, 40) as BusinessAddOnRequestStatus | null
  if (!status || !Object.values(BusinessAddOnRequestStatus).includes(status)) {
    throw new Error("Valid add-on status is required")
  }
  const current = await db.businessAddOnRequest.findUnique({
    where: { id },
    select: { status: true, validFrom: true, validUntil: true, renewalAt: true },
  })
  if (!current) throw new Error("Add-on request was not found")
  const hasValidityField = (key: "validFrom" | "validUntil" | "renewalAt") => input[key] !== undefined
  const validity = {
    validFrom: hasValidityField("validFrom") ? cleanDate(input.validFrom, "Valid from") : current.validFrom,
    validUntil: hasValidityField("validUntil") ? cleanDate(input.validUntil, "Valid until", true) : current.validUntil,
    renewalAt: hasValidityField("renewalAt") ? cleanDate(input.renewalAt, "Renewal date") : current.renewalAt,
  }
  if (validity.validFrom && validity.validUntil && validity.validUntil <= validity.validFrom) {
    throw new Error("Valid until must be after valid from")
  }
  const validityChanged =
    !sameDateValue(current.validFrom, validity.validFrom) ||
    !sameDateValue(current.validUntil, validity.validUntil) ||
    !sameDateValue(current.renewalAt, validity.renewalAt)
  if (current.status === status && !validityChanged) {
    const existing = await db.businessAddOnRequest.findUniqueOrThrow({
      where: { id },
      include: { businessAccount: { include: { plan: true } }, requestedBy: true, decidedBy: true },
    })
    return mapAddOnRequest(existing)
  }
  const row = await db.businessAddOnRequest.update({
    where: { id },
    data: {
      status,
      decidedByAdminId: input.adminId,
      decidedAt: new Date(),
      validFrom: validity.validFrom,
      validUntil: validity.validUntil,
      renewalAt: validity.renewalAt,
    },
    include: {
      businessAccount: {
        include: {
          plan: true,
          owner: { select: { id: true, email: true, phone: true, firstName: true, lastName: true, companyName: true } },
          addOnRequests: { where: activeAddOnRequestWhere(), select: activeAddOnRequestSelect },
        },
      },
      requestedBy: true,
      decidedBy: true,
    },
  })
  const limitAddOn = parseLimitAddOnKey(row.featureKey)
  if (limitAddOn && ["services", "products", "vehicles"].includes(limitAddOn.metric)) {
    const limits = effectiveLimitsForAccount(row.businessAccount)
    await enforcePlanLimitedRecords({
      account: row.businessAccount,
      plan: {
        ...row.businessAccount.plan,
        serviceLimit: limits.services,
        productLimit: limits.products,
        vehicleLimit: limits.vehicles,
      },
    })
  }
  await logBusinessActivity({
    businessAccountId: row.businessAccountId,
    action: "business_addon.status_changed",
    entityType: "business_addon",
    entityId: row.id,
    metadata: {
      featureKey: row.featureKey,
      label: row.label,
      previousStatus: current.status,
      status,
      validFrom: toIso(row.validFrom),
      validUntil: toIso(row.validUntil),
      renewalAt: toIso(row.renewalAt),
    },
  })
  const recipient = row.requestedBy ?? row.businessAccount.owner
  if (recipient) {
    await createNotificationsSafely([{
      recipientUserId: recipient.id,
      actorAdminId: input.adminId,
      type: "business.addon.status.updated",
      title: "Add-on request updated",
      body: `${row.label} changed from ${current.status} to ${status}.`,
      linkUrl: "/add-ons",
      entityType: "business_addon",
      entityId: row.id,
    }])
    if (recipient.email) {
      const safeLabel = escapeHtml(row.label)
      const safeBusiness = escapeHtml(row.businessAccount.name)
      const safePreviousStatus = escapeHtml(current.status)
      const safeStatus = escapeHtml(status)
      const validFromText = formatMailDate(row.validFrom)
      const validUntilText = formatMailDate(row.validUntil)
      const renewalText = formatMailDate(row.renewalAt)
      const statusColor = addOnStatusColor(status)
      await sendSmtpMail({
        to: recipient.email,
        subject: `AutoParts Pro add-on request update - ${row.label}`,
        text: [
          "Hello,",
          "",
          `The status of your AutoParts Pro add-on request "${row.label}" has been updated.`,
          "",
          `Add-on: ${row.label}`,
          `Business: ${row.businessAccount.name}`,
          `Previous status: ${current.status}`,
          `New status: ${status}`,
          `Valid from: ${validFromText}`,
          `Expires on: ${validUntilText}`,
          `Renewal date: ${renewalText}`,
          "",
          activeAddOnStatuses.includes(status)
            ? "Your add-on is now active for this business account. Sign in to your dashboard to use the enabled feature."
            : "Sign in to your dashboard and open Add-ons to review the request.",
          "",
          "AutoParts Pro Support",
        ].join("\n"),
        html: [
          `<div style="margin:0;background:#f8fafc;padding:24px 0;font-family:Arial,Helvetica,sans-serif;color:#111827">`,
          `<div style="max-width:640px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden">`,
          `<div style="background:#0f172a;color:#ffffff;padding:24px 28px">`,
          `<p style="margin:0 0 8px;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#cbd5e1">AutoParts Pro Add-ons</p>`,
          `<h1 style="margin:0;font-size:22px;line-height:1.3">Add-on request updated</h1>`,
          `</div>`,
          `<div style="padding:28px">`,
          `<p style="margin:0 0 14px;font-size:15px;line-height:1.6">Hello,</p>`,
          `<p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#334155">We updated the status of your AutoParts Pro add-on request.</p>`,
          `<div style="margin:0 0 22px;padding:16px;border:1px solid #e5e7eb;border-radius:10px;background:#f8fafc">`,
          `<p style="margin:0 0 6px;font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#64748b">Current status</p>`,
          `<p style="margin:0;font-size:20px;font-weight:700;color:${statusColor}">${safeStatus}</p>`,
          `</div>`,
          `<table role="presentation" style="width:100%;border-collapse:collapse;table-layout:fixed;margin:0 0 22px">`,
          `<tr><td style="width:36%;padding:10px 0;color:#64748b;vertical-align:top">Add-on</td><td style="padding:10px 0;font-weight:600;word-break:break-word">${safeLabel}</td></tr>`,
          `<tr><td style="width:36%;padding:10px 0;color:#64748b;vertical-align:top">Business</td><td style="padding:10px 0;word-break:break-word">${safeBusiness}</td></tr>`,
          `<tr><td style="width:36%;padding:10px 0;color:#64748b;vertical-align:top">Previous status</td><td style="padding:10px 0">${safePreviousStatus}</td></tr>`,
          `<tr><td style="width:36%;padding:10px 0;color:#64748b;vertical-align:top">New status</td><td style="padding:10px 0;font-weight:600;color:${statusColor}">${safeStatus}</td></tr>`,
          `<tr><td style="width:36%;padding:10px 0;color:#64748b;vertical-align:top">Valid from</td><td style="padding:10px 0">${escapeHtml(validFromText)}</td></tr>`,
          `<tr><td style="width:36%;padding:10px 0;color:#64748b;vertical-align:top">Expires on</td><td style="padding:10px 0">${escapeHtml(validUntilText)}</td></tr>`,
          `<tr><td style="width:36%;padding:10px 0;color:#64748b;vertical-align:top">Renewal date</td><td style="padding:10px 0">${escapeHtml(renewalText)}</td></tr>`,
          `</table>`,
          `<p style="margin:0;font-size:14px;line-height:1.6;color:#64748b">${
            activeAddOnStatuses.includes(status)
              ? "Your add-on is now active for this business account. Sign in to your dashboard to use the enabled feature."
              : "Sign in to your dashboard and open Add-ons to review the request."
          }</p>`,
          `<p style="margin:22px 0 0;font-size:14px;color:#334155">AutoParts Pro Support</p>`,
          `</div></div></div>`,
        ].join(""),
      }).catch((error) => logError("Unable to email add-on status update", error))
    }
  }
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
  category: row.category,
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
  page?: unknown
  pageSize?: unknown
}) {
  const account = await findWritableBusinessAccount(input.userId, input.businessAccountId)
  const page = Math.max(1, Number(input.page) || 1)
  const pageSize = Math.min(25, Math.max(1, Number(input.pageSize) || 10))
  const where = { businessAccountId: account.id }
  const [rows, total] = await Promise.all([
    db.businessSupportTicket.findMany({
      where,
      include: { businessAccount: { include: { plan: true } }, createdBy: true, assignedAdmin: true },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    db.businessSupportTicket.count({ where }),
  ])
  return { items: rows.map(mapSupportTicket), total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) }
}

export async function createBusinessSupportTicket(input: {
  userId: string
  businessAccountId: unknown
  subject: unknown
  message: unknown
  category?: unknown
}) {
  const account = await findWritableBusinessAccount(input.userId, input.businessAccountId)
  const subject = cleanText(input.subject, 150)
  const message = cleanText(input.message, 2000)
  const category = cleanText(input.category, 80)
  if (!subject) throw new Error("Support subject is required")
  if (!message) throw new Error("Support message is required")
  if (textLength(input.subject) < 3 || textLength(input.subject) > 150) {
    throw new Error("Subject must be between 3 and 150 characters")
  }
  if (textLength(input.message) < 10 || textLength(input.message) > 2000) {
    throw new Error("Message must be between 10 and 2000 characters")
  }
  const allowedCategories =
    account.plan.supportTier === "Premium"
      ? new Set(["booking_completion", "account_assistance", "onboarding_training"])
      : account.plan.supportTier === "Standard"
        ? new Set(["booking_completion", "account_assistance"])
        : new Set(["booking_completion"])
  if (category && !allowedCategories.has(category)) throw new Error("This support option is not included in your current plan")

  const row = await db.businessSupportTicket.create({
    data: {
      businessAccountId: account.id,
      subject,
      message,
      category,
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
    metadata: { ticketCode: supportTicketCode(row.id), subject, priority: row.priority, category },
  })
  if (row.createdBy?.email) {
    const ticketCode = supportTicketCode(row.id)
    const safeTicketCode = escapeHtml(ticketCode)
    const safeSubject = escapeHtml(row.subject)
    const safeMessage = escapeHtml(row.message)
    const safeBusiness = escapeHtml(row.businessAccount.name)
    const safeStatus = escapeHtml(supportTicketStatusLabel(row.status))
    await sendSmtpMail({
      to: row.createdBy.email,
      subject: `AutoParts Pro support ticket created - ${ticketCode}`,
      text: [
        "Hello,",
        "",
        "Your AutoParts Pro support ticket has been created successfully.",
        "",
        `Ticket ID: ${ticketCode}`,
        `Issue: ${row.subject}`,
        `Business: ${row.businessAccount.name}`,
        `Status: ${supportTicketStatusLabel(row.status)}`,
        "",
        "Issue details:",
        row.message,
        "",
        "Our support team will contact you shortly or help resolve your problem.",
        "",
        "AutoParts Pro Support",
      ].join("\n"),
      html: [
        `<div style="margin:0;background:#f8fafc;padding:24px 0;font-family:Arial,Helvetica,sans-serif;color:#111827">`,
        `<div style="max-width:640px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden">`,
        `<div style="background:#0f172a;color:#ffffff;padding:24px 28px">`,
        `<p style="margin:0 0 8px;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#cbd5e1">AutoParts Pro Support</p>`,
        `<h1 style="margin:0;font-size:22px;line-height:1.3">Support ticket created</h1>`,
        `</div>`,
        `<div style="padding:28px">`,
        `<p style="margin:0 0 14px;font-size:15px;line-height:1.6">Hello,</p>`,
        `<p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#334155">Your support ticket has been created successfully. Our team will contact you shortly or help resolve your problem.</p>`,
        `<div style="margin:0 0 22px;padding:16px;border:1px solid #e5e7eb;border-radius:10px;background:#f8fafc">`,
        `<p style="margin:0 0 6px;font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#64748b">Ticket ID</p>`,
        `<p style="margin:0;font-size:20px;font-weight:700;color:#dc2626">${safeTicketCode}</p>`,
        `</div>`,
        `<table role="presentation" style="width:100%;border-collapse:collapse;table-layout:fixed;margin:0 0 22px">`,
        `<tr><td style="width:36%;padding:10px 0;color:#64748b;vertical-align:top">Issue</td><td style="padding:10px 0;font-weight:600;word-break:break-word">${safeSubject}</td></tr>`,
        `<tr><td style="width:36%;padding:10px 0;color:#64748b;vertical-align:top">Business</td><td style="padding:10px 0;word-break:break-word">${safeBusiness}</td></tr>`,
        `<tr><td style="width:36%;padding:10px 0;color:#64748b;vertical-align:top">Status</td><td style="padding:10px 0;font-weight:600">${safeStatus}</td></tr>`,
        `</table>`,
        `<p style="margin:0 0 8px;font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#64748b">Issue details</p>`,
        `<p style="margin:0;white-space:pre-wrap;word-break:break-word;font-size:14px;line-height:1.6;color:#334155">${safeMessage}</p>`,
        `<p style="margin:22px 0 0;font-size:14px;color:#334155">AutoParts Pro Support</p>`,
        `</div></div></div>`,
      ].join(""),
    }).catch((error) => logError("Unable to email support ticket creation", error))
  }
  return mapSupportTicket(row)
}

const supportVideoUrl = async (videoUrl: string) => {
  if (!/^(s3:\/\/)|amazonaws\.com|business-support\/videos\//i.test(videoUrl)) {
    return videoUrl
  }

  try {
    const key = getS3ObjectKeyFromUrl(videoUrl)
    return key ? await createSignedS3ObjectUrl(key, 60 * 60) : videoUrl
  } catch (error) {
    logError("[business-support] signed video url failed", error)
    return videoUrl
  }
}

const youtubeEmbedUrl = (value: string): string | null => {
  try {
    const url = new URL(value)
    const host = url.hostname.replace(/^www\./, "").toLowerCase()
    let videoId = ""

    if (host === "youtu.be") {
      videoId = url.pathname.split("/").filter(Boolean)[0] ?? ""
    } else if (host === "youtube.com" || host === "m.youtube.com" || host === "youtube-nocookie.com") {
      const [first, second] = url.pathname.split("/").filter(Boolean)
      videoId = first === "embed" || first === "shorts" || first === "live" ? second ?? "" : url.searchParams.get("v") ?? ""
    }

    return /^[A-Za-z0-9_-]{11}$/.test(videoId) ? `https://www.youtube.com/embed/${videoId}` : null
  } catch {
    return null
  }
}

const mapSupportVideo = async (row: {
  id: string
  accountType: BusinessAccountType
  supportTier: string
  title: string
  description: string | null
  videoUrl: string
  sortOrder: number
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}) => ({
  id: row.id,
  accountType: row.accountType,
  supportTier: row.supportTier,
  title: row.title,
  description: row.description,
  videoUrl: await supportVideoUrl(row.videoUrl),
  storedVideoUrl: row.videoUrl,
  sortOrder: row.sortOrder,
  isActive: row.isActive,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
})

const mapSupportFaq = (row: {
  id: string
  accountType: BusinessAccountType
  supportTier: string
  question: string
  answer: string
  sortOrder: number
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}) => ({
  id: row.id,
  accountType: row.accountType,
  supportTier: row.supportTier,
  question: row.question,
  answer: row.answer,
  sortOrder: row.sortOrder,
  isActive: row.isActive,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
})

export async function listAdminBusinessSupportContent() {
  const [videos, faqs] = await Promise.all([
    db.businessSupportVideo.findMany({ orderBy: [{ accountType: "asc" }, { createdAt: "desc" }] }),
    db.businessSupportFaq.findMany({ orderBy: [{ accountType: "asc" }, { sortOrder: "asc" }, { createdAt: "desc" }] }),
  ])
  return {
    videos: await Promise.all(videos.map(mapSupportVideo)),
    faqs: faqs.map(mapSupportFaq),
  }
}

export async function listBusinessSupportContent(input: { userId: string; businessAccountId: unknown }) {
  const account = await findWritableBusinessAccount(input.userId, input.businessAccountId)
  const [videos, faqs] = await Promise.all([
    db.businessSupportVideo.findMany({ where: { accountType: account.type, isActive: true }, orderBy: [{ createdAt: "desc" }] }),
    db.businessSupportFaq.findMany({ where: { accountType: account.type, isActive: true }, orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }] }),
  ])
  return {
    supportTier: account.plan.supportTier,
    supportSummary:
      account.plan.supportTier === "Premium"
        ? "Help videos, FAQ, priority support, faster response, account assistance, onboarding, and training support."
        : account.plan.supportTier === "Standard"
          ? "Help videos, FAQ, support request, faster response, and basic account assistance."
          : "Help videos, FAQ, and standard support request.",
    ticketCategories:
      account.plan.supportTier === "Premium"
        ? [
            { value: "booking_completion", label: "Booking completion / close request" },
            { value: "account_assistance", label: "Account assistance" },
            { value: "onboarding_training", label: "Onboarding / training support" },
          ]
        : account.plan.supportTier === "Standard"
          ? [
              { value: "booking_completion", label: "Booking completion / close request" },
              { value: "account_assistance", label: "Account assistance" },
            ]
          : [{ value: "booking_completion", label: "Booking completion / close request" }],
    videos: await Promise.all(videos.map(mapSupportVideo)),
    faqs: faqs.map(mapSupportFaq),
  }
}

export async function upsertAdminBusinessSupportContent(input: {
  adminId: string
  kind: unknown
  id?: unknown
  accountType: unknown
  supportTier: unknown
  title?: unknown
  description?: unknown
  videoUrl?: unknown
  question?: unknown
  answer?: unknown
  sortOrder?: unknown
  isActive?: unknown
}) {
  const kind = cleanText(input.kind, 20)
  const id = cleanText(input.id, 80)
  const accountType = cleanText(input.accountType, 20) as BusinessAccountType | null
  const supportTier = "Basic"
  if (kind !== "video" && kind !== "faq") throw new Error("Content type is required")
  if (!accountType || !Object.values(BusinessAccountType).includes(accountType)) throw new Error("Valid dashboard type is required")
  const sortOrder = Number(input.sortOrder ?? 0)
  if (!Number.isInteger(sortOrder) || sortOrder < 0 || sortOrder > 9999) throw new Error("Sort order must be a whole number between 0 and 9999")
  const isActive = typeof input.isActive === "boolean" ? input.isActive : true

  if (kind === "video") {
    const title = cleanText(input.title, 160)
    const videoUrl = cleanText(input.videoUrl, 1000)
    if (!title || title.length < 2) throw new Error("Video title must be at least 2 characters")
    if (!videoUrl) throw new Error("Video URL is required")
    let parsedVideoUrl: URL
    try {
      parsedVideoUrl = new URL(videoUrl)
    } catch {
      throw new Error("Video URL must be valid")
    }
    if (!["http:", "https:"].includes(parsedVideoUrl.protocol)) throw new Error("Video URL must start with http or https")
    const isUploadedS3Video = /amazonaws\.com|business-support\/videos\//i.test(videoUrl)
    const normalizedVideoUrl = isUploadedS3Video ? videoUrl : youtubeEmbedUrl(videoUrl)
    if (!normalizedVideoUrl) throw new Error("Video URL must be a valid YouTube link")
    const data = { accountType, supportTier, title, description: null, videoUrl: normalizedVideoUrl, sortOrder, isActive }
    const existingVideo = id ? { id } : null
    const row = existingVideo ? await db.businessSupportVideo.update({ where: { id: existingVideo.id }, data }) : await db.businessSupportVideo.create({ data })
    await logBusinessActivity({ action: "business_support_video.saved", entityType: "business_support_video", entityId: row.id, metadata: { adminId: input.adminId, accountType, supportTier } })
    return { video: await mapSupportVideo(row) }
  }

  const question = normalizeText(input.question)
  const answer = normalizeText(input.answer)
  if (!question) throw new Error("FAQ question is required")
  if (question.length < 5) throw new Error("FAQ question must be at least 5 characters")
  if (question.length > 300) throw new Error("FAQ question must be 300 characters or fewer")
  if (wordCount(question) < faqQuestionMinWords) throw new Error(`FAQ question must be at least ${faqQuestionMinWords} words`)
  if (wordCount(question) > faqQuestionMaxWords) throw new Error(`FAQ question must be ${faqQuestionMaxWords} words or fewer`)
  if (!answer) throw new Error("FAQ answer is required")
  if (answer.length < 10) throw new Error("FAQ answer must be at least 10 characters")
  if (answer.length > 2000) throw new Error("FAQ answer must be 2000 characters or fewer")
  if (wordCount(answer) < faqAnswerMinWords) throw new Error(`FAQ answer must be at least ${faqAnswerMinWords} words`)
  if (wordCount(answer) > faqAnswerMaxWords) throw new Error(`FAQ answer must be ${faqAnswerMaxWords} words or fewer`)
  const data = { accountType, supportTier, question, answer, sortOrder, isActive }
  const row = id ? await db.businessSupportFaq.update({ where: { id }, data }) : await db.businessSupportFaq.create({ data })
  await logBusinessActivity({ action: "business_support_faq.saved", entityType: "business_support_faq", entityId: row.id, metadata: { adminId: input.adminId, accountType, supportTier } })
  return { faq: mapSupportFaq(row) }
}

export async function deleteAdminBusinessSupportContent(input: { adminId: string; kind: unknown; id: unknown }) {
  const kind = cleanText(input.kind, 20)
  const id = cleanText(input.id, 80)
  if (kind !== "video" && kind !== "faq") throw new Error("Content type is required")
  if (!id) throw new Error("Content id is required")

  if (kind === "video") {
    const row = await db.businessSupportVideo.delete({ where: { id } })
    if (/^(s3:\/\/)|amazonaws\.com|business-support\/videos\//i.test(row.videoUrl)) {
      try {
        const key = getS3ObjectKeyFromUrl(row.videoUrl)
        if (key) await deleteObjectFromS3(key)
      } catch (error) {
        logError("[business-support] delete video object failed", error)
      }
    }
    await logBusinessActivity({ action: "business_support_video.deleted", entityType: "business_support_video", entityId: row.id, metadata: { adminId: input.adminId, accountType: row.accountType } })
    return { kind, id: row.id }
  }

  const row = await db.businessSupportFaq.delete({ where: { id } })
  await logBusinessActivity({ action: "business_support_faq.deleted", entityType: "business_support_faq", entityId: row.id, metadata: { adminId: input.adminId, accountType: row.accountType } })
  return { kind, id: row.id }
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

export async function listAdminBusinessSupportTicketsPage(input: {
  page?: number
  pageSize?: number
  query?: string
  status?: string
  accountType?: string
}) {
  const page = Math.max(1, input.page ?? 1)
  const pageSize = Math.min(50, Math.max(1, input.pageSize ?? 20))
  const query = cleanText(input.query, 120)
  const statuses = Object.values(BusinessSupportTicketStatus)
  const accountTypes = Object.values(BusinessAccountType)
  const where: Prisma.BusinessSupportTicketWhereInput = {
    ...(statuses.includes(input.status as BusinessSupportTicketStatus) ? { status: input.status as BusinessSupportTicketStatus } : {}),
    ...(accountTypes.includes(input.accountType as BusinessAccountType) ? { businessAccount: { type: input.accountType as BusinessAccountType } } : {}),
    ...(query ? { OR: [
      { subject: { contains: query, mode: "insensitive" } },
      { message: { contains: query, mode: "insensitive" } },
      { category: { contains: query, mode: "insensitive" } },
      { businessAccount: { name: { contains: query, mode: "insensitive" } } },
      { businessAccount: { publicId: { contains: query, mode: "insensitive" } } },
      { createdBy: { email: { contains: query, mode: "insensitive" } } },
    ] } : {}),
  }
  const [rows, total] = await Promise.all([
    db.businessSupportTicket.findMany({
      where,
      include: { businessAccount: { include: { plan: true } }, createdBy: true, assignedAdmin: true },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    db.businessSupportTicket.count({ where }),
  ])
  return { items: rows.map(mapSupportTicket), total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) }
}

export async function getAdminBusinessWorkflowCounts() {
  const [pendingAddOns, requestedAddOns, paidAddOns, activeTickets, newTickets] = await Promise.all([
    db.businessAddOnRequest.count({ where: { status: { in: [BusinessAddOnRequestStatus.Requested, BusinessAddOnRequestStatus.Approved] } } }),
    db.businessAddOnRequest.count({ where: { status: BusinessAddOnRequestStatus.Requested } }),
    db.businessAddOnRequest.count({ where: { status: { in: activeAddOnStatuses } } }),
    db.businessSupportTicket.count({ where: { status: { in: [BusinessSupportTicketStatus.Open, BusinessSupportTicketStatus.InProgress] } } }),
    db.businessSupportTicket.count({ where: { status: BusinessSupportTicketStatus.Open } }),
  ])
  return { pendingAddOns, requestedAddOns, paidAddOns, activeTickets, newTickets }
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
  const current = await db.businessSupportTicket.findUnique({
    where: { id },
    include: { businessAccount: { include: { plan: true } }, createdBy: true, assignedAdmin: true },
  })
  if (!current) throw new Error("Support ticket was not found")
  if (current.status === status) return mapSupportTicket(current)
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
    metadata: { subject: row.subject, previousStatus: current.status, status },
  })
  const displayStatus = supportTicketStatusLabel(status)
  const previousDisplayStatus = supportTicketStatusLabel(current.status)
  const ticketCode = supportTicketCode(row.id)
  if (row.createdBy) {
    await createNotificationsSafely([{
      recipientUserId: row.createdBy.id,
      actorAdminId: input.adminId,
      type: "business.support.status.updated",
      title: "Support ticket updated",
      body: `${ticketCode} changed from ${previousDisplayStatus} to ${displayStatus}.`,
      linkUrl: "/support",
      entityType: "business_support_ticket",
      entityId: row.id,
    }])
    if (row.createdBy.email) {
      const safeTicketCode = escapeHtml(ticketCode)
      const safeSubject = escapeHtml(row.subject)
      const safeMessage = escapeHtml(row.message)
      const safeBusiness = escapeHtml(row.businessAccount.name)
      const safePreviousStatus = escapeHtml(previousDisplayStatus)
      const safeStatus = escapeHtml(displayStatus)
      const statusColor = supportTicketStatusColor(status)
      await sendSmtpMail({
        to: row.createdBy.email,
        subject: `AutoParts Pro support ticket update - ${ticketCode}`,
        text: [
          "Hello,",
          "",
          `The status of your AutoParts Pro support ticket ${ticketCode} has been updated.`,
          "",
          `Ticket ID: ${ticketCode}`,
          `Issue: ${row.subject}`,
          `Business: ${row.businessAccount.name}`,
          `Previous status: ${previousDisplayStatus}`,
          `New status: ${displayStatus}`,
          "",
          "Issue details:",
          row.message,
          "",
          "No action is required unless you need to add more information. Sign in to your dashboard and open Support to view the full ticket history.",
          "",
          "AutoParts Pro Support",
        ].join("\n"),
        html: [
          `<div style="margin:0;background:#f8fafc;padding:24px 0;font-family:Arial,Helvetica,sans-serif;color:#111827">`,
          `<div style="max-width:640px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden">`,
          `<div style="background:#0f172a;color:#ffffff;padding:24px 28px">`,
          `<p style="margin:0 0 8px;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#cbd5e1">AutoParts Pro Support</p>`,
          `<h1 style="margin:0;font-size:22px;line-height:1.3">Ticket status updated</h1>`,
          `</div>`,
          `<div style="padding:28px">`,
          `<p style="margin:0 0 14px;font-size:15px;line-height:1.6">Hello,</p>`,
          `<p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#334155">We updated the status of your AutoParts Pro support ticket.</p>`,
          `<div style="margin:0 0 22px;padding:16px;border:1px solid #e5e7eb;border-radius:10px;background:#f8fafc">`,
          `<p style="margin:0 0 6px;font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#64748b">Current status</p>`,
          `<p style="margin:0;font-size:20px;font-weight:700;color:${statusColor}">${safeStatus}</p>`,
          `</div>`,
          `<table role="presentation" style="width:100%;border-collapse:collapse;table-layout:fixed;margin:0 0 22px">`,
          `<tr><td style="width:36%;padding:10px 0;color:#64748b;vertical-align:top">Ticket ID</td><td style="padding:10px 0;font-weight:600;word-break:break-word">${safeTicketCode}</td></tr>`,
          `<tr><td style="width:36%;padding:10px 0;color:#64748b;vertical-align:top">Issue</td><td style="padding:10px 0;font-weight:600;word-break:break-word">${safeSubject}</td></tr>`,
          `<tr><td style="width:36%;padding:10px 0;color:#64748b;vertical-align:top">Business</td><td style="padding:10px 0;word-break:break-word">${safeBusiness}</td></tr>`,
          `<tr><td style="width:36%;padding:10px 0;color:#64748b;vertical-align:top">Previous status</td><td style="padding:10px 0">${safePreviousStatus}</td></tr>`,
          `<tr><td style="width:36%;padding:10px 0;color:#64748b;vertical-align:top">New status</td><td style="padding:10px 0;font-weight:600;color:${statusColor}">${safeStatus}</td></tr>`,
          `</table>`,
          `<p style="margin:0 0 8px;font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#64748b">Issue details</p>`,
          `<p style="margin:0 0 22px;white-space:pre-wrap;word-break:break-word;font-size:14px;line-height:1.6;color:#334155">${safeMessage}</p>`,
          `<p style="margin:0;font-size:14px;line-height:1.6;color:#64748b">No action is required unless you need to add more information. Sign in to your dashboard and open Support to view the full ticket history.</p>`,
          `<p style="margin:22px 0 0;font-size:14px;color:#334155">AutoParts Pro Support</p>`,
          `</div></div></div>`,
        ].join(""),
      }).catch((error) => logError("Unable to email support ticket status update", error))
    }
  }
  return mapSupportTicket(row)
}

export async function deleteAdminBusinessSupportTicket(input: { adminId: string; id: unknown }) {
  const id = cleanText(input.id, 80)
  if (!id) throw new Error("Support ticket id is required")
  const row = await db.businessSupportTicket.delete({ where: { id } })
  await logBusinessActivity({
    businessAccountId: row.businessAccountId,
    action: "business_support_ticket.deleted",
    entityType: "business_support_ticket",
    entityId: row.id,
    metadata: { subject: row.subject, deletedByAdminId: input.adminId },
  })
  return { id: row.id }
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
  void input
  throw new Error("Wishlist is not available in business dashboards")
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
      where: { supplierId: input.userId, isActive: true, originalBrand: { not: null } },
      select: { originalBrand: true },
      distinct: ["originalBrand"],
    }),
    db.supplierPart.findMany({
      where: { supplierId: input.userId, isActive: true, category: { not: null } },
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

  const limits = effectiveLimitsForAccount(account)
  if (limits.brands !== null && brandValues.size > limits.brands) {
    throw new Error(`${account.plan.name} brand limit reached. Upgrade your plan.`)
  }
  if (limits.categories !== null && categoryValues.size > limits.categories) {
    throw new Error(`${account.plan.name} category limit reached. Upgrade your plan.`)
  }

  return account
}

export async function listBusinessAccounts() {
  await ensureFreeBusinessAccountsForExistingUsers()
  const accounts = await db.businessAccount.findMany({
    include: accountInclude(),
    orderBy: { createdAt: "desc" },
  })
  return accounts.map(mapAccount)
}

export async function searchBusinessAccountOptions(input: {
  query?: unknown
  limit?: unknown
}) {
  await ensureFreeBusinessAccountsForExistingUsers()
  const query = cleanText(input.query, 100)
  const limit = Math.min(Math.max(Number(input.limit) || 12, 5), 25)
  const where: Prisma.BusinessAccountWhereInput = {
    isActive: true,
    ...(query
      ? {
          OR: [
            { publicId: { contains: query, mode: "insensitive" } },
            { name: { contains: query, mode: "insensitive" } },
            { owner: { is: { email: { contains: query, mode: "insensitive" } } } },
            { owner: { is: { phone: { contains: query, mode: "insensitive" } } } },
            { owner: { is: { firstName: { contains: query, mode: "insensitive" } } } },
            { owner: { is: { lastName: { contains: query, mode: "insensitive" } } } },
            { owner: { is: { companyName: { contains: query, mode: "insensitive" } } } },
          ],
        }
      : {}),
  }
  const accounts = await db.businessAccount.findMany({
    where,
    orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
    take: limit,
    select: {
      id: true,
      publicId: true,
      name: true,
      type: true,
      owner: {
        select: {
          email: true,
          phone: true,
          firstName: true,
          lastName: true,
          companyName: true,
        },
      },
      plan: { select: { name: true } },
    },
  })
  return accounts.map((account) => ({
    id: account.id,
    publicId: account.publicId,
    name: account.name,
    type: account.type,
    planName: account.plan.name,
    owner: {
      name: fullName(account.owner),
      email: account.owner.email,
      phone: account.owner.phone,
    },
  }))
}

export async function getBusinessAccount(id: string) {
  await ensureDefaultBusinessPlans()
  const account = await db.businessAccount.findUnique({
    where: { id },
    include: accountInclude(),
  })
  return account ? mapAccount(account) : null
}

export async function ensureBusinessAccountForOwner(input: {
  userId: string
  role: UserRole
  name: string | null
  planCode?: BusinessPlanCode
}) {
  if (!isBusinessUserRole(input.role)) return null

  const type = userRoleToAccountType(input.role)
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

export async function getBusinessAccountOwnerId(
  userId: string,
  accountType: BusinessAccountType,
) {
  const account = await db.businessAccount.findFirst({
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
    select: { ownerUserId: true },
  })

  return account?.ownerUserId ?? userId
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
          addOnRequests: { where: activeAddOnRequestWhere(), select: activeAddOnRequestSelect },
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
    const entitlements = await buildEntitlementPayload(
      account,
      usage,
      account.addOnRequests.map((request) => request.featureKey),
      account.addOnRequests,
    )
    let paymentTransactions: Awaited<ReturnType<typeof db.businessPaymentTransaction.findMany>> = []
    try {
      paymentTransactions = await db.businessPaymentTransaction.findMany({
        where: { businessAccountId: account.id },
        orderBy: { createdAt: "desc" },
        take: 50,
      })
    } catch (error) {
      logError("Unable to load business payment transactions; continuing without payment history", error)
    }
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
        createdAt: account.createdAt.toISOString(),
        updatedAt: account.updatedAt.toISOString(),
        plan: entitlements.plan,
        subscription: entitlements.subscription,
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
      limitAddOns: entitlements.limitAddOns,
      addOns: entitlements.addOns,
      activeAddOns: entitlements.activeAddOns,
      paymentTransactions: paymentTransactions.map(mapBusinessPaymentTransaction),
      actions,
      entitlements,
    }
  }))
}

export async function assertBusinessAction(input: {
  userId: string
  accountType: BusinessAccountType
  action: string
}) {
  const access = (await getMyBusinessAccess(input.userId)).find(
    (item) => item.businessAccount.type === input.accountType,
  )
  if (!access) throw new Error("Business account access is required")
  const result = access.actions[input.action]
  if (!result?.allowed) throw new Error(result?.reason ?? "This action is not allowed")
  return access.businessAccount
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
  const addOnFeatures = addOnFeatureSet(account.addOnRequests.map((request) => request.featureKey), account.type)
  const limits = effectiveLimitsForAccount(account)
  if (!account.plan.customRolesEnabled && !addOnFeatures.has("roles.manage")) {
    throw new Error("Custom roles are not enabled for this plan")
  }
  if (limits.roles !== null && account.roles.length >= limits.roles) {
    throw new Error("Role limit reached for this plan")
  }

  const validPermissionIds = new Set(account.permissions.map((permission) => permission.id))
  const permissionIds = cleanTextArray(input.permissionIds).filter((id) => validPermissionIds.has(id))
  const roleInput = validateBusinessRoleInput({ name: input.name, description: input.description, permissionIds })
  const duplicateRole = account.roles.find(
    (role) => role.name.trim().toLowerCase() === roleInput.name.toLowerCase(),
  )
  if (duplicateRole) {
    throw new Error("A role with this name already exists")
  }
  if (
    limits.permissions !== null &&
    permissionIds.length > limits.permissions
  ) {
    throw new Error("Permission limit reached for this plan")
  }

  const role = await db.businessRole.create({
    data: {
      businessAccountId: account.id,
      name: roleInput.name,
      description: roleInput.description,
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
  const limits = effectiveLimitsForAccount(account)
  if (limits.staff !== null && staffCount >= limits.staff) {
    throw new Error("Staff limit reached for this plan")
  }

  const email = cleanText(input.email, 254)?.toLowerCase()
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("Valid staff email is required")
  }
  const firstName = cleanText(input.firstName, 50)
  if (!firstName) throw new Error("Staff first name is required")
  validateStaffName(firstName, "First name")
  const lastName = cleanText(input.lastName, 50)
  if (!lastName) throw new Error("Staff last name is required")
  validateStaffName(lastName, "Last name")
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
            addOnRequests: { where: activeAddOnRequestWhere(), select: activeAddOnRequestSelect },
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

    const limits = effectiveLimitsForAccount(invitation.businessAccount)
    if (!hasExistingSeat && limits.staff !== null && activeMembers >= limits.staff) {
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
  const firstName = input.firstName === undefined ? undefined : cleanText(input.firstName, 50)
  if (input.firstName !== undefined && !firstName) {
    throw new Error("Staff first name is required")
  }
  if (firstName) validateStaffName(firstName, "First name")
  const lastName = input.lastName === undefined ? undefined : cleanText(input.lastName, 50)
  if (input.lastName !== undefined && !lastName) {
    throw new Error("Staff last name is required")
  }
  if (lastName) validateStaffName(lastName, "Last name")

  const ownerRoleIds = new Set(account.roles.filter((role) => role.isOwnerRole).map((role) => role.id))
  const submittedRoleIds = cleanTextArray(input.roleIds)
  if (submittedRoleIds.some((id) => ownerRoleIds.has(id))) {
    throw new Error("Owner role cannot be assigned to staff")
  }
  const validRoleIds = new Set(account.roles.filter((role) => !role.isOwnerRole).map((role) => role.id))
  const nextRoleIds = submittedRoleIds.filter((id) => validRoleIds.has(id))
  if (!nextRoleIds.length) {
    throw new Error("Select at least one role for this staff account")
  }

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

  const member = account.members.find((row) => row.id === memberId || row.userId === memberId)
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
  const addOnFeatures = addOnFeatureSet(account.addOnRequests.map((request) => request.featureKey), account.type)
  const limits = effectiveLimitsForAccount(account)
  if (!account.plan.customRolesEnabled && !addOnFeatures.has("roles.manage")) {
    throw new Error("Custom roles are not enabled for this plan")
  }

  const roleId = cleanText(input.roleId, 80)
  if (!roleId) throw new Error("Role id is required")

  const role = account.roles.find((row) => row.id === roleId)
  if (!role) throw new Error("Business role was not found")
  if (role.isOwnerRole) throw new Error("Owner role cannot be updated")

  const validPermissionIds = new Set(account.permissions.map((permission) => permission.id))
  const permissionIds = input.permissionIds === undefined
    ? role.permissionIds
    : cleanTextArray(input.permissionIds).filter((id) => validPermissionIds.has(id))
  const roleInput = validateBusinessRoleInput({
    name: input.name === undefined ? role.name : input.name,
    description: input.description === undefined ? role.description ?? "" : input.description,
    permissionIds,
  })
  const duplicateRole = account.roles.find(
    (row) =>
      row.id !== role.id &&
      row.name.trim().toLowerCase() === roleInput.name.toLowerCase(),
  )
  if (duplicateRole) {
    throw new Error("A role with this name already exists")
  }
  if (
    limits.permissions !== null &&
    permissionIds.length > limits.permissions
  ) {
    throw new Error("Permission limit reached for this plan")
  }

  const nextRole = await db.businessRole.update({
    where: { id: role.id },
    data: {
      name: roleInput.name,
      description: roleInput.description,
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
  if (impactedMembers.length) {
    throw new Error("This role is assigned to staff. First assign another role to those staff members, then delete this role.")
  }
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
