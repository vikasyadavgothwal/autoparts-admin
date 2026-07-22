import { db } from "@/lib/database/prisma"
import {
  PartNumberType,
  SupplierPartMappingSource,
  SupplierPartMappingStatus,
} from "@/lib/generated/prisma/client"
import type { ManualMapInput } from "@/types/parts-mapping/parts-mapping"
import {
  createPartNumberIndexIfMissing,
  getSupplierPartById,
  normalizeOptionalText,
} from "./internal-helpers"

export async function manuallyMapSupplierPart(
  supplierPartId: string,
  input: ManualMapInput,
) {
  const supplierPart = await db.supplierPart.findUnique({
    where: { id: supplierPartId },
  })

  if (!supplierPart) {
    throw new Error("Supplier part not found")
  }

  const partUid = normalizeOptionalText(input.partUid)

  if (partUid) {
    const existing = await db.partMaster.findUnique({ where: { partUid } })
    if (!existing) {
      throw new Error("PartMaster not found")
    }
  } else {
    throw new Error(
      "New master products require the complete supplier product form with images and features",
    )
  }

  await createPartNumberIndexIfMissing({
    partUid,
    numberOriginal: supplierPart.originalOemNumber,
    numberType: PartNumberType.oem,
    brand: supplierPart.originalBrand,
    source: "manual",
  })
  await createPartNumberIndexIfMissing({
    partUid,
    numberOriginal: supplierPart.originalMpn,
    numberType: PartNumberType.mpn,
    brand: supplierPart.originalBrand,
    source: "manual",
  })

  for (const number of input.numbers ?? []) {
    await createPartNumberIndexIfMissing({
      partUid,
      numberOriginal: number.numberOriginal,
      numberType: number.numberType ?? PartNumberType.unknown,
      brand: number.brand,
      source: "manual",
    })
  }

  await db.supplierPart.update({
    where: { id: supplierPartId },
    data: {
      partUid,
      mappingStatus: SupplierPartMappingStatus.mapped,
      mappingSource: SupplierPartMappingSource.manual,
      mappingError: null,
    },
  })

  return getSupplierPartById(supplierPartId)
}


export async function deleteSupplierPart(id: string) {
  return db.$transaction(async (transaction) => {
    const part = await transaction.supplierPart.findUnique({
      where: { id },
      select: { id: true, partUid: true },
    })

    if (!part) {
      throw new Error("Supplier part not found")
    }

    await transaction.supplierPart.delete({ where: { id } })

    let deletedMasterPart = false
    if (part.partUid) {
      const remainingSupplierCount = await transaction.supplierPart.count({
        where: { partUid: part.partUid },
      })

      if (remainingSupplierCount === 0) {
        await transaction.partMaster.delete({ where: { partUid: part.partUid } })
        deletedMasterPart = true
      }
    }

    return { id, deletedMasterPart }
  })
}

