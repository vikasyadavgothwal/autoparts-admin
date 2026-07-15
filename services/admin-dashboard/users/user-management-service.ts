import { Building, FileText, ShoppingCart, Users as UsersIcon } from "lucide-react"

import { db } from "@/lib/database/prisma"
import { UserRole, type Prisma } from "@/lib/generated/prisma/client"
import type {
  UserActivity,
  UserRecord,
  UserRoleLabel,
  UsersKpi,
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
    postalCode: user.postalCode ?? "Not added",
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

export async function listAdminUsers(): Promise<UserRecord[]> {
  const users = await db.user.findMany({
    include: userInclude,
    orderBy: [{ createdAt: "desc" }],
  })

  return users.map(mapUser)
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

export function buildUserKpis(users: readonly UserRecord[]): UsersKpi[] {
  return [
    {
      id: "users",
      title: "Total Accounts",
      value: String(users.length),
      icon: UsersIcon,
      iconTone: "primary",
    },
    {
      id: "buyers",
      title: "Buyers",
      value: String(users.filter((user) => user.roles.includes("Buyer")).length),
      icon: ShoppingCart,
      iconTone: "info",
    },
    {
      id: "fleet",
      title: "Fleet Managers",
      value: String(
        users.filter((user) => user.roles.includes("Fleet Manager")).length,
      ),
      icon: Building,
      iconTone: "success",
    },
    {
      id: "garages",
      title: "Garage Owners",
      value: String(
        users.filter((user) => user.roles.includes("Garage Owner")).length,
      ),
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
