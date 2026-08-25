import { Building, FileText, ShoppingCart, Users as UsersIcon } from "lucide-react"

import { db } from "@/lib/database/prisma"
import { getFirebaseAuth } from "@/lib/firebase/admin"
import { UserRole, type Prisma } from "@/lib/generated/prisma/client"
import { logError } from "@/lib/logger"
import type {
  UserActivity,
  UserRecord,
  UserRoleLabel,
  UsersKpi,
  UsersPagination,
  UsersSummary,
} from "@/types/admin-dashboard/users/users-types"

const userInclude = {
  _count: {
    select: {
      buyerOrders: true,
      rfqs: true,
    },
  },
} satisfies Prisma.UserInclude

type UserAccount = Prisma.UserGetPayload<{ include: typeof userInclude }>

type ListAdminUsersInput = {
  page?: string | number | null
  pageSize?: string | number | null
  search?: string | null
}

type ListAdminUsersResult = {
  users: UserRecord[]
  pagination: UsersPagination
}

const roleLabels: Record<UserRole, UserRoleLabel> = {
  [UserRole.User]: "Buyer",
  [UserRole.Fleet]: "Fleet Manager",
  [UserRole.Garage]: "Garage Owner",
  [UserRole.Supplier]: "Supplier",
}

const formatDate = (value: Date | null) =>
  value
    ? value.toLocaleDateString("en-US", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      })
    : "Not available"

const fullName = (user: UserAccount) =>
  [user.firstName, user.lastName].filter(Boolean).join(" ") ||
  user.companyName ||
  user.email ||
  user.phone ||
  "Not added"

const mapUser = (user: UserAccount): UserRecord => {
  const roles = user.roles.map((role) => roleLabels[role])

  return {
    internalId: user.id,
    id: user.publicId,
    name: fullName(user),
    email: user.email ?? "Not added",
    phone: user.phone ?? "Not added",
    companyName: user.companyName ?? "Not added",
    address:
      [user.addressLine1, user.addressLine2].filter(Boolean).join(", ") ||
      "Not added",
    city: user.city ?? "Not added",
    state: user.state ?? "Not added",
    country: user.country ?? "Not added",
    roles,
    role: roles.join(", ") || roleLabels[user.activeRole],
    orders: user._count.buyerOrders,
    rfqs: user._count.rfqs,
    joined: formatDate(user.createdAt),
    lastLogin: formatDate(user.lastLoginAt),
    emailVerified: Boolean(user.emailVerifiedAt),
    status: user.isActive ? "Active" : "Suspended",
  }
}

const numberParam = (value: unknown, fallback: number, max: number) => {
  const parsed = Number.parseInt(String(value ?? ""), 10)
  if (!Number.isFinite(parsed)) return fallback
  return Math.min(max, Math.max(1, parsed))
}

const userSearchWhere = (search?: string | null): Prisma.UserWhereInput => {
  const query = search?.trim()
  if (!query) return {}

  return {
    OR: [
      { publicId: { contains: query, mode: "insensitive" } },
      { firstName: { contains: query, mode: "insensitive" } },
      { lastName: { contains: query, mode: "insensitive" } },
      { email: { contains: query, mode: "insensitive" } },
      { phone: { contains: query, mode: "insensitive" } },
      { companyName: { contains: query, mode: "insensitive" } },
      { city: { contains: query, mode: "insensitive" } },
      { state: { contains: query, mode: "insensitive" } },
      { country: { contains: query, mode: "insensitive" } },
    ],
  }
}

export async function listAdminUsers(
  input: ListAdminUsersInput = {},
): Promise<ListAdminUsersResult> {
  const pageSize = numberParam(input.pageSize, 10, 50)
  const requestedPage = numberParam(input.page, 1, 10_000)
  const where = userSearchWhere(input.search)
  const total = await db.user.count({ where })
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const page = Math.min(requestedPage, totalPages)
  const users = await db.user.findMany({
    where,
    include: userInclude,
    orderBy: [{ createdAt: "desc" }],
    skip: (page - 1) * pageSize,
    take: pageSize,
  })

  return {
    users: users.map(mapUser),
    pagination: { page, pageSize, total, totalPages },
  }
}

export async function updateAdminUserStatus(
  id: string,
  isActive: boolean,
): Promise<UserRecord> {
  const result = await db.user.updateMany({
    where: { id },
    data: { isActive },
  })
  if (result.count !== 1) {
    throw new Error("User was not found")
  }

  const user = await db.user.findUnique({
    where: { id },
    include: userInclude,
  })
  if (!user) {
    throw new Error("User was not found")
  }

  return mapUser(user)
}

export async function deleteAdminUserAccount(id: string) {
  const deletedUser = await db.$transaction(async (tx) => {
    const user = await tx.user.findUnique({
      where: { id },
      select: {
        id: true,
        publicId: true,
        firebaseUid: true,
      },
    })
    if (!user) throw new Error("User was not found")

    await tx.$executeRaw`
      DELETE FROM "business_invitations"
      WHERE "invitedByUserId" = ${id}
    `
    await tx.$executeRaw`
      DELETE FROM "orders"
      WHERE "buyerId" = ${id}
         OR "supplierId" = ${id}
    `
    await tx.$executeRaw`
      DELETE FROM "rfqs"
      WHERE "requesterId" = ${id}
         OR "fleetVehicleId" IN (
           SELECT "id" FROM "fleet_vehicles" WHERE "fleetId" = ${id}
         )
    `
    await tx.$executeRaw`
      DELETE FROM "rfq_bids"
      WHERE "supplierId" = ${id}
    `
    await tx.$executeRaw`
      DELETE FROM "garage_bookings"
      WHERE "garageId" = ${id}
         OR "customerId" = ${id}
    `
    await tx.$executeRaw`
      DELETE FROM "garage_services"
      WHERE "garageId" = ${id}
    `
    await tx.$executeRaw`
      DELETE FROM "supplier_parts"
      WHERE "supplierId" = ${id}
    `
    await tx.$executeRaw`
      DELETE FROM "business_accounts"
      WHERE "ownerUserId" = ${id}
    `
    await tx.user.delete({ where: { id } })

    return user
  })

  let firebaseDeleted = !deletedUser.firebaseUid
  if (deletedUser.firebaseUid) {
    try {
      await getFirebaseAuth().deleteUser(deletedUser.firebaseUid)
      firebaseDeleted = true
    } catch (error) {
      const code =
        typeof error === "object" && error !== null && "code" in error
          ? String(error.code)
          : ""
      if (code === "auth/user-not-found") {
        firebaseDeleted = true
      } else {
        logError("Unable to delete Firebase user from Admin User Management", error)
      }
    }
  }

  return {
    deleted: true,
    userId: deletedUser.publicId,
    firebaseDeleted,
  }
}

export async function getAdminUsersSummary(): Promise<UsersSummary> {
  const [totalAccounts, buyers, fleetManagers, garageOwners] = await Promise.all([
    db.user.count(),
    db.user.count({ where: { roles: { has: UserRole.User } } }),
    db.user.count({ where: { roles: { has: UserRole.Fleet } } }),
    db.user.count({ where: { roles: { has: UserRole.Garage } } }),
  ])

  return { totalAccounts, buyers, fleetManagers, garageOwners }
}

export function buildUserKpis(summary: UsersSummary): UsersKpi[] {
  return [
    {
      id: "users",
      title: "Total Accounts",
      value: String(summary.totalAccounts),
      icon: UsersIcon,
      iconTone: "primary",
    },
    {
      id: "buyers",
      title: "Buyers",
      value: String(summary.buyers),
      icon: ShoppingCart,
      iconTone: "info",
    },
    {
      id: "fleet",
      title: "Fleet Managers",
      value: String(summary.fleetManagers),
      icon: Building,
      iconTone: "success",
    },
    {
      id: "garages",
      title: "Garage Owners",
      value: String(summary.garageOwners),
      icon: FileText,
      iconTone: "warning",
    },
  ]
}

export function buildUserActivity(
  users: readonly UserRecord[],
): UserActivity[] {
  return users.slice(0, 4).map((user) => ({
    user: user.name,
    action: `Joined as ${user.role}`,
    time: user.joined,
  }))
}
