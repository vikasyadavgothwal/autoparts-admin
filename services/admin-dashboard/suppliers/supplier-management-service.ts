import { Check, CircleX, Package, Store } from "lucide-react"

import { db } from "@/lib/database/prisma"
import { sendSmtpMail } from "@/lib/email/smtp"
import { logError } from "@/lib/logger"
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

const documentUrl = async (value: string | null) => {
  if (!value) return { url: null, exists: false }
  try {
    const url = new URL(value)
    const isHttp = url.protocol === "http:" || url.protocol === "https:"
    return { url: isHttp ? value : null, exists: isHttp }
  } catch {
    return { url: null, exists: false }
  }
}

const mapSupplier = async (supplier: SupplierAccount): Promise<SupplierRecord> => ({
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
  tradeLicenseImageUrl: await documentUrl(supplier.tradeLicenseImageUrl),
  vatTrnNumber: supplier.vatTrnNumber ?? "Not added",
  vatTrnImageUrl: await documentUrl(supplier.vatTrnImageUrl),
  supplierIdentityDocumentType: supplier.supplierIdentityDocumentType,
  emiratesIdPassportUrl: await documentUrl(supplier.emiratesIdPassportUrl),
  emiratesIdBackUrl: await documentUrl(supplier.emiratesIdBackUrl),
  passportAddressUrl: await documentUrl(supplier.passportAddressUrl),
  passportVisaFrontUrl: await documentUrl(supplier.passportVisaFrontUrl),
  bankIban: supplier.bankIban ?? "Not added",
  bankAccountProofUrl: await documentUrl(supplier.bankAccountProofUrl),
  marketplaceAgreementAcceptedAt:
    supplier.marketplaceAgreementAcceptedAt?.toISOString() ?? null,
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
  featuredSupplier: supplier.featuredSupplier,
  reviewedAt: formatDate(supplier.supplierReviewedAt),
  reviewedBy: reviewerName(supplier),
  status: supplier.supplierApprovalStatus,
  rejectionReason: supplier.supplierApprovalRejectionReason,
})

const supplierDisplayName = (supplier: SupplierAccount) =>
  supplier.supplierContactPerson || supplier.firstName || supplier.companyName || "Supplier"

type SupplierReviewNotificationResult = {
  sent: boolean
  skipped: boolean
  error: string | null
}

const supplierReviewNotificationResult = (
  status: SupplierApprovalStatus,
): SupplierReviewNotificationResult => ({
  sent: false,
  skipped: status !== SupplierApprovalStatus.Approved && status !== SupplierApprovalStatus.Rejected,
  error: null,
})

async function notifySupplierReviewResult(
  supplier: SupplierAccount,
  status: SupplierApprovalStatus,
  rejectionReason: string | null,
): Promise<SupplierReviewNotificationResult> {
  if (!supplier.email) {
    return {
      sent: false,
      skipped: false,
      error: "Supplier email is not available.",
    }
  }
  if (
    status !== SupplierApprovalStatus.Approved &&
    status !== SupplierApprovalStatus.Rejected
  ) {
    return supplierReviewNotificationResult(status)
  }

  try {
    if (status === SupplierApprovalStatus.Approved) {
      await sendSmtpMail({
        to: supplier.email,
        subject: "Your AutoParts Pro supplier profile is verified",
        text: `Hello ${supplierDisplayName(supplier)},\n\nYour supplier profile has been verified by the AutoParts Pro admin team. You can now manage your inventory, RFQs, orders, offers, reviews, and performance dashboard.\n\nAutoParts Pro`,
      })
      return {
        sent: true,
        skipped: false,
        error: null,
      }
    }

    if (status === SupplierApprovalStatus.Rejected) {
      await sendSmtpMail({
        to: supplier.email,
        subject: "AutoParts Pro supplier document review update",
        text: `Hello ${supplierDisplayName(supplier)},\n\nYour supplier profile documents need to be updated before approval.\n\nReason: ${rejectionReason || "Please review and resubmit your supplier documents."}\n\nLog in to Supplier Settings, update the required documents, and resubmit for admin review.\n\nAutoParts Pro`,
      })
    }

    return {
      sent: true,
      skipped: false,
      error: null,
    }
  } catch (error) {
    logError("Unable to send supplier review email", error)
    return {
      sent: false,
      skipped: false,
      error:
        error instanceof Error
          ? error.message
          : "Unable to send supplier review email",
    }
  }
}

export async function listAdminSuppliers(): Promise<SupplierRecord[]> {
  const suppliers = await db.user.findMany({
    where: supplierWhere,
    include: supplierInclude,
    orderBy: [{ createdAt: "desc" }],
  })

  return Promise.all(suppliers.map(mapSupplier))
}

export async function updateAdminSupplierApproval(
  id: string,
  status: SupplierStatus,
  adminId: string,
  rejectionReasonInput?: string,
): Promise<{ supplier: SupplierRecord; notification: SupplierReviewNotificationResult }> {
  const approvalStatus = status as SupplierApprovalStatus
  const rejectionReason = rejectionReasonInput?.trim() ?? ""
  if (approvalStatus === SupplierApprovalStatus.Rejected && !rejectionReason) {
    throw new Error("Enter a rejection reason for the supplier")
  }

  const existing = await db.user.findFirst({
    where: { id, ...supplierWhere },
    select: {
      supplierApprovalStatus: true,
      supplierApprovalRejectionReason: true,
    },
  })
  if (!existing) {
    throw new Error("Supplier was not found")
  }
  const shouldNotifySupplier =
    existing.supplierApprovalStatus !== approvalStatus ||
    (approvalStatus === SupplierApprovalStatus.Rejected &&
      (existing.supplierApprovalRejectionReason ?? "") !== rejectionReason)

  const result = await db.user.updateMany({
    where: {
      id,
      ...supplierWhere,
    },
    data: {
      supplierApprovalStatus: approvalStatus,
      supplierApprovalRejectionReason:
        approvalStatus === SupplierApprovalStatus.Rejected
          ? rejectionReason
          : null,
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

  const notification = shouldNotifySupplier
    ? await notifySupplierReviewResult(
        supplier,
        approvalStatus,
        approvalStatus === SupplierApprovalStatus.Rejected ? rejectionReason : null,
      )
    : {
        sent: false,
        skipped: true,
        error: null,
      }

  return {
    supplier: await mapSupplier(supplier),
    notification,
  }
}

export async function updateAdminSupplierFeatured(
  id: string,
  featuredSupplier: boolean,
): Promise<SupplierRecord> {
  const result = await db.user.updateMany({
    where: { id, ...supplierWhere },
    data: { featuredSupplier },
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
