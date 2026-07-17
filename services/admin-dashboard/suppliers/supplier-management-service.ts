import { Check, CircleX, Package, Store } from "lucide-react"

import { db } from "@/lib/database/prisma"
import {
  SupplierApprovalStatus,
  UserRole,
  type Prisma,
} from "@/lib/generated/prisma/client"
import type {
  SupplierKpi,
  SupplierMetric,
  SupplierRecord,
  SupplierStatus,
} from "@/types/admin-dashboard/suppliers/suppliers-types"

const supplierInclude = {
  _count: {
    select: {
      supplierParts: true,
    },
  },
  supplierReviewedBy: {
    select: {
      email: true,
      name: true,
    },
  },
} satisfies Prisma.UserInclude

type SupplierAccount = Prisma.UserGetPayload<{
  include: typeof supplierInclude
}>

const supplierWhere = {
  OR: [
    { roles: { has: UserRole.Supplier } },
    { activeRole: UserRole.Supplier },
  ],
} satisfies Prisma.UserWhereInput

const formatDate = (value: Date | null) =>
  value
    ? value.toLocaleDateString("en-US", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      })
    : "Not available"

const fullName = (supplier: SupplierAccount) =>
  [supplier.firstName, supplier.lastName].filter(Boolean).join(" ") ||
  supplier.email ||
  supplier.phone ||
  "Not added"

const supplierName = (supplier: SupplierAccount) =>
  supplier.companyName || fullName(supplier)

const reviewerName = (supplier: SupplierAccount) =>
  supplier.supplierReviewedBy?.name ||
  supplier.supplierReviewedBy?.email ||
  "Not reviewed"

const documentUrl = (value: string | null) => {
  if (!value) return null
  try {
    const url = new URL(value)
    return url.protocol === "http:" || url.protocol === "https:" ? value : null
  } catch {
    return null
  }
}

const mapSupplier = (supplier: SupplierAccount): SupplierRecord => ({
  internalId: supplier.id,
  id: supplier.supplierPublicId ?? supplier.publicId,
  accountId: supplier.publicId,
  name: supplierName(supplier),
  contactName: fullName(supplier),
  email: supplier.email ?? "Not added",
  phone: supplier.phone ?? "Not added",
  tradeLicenseNumber: supplier.tradeLicenseNumber ?? "Not added",
  contactPerson: supplier.supplierContactPerson ?? "Not added",
  designation: supplier.supplierDesignation ?? "Not added",
  tradeLicenseImageUrl: documentUrl(supplier.tradeLicenseImageUrl),
  vatTrnNumber: supplier.vatTrnNumber ?? "Not added",
  vatTrnImageUrl: documentUrl(supplier.vatTrnImageUrl),
  address:
    [supplier.addressLine1, supplier.addressLine2].filter(Boolean).join(", ") ||
    "Not added",
  city: supplier.city ?? "Not added",
  state: supplier.state ?? "Not added",
  postalCode: supplier.postalCode ?? "Not added",
  country: supplier.country ?? "Not added",
  products: supplier._count.supplierParts,
  rating: "N/A",
  joined: formatDate(supplier.createdAt),
  lastLogin: formatDate(supplier.lastLoginAt),
  emailVerified: Boolean(supplier.emailVerifiedAt),
  accountActive: supplier.isActive,
  reviewedAt: formatDate(supplier.supplierReviewedAt),
  reviewedBy: reviewerName(supplier),
  status: supplier.supplierApprovalStatus,
})

export async function listAdminSuppliers(): Promise<SupplierRecord[]> {
  const suppliers = await db.user.findMany({
    where: supplierWhere,
    include: supplierInclude,
    orderBy: [{ createdAt: "desc" }],
  })

  return suppliers.map(mapSupplier)
}

export async function updateAdminSupplierApproval(
  id: string,
  status: SupplierStatus,
  adminId: string,
): Promise<SupplierRecord> {
  const approvalStatus = status as SupplierApprovalStatus
  const result = await db.user.updateMany({
    where: {
      id,
      ...supplierWhere,
    },
    data: {
      supplierApprovalStatus: approvalStatus,
      supplierReviewedAt: new Date(),
      supplierReviewedByAdminId: adminId,
    },
  })

  if (result.count !== 1) {
    throw new Error("Supplier was not found")
  }

  const supplier = await db.user.findFirst({
    where: { id, ...supplierWhere },
    include: supplierInclude,
  })
  if (!supplier) {
    throw new Error("Supplier was not found")
  }

  return mapSupplier(supplier)
}

export function buildSupplierKpis(
  suppliers: readonly SupplierRecord[],
): SupplierKpi[] {
  const approved = suppliers.filter((supplier) => supplier.status === "Approved")
  const pending = suppliers.filter((supplier) => supplier.status === "Pending")

  return [
    {
      id: "total",
      title: "Total Suppliers",
      value: String(suppliers.length),
      icon: Store,
      iconTone: "primary",
    },
    {
      id: "approved",
      title: "Approved",
      value: String(approved.length),
      icon: Check,
      iconTone: "success",
    },
    {
      id: "pending",
      title: "Pending Review",
      value: String(pending.length),
      icon: CircleX,
      iconTone: "warning",
    },
    {
      id: "products",
      title: "Total Products",
      value: String(
        suppliers.reduce((total, supplier) => total + supplier.products, 0),
      ),
      icon: Package,
      iconTone: "primary",
    },
  ]
}

export function buildSupplierAlerts(
  suppliers: readonly SupplierRecord[],
): SupplierMetric[] {
  const pending = suppliers.filter((supplier) => supplier.status === "Pending")
    .length

  return [
    {
      message:
        pending === 0
          ? "No supplier applications are waiting for review."
          : `${pending} supplier${pending === 1 ? "" : "s"} awaiting review.`,
    },
  ]
}
