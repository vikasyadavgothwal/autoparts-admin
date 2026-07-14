import { db } from "@/lib/database/prisma"
import { Prisma, RfqBidStatus } from "@/lib/generated/prisma/client"
import type {
  SupplierOfferRecord,
  SupplierOfferStatus,
} from "@/types/supplier/offers"

const offerStatuses = new Set<SupplierOfferStatus>([
  "submitted",
  "accepted",
  "rejected",
  "withdrawn",
])

const normalizePaging = (page: number, pageSize: number) => ({
  page: Math.max(1, Number.isFinite(page) ? page : 1),
  pageSize: Math.min(50, Math.max(1, Number.isFinite(pageSize) ? pageSize : 10)),
})

const normalizeStatus = (status: string) => {
  const normalized = status.trim().toLowerCase() as SupplierOfferStatus
  return offerStatuses.has(normalized) ? normalized : null
}

const searchWhere = (search: string): Prisma.RfqBidWhereInput => {
  const query = search.trim()
  if (!query) return {}

  return {
    OR: [
      { id: { contains: query, mode: "insensitive" } },
      { rfq: { publicId: { contains: query, mode: "insensitive" } } },
      { rfq: { projectName: { contains: query, mode: "insensitive" } } },
      { rfq: { companyName: { contains: query, mode: "insensitive" } } },
      { rfq: { contactName: { contains: query, mode: "insensitive" } } },
      { rfq: { vehicleVin: { contains: query, mode: "insensitive" } } },
      { rfq: { vehicleMake: { contains: query, mode: "insensitive" } } },
      { rfq: { vehicleModel: { contains: query, mode: "insensitive" } } },
      { rfq: { parts: { some: { partName: { contains: query, mode: "insensitive" } } } } },
      { rfq: { parts: { some: { partNumber: { contains: query, mode: "insensitive" } } } } },
      { order: { publicId: { contains: query, mode: "insensitive" } } },
    ],
  }
}

const offerInclude = {
  rfq: {
    include: {
      parts: { orderBy: { createdAt: "asc" as const } },
    },
  },
  order: {
    select: {
      id: true,
      publicId: true,
      status: true,
      totalAmount: true,
      createdAt: true,
    },
  },
} satisfies Prisma.RfqBidInclude

type SupplierOfferPayload = Prisma.RfqBidGetPayload<{
  include: typeof offerInclude
}>

const mapOffer = (offer: SupplierOfferPayload): SupplierOfferRecord => ({
  id: offer.id,
  rfqId: offer.rfqId,
  rfqPublicId: offer.rfq.publicId,
  rfqStatus: offer.rfq.status,
  source: offer.rfq.source,
  buyerCompanyName: offer.rfq.companyName,
  buyerContactName: offer.rfq.contactName,
  buyerEmail: offer.rfq.email,
  projectName: offer.rfq.projectName,
  description: offer.rfq.description,
  vehicleVin: offer.rfq.vehicleVin,
  vehicleYear: offer.rfq.vehicleYear,
  vehicleMake: offer.rfq.vehicleMake,
  vehicleModel: offer.rfq.vehicleModel,
  vehicleTrim: offer.rfq.vehicleTrim,
  responseDeadline: offer.rfq.responseDeadline.toISOString(),
  deliveryRequirement: offer.rfq.deliveryRequirement,
  paymentTerms: offer.rfq.paymentTerms,
  parts: offer.rfq.parts.map((part) => ({
    ...part,
    targetPrice: part.targetPrice === null ? null : part.targetPrice / 100,
  })),
  totalAmount: offer.totalAmount / 100,
  deliveryDays: offer.deliveryDays,
  partType: offer.partType,
  validUntil: offer.validUntil?.toISOString() ?? null,
  notes: offer.notes,
  status: offer.status,
  submittedAt: offer.createdAt.toISOString(),
  updatedAt: offer.updatedAt.toISOString(),
  order: offer.order
    ? {
        ...offer.order,
        totalAmount: offer.order.totalAmount / 100,
        createdAt: offer.order.createdAt.toISOString(),
      }
    : null,
})

export async function listSupplierOffers(
  supplierId: string,
  page: number,
  pageSize: number,
  search = "",
  status = "",
) {
  const paging = normalizePaging(page, pageSize)
  const statusFilter = normalizeStatus(status)
  const where: Prisma.RfqBidWhereInput = {
    AND: [
      { supplierId },
      statusFilter ? { status: statusFilter as RfqBidStatus } : {},
      searchWhere(search),
    ],
  }
  const [offers, total, aggregate, statuses] = await Promise.all([
    db.rfqBid.findMany({
      where,
      include: offerInclude,
      orderBy: { updatedAt: "desc" },
      skip: (paging.page - 1) * paging.pageSize,
      take: paging.pageSize,
    }),
    db.rfqBid.count({ where }),
    db.rfqBid.aggregate({ where, _sum: { totalAmount: true } }),
    db.rfqBid.groupBy({ by: ["status"], where, _count: { _all: true } }),
  ])

  return {
    offers: offers.map(mapOffer),
    pagination: {
      ...paging,
      total,
      totalPages: Math.max(1, Math.ceil(total / paging.pageSize)),
    },
    summary: {
      totalOffers: total,
      totalAmount: (aggregate._sum.totalAmount ?? 0) / 100,
      byStatus: Object.fromEntries(
        statuses.map((item) => [item.status, item._count._all]),
      ),
    },
  }
}
