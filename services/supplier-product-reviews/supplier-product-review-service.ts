import { db } from "@/lib/database/prisma"
import { OrderStatus } from "@/lib/generated/prisma/client"
import type {
  SupplierProductReviewInput,
  SupplierProductReviewRecord,
  SupplierProductReviewPagination,
  SupplierProductReviewSummary,
} from "@/types/supplier-product-reviews/reviews"

const text = (value: unknown, maxLength = 1000) => {
  const normalized =
    typeof value === "string" ? value.trim().replace(/\s+/g, " ") : ""
  return normalized.slice(0, maxLength)
}

const requiredText = (value: unknown, label: string, maxLength = 1000) => {
  const normalized = text(value, maxLength)
  if (!normalized) throw new Error(`${label} is required`)
  return normalized
}

const parseRating = (value: unknown) => {
  const parsed = Number.parseInt(String(value ?? ""), 10)
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 5) {
    throw new Error("Rating must be between 1 and 5")
  }
  return parsed
}

const displayName = (user: {
  companyName?: string | null
  firstName?: string | null
  lastName?: string | null
  email?: string | null
}) =>
  user.companyName ||
  [user.firstName, user.lastName].filter(Boolean).join(" ") ||
  user.email ||
  "Customer"

const mapReview = (review: {
  id: string
  supplierId: string
  customerId: string
  supplierPartId: string
  partUid: string
  orderItemId: string
  rating: number
  comment: string
  createdAt: Date
  updatedAt: Date
  supplier: {
    companyName: string | null
    firstName: string | null
    lastName: string | null
    email: string | null
  }
  customer: {
    companyName: string | null
    firstName: string | null
    lastName: string | null
    email: string | null
  }
  orderItem: {
    partName: string
    partNumber: string | null
    order: {
      publicId: string
      source: string
    }
  }
}): SupplierProductReviewRecord => ({
  id: review.id,
  supplierId: review.supplierId,
  supplierName: displayName(review.supplier),
  customerId: review.customerId,
  customerName: displayName(review.customer),
  supplierPartId: review.supplierPartId,
  partUid: review.partUid,
  orderItemId: review.orderItemId,
  orderPublicId: review.orderItem.order.publicId,
  orderSource: review.orderItem.order.source,
  partName: review.orderItem.partName,
  partNumber: review.orderItem.partNumber,
  rating: review.rating,
  comment: review.comment,
  createdAt: review.createdAt.toISOString(),
  updatedAt: review.updatedAt.toISOString(),
})

const reviewInclude = {
  supplier: {
    select: {
      companyName: true,
      firstName: true,
      lastName: true,
      email: true,
    },
  },
  customer: {
    select: {
      companyName: true,
      firstName: true,
      lastName: true,
      email: true,
    },
  },
  orderItem: {
    select: {
      partName: true,
      partNumber: true,
      order: {
        select: {
          publicId: true,
          source: true,
        },
      },
    },
  },
} as const

export async function upsertUserSupplierProductReview(
  customerId: string,
  input: SupplierProductReviewInput,
) {
  const orderItemId = requiredText(input.orderItemId, "Order item", 120)
  const rating = parseRating(input.rating)
  const comment = requiredText(input.comment, "Review comment", 1000)

  const orderItem = await db.orderItem.findFirst({
    where: {
      id: orderItemId,
      deliveredAt: { not: null },
      supplierPartId: { not: null },
      order: {
        buyerId: customerId,
        status: { in: [OrderStatus.processing, OrderStatus.shipped, OrderStatus.delivered] },
      },
    },
    select: {
      id: true,
      supplierPartId: true,
      order: { select: { supplierId: true } },
      supplierPart: { select: { partUid: true } },
    },
  })

  if (!orderItem?.supplierPartId || !orderItem.supplierPart?.partUid) {
    throw new Error("Only delivered purchased product items can be reviewed")
  }

  const existingReview = await db.supplierProductReview.findUnique({
    where: {
      customerId_supplierId_partUid: {
        customerId,
        supplierId: orderItem.order.supplierId,
        partUid: orderItem.supplierPart.partUid,
      },
    },
    select: { orderItemId: true },
  })

  if (existingReview && existingReview.orderItemId !== orderItemId) {
    throw new Error("You have already reviewed this product for this supplier")
  }

  const review = await db.supplierProductReview.upsert({
    where: {
      customerId_supplierId_partUid: {
        customerId,
        supplierId: orderItem.order.supplierId,
        partUid: orderItem.supplierPart.partUid,
      },
    },
    update: { orderItemId, supplierPartId: orderItem.supplierPartId, rating, comment },
    create: {
      supplierId: orderItem.order.supplierId,
      customerId,
      supplierPartId: orderItem.supplierPartId,
      partUid: orderItem.supplierPart.partUid,
      orderItemId,
      rating,
      comment,
    },
    include: reviewInclude,
  })

  return mapReview(review)
}

const normalizePage = (value: number) =>
  Number.isFinite(value) ? Math.max(1, Math.floor(value)) : 1

const normalizePageSize = (value: number) =>
  Number.isFinite(value) ? Math.min(50, Math.max(1, Math.floor(value))) : 10

export async function listSupplierProductReviews(
  supplierId: string,
  page = 1,
  pageSize = 10,
) {
  const paging = {
    page: normalizePage(page),
    pageSize: normalizePageSize(pageSize),
  }
  const where = { supplierId }
  const [reviews, total] = await Promise.all([
    db.supplierProductReview.findMany({
      where,
      include: reviewInclude,
      orderBy: { createdAt: "desc" },
      skip: (paging.page - 1) * paging.pageSize,
      take: paging.pageSize,
    }),
    db.supplierProductReview.count({ where }),
  ])
  const pagination: SupplierProductReviewPagination = {
    ...paging,
    total,
    totalPages: Math.max(1, Math.ceil(total / paging.pageSize)),
  }
  return { reviews: reviews.map(mapReview), pagination }
}

export async function getSupplierReviewSummaries(supplierIds: string[]) {
  if (!supplierIds.length) return new Map<string, SupplierProductReviewSummary>()
  const rows = await db.supplierProductReview.groupBy({
    by: ["supplierId"],
    where: { supplierId: { in: Array.from(new Set(supplierIds)) } },
    _avg: { rating: true },
    _count: { _all: true },
  })

  return new Map(
    rows.map((row) => [
      row.supplierId,
      {
        ratingAverage: Number((row._avg.rating ?? 0).toFixed(1)),
        reviewCount: row._count._all,
      },
    ]),
  )
}

export async function getPartReviewSummary(partUid: string): Promise<SupplierProductReviewSummary> {
  const aggregate = await db.supplierProductReview.aggregate({
    where: { partUid },
    _avg: { rating: true },
    _count: { _all: true },
  })
  return {
    ratingAverage: Number((aggregate._avg.rating ?? 0).toFixed(1)),
    reviewCount: aggregate._count._all,
  }
}

export async function listPartReviews(partUid: string, take = 20) {
  const reviews = await db.supplierProductReview.findMany({
    where: { partUid },
    include: reviewInclude,
    orderBy: { createdAt: "desc" },
    take: Math.min(Math.max(take, 1), 50),
  })
  return reviews.map(mapReview)
}
