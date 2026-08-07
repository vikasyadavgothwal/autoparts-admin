import { NextRequest } from "next/server"

import {
  apiError,
  apiErrorMessage,
  apiOk,
  withUserApiRoute,
} from "@/lib/auth/api-guards"
import { deleteBusinessWishlistItem } from "@/services/business/business-platform-service"

export const dynamic = "force-dynamic"

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  return withUserApiRoute(request, async (auth) => {
    try {
      const { id } = await context.params
      const result = await deleteBusinessWishlistItem({
        userId: auth.user.id,
        businessAccountId: request.nextUrl.searchParams.get("businessAccountId"),
        id,
      })
      return apiOk(result)
    } catch (error) {
      return apiError(apiErrorMessage(error, "Unable to delete wishlist item"))
    }
  })
}
