import { deleteObjectFromS3 } from "@/lib/storage/s3"
import { db } from "@/lib/database/prisma"
import {
  PartNumberType,
  SupplierPartMappingSource,
  SupplierPartMappingStatus,
} from "@/lib/generated/prisma/client"
import type { PartContentUpdateInput } from "@/types/parts-mapping/parts-mapping"
import {
  createPartNumberIndexIfMissing,
  getSupplierPartById,
  normalizeRequiredProductText,
  normalizeText,
} from "./internal-helpers"

export async function approveFirstVendorProduct(supplierPartId: string) {
  const supplierPart = await db.supplierPart.findUnique({
    where: { id: supplierPartId },
    include: { part: true },
  })

  if (!supplierPart?.part || !supplierPart.partUid) {
    throw new Error("First-vendor product draft not found")
  }
  if (!supplierPart.part.source.endsWith("_pending")) {
    throw new Error("This product is not awaiting first-vendor approval")
  }
  if (
    supplierPart.part.imageUrls.length === 0 ||
    supplierPart.part.keyFeatures.length === 0 ||
    !supplierPart.part.badgeText ||
    !supplierPart.part.heading ||
    !supplierPart.part.description ||
    !supplierPart.originalBrand ||
    !supplierPart.originalMpn ||
    !supplierPart.originalOemNumber
  ) {
    throw new Error("Product images and complete catalog content are required")
  }

  await createPartNumberIndexIfMissing({
    partUid: supplierPart.partUid,
    numberOriginal: supplierPart.originalOemNumber,
    numberType: PartNumberType.oem,
    brand: supplierPart.originalBrand,
    source: "admin_approved_supplier",
  })
  await createPartNumberIndexIfMissing({
    partUid: supplierPart.partUid,
    numberOriginal: supplierPart.originalMpn,
    numberType: PartNumberType.mpn,
    brand: supplierPart.originalBrand,
    source: "admin_approved_supplier",
  })

  const mappingSource = supplierPart.part.source.startsWith("17vin")
    ? SupplierPartMappingSource.vin17
    : SupplierPartMappingSource.manual

  await db.$transaction([
    db.partMaster.update({
      where: { partUid: supplierPart.partUid },
      data: { source: supplierPart.part.source.replace(/_pending$/, "") },
    }),
    db.supplierPart.update({
      where: { id: supplierPartId },
      data: {
        mappingStatus: SupplierPartMappingStatus.mapped,
        mappingSource,
        mappingError: null,
      },
    }),
  ])

  return getSupplierPartById(supplierPartId)
}


export async function updateSupplierPartContent(
  supplierPartId: string,
  input: PartContentUpdateInput,
) {
  const supplierPart = await db.supplierPart.findUnique({
    where: { id: supplierPartId },
    include: { part: true },
  })

  if (!supplierPart?.part || !supplierPart.partUid) {
    throw new Error("Master product not found")
  }

  const partName = normalizeRequiredProductText(input.partName, "Product name")
  const category = normalizeRequiredProductText(input.category, "Category")
  const badgeText = normalizeRequiredProductText(input.badgeText, "Badge text")
  const heading = normalizeRequiredProductText(input.heading, "Heading")
  const description = normalizeRequiredProductText(input.description, "Description")
  const keyFeatures = Array.from(
    new Set(input.keyFeatures.map(normalizeText).filter(Boolean)),
  ).slice(0, 12)
  const imageUrls = Array.from(
    new Set(input.imageUrls.map(normalizeText).filter(Boolean)),
  ).slice(0, 8)
  const imageKeys = Array.from(
    new Set(input.imageKeys.map(normalizeText).filter(Boolean)),
  ).slice(0, 8)

  if (keyFeatures.length === 0) {
    throw new Error("At least one key feature is required")
  }
  if (
    imageUrls.length === 0 ||
    imageUrls.length !== imageKeys.length ||
    imageKeys.some(
      (key) =>
        !key.startsWith("supplier-products/") &&
        !key.startsWith("product-images/"),
    )
  ) {
    throw new Error("At least one uploaded product image is required")
  }

  const removedImageKeys = supplierPart.part.imageKeys.filter(
    (key) => !imageKeys.includes(key),
  )

  await db.$transaction([
    db.partMaster.update({
      where: { partUid: supplierPart.partUid },
      data: {
        partName,
        category,
        imageUrl: imageUrls[0],
        imageUrls,
        imageKeys,
        badgeText,
        heading,
        description,
        keyFeatures,
      },
    }),
    db.supplierPart.updateMany({
      where: { partUid: supplierPart.partUid },
      data: { originalPartName: partName, category },
    }),
  ])

  await Promise.allSettled(removedImageKeys.map(deleteObjectFromS3))

  return getSupplierPartById(supplierPartId)
}
