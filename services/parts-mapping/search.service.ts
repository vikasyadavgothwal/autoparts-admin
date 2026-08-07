import { normalizePartNumber } from "@/lib/vin-17-api-client"
import { db } from "@/lib/database/prisma"
import { SupplierPartMappingStatus } from "@/lib/generated/prisma/client"
import type { PartSearchResponse } from "@/types/parts-mapping/parts-mapping"
import { mapSupplierPart, normalizeText } from "./internal-helpers"

export async function searchPartsFromLocalDb(input: {
  partNumber: string
  userId?: string | null
}): Promise<PartSearchResponse> {
  const searchedNumber = normalizeText(input.partNumber)
  const normalizedNumber = normalizePartNumber(searchedNumber)

  if (!normalizedNumber) {
    throw new Error("partNumber is required")
  }

  const index = await db.partNumberIndex.findFirst({
    where: { numberNormalized: normalizedNumber },
    select: { partUid: true },
  })

  if (!index) {
    await db.unmatchedPartSearchLog.create({
      data: {
        searchedNumber,
        normalizedNumber,
        userId: input.userId ?? null,
        resultStatus: "not_found",
      },
    })

    return { ok: true, found: false, result: null }
  }

  const part = await db.partMaster.findUnique({
    where: { partUid: index.partUid },
    include: {
      supplierParts: {
        where: {
          mappingStatus: SupplierPartMappingStatus.mapped,
          stock: { gt: 0 },
        },
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
        },
      },
      fitments: {
        orderBy: [{ make: "asc" }, { model: "asc" }, { modelYear: "desc" }],
        take: 200,
      },
    },
  })

  if (!part) {
    return { ok: true, found: false, result: null }
  }

  return {
    ok: true,
    found: true,
    result: {
      part: {
        partUid: part.partUid,
        partName: part.partName,
        partNumber: part.partNumber,
        brandName: part.brandName,
        category: part.category,
        source: part.source,
        imageUrls: part.imageUrls,
        imageKeys: part.imageKeys,
        badgeText: part.badgeText,
        heading: part.heading,
        description: part.description,
        keyFeatures: part.keyFeatures,
      },
      supplierParts: part.supplierParts.map(mapSupplierPart),
      fitments: part.fitments.map((fitment) => ({
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
    },
  }
}

