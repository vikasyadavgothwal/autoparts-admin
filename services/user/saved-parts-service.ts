import { randomUUID } from "node:crypto"

import { db } from "@/lib/database/prisma"
import { UserRole } from "@/lib/generated/prisma/client"
import {
  getMarketplaceProduct,
  listMarketplaceProductsByUids,
} from "@/services/marketplace/marketplace-service"
import type {
  UserSavedPartProduct,
  UserSavedPartStatus,
  UserSavedPartsPayload,
} from "@/types/user/saved-parts"

type UserSavedWatchRow = {
  partUid: string
  watchForPriceDrops: boolean
  watchStockReturns: boolean
  createdAt: Date
  updatedAt: Date
}

const normalizePartUid = (value: unknown) =>
  typeof value === "string" ? value.trim() : ""

const normalizeWatchFlag = (value: unknown) =>
  value === true || value === "true" || value === 1 || value === "1"

const getSavedPartRow = async (
  userId: string,
  partUid: string,
): Promise<UserSavedWatchRow | null> => {
  const rows = await db.$queryRaw<UserSavedWatchRow[]>`
    SELECT
      "partUid",
      "watchPriceChanges" AS "watchForPriceDrops",
      "watchStockReturns",
      "createdAt",
      "updatedAt"
    FROM "user_saved_parts"
    WHERE "userId" = ${userId} AND "partUid" = ${partUid}
    LIMIT 1
  `

  return rows[0] ?? null
}

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

export async function isPartSavedByUser(
  userId: string,
  partUid: unknown,
): Promise<boolean> {
  const normalizedPartUid = normalizePartUid(partUid)
  if (!normalizedPartUid) return false

  const savedPart = await getSavedPartRow(userId, normalizedPartUid)
  return Boolean(savedPart)
}

export async function getSavedPartStatus(
  userId: string,
  partUid: unknown,
): Promise<UserSavedPartStatus> {
  const normalizedPartUid = normalizePartUid(partUid)
  if (!normalizedPartUid) {
    return {
      saved: false,
      watchForPriceDrops: false,
      watchForStockReturns: false,
    }
  }

  const row = await getSavedPartRow(userId, normalizedPartUid)
  return row
    ? {
        saved: true,
        watchForPriceDrops: Boolean(row.watchForPriceDrops),
        watchForStockReturns: Boolean(row.watchStockReturns),
      }
    : {
        saved: false,
        watchForPriceDrops: false,
        watchForStockReturns: false,
      }
}

export async function savePartForUser(
  userId: string,
  partUid: unknown,
  options: {
    watchForPriceDrops?: unknown
    watchForStockReturns?: unknown
  } = {},
) {
  const normalizedPartUid = normalizePartUid(partUid)
  if (!normalizedPartUid) {
    throw new Error("Product id is required")
  }

  await assertUserCanSaveParts(userId)
  const product = await getMarketplaceProduct(normalizedPartUid)
  if (!product.ok) {
    throw new Error("Product is not available to save")
  }

  await db.$executeRaw`
    INSERT INTO "user_saved_parts" (
      "id",
      "userId",
      "partUid",
      "watchPriceChanges",
      "watchStockReturns",
      "updatedAt"
    )
    VALUES (
      ${randomUUID()},
      ${userId},
      ${normalizedPartUid},
      ${Boolean(normalizeWatchFlag(options.watchForPriceDrops))},
      ${Boolean(normalizeWatchFlag(options.watchForStockReturns))},
      CURRENT_TIMESTAMP
    )
    ON CONFLICT ("userId", "partUid")
    DO UPDATE SET
      "watchPriceChanges" = EXCLUDED."watchPriceChanges",
      "watchStockReturns" = EXCLUDED."watchStockReturns",
      "updatedAt" = CURRENT_TIMESTAMP
  `

  return {
    partUid: normalizedPartUid,
    ...(await getSavedPartRow(userId, normalizedPartUid)),
  }
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

  const savedParts = await db.$queryRaw<UserSavedWatchRow[]>`
    SELECT
      "partUid",
      "watchPriceChanges" AS "watchForPriceDrops",
      "watchStockReturns",
      "createdAt",
      "updatedAt"
    FROM "user_saved_parts"
    WHERE "userId" = ${userId}
    ORDER BY "createdAt" DESC
    LIMIT 100
  `

  const savedAtByPartUid = new Map(
    savedParts.map((part) => [part.partUid, part.createdAt.toISOString()]),
  )
  const watchByPartUid = new Map(
    savedParts.map((part) => [
      part.partUid,
      {
        watchForPriceDrops: Boolean(part.watchForPriceDrops),
        watchForStockReturns: Boolean(part.watchStockReturns),
      },
    ]),
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
    watchForPriceDrops:
      watchByPartUid.get(product.partUid)?.watchForPriceDrops ?? false,
    watchForStockReturns:
      watchByPartUid.get(product.partUid)?.watchForStockReturns ?? false,
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
