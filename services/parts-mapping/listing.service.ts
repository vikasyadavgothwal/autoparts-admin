import { normalizePartNumber } from "@/lib/vin-17-api-client"
import { db } from "@/lib/database/prisma"
import {
  PartNumberType,
  SupplierPartMappingStatus,
  UserRole,
  type Prisma,
} from "@/lib/generated/prisma/client"
import {
  featuredCategorySource,
  isFeaturedCategoryActive,
} from "@/services/featured-vendor/featured-vendor-category-service"
import {
  mapMappedCatalogPart,
  mapSupplierPart,
  normalizeText,
} from "./internal-helpers"

export { getSupplierPartById } from "./internal-helpers"

export async function listSupplierParts(input: {
  supplierId?: string
  status?: SupplierPartMappingStatus
  query?: string
  limit?: number
}) {
  const query = normalizeText(input.query)
  const where: Prisma.SupplierPartWhereInput = {
    ...(input.supplierId ? { supplierId: input.supplierId } : {}),
    ...(input.status ? { mappingStatus: input.status } : {}),
    ...(query
      ? {
          OR: [
            { originalPartName: { contains: query, mode: "insensitive" } },
            { vendorSku: { contains: query, mode: "insensitive" } },
            { originalBrand: { contains: query, mode: "insensitive" } },
            { originalMpn: { contains: query, mode: "insensitive" } },
            { originalOemNumber: { contains: query, mode: "insensitive" } },
          ],
        }
      : {}),
  }

  const parts = await db.supplierPart.findMany({
    where,
    take: Math.min(input.limit ?? 100, 250),
    orderBy: [{ updatedAt: "desc" }],
    include: {
      supplier: {
        select: {
          companyName: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      },
      part: {
        select: {
          partUid: true,
          partName: true,
          partNumber: true,
          brandName: true,
          category: true,
          source: true,
          imageUrls: true,
          imageKeys: true,
          badgeText: true,
          heading: true,
          description: true,
          keyFeatures: true,
        },
      },
      pricing: true,
    },
  })

  return parts.map(mapSupplierPart)
}

const mappedSupplierPartWhere: Prisma.SupplierPartWhereInput = {
  isActive: true,
  mappingStatus: SupplierPartMappingStatus.mapped,
  partUid: { not: null },
}

const normalizeCategoryName = (value: string | null | undefined) =>
  normalizeText(value).toLowerCase()

async function activeFeaturedCategoryNamesForSupplier(supplierId: string) {
  const [account, rows] = await Promise.all([
    db.businessAccount.findFirst({
      where: { ownerUserId: supplierId, type: "Supplier", isActive: true },
      select: { plan: { select: { featuredVendor: true } } },
    }),
    db.supplierFeaturedCategory.findMany({
      where: { supplierId },
      include: {
        category: { select: { name: true } },
        addOnRequest: { select: { status: true, validFrom: true, validUntil: true } },
      },
    }),
  ])
  const planFeatured = Boolean(account?.plan.featuredVendor)

  return new Set(
    rows
      .filter((row) => row.source !== featuredCategorySource.plan || planFeatured)
      .filter((row) => isFeaturedCategoryActive(row, planFeatured))
      .map((row) => normalizeCategoryName(row.category.name))
      .filter(Boolean),
  )
}


export async function listMappedCatalogPartsPage(input: {
  query?: string
  page?: number
  pageSize?: number
}) {
  const query = normalizeText(input.query)
  const normalizedQuery = query ? normalizePartNumber(query) : ""
  const page = Math.max(1, Number.isFinite(input.page) ? input.page ?? 1 : 1)
  const pageSize = Math.min(
    50,
    Math.max(1, Number.isFinite(input.pageSize) ? input.pageSize ?? 10 : 10),
  )
  const numberSearch: Prisma.PartNumberIndexWhereInput[] = query
    ? [
        { numberOriginal: { contains: query, mode: "insensitive" } },
        ...(normalizedQuery
          ? [{ numberNormalized: { contains: normalizedQuery } }]
          : []),
      ]
    : []
  const supplierNumberSearch: Prisma.SupplierPartWhereInput[] = query
    ? [
        { originalOemNumber: { contains: query, mode: "insensitive" } },
        { originalMpn: { contains: query, mode: "insensitive" } },
        ...(normalizedQuery
          ? [
              { normalizedOemNumber: { contains: normalizedQuery } },
              { normalizedMpn: { contains: normalizedQuery } },
            ]
          : []),
      ]
    : []
  const where: Prisma.PartMasterWhereInput = {
    supplierParts: { some: mappedSupplierPartWhere },
    ...(query
      ? {
          OR: [
            { partUid: { contains: query, mode: "insensitive" } },
            { partName: { contains: query, mode: "insensitive" } },
            { heading: { contains: query, mode: "insensitive" } },
            { partNumber: { contains: query, mode: "insensitive" } },
            { partNumberOriginal: { contains: query, mode: "insensitive" } },
            { brandName: { contains: query, mode: "insensitive" } },
            { category: { contains: query, mode: "insensitive" } },
            ...(numberSearch.length
              ? [{ numbers: { some: { OR: numberSearch } } }]
              : []),
            ...(supplierNumberSearch.length
              ? [
                  {
                    supplierParts: {
                      some: {
                        ...mappedSupplierPartWhere,
                        OR: supplierNumberSearch,
                      },
                    },
                  },
                ]
              : []),
          ],
        }
      : {}),
  }

  const [parts, total] = await Promise.all([
    db.partMaster.findMany({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: [{ updatedAt: "desc" }],
      include: {
        numbers: {
          where: { numberType: { in: [PartNumberType.oem, PartNumberType.mpn] } },
          orderBy: [{ numberType: "asc" }, { createdAt: "asc" }],
          select: { numberOriginal: true, numberType: true },
        },
        supplierParts: {
          where: mappedSupplierPartWhere,
          orderBy: [{ updatedAt: "desc" }],
          select: {
            originalOemNumber: true,
            originalMpn: true,
            updatedAt: true,
          },
        },
      },
    }),
    db.partMaster.count({ where }),
  ])

  return {
    parts: parts.map(mapMappedCatalogPart),
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    },
  }
}


export async function listSupplierPartsPage(input: {
  supplierId: string
  status?: SupplierPartMappingStatus
  query?: string
  page?: number
  pageSize?: number
}) {
  const query = normalizeText(input.query)
  const page = Math.max(1, Number.isFinite(input.page) ? input.page ?? 1 : 1)
  const pageSize = Math.min(
    50,
    Math.max(1, Number.isFinite(input.pageSize) ? input.pageSize ?? 10 : 10),
  )
  const where: Prisma.SupplierPartWhereInput = {
    supplierId: input.supplierId,
    ...(input.status ? { mappingStatus: input.status } : {}),
    ...(query
      ? {
          OR: [
            { originalPartName: { contains: query, mode: "insensitive" } },
            { vendorSku: { contains: query, mode: "insensitive" } },
            { originalBrand: { contains: query, mode: "insensitive" } },
            { originalMpn: { contains: query, mode: "insensitive" } },
            { originalOemNumber: { contains: query, mode: "insensitive" } },
            { category: { contains: query, mode: "insensitive" } },
            { partUid: { contains: query, mode: "insensitive" } },
            { part: { is: { category: { contains: query, mode: "insensitive" } } } },
            {
              supplier: {
                is: {
                  OR: [
                    { companyName: { contains: query, mode: "insensitive" } },
                    { firstName: { contains: query, mode: "insensitive" } },
                    { lastName: { contains: query, mode: "insensitive" } },
                    { email: { contains: query, mode: "insensitive" } },
                  ],
                },
              },
            },
          ],
        }
      : {}),
  }

  const inactiveWhere: Prisma.SupplierPartWhereInput = {
    supplierId: input.supplierId,
    isActive: false,
    ...(input.status ? { mappingStatus: input.status } : {}),
  }

  const [parts, total, inactiveCount, featuredCategoryNames] = await Promise.all([
    db.supplierPart.findMany({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: [{ updatedAt: "desc" }],
      include: {
        supplier: {
          select: {
            companyName: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        part: {
          select: {
            partUid: true,
            partName: true,
            partNumber: true,
            brandName: true,
            category: true,
            source: true,
            imageUrls: true,
            imageKeys: true,
            badgeText: true,
            heading: true,
            description: true,
            keyFeatures: true,
          },
        },
        pricing: true,
      },
    }),
    db.supplierPart.count({ where }),
    db.supplierPart.count({ where: inactiveWhere }),
    activeFeaturedCategoryNamesForSupplier(input.supplierId),
  ])

  return {
    parts: parts.map((part) => {
      const categoryNames = [part.part?.category, part.category].map(normalizeCategoryName).filter(Boolean)
      return {
        ...mapSupplierPart(part),
        isFeaturedVendorProduct: categoryNames.some((categoryName) => featuredCategoryNames.has(categoryName)),
      }
    }),
    inactiveCount,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    },
  }
}


export const isSupplierUser = (user: { activeRole: UserRole; roles: UserRole[] }) =>
  user.activeRole === UserRole.Supplier || user.roles.includes(UserRole.Supplier)
