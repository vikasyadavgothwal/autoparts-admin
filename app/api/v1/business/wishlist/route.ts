import { NextRequest } from "next/server"

import {
  apiCreated,
  apiError,
  apiErrorMessage,
  apiOk,
  readJsonBody,
  withUserApiRoute,
} from "@/lib/auth/api-guards"
import {
  createBusinessWishlistItem,
  listBusinessWishlistItems,
} from "@/services/business/business-platform-service"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  return withUserApiRoute(request, async (auth) => {
    try {
      const wishlistItems = await listBusinessWishlistItems({
        userId: auth.user.id,
        businessAccountId: request.nextUrl.searchParams.get("businessAccountId"),
        itemType: request.nextUrl.searchParams.get("itemType"),
      })
      return apiOk({ wishlistItems })
    } catch (error) {
      return apiError(apiErrorMessage(error, "Unable to list wishlist"))
    }
  })
}

export async function POST(request: NextRequest) {
  return withUserApiRoute(request, async (auth) => {
    const body = await readJsonBody<{
      businessAccountId?: unknown
      itemType?: unknown
      itemId?: unknown
      title?: unknown
      metadata?: unknown
    }>(request)
    if (!body.ok) return apiError(body.message)

    try {
      const wishlistItem = await createBusinessWishlistItem({
        userId: auth.user.id,
        businessAccountId: body.body.businessAccountId,
        itemType: body.body.itemType,
        itemId: body.body.itemId,
        title: body.body.title,
        metadata: body.body.metadata,
      })
      return apiCreated({ wishlistItem })
    } catch (error) {
      return apiError(apiErrorMessage(error, "Unable to save wishlist item"))
    }
  })
}
