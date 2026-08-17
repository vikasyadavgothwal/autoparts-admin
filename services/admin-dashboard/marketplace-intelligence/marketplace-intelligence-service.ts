import { db } from "@/lib/database/prisma"
import {
  PartNumberType,
  Prisma,
  SupplierApprovalStatus,
  SupplierPartMappingStatus,
  UserRole,
} from "@/lib/generated/prisma/client"

const startOfToday = () => {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), now.getDate())
}

const pct = (value: number, total: number) =>
  total > 0 ? Math.min(100, Math.round((value / total) * 100)) : 0

const monthLabel = (date: Date) =>
  date.toLocaleString("en", { month: "short" })

const vehiclePageSize = 20

export async function getVehicleDatabaseData({
  page = 1,
  search = "",
}: {
  page?: number
  search?: string
} = {}) {
  const today = startOfToday()
  const currentPage = Math.max(1, Math.floor(page))
  const query = search.trim().slice(0, 80)
  const where: Prisma.VehicleLookupWhereInput = query
    ? {
        OR: [
          { make: { contains: query, mode: "insensitive" } },
          { model: { contains: query, mode: "insensitive" } },
          { tier: { is: { customerFacingLabel: { contains: query, mode: "insensitive" } } } },
        ],
      }
    : {}
  const [
    vehicleTotal,
    filteredVehicleTotal,
    vinDecodesToday,
    cachedVinTotal,
    fitmentTotal,
    vehicles,
    fitmentsByMake,
  ] = await Promise.all([
    db.vehicleLookup.count(),
    db.vehicleLookup.count({ where }),
    db.vinLookupCache.count({ where: { updatedAt: { gte: today } } }),
    db.vinLookupCache.count(),
    db.masterFitment.count(),
    db.vehicleLookup.findMany({
      where,
      include: { tier: true },
      orderBy: [{ make: "asc" }, { model: "asc" }],
      skip: (currentPage - 1) * vehiclePageSize,
      take: vehiclePageSize,
    }),
    db.masterFitment.groupBy({
      by: ["make"],
      where: { make: { not: null } },
      _count: { _all: true },
      orderBy: { _count: { make: "desc" } },
      take: 8,
    }),
  ])

  const maxFitments = Math.max(...fitmentsByMake.map((item) => item._count._all), 0)

  return {
    metrics: {
      vehicleTotal,
      vinDecodesToday,
      cachedVinTotal,
      fitmentTotal,
    },
    pagination: {
      page: currentPage,
      pageSize: vehiclePageSize,
      total: filteredVehicleTotal,
      totalPages: Math.max(1, Math.ceil(filteredVehicleTotal / vehiclePageSize)),
      search: query,
    },
    vehicleRows: vehicles.map((vehicle) => ({
      id: vehicle.id,
      make: vehicle.make,
      model: vehicle.model,
      platform: vehicle.tier?.customerFacingLabel ?? "-",
      years: "-",
      coverage: pct(
        fitmentsByMake.find((item) => item.make === vehicle.make)?._count._all ?? 0,
        maxFitments,
      ),
    })),
    coverageRows: fitmentsByMake.map((item) => ({
      make: item.make ?? "Unknown",
      coverage: pct(item._count._all, maxFitments),
      mappedParts: item._count._all,
      missingModels: Math.max(0, vehicleTotal - item._count._all),
      missingParts: item._count._all,
    })),
  }
}

export async function getFitmentRulesData() {
  const [
    fitmentTotal,
    mappedParts,
    pendingReview,
    failedMappings,
    vehicleRuleRows,
    recentFitments,
  ] = await Promise.all([
    db.masterFitment.count(),
    db.supplierPart.count({ where: { mappingStatus: SupplierPartMappingStatus.mapped } }),
    db.supplierPart.count({ where: { mappingStatus: SupplierPartMappingStatus.pending_review } }),
    db.supplierPart.count({ where: { mappingStatus: SupplierPartMappingStatus.failed } }),
    db.masterFitment.count({
      where: {
        make: { not: null },
        model: { not: null },
      },
    }),
    db.masterFitment.findMany({
      where: {
        OR: [{ make: { not: null } }, { model: { not: null } }, { engine: { not: null } }],
      },
      orderBy: { updatedAt: "desc" },
      take: 6,
    }),
  ])

  return {
    metrics: {
      fitmentTotal,
      mappedParts,
      pendingReview,
      failedMappings,
      confidence: pct(mappedParts, mappedParts + pendingReview + failedMappings),
    },
    ruleCards: [
      {
        title: "Vehicle Attribute Rules",
        value: vehicleRuleRows,
        detail: "Active policies ensuring fitment confidence across GCC-spec and international catalogs.",
      },
      {
        title: "OE Mapping Rules",
        value: mappedParts,
        detail: "Active policies ensuring fitment confidence across GCC-spec and international catalogs.",
      },
      {
        title: "AI Validation Rules",
        value: pct(mappedParts, mappedParts + pendingReview + failedMappings),
        detail: "Active policies ensuring fitment confidence across GCC-spec and international catalogs.",
      },
    ],
    recentFitments: recentFitments.map((fitment) => ({
      vehicle: [fitment.modelYear, fitment.make, fitment.model].filter(Boolean).join(" ") || "Unknown vehicle",
      engine: fitment.engine ?? fitment.engineNo ?? "-",
      range: fitment.yearFrom || fitment.yearTo ? `${fitment.yearFrom ?? "-"}-${fitment.yearTo ?? "-"}` : "-",
      source: fitment.source,
    })),
  }
}

export async function getOeMappingData() {
  const [
    oeReferences,
    mappedProducts,
    mappedSupplierParts,
    pendingReview,
    rows,
  ] = await Promise.all([
    db.partNumberIndex.count({ where: { numberType: PartNumberType.oem } }),
    db.partMaster.count({ where: { numbers: { some: { numberType: PartNumberType.oem } } } }),
    db.supplierPart.count({ where: { mappingStatus: SupplierPartMappingStatus.mapped } }),
    db.supplierPart.count({ where: { mappingStatus: SupplierPartMappingStatus.pending_review } }),
    db.partNumberIndex.findMany({
      where: { numberType: PartNumberType.oem },
      orderBy: { updatedAt: "desc" },
      take: 8,
      include: {
        part: {
          select: {
            partName: true,
            brandName: true,
            category: true,
            _count: { select: { numbers: true } },
          },
        },
      },
    }),
  ])

  return {
    metrics: {
      oeReferences,
      mappedProducts,
      verifiedPercent: pct(mappedSupplierParts, mappedSupplierParts + pendingReview),
      pendingReview,
    },
    rows: rows.map((row) => ({
      number: row.numberOriginal,
      product:
        row.part.partName ??
        ([row.part.brandName, row.part.category].filter(Boolean).join(" ") || row.partUid),
      refs: row.part._count.numbers,
      status: row.source,
    })),
  }
}

export async function getCrossReferencesData() {
  const [
    crossReferences,
    mappedSupplierParts,
    pendingReview,
    alternativeParts,
    rejectedLinks,
    rows,
  ] = await Promise.all([
    db.partNumberIndex.count({
      where: {
        numberType: { in: [PartNumberType.mpn, PartNumberType.brand_part_number] },
      },
    }),
    db.supplierPart.count({ where: { mappingStatus: SupplierPartMappingStatus.mapped } }),
    db.supplierPart.count({ where: { mappingStatus: SupplierPartMappingStatus.pending_review } }),
    db.supplierPart.count({
      where: {
        OR: [
          { competitorPartNumber: { not: null } },
          { oemSupersessionNumbers: { isEmpty: false } },
        ],
      },
    }),
    db.supplierPart.count({ where: { mappingStatus: SupplierPartMappingStatus.failed } }),
    db.partMaster.findMany({
      where: {
        numbers: {
          some: {
            numberType: { in: [PartNumberType.mpn, PartNumberType.brand_part_number] },
          },
        },
      },
      orderBy: { updatedAt: "desc" },
      take: 8,
      include: {
        numbers: {
          where: {
            numberType: {
              in: [PartNumberType.oem, PartNumberType.mpn, PartNumberType.brand_part_number],
            },
          },
          orderBy: [{ numberType: "asc" }, { updatedAt: "desc" }],
          take: 6,
        },
        _count: { select: { numbers: true } },
      },
    }),
  ])

  return {
    metrics: {
      crossReferences,
      confidence: pct(mappedSupplierParts, mappedSupplierParts + pendingReview + rejectedLinks),
      alternativeParts,
      rejectedLinks,
    },
    rows: rows.map((part) => {
      const oeNumber = part.numbers.find((number) => number.numberType === PartNumberType.oem)
      const crossNumber = part.numbers.find((number) => number.numberType !== PartNumberType.oem)

      return {
        number: oeNumber?.numberOriginal ?? crossNumber?.numberOriginal ?? part.partNumber ?? part.partUid,
        product: part.partName ?? ([part.brandName, part.category].filter(Boolean).join(" ") || part.partUid),
        refs: part._count.numbers,
        status: crossNumber?.source ?? part.source,
      }
    }),
  }
}

export async function getSupplierValidationData() {
  const today = startOfToday()
  const weekAgo = new Date(today)
  weekAgo.setDate(weekAgo.getDate() - 7)

  const supplierWhere = {
    OR: [{ roles: { has: UserRole.Supplier } }, { activeRole: UserRole.Supplier }],
  }

  const [
    approvedSuppliers,
    approvedThisWeek,
    pendingSuppliers,
    pendingCatalogRows,
    rejectedUploads,
    rejectedThisWeek,
    totalInventory,
    mappedInventory,
    newCatalogUploads,
  ] = await Promise.all([
    db.user.count({
      where: {
        ...supplierWhere,
        supplierApprovalStatus: SupplierApprovalStatus.Approved,
      },
    }),
    db.user.count({
      where: {
        ...supplierWhere,
        supplierApprovalStatus: SupplierApprovalStatus.Approved,
        supplierReviewedAt: { gte: weekAgo },
      },
    }),
    db.user.count({
      where: {
        ...supplierWhere,
        supplierApprovalStatus: SupplierApprovalStatus.Pending,
      },
    }),
    db.supplierPart.count({ where: { mappingStatus: SupplierPartMappingStatus.pending_review } }),
    db.supplierPart.count({ where: { mappingStatus: SupplierPartMappingStatus.failed } }),
    db.supplierPart.count({
      where: {
        mappingStatus: SupplierPartMappingStatus.failed,
        updatedAt: { gte: weekAgo },
      },
    }),
    db.supplierPart.count(),
    db.supplierPart.count({ where: { mappingStatus: SupplierPartMappingStatus.mapped } }),
    db.supplierPart.count({ where: { createdAt: { gte: today } } }),
  ])

  const pendingValidation = pendingSuppliers + pendingCatalogRows

  return {
    cards: [
      {
        label: "Approved Suppliers",
        value: approvedSuppliers,
        trend: `+${approvedThisWeek} this week`,
        tone: "success" as const,
      },
      {
        label: "Pending Validation",
        value: pendingValidation,
        trend: `${pendingCatalogRows} catalog rows`,
        tone: "gold" as const,
      },
      {
        label: "Rejected Uploads",
        value: rejectedUploads,
        trend: `${rejectedThisWeek} this week`,
        tone: "red" as const,
      },
      {
        label: "Inventory Coverage",
        value: pct(mappedInventory, totalInventory),
        trend: "Mapped supplier stock",
        tone: "success" as const,
        suffix: "%",
      },
      {
        label: "New Catalog Uploads",
        value: newCatalogUploads,
        trend: "Today",
        tone: "gold" as const,
      },
    ],
  }
}

export async function getInventoryMappingData() {
  const [
    totalParts,
    mappedParts,
    approvedSuppliers,
    suppliersWithMappedStock,
    makesByVehicle,
    fitmentsByMake,
  ] = await Promise.all([
    db.supplierPart.count(),
    db.supplierPart.count({ where: { mappingStatus: SupplierPartMappingStatus.mapped } }),
    db.user.count({
      where: {
        OR: [{ roles: { has: UserRole.Supplier } }, { activeRole: UserRole.Supplier }],
        supplierApprovalStatus: SupplierApprovalStatus.Approved,
      },
    }),
    db.supplierPart.findMany({
      where: { mappingStatus: SupplierPartMappingStatus.mapped },
      distinct: ["supplierId"],
      select: { supplierId: true },
    }),
    db.vehicleLookup.groupBy({
      by: ["make"],
      _count: { _all: true },
      orderBy: { _count: { make: "desc" } },
      take: 8,
    }),
    db.masterFitment.groupBy({
      by: ["make"],
      where: { make: { not: null } },
      _count: { _all: true },
      orderBy: { _count: { make: "desc" } },
      take: 6,
    }),
  ])

  const maxVehicleRows = Math.max(...makesByVehicle.map((item) => item._count._all), 0)
  const fitmentsByMakeMap = new Map(fitmentsByMake.map((item) => [item.make, item._count._all]))

  return {
    metrics: {
      totalParts,
      inventoryCoverage: pct(mappedParts, totalParts),
      supplierCoverage: pct(suppliersWithMappedStock.length, approvedSuppliers),
      needsMapping: Math.max(0, totalParts - mappedParts),
    },
    coverageRows: makesByVehicle.map((item) => {
      const fitments = fitmentsByMakeMap.get(item.make) ?? 0

      return {
        make: item.make,
        coverage: pct(item._count._all, maxVehicleRows),
        missingModels: Math.max(0, maxVehicleRows - item._count._all),
        missingParts: Math.max(0, totalParts - fitments),
      }
    }),
  }
}

export async function getMarketplaceAnalyticsData() {
  const monthStarts = Array.from({ length: 6 }, (_, index) => {
    const date = new Date()
    date.setDate(1)
    date.setHours(0, 0, 0, 0)
    date.setMonth(date.getMonth() - (5 - index))
    return date
  })
  const firstMonth = monthStarts[0]

  const [
    suppliers,
    totalInventory,
    mappedInventory,
    verifiedFitments,
    pendingReview,
    failedMappings,
  ] = await Promise.all([
    db.user.findMany({
      where: {
        OR: [{ roles: { has: UserRole.Supplier } }, { activeRole: UserRole.Supplier }],
        createdAt: { gte: firstMonth },
      },
      select: { createdAt: true },
    }),
    db.supplierPart.count(),
    db.supplierPart.count({ where: { mappingStatus: SupplierPartMappingStatus.mapped } }),
    db.masterFitment.count(),
    db.supplierPart.count({ where: { mappingStatus: SupplierPartMappingStatus.pending_review } }),
    db.supplierPart.count({ where: { mappingStatus: SupplierPartMappingStatus.failed } }),
  ])

  const supplierGrowth = monthStarts.map((start, index) => {
    const end = new Date(start)
    end.setMonth(end.getMonth() + 1)

    return {
      month: monthLabel(start),
      suppliers: suppliers.filter((supplier) => {
        const createdAt = supplier.createdAt
        return createdAt >= start && createdAt < end
      }).length,
      total: suppliers.filter((supplier) => supplier.createdAt < end).length,
      index,
    }
  })

  const needsReview = pendingReview + failedMappings
  const healthTotal = mappedInventory + verifiedFitments + needsReview

  return {
    metrics: {
      supplierTotal: suppliers.length,
      inventoryCoverage: pct(mappedInventory, totalInventory),
      mappedParts: mappedInventory,
      needsReview,
    },
    supplierGrowth,
    healthRows: [
      {
        name: "Mapped inventory",
        value: pct(mappedInventory, healthTotal),
        color: "#DC2626",
      },
      {
        name: "Verified fitment",
        value: pct(verifiedFitments, healthTotal),
        color: "#10B981",
      },
      {
        name: "Needs review",
        value: pct(needsReview, healthTotal),
        color: "#F59E0B",
      },
    ],
  }
}

export async function listRecentAdminVinDecodes() {
  const rows = await db.vinLookupCache.findMany({
    orderBy: { updatedAt: "desc" },
    take: 8,
  })

  return rows.map((row) => ({
    vin: row.vin,
    title: `${row.make} ${row.model} · ${row.year}`,
    market: row.market ?? "-",
    engine: [row.engine, row.engineCapacity].filter(Boolean).join(" · ") || "-",
    updatedAt: row.updatedAt.toISOString(),
  }))
}
