import { db } from "@/lib/database/prisma"
import { normalizePartNumber } from "@/lib/17vin"
import {
  createSignedS3ObjectUrl,
  getS3ObjectKeyFromUrl,
} from "@/lib/storage/s3"
import {
  SupplierApprovalStatus,
  SupplierPartMappingStatus,
  type Prisma,
} from "@/lib/generated/prisma/client"

const DEFAULT_CURRENCY = "AED"
const DEFAULT_PRODUCT_IMAGE =
  "https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?w=900&h=900&fit=crop"

const mappedSupplierPartWhere = {
  mappingStatus: SupplierPartMappingStatus.mapped,
  supplier: {
    is: {
      isActive: true,
      supplierApprovalStatus: SupplierApprovalStatus.Approved,
    },
  },
} satisfies Prisma.SupplierPartWhereInput

const supplierPartInclude = {
  supplier: {
    select: {
      companyName: true,
      firstName: true,
      lastName: true,
      email: true,
      avatarUrl: true,
    },
  },
  pricing: true,
  stockRows: {
    select: {
      warehouseId: true,
      quantity: true,
      leadTime: true,
      lowStockThreshold: true,
    },
  },
} satisfies Prisma.SupplierPartInclude

type MarketplaceSupplierPart = Prisma.SupplierPartGetPayload<{
  include: typeof supplierPartInclude
}>

type MarketplacePart = Prisma.PartMasterGetPayload<{
  include: {
    supplierParts: {
      where: typeof mappedSupplierPartWhere
      include: typeof supplierPartInclude
    }
    fitments: true
  }
}>

type MarketplaceSearchInput = {
  partNumber?: string | null
  vin?: string | null
  modelId?: string | null
  year?: string | null
  make?: string | null
  model?: string | null
  q?: string | null
  limit?: number | null
}

const normalizeText = (value: unknown): string =>
  typeof value === "string" ? value.trim().replace(/\s+/g, " ") : ""

const normalizeToken = (value: string): string =>
  value.toUpperCase().replace(/[^A-Z0-9]+/g, "")

const containsInsensitive = (value: string) => ({
  contains: value,
  mode: "insensitive" as const,
})

const toMoney = (cents: number | null | undefined): number | null =>
  typeof cents === "number" ? cents / 100 : null

const getEffectivePriceCents = (offer: MarketplaceSupplierPart): number =>
  offer.pricing?.discountPrice ??
  offer.pricing?.basePrice ??
  offer.price ??
  0

const isSellableOffer = (offer: MarketplaceSupplierPart): boolean =>
  offer.stock > 0 && getEffectivePriceCents(offer) > 0

const getUniqueSellableOfferModels = (offers: MarketplaceSupplierPart[]) => {
  const sortedOfferModels = offers
    .filter(isSellableOffer)
    .map((offer) => ({
      offer,
      effectivePrice: getEffectivePriceCents(offer),
    }))
    .sort(
      (left, right) =>
        left.effectivePrice - right.effectivePrice ||
        right.offer.stock - left.offer.stock ||
        right.offer.updatedAt.getTime() - left.offer.updatedAt.getTime(),
    )
  const offerBySupplier = new Map<
    string,
    (typeof sortedOfferModels)[number]
  >()

  for (const offerModel of sortedOfferModels) {
    if (!offerBySupplier.has(offerModel.offer.supplierId)) {
      offerBySupplier.set(offerModel.offer.supplierId, offerModel)
    }
  }

  return Array.from(offerBySupplier.values())
}

const getCurrency = (offer: MarketplaceSupplierPart): string =>
  offer.pricing?.currency || offer.currency || DEFAULT_CURRENCY

const formatSupplierName = (offer: MarketplaceSupplierPart): string => {
  const profileName = [offer.supplier.firstName, offer.supplier.lastName]
    .filter(Boolean)
    .join(" ")

  return (
    offer.supplier.companyName ||
    profileName ||
    offer.supplier.email ||
    "Verified supplier"
  )
}

const toObject = (value: Prisma.JsonValue | null | undefined) =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}

const firstText = (
  value: Record<string, unknown>,
  keys: string[],
): string | null => {
  const normalizedEntries = new Map(
    Object.entries(value).map(([key, item]) => [
      key.toLowerCase().replace(/[^a-z0-9]+/g, ""),
      item,
    ]),
  )

  for (const key of keys) {
    const rawValue = normalizedEntries.get(
      key.toLowerCase().replace(/[^a-z0-9]+/g, ""),
    )
    if (typeof rawValue === "string" && rawValue.trim()) {
      return rawValue.trim()
    }
    if (typeof rawValue === "number" && Number.isFinite(rawValue)) {
      return String(rawValue)
    }
  }

  return null
}

const parseFeatureList = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value
      .map((item) => normalizeText(item))
      .filter(Boolean)
      .slice(0, 8)
  }

  if (typeof value !== "string") {
    return []
  }

  return value
    .split(/[\n;|]+/)
    .map((item) => item.trim().replace(/^[-*•]\s*/, ""))
    .filter(Boolean)
    .slice(0, 8)
}

const extractVendorContent = (offer: MarketplaceSupplierPart) => {
  const rawUploadData = toObject(offer.rawUploadData)
  const pricingRawData = toObject(offer.pricing?.rawUploadData)
  const rawData = { ...rawUploadData, ...pricingRawData }
  const featuresValue =
    rawData["Key Features"] ??
    rawData.keyFeatures ??
    rawData.Features ??
    rawData.features

  return {
    productName:
      firstText(rawData, [
        "Product Name",
        "Product",
        "Title",
        "Part Name",
        "Name",
      ]) ?? offer.originalPartName,
    shortDescription: firstText(rawData, [
      "Short Description",
      "Description",
      "Product Description",
    ]),
    longDescription: firstText(rawData, [
      "Long Description",
      "Detailed Description",
      "Full Description",
    ]),
    manufacturerPartNumber:
      firstText(rawData, [
        "Manufacturer Part Number (MPN)",
        "Manufacturer Part Number",
        "MPN",
        "Part Number",
      ]) ?? offer.originalMpn,
    status: firstText(rawData, ["Status"]),
    grade: firstText(rawData, ["Grade"]),
    condition: firstText(rawData, ["Condition"]) ?? "New",
    features: parseFeatureList(featuresValue),
  }
}

const hasVendorContent = (offer: MarketplaceSupplierPart): boolean => {
  const content = extractVendorContent(offer)
  return Boolean(
    content.shortDescription ||
      content.longDescription ||
      content.manufacturerPartNumber ||
      content.status ||
      content.grade ||
      content.features.length > 0 ||
      content.productName !== offer.originalPartName,
  )
}

const buildSelectedVendorContent = (offer: MarketplaceSupplierPart) => ({
  supplierId: offer.supplierId,
  supplierName: formatSupplierName(offer),
  vendorSku: offer.vendorSku,
  ...extractVendorContent(offer),
})

const seededIndex = (seed: string, count: number): number => {
  if (count <= 1) {
    return 0
  }

  let hash = 0
  for (const character of seed) {
    hash = (hash * 31 + character.charCodeAt(0)) >>> 0
  }
  return hash % count
}

const uniqueNonEmpty = (values: Array<string | null | undefined>): string[] => {
  const seen = new Set<string>()
  const result: string[] = []

  for (const value of values) {
    const normalized = normalizeText(value)
    if (!normalized || seen.has(normalized)) {
      continue
    }
    seen.add(normalized)
    result.push(normalized)
  }

  return result
}

const getSearchTokens = (query: string): string[] =>
  uniqueNonEmpty(query.split(/[^A-Za-z0-9]+/).map(normalizeToken)).filter(
    (token) => token.length >= 3,
  )

const partNumberIndexFiltersFor = (
  query: string,
  normalizedNumber = normalizePartNumber(query),
): Prisma.PartNumberIndexWhereInput[] => [
  ...(normalizedNumber
    ? [
        { numberNormalized: normalizedNumber },
        { numberNormalized: { contains: normalizedNumber } },
      ]
    : []),
  ...(query
    ? [{ numberOriginal: containsInsensitive(query) }]
    : []),
]

const supplierPartFiltersFor = (
  query: string,
  normalizedNumber = normalizePartNumber(query),
): Prisma.SupplierPartWhereInput[] => [
  ...(normalizedNumber
    ? [
        { normalizedMpn: { contains: normalizedNumber } },
        { normalizedOemNumber: { contains: normalizedNumber } },
      ]
    : []),
  ...(query
    ? [
        { vendorSku: containsInsensitive(query) },
        { originalMpn: containsInsensitive(query) },
        { originalOemNumber: containsInsensitive(query) },
        { originalPartName: containsInsensitive(query) },
        { originalBrand: containsInsensitive(query) },
        { competitorPartNumber: containsInsensitive(query) },
        { competitorBrandName: containsInsensitive(query) },
        { category: containsInsensitive(query) },
      ]
    : []),
]

const partMasterFiltersFor = (
  query: string,
  normalizedNumber = normalizePartNumber(query),
): Prisma.PartMasterWhereInput[] => [
  ...(normalizedNumber
    ? [{ normalizedPartNumber: { contains: normalizedNumber } }]
    : []),
  ...(query
    ? [
        { partNumber: containsInsensitive(query) },
        { partNumberOriginal: containsInsensitive(query) },
        { partName: containsInsensitive(query) },
        { heading: containsInsensitive(query) },
        { brandName: containsInsensitive(query) },
        { category: containsInsensitive(query) },
        { description: containsInsensitive(query) },
        {
          numbers: {
            some: { OR: partNumberIndexFiltersFor(query, normalizedNumber) },
          },
        },
        {
          supplierParts: {
            some: {
              ...mappedSupplierPartWhere,
              OR: supplierPartFiltersFor(query, normalizedNumber),
            },
          },
        },
        {
          fitments: {
            some: {
              OR: [
                { brand: containsInsensitive(query) },
                { make: containsInsensitive(query) },
                { model: containsInsensitive(query) },
                { series: containsInsensitive(query) },
                { engine: containsInsensitive(query) },
              ],
            },
          },
        },
      ]
    : []),
]

const tokenizedPartMasterFilter = (
  tokens: string[],
): Prisma.PartMasterWhereInput | null =>
  tokens.length > 0
    ? {
        AND: tokens.map((token) => ({
          OR: partMasterFiltersFor(token, normalizePartNumber(token)),
        })),
      }
    : null

const tokenizedSupplierPartFilter = (
  tokens: string[],
): Prisma.SupplierPartWhereInput | null =>
  tokens.length > 0
    ? {
        AND: tokens.map((token) => ({
          OR: supplierPartFiltersFor(token, normalizePartNumber(token)),
        })),
      }
    : null

const getDisplayImageUrl = async (imageUrl: string): Promise<string> => {
  try {
    const key = getS3ObjectKeyFromUrl(imageUrl)
    return key ? await createSignedS3ObjectUrl(key, 60 * 60) : imageUrl
  } catch {
    return imageUrl
  }
}

const getDisplayImageUrls = async (imageUrls: string[]): Promise<string[]> =>
  Promise.all(imageUrls.map(getDisplayImageUrl))

const collectProductImages = async (part: MarketplacePart): Promise<string[]> => {
  const primaryVendorImages = part.supplierParts.map(
    (offer) => offer.supplierImageUrls[0],
  )
  const extraVendorImages = part.supplierParts.flatMap((offer) =>
    offer.supplierImageUrls.slice(1),
  )
  const images = uniqueNonEmpty([
    ...primaryVendorImages,
    ...extraVendorImages,
    part.imageUrl,
    ...part.imageUrls,
  ]).slice(0, 8)

  return images.length > 0
    ? getDisplayImageUrls(images)
    : [DEFAULT_PRODUCT_IMAGE]
}

const buildTitle = (
  part: MarketplacePart,
  content?: ReturnType<typeof extractVendorContent> | null,
) =>
  content?.productName ||
  part.heading ||
  part.partName ||
  [part.brandName, part.partNumber].filter(Boolean).join(" ") ||
  "Auto part"

const buildDescription = (
  part: MarketplacePart,
  content?: ReturnType<typeof extractVendorContent> | null,
) =>
  content?.longDescription ||
  content?.shortDescription ||
  part.description ||
  "Compare verified supplier offers for this part."

const buildKeyFeatures = (
  part: MarketplacePart,
  content?: ReturnType<typeof extractVendorContent> | null,
) => {
  if (part.keyFeatures.length > 0) {
    return part.keyFeatures
  }
  if (content?.features.length) {
    return content.features
  }
  return [
    "Supplier inventory is mapped to this master product",
    "Compare price and stock across verified suppliers",
    "Images are collected from product and supplier uploads",
  ]
}

const buildOffer = async (
  offer: MarketplaceSupplierPart,
  recommended: boolean,
) => {
  const content = extractVendorContent(offer)
  const effectivePrice = getEffectivePriceCents(offer)
  const stockLeadTime = offer.stockRows.find((row) => row.leadTime)?.leadTime
  const images = await getDisplayImageUrls(
    uniqueNonEmpty(offer.supplierImageUrls),
  )

  return {
    id: offer.id,
    supplierId: offer.supplierId,
    supplierName: formatSupplierName(offer),
    supplierLogo: offer.supplier.avatarUrl,
    vendorSku: offer.vendorSku,
    price: toMoney(effectivePrice) ?? 0,
    currency: getCurrency(offer),
    stock: offer.stock,
    stockLabel: offer.stock > 0 ? "In Stock" : "Out of Stock",
    leadTime: stockLeadTime,
    condition: content.condition,
    recommended,
    images,
    content,
    warehouseStock: offer.stockRows,
  }
}

const summarizeProduct = async (part: MarketplacePart) => {
  const offerModels = getUniqueSellableOfferModels(part.supplierParts)
  const sellableOffers = offerModels.map(({ offer }) => offer)
  const offers = (
    await Promise.all(sellableOffers.map((offer) => buildOffer(offer, false)))
  ).sort((left, right) => left.price - right.price)
  const minOffer = offers[0] ?? null
  const vendorContentOffers = part.supplierParts.filter(hasVendorContent)
  const selectedContentOffer =
    vendorContentOffers[
      seededIndex(part.partUid, vendorContentOffers.length)
    ] ?? null
  const selectedContent = selectedContentOffer
    ? extractVendorContent(selectedContentOffer)
    : null
  const images = await collectProductImages(part)

  return {
    partUid: part.partUid,
    title: buildTitle(part, selectedContent),
    partNumber: part.partNumber,
    brandName: part.brandName,
    category: part.category,
    description: buildDescription(part, selectedContent),
    keyFeatures: buildKeyFeatures(part, selectedContent),
    image: images[0],
    images,
    offerCount: offers.length,
    totalStock: offers.reduce((total, offer) => total + offer.stock, 0),
    minPrice: minOffer?.price ?? null,
    currency: minOffer?.currency ?? DEFAULT_CURRENCY,
    badge: "Confirmed Fit",
    badgeType: "fit" as const,
    fitments: part.fitments.slice(0, 20).map((fitment) => ({
      brand: fitment.brand,
      make: fitment.make,
      model: fitment.model,
      series: fitment.series,
      modelYear: fitment.modelYear,
      yearFrom: fitment.yearFrom,
      yearTo: fitment.yearTo,
      engine: fitment.engine,
      engineNo: fitment.engineNo,
    })),
  }
}

const loadPartsByUids = async (
  partUids: string[],
  limit: number,
): Promise<MarketplacePart[]> => {
  if (partUids.length === 0) {
    return []
  }

  const uniqueUids = Array.from(new Set(partUids)).slice(0, limit)
  const parts = await db.partMaster.findMany({
    where: {
      partUid: { in: uniqueUids },
      supplierParts: { some: mappedSupplierPartWhere },
    },
    include: {
      supplierParts: {
        where: mappedSupplierPartWhere,
        include: supplierPartInclude,
      },
      fitments: {
        orderBy: [{ modelYear: "desc" }],
        take: 50,
      },
    },
  })
  const sortOrder = new Map(uniqueUids.map((partUid, index) => [partUid, index]))

  return parts.sort(
    (left, right) =>
      (sortOrder.get(left.partUid) ?? 0) - (sortOrder.get(right.partUid) ?? 0),
  )
}

const findPartUidsByPartSearch = async (query: string) => {
  const normalizedQuery = normalizeText(query)
  const normalizedNumber = normalizePartNumber(normalizedQuery)
  const searchTokens = getSearchTokens(normalizedQuery)
  const tokenPartFilter = tokenizedPartMasterFilter(searchTokens)
  const tokenSupplierFilter = tokenizedSupplierPartFilter(searchTokens)

  if (!normalizedQuery && !normalizedNumber) {
    return []
  }

  const numberIndexFilters = partNumberIndexFiltersFor(
    normalizedQuery,
    normalizedNumber,
  )
  const directPartFilters: Prisma.PartMasterWhereInput[] = [
    ...partMasterFiltersFor(normalizedQuery, normalizedNumber),
    ...(tokenPartFilter ? [tokenPartFilter] : []),
  ]
  const supplierPartFilters: Prisma.SupplierPartWhereInput[] = [
    ...supplierPartFiltersFor(normalizedQuery, normalizedNumber),
    ...(tokenSupplierFilter ? [tokenSupplierFilter] : []),
  ]

  const [indexedParts, directParts, supplierParts] = await Promise.all([
    db.partNumberIndex.findMany({
      where: { OR: numberIndexFilters },
      select: { partUid: true },
      take: 100,
    }),
    db.partMaster.findMany({
      where: { OR: directPartFilters },
      select: { partUid: true },
      take: 100,
    }),
    db.supplierPart.findMany({
      where: {
        ...mappedSupplierPartWhere,
        partUid: { not: null },
        OR: supplierPartFilters,
      },
      select: { partUid: true },
      take: 100,
    }),
  ])

  return Array.from(
    new Set([
      ...indexedParts.map((part) => part.partUid),
      ...directParts.map((part) => part.partUid),
      ...supplierParts
        .map((part) => part.partUid)
        .filter((partUid): partUid is string => Boolean(partUid)),
    ]),
  )
}

const parseYear = (year: string | null | undefined): number | null => {
  const parsed = Number.parseInt(year ?? "", 10)
  return Number.isInteger(parsed) && parsed >= 1900 && parsed <= 2100
    ? parsed
    : null
}

const fitmentTextWhere = (text: string): Prisma.MasterFitmentWhereInput | null => {
  const tokens = uniqueNonEmpty(text.split(/\s+/)).filter(
    (token) => normalizeToken(token).length >= 2,
  )
  if (tokens.length === 0) {
    return null
  }

  return {
    OR: tokens.flatMap((token) => [
      { brand: { contains: token, mode: "insensitive" } },
      { make: { contains: token, mode: "insensitive" } },
      { model: { contains: token, mode: "insensitive" } },
      { series: { contains: token, mode: "insensitive" } },
    ]),
  }
}

const fitmentYearWhere = (year: number): Prisma.MasterFitmentWhereInput => ({
  OR: [
    { modelYear: year },
    {
      AND: [
        { yearFrom: { lte: year } },
        { yearTo: { gte: year } },
      ],
    },
    {
      AND: [
        { yearFrom: { lte: year } },
        { yearTo: null },
      ],
    },
  ],
})

const findPartUidsByVehicle = async (input: MarketplaceSearchInput) => {
  const modelId = normalizeText(input.modelId)

  if (modelId) {
    const fitments = await db.masterFitment.findMany({
      where: { vin17ModelId: modelId },
      select: { partUid: true },
      distinct: ["partUid"],
      take: 200,
    })

    if (fitments.length > 0) {
      return fitments.map((fitment) => fitment.partUid)
    }
  }

  const year = parseYear(input.year)
  const textWhere = fitmentTextWhere(
    [input.make, input.model].map(normalizeText).filter(Boolean).join(" "),
  )
  const yearWhere = year ? fitmentYearWhere(year) : null
  const searchAttempts: Prisma.MasterFitmentWhereInput[] = []

  if (yearWhere && textWhere) {
    searchAttempts.push({ AND: [yearWhere, textWhere] })
  }
  if (yearWhere) {
    searchAttempts.push(yearWhere)
  }
  if (textWhere) {
    searchAttempts.push(textWhere)
  }

  for (const where of searchAttempts) {
    const fitments = await db.masterFitment.findMany({
      where,
      select: { partUid: true },
      distinct: ["partUid"],
      take: 200,
    })
    if (fitments.length > 0) {
      return fitments.map((fitment) => fitment.partUid)
    }
  }

  return []
}

const searchPartsByText = async (query: string, limit: number) => {
  const normalizedQuery = normalizeText(query)
  const normalizedNumber = normalizePartNumber(normalizedQuery)
  const searchTokens = getSearchTokens(normalizedQuery)
  const tokenPartFilter = tokenizedPartMasterFilter(searchTokens)

  if (!normalizedQuery) {
    return db.partMaster.findMany({
      where: { supplierParts: { some: mappedSupplierPartWhere } },
      include: {
        supplierParts: {
          where: mappedSupplierPartWhere,
          include: supplierPartInclude,
        },
        fitments: {
          orderBy: [{ modelYear: "desc" }],
          take: 50,
        },
      },
      orderBy: [{ updatedAt: "desc" }],
      take: limit,
    })
  }

  return db.partMaster.findMany({
    where: {
      AND: [
        { supplierParts: { some: mappedSupplierPartWhere } },
        {
          OR: [
            ...partMasterFiltersFor(normalizedQuery, normalizedNumber),
            ...(tokenPartFilter ? [tokenPartFilter] : []),
          ],
        },
      ],
    },
    include: {
      supplierParts: {
        where: mappedSupplierPartWhere,
        include: supplierPartInclude,
      },
      fitments: {
        orderBy: [{ modelYear: "desc" }],
        take: 50,
      },
    },
    orderBy: [{ updatedAt: "desc" }],
    take: limit,
  })
}

export async function searchMarketplaceProducts(input: MarketplaceSearchInput) {
  const limit = Math.min(Math.max(input.limit ?? 24, 1), 60)
  const partNumber = normalizeText(input.partNumber)
  const vin = normalizeText(input.vin)
  const textQuery = normalizeText(input.q)
  let parts: MarketplacePart[] = []
  let searchType: "partNumber" | "vin" | "text" = "text"

  if (partNumber) {
    searchType = "partNumber"
    parts = await loadPartsByUids(
      await findPartUidsByPartSearch(partNumber),
      limit,
    )
  } else if (vin || input.year || input.make || input.model) {
    searchType = "vin"
    parts = await loadPartsByUids(await findPartUidsByVehicle(input), limit)
  } else {
    parts = await searchPartsByText(textQuery, limit)
  }
  const products = await Promise.all(parts.map(summarizeProduct))

  return {
    ok: true,
    searchType,
    query: {
      partNumber: partNumber || null,
      vin: vin || null,
      modelId: normalizeText(input.modelId) || null,
      year: normalizeText(input.year) || null,
      make: normalizeText(input.make) || null,
      model: normalizeText(input.model) || null,
      q: textQuery || null,
    },
    count: products.length,
    products,
  }
}

export async function getMarketplaceProduct(partUid: string) {
  const normalizedPartUid = normalizeText(partUid)
  if (!normalizedPartUid) {
    return { ok: false as const, message: "Product id is required" }
  }

  const part = await db.partMaster.findUnique({
    where: { partUid: normalizedPartUid },
    include: {
      supplierParts: {
        where: mappedSupplierPartWhere,
        include: supplierPartInclude,
        orderBy: [{ price: "asc" }],
      },
      fitments: {
        orderBy: [{ modelYear: "desc" }],
        take: 200,
      },
    },
  })

  if (!part || part.supplierParts.length === 0) {
    return { ok: false as const, message: "Product was not found" }
  }

  const offerModels = getUniqueSellableOfferModels(part.supplierParts)
  const recommendedOfferId = offerModels[0]?.offer.id ?? null
  const offers = await Promise.all(
    offerModels.map(({ offer }) =>
      buildOffer(offer, offer.id === recommendedOfferId),
    ),
  )
  const sellableOffers = offerModels.map(({ offer }) => offer)
  const vendorContentOffers = sellableOffers.filter(hasVendorContent)
  const selectedContentOffer =
    vendorContentOffers[
      seededIndex(part.partUid, vendorContentOffers.length)
    ] ?? null
  const selectedContent = selectedContentOffer
    ? extractVendorContent(selectedContentOffer)
    : null
  const images = await collectProductImages(part)
  const summary = await summarizeProduct(part)

  return {
    ok: true as const,
    product: {
      ...summary,
      title: buildTitle(part, selectedContent),
      description: buildDescription(part, selectedContent),
      keyFeatures: buildKeyFeatures(part, selectedContent),
      images,
      image: images[0],
      contentSourceSupplierId: selectedContentOffer?.supplierId ?? null,
      selectedVendorContent: selectedContentOffer
        ? buildSelectedVendorContent(selectedContentOffer)
        : null,
      offers,
    },
  }
}
