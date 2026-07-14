import { db } from "@/lib/database/prisma"
import { UserRole } from "@/lib/generated/prisma/client"
import {
  getMarketplaceProduct,
  listMarketplaceProductsByUids,
} from "@/services/marketplace/marketplace-service"
import type {
  UserSavedPartProduct,
  UserSavedPartsPayload,
} from "@/types/user/saved-parts"

const normalizePartUid = (value: unknown) =>
  typeof value === "string" ? value.trim() : ""

export async function assertUserCanSaveParts(userId: string) {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, isActive: true, roles: true, activeRole: true },
  })

  if (!user || !user.isActive) {
    throw new Error("User account is inactive")
  }
  if (user.activeRole !== UserRole.User || !user.roles.includes(UserRole.User)) {
    throw new Error("Only User accounts can save parts")
  }
}

export async function isPartSavedByUser(userId: string, partUid: unknown) {
  const normalizedPartUid = normalizePartUid(partUid)
  if (!normalizedPartUid) return false

  const savedPart = await db.userSavedPart.findUnique({
    where: { userId_partUid: { userId, partUid: normalizedPartUid } },
    select: { id: true },
  })

  return Boolean(savedPart)
}

export async function savePartForUser(userId: string, partUid: unknown) {
  const normalizedPartUid = normalizePartUid(partUid)
  if (!normalizedPartUid) {
    throw new Error("Product id is required")
  }

  await assertUserCanSaveParts(userId)
  const product = await getMarketplaceProduct(normalizedPartUid)
  if (!product.ok) {
    throw new Error("Product is not available to save")
  }

  await db.userSavedPart.upsert({
    where: { userId_partUid: { userId, partUid: normalizedPartUid } },
    update: {},
    create: { userId, partUid: normalizedPartUid },
  })

  return { partUid: normalizedPartUid }
}

export async function removeSavedPartForUser(userId: string, partUid: unknown) {
  const normalizedPartUid = normalizePartUid(partUid)
  if (!normalizedPartUid) {
    throw new Error("Product id is required")
  }

  await assertUserCanSaveParts(userId)
  await db.userSavedPart.deleteMany({
    where: { userId, partUid: normalizedPartUid },
  })

  return { partUid: normalizedPartUid }
}

export async function listSavedPartsForUser(
  userId: string,
): Promise<UserSavedPartsPayload> {
  await assertUserCanSaveParts(userId)
  const savedParts = await db.userSavedPart.findMany({
    where: { userId },
    orderBy: [{ createdAt: "desc" }],
    take: 100,
  })
  const savedAtByPartUid = new Map(
    savedParts.map((part) => [part.partUid, part.createdAt.toISOString()]),
  )
  const products = await listMarketplaceProductsByUids(
    savedParts.map((part) => part.partUid),
    100,
  )
  const parts: UserSavedPartProduct[] = products.map((product) => ({
    partUid: product.partUid,
    title: product.title,
    partNumber: product.partNumber,
    brandName: product.brandName,
    category: product.category,
    description: product.description,
    image: product.image,
    images: product.images,
    offerCount: product.offerCount,
    totalStock: product.totalStock,
    minPrice: product.minPrice,
    currency: product.currency,
    savedAt: savedAtByPartUid.get(product.partUid) ?? new Date().toISOString(),
  }))

  return {
    parts,
    summary: {
      totalSaved: parts.length,
      inStock: parts.filter((part) => part.totalStock > 0).length,
      totalValue: parts.reduce(
        (total, part) => total + (part.minPrice ?? 0),
        0,
      ),
    },
  }
}
