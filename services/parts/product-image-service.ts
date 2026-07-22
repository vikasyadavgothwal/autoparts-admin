import { db } from "@/lib/database/prisma"

export async function supplierOwnsCatalogProductImage(input: {
  supplierId: string
  key: string
}): Promise<boolean> {
  // FIX: Keep supplier product-image ownership lookup out of the route handler.
  const ownsImage = await db.supplierPart.findFirst({
    where: {
      supplierId: input.supplierId,
      part: { imageKeys: { has: input.key } },
    },
    select: { id: true },
  })

  return Boolean(ownsImage)
}
