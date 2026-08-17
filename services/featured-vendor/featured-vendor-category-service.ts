import { db } from "@/lib/database/prisma"
import { SupplierPartMappingStatus, type BusinessAddOnRequestStatus } from "@/lib/generated/prisma/client"

export const featuredVendorFeatureKey = "marketplace.featured-vendor"
export const featuredCategorySource = {
  admin: "admin",
  plan: "plan",
  addOn: "add_on",
} as const

const defaultCurrency = "AED"
const defaultValidityDays = 30

const normalizeCategoryName = (value: string) => value.trim().replace(/\s+/g, " ").toLowerCase()
const displayCategoryName = (value: string) => value.trim().replace(/\s+/g, " ")

const cleanCategoryIds = (value: unknown) =>
  Array.isArray(value)
    ? Array.from(new Set(value.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean))).slice(0, 50)
    : []
const cleanRequestedValidityDays = (value: unknown, fallback: number) => {
  if (value === undefined || value === null || value === "") return fallback
  const days = typeof value === "number" ? value : Number(value)
  if (!Number.isInteger(days) || days < 1 || days > 3650) throw new Error("Select a valid Featured Vendor duration")
  return days
}
const cleanValidUntil = (value: unknown) => {
  if (value === undefined || value === null || value === "") return null
  const text = typeof value === "string" ? value.trim() : ""
  if (!text) return null
  const date = new Date(/^\d{4}-\d{2}-\d{2}$/.test(text) ? `${text}T23:59:59.999Z` : text)
  if (Number.isNaN(date.getTime()) || date <= new Date()) throw new Error("Featured Vendor expiry must be a future date")
  return date
}

const activeAddOnStatuses = new Set<BusinessAddOnRequestStatus | string>(["Approved", "Enabled"])

export async function listFeaturedVendorCategoryPrices() {
  const [categories, supplierParts, partMasterRows] = await Promise.all([
    db.productCategory.findMany({
    include: {
      parent: { select: { id: true, name: true } },
      featuredVendorPrice: true,
    },
    orderBy: [{ name: "asc" }],
    }),
    db.supplierPart.groupBy({
      by: ["category"],
      where: { category: { not: null }, isActive: true },
      _count: { _all: true },
    }),
    db.partMaster.groupBy({
      by: ["category"],
      where: { category: { not: null } },
      _count: { _all: true },
    }),
  ])
  const productCountByCategory = new Map<string, number>()
  for (const row of supplierParts) {
    if (row.category) productCountByCategory.set(normalizeCategoryName(row.category), row._count._all)
  }
  for (const row of partMasterRows) {
    if (!row.category) continue
    const key = normalizeCategoryName(row.category)
    productCountByCategory.set(key, (productCountByCategory.get(key) ?? 0) + row._count._all)
  }

  return categories.map((category) => ({
    categoryId: category.id,
    categoryName: category.name,
    parentId: category.parentId,
    parentName: category.parent?.name ?? null,
    priceAmount: category.featuredVendorPrice?.priceAmount ?? 0,
    priceCurrency: category.featuredVendorPrice?.priceCurrency ?? defaultCurrency,
    validityDays: category.featuredVendorPrice?.validityDays ?? defaultValidityDays,
    productCount: productCountByCategory.get(normalizeCategoryName(category.name)) ?? 0,
  }))
}

export async function updateFeaturedVendorCategoryPrices(input: { prices: unknown }) {
  if (!Array.isArray(input.prices)) throw new Error("Category prices must be an array")

  const rows = input.prices.map((price) => {
    if (!price || typeof price !== "object") throw new Error("Each category price must be an object")
    const payload = price as Record<string, unknown>
    const categoryId = typeof payload.categoryId === "string" ? payload.categoryId.trim() : ""
    const priceAmount = typeof payload.priceAmount === "number" ? payload.priceAmount : Number(payload.priceAmount)
    const currency = typeof payload.priceCurrency === "string" ? payload.priceCurrency.trim().toUpperCase() : defaultCurrency
    const validityDays = typeof payload.validityDays === "number" ? payload.validityDays : Number(payload.validityDays ?? defaultValidityDays)

    if (!categoryId) throw new Error("Category is required")
    if (!Number.isInteger(priceAmount) || priceAmount < 0 || priceAmount > 100000000) throw new Error("Category price must be valid")
    if (!/^[A-Z]{3}$/.test(currency)) throw new Error("Category currency must be valid")
    if (!Number.isInteger(validityDays) || validityDays < 1 || validityDays > 3650) throw new Error("Category validity must be valid")

    return { categoryId, priceAmount, priceCurrency: currency, validityDays }
  })

  const categoryCount = await db.productCategory.count({
    where: { id: { in: rows.map((row) => row.categoryId) } },
  })
  if (categoryCount !== new Set(rows.map((row) => row.categoryId)).size) throw new Error("One or more categories were not found")

  await db.$transaction(rows.map((row) =>
    db.featuredVendorCategoryPrice.upsert({
      where: { categoryId: row.categoryId },
      create: row,
      update: {
        priceAmount: row.priceAmount,
        priceCurrency: row.priceCurrency,
        validityDays: row.validityDays,
      },
    }),
  ))

  return listFeaturedVendorCategoryPrices()
}

export async function listSupplierFeaturedCategoryOptions(supplierId: string, input?: {
  allowedCategoryIds?: string[] | null
  excludeActiveCategories?: boolean
  planFeatured?: boolean
}) {
  const [supplierParts, categories, selectedRows] = await Promise.all([
    db.supplierPart.findMany({
      where: {
        supplierId,
        isActive: true,
        mappingStatus: SupplierPartMappingStatus.mapped,
      },
      select: {
        category: true,
        part: { select: { category: true } },
      },
      take: 10000,
    }),
    db.productCategory.findMany({
      include: {
        parent: { select: { id: true, name: true } },
        featuredVendorPrice: true,
      },
      orderBy: [{ name: "asc" }],
    }),
    db.supplierFeaturedCategory.findMany({
      where: { supplierId },
      select: {
        categoryId: true,
        source: true,
        validFrom: true,
        validUntil: true,
        addOnRequest: { select: { status: true, validFrom: true, validUntil: true } },
      },
    }),
  ])

  const supplierCategoryNames = supplierParts.reduce<Map<string, string>>((result, part) => {
    const categoryName = part.part?.category?.trim() || part.category?.trim()
    if (!categoryName) return result
    const normalized = normalizeCategoryName(categoryName)
    if (!result.has(normalized)) result.set(normalized, displayCategoryName(categoryName))
    return result
  }, new Map())
  const categoryByName = new Map<string, (typeof categories)[number]>()
  for (const category of categories) {
    const normalized = normalizeCategoryName(category.name)
    if (!supplierCategoryNames.has(normalized) || categoryByName.has(normalized)) continue
    categoryByName.set(normalized, category)
  }
  const allowedByPlan = input?.allowedCategoryIds == null ? null : new Set(input.allowedCategoryIds)
  const selected = new Set(selectedRows.map((row) => row.categoryId))
  const activeCategoryIds = new Set(
    selectedRows
      .filter((row) => isFeaturedCategoryActive(row, Boolean(input?.planFeatured)))
      .map((row) => row.categoryId),
  )
  const selectedBySource = selectedRows.reduce<Record<string, string[]>>((result, row) => {
    result[row.source] = [...(result[row.source] ?? []), row.categoryId]
    return result
  }, {})
  const validUntilBySource = selectedRows.reduce<Record<string, string | null>>((result, row) => {
    if (!row.validUntil || result[row.source]) return result
    result[row.source] = row.validUntil.toISOString().slice(0, 10)
    return result
  }, {})

  return {
    categories: Array.from(supplierCategoryNames.entries())
      .map(([normalizedName, fallbackName]) => ({ category: categoryByName.get(normalizedName), fallbackName }))
      .filter((row): row is { category: NonNullable<typeof row.category>; fallbackName: string } => Boolean(row.category))
      .filter((category) => !allowedByPlan || allowedByPlan.has(category.category.id))
      .filter((category) => !input?.excludeActiveCategories || !activeCategoryIds.has(category.category.id))
      .map((category) => ({
        categoryId: category.category.id,
        categoryName: category.category.name || category.fallbackName,
        parentId: category.category.parentId,
        parentName: category.category.parent?.name ?? null,
        selected: selected.has(category.category.id),
        priceAmount: category.category.featuredVendorPrice?.priceAmount ?? 0,
        priceCurrency: category.category.featuredVendorPrice?.priceCurrency ?? defaultCurrency,
        validityDays: category.category.featuredVendorPrice?.validityDays ?? defaultValidityDays,
      })),
    selectedCategoryIds: Array.from(selected),
    selectedBySource,
    validUntilBySource,
  }
}

export async function calculateFeaturedVendorCategoryQuote(categoryIdsInput: unknown, validityDaysInput?: unknown) {
  const categoryIds = cleanCategoryIds(categoryIdsInput)
  if (!categoryIds.length) throw new Error("Select at least one featured category")

  const prices = await db.featuredVendorCategoryPrice.findMany({
    where: { categoryId: { in: categoryIds } },
    include: { category: { select: { id: true, name: true } } },
  })
  if (prices.length !== categoryIds.length) throw new Error("Admin must set pricing for every selected category")

  const currencies = new Set(prices.map((price) => price.priceCurrency))
  if (currencies.size > 1) throw new Error("Selected featured categories must use the same currency")
  const defaultDays = Math.min(...prices.map((price) => price.validityDays))
  const validityDays = cleanRequestedValidityDays(validityDaysInput, defaultDays)

  return {
    categoryIds,
    priceAmount: prices.reduce((total, price) => total + Math.round((price.priceAmount * validityDays) / price.validityDays), 0),
    priceCurrency: prices[0]?.priceCurrency ?? defaultCurrency,
    validityDays,
    label: `Featured vendor placement (${prices.map((price) => price.category.name).join(", ")})`,
  }
}

export async function setSupplierFeaturedCategories(input: {
  supplierId: string
  categoryIds: unknown
  source: string
  businessAccountId?: string | null
  addOnRequestId?: string | null
  assignedByAdminId?: string | null
  maxCategories?: number | null
  allowedCategoryIds?: string[] | null
  validFrom?: Date | null
  validUntil?: Date | string | null
  replaceExisting?: boolean
}) {
  const categoryIds = cleanCategoryIds(input.categoryIds)
  if (typeof input.maxCategories === "number" && input.maxCategories >= 0 && categoryIds.length > input.maxCategories) {
    throw new Error(`Your plan allows ${input.maxCategories} Featured Vendor categor${input.maxCategories === 1 ? "y" : "ies"}`)
  }
  const validUntil = input.validUntil instanceof Date ? input.validUntil : cleanValidUntil(input.validUntil)
  const options = await listSupplierFeaturedCategoryOptions(input.supplierId, { allowedCategoryIds: input.allowedCategoryIds })
  const allowed = new Set(options.categories.map((category) => category.categoryId))
  const invalid = categoryIds.find((categoryId) => !allowed.has(categoryId))
  if (invalid) throw new Error("Selected category is not available in this supplier's products")

  const replaceExisting = input.replaceExisting !== false
  await db.$transaction([
    ...(replaceExisting
      ? [
          db.supplierFeaturedCategory.deleteMany({
            where: { supplierId: input.supplierId, source: input.source },
          }),
        ]
      : [
          db.supplierFeaturedCategory.updateMany({
            where: { supplierId: input.supplierId, source: input.source, categoryId: { in: categoryIds } },
            data: {
              businessAccountId: input.businessAccountId ?? null,
              addOnRequestId: input.addOnRequestId ?? null,
              assignedByAdminId: input.assignedByAdminId ?? null,
              validFrom: input.validFrom ?? null,
              validUntil,
            },
          }),
        ]),
    ...(categoryIds.length
      ? [
          db.supplierFeaturedCategory.createMany({
            data: categoryIds.map((categoryId) => ({
              supplierId: input.supplierId,
              categoryId,
              source: input.source,
              businessAccountId: input.businessAccountId ?? null,
              addOnRequestId: input.addOnRequestId ?? null,
              assignedByAdminId: input.assignedByAdminId ?? null,
              validFrom: input.validFrom ?? null,
              validUntil,
            })),
            skipDuplicates: true,
          }),
        ]
      : []),
  ])

  const count = await db.supplierFeaturedCategory.count({ where: { supplierId: input.supplierId } })
  await db.user.update({ where: { id: input.supplierId }, data: { featuredSupplier: count > 0 } })

  return listSupplierFeaturedCategoryOptions(input.supplierId)
}

export function isFeaturedCategoryActive(row: {
  source: string
  validFrom?: Date | null
  validUntil?: Date | null
  addOnRequest?: { status: string; validFrom: Date | null; validUntil: Date | null } | null
}, planFeatured: boolean) {
  const now = Date.now()
  if (row.source === featuredCategorySource.plan) return planFeatured
  if (row.validFrom && row.validFrom.getTime() > now) return false
  if (row.validUntil && row.validUntil.getTime() <= now) return false
  if (row.source === featuredCategorySource.admin) return true
  if (row.source !== featuredCategorySource.addOn || !row.addOnRequest || !activeAddOnStatuses.has(row.addOnRequest.status)) return false
  if (row.addOnRequest.validFrom && row.addOnRequest.validFrom.getTime() > now) return false
  return true
}
