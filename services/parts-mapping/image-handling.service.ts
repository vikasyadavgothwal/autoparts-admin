import { db } from "@/lib/database/prisma"
import type { SupplierBulkImageRow } from "@/types/parts-mapping/parts-mapping"
import {
  createSupplierPartSkuResolver,
  getSupplierPartById,
  normalizeVendorSku,
  uploadSupplierImageUrlsToS3,
} from "./internal-helpers"

export async function updateSupplierPartImagesBulk(
  supplierId: string,
  rows: SupplierBulkImageRow[],
) {
  const results = []
  const resolveSupplierPart = await createSupplierPartSkuResolver(supplierId)

  for (const row of rows) {
    const vendorSku = normalizeVendorSku(row.vendorSku)
    const supplierPart = resolveSupplierPart(vendorSku)

    if (!supplierPart) {
      results.push({
        ok: false as const,
        rowNumber: row.rowNumber,
        vendorSku,
        reason: "No mapped product exists for this supplier SKU",
      })
      continue
    }

    try {
      const supplierImageUrls = await uploadSupplierImageUrlsToS3({
        supplierId,
        vendorSku: normalizeVendorSku(supplierPart.vendorSku ?? vendorSku),
        imageUrls: [row.primaryImageUrl, ...row.galleryImageUrls],
      })

      await db.supplierPart.update({
        where: { id: supplierPart.id },
        data: {
          supplierImageUrls,
        },
      })
      results.push({
        ok: true as const,
        rowNumber: row.rowNumber,
        vendorSku,
        part: await getSupplierPartById(supplierPart.id),
      })
    } catch (error) {
      results.push({
        ok: false as const,
        rowNumber: row.rowNumber,
        vendorSku,
        reason:
          error instanceof Error ? error.message : "Unable to upload images to S3",
      })
    }
  }

  return {
    totalRows: rows.length,
    updatedCount: results.filter((result) => result.ok).length,
    unmatchedCount: results.filter((result) => !result.ok).length,
    updatedParts: results
      .filter((result) => result.ok)
      .map((result) => result.part),
    unmatched: results.filter((result) => !result.ok),
  }
}

