import { NextRequest } from "next/server"

import { apiError, apiErrorMessage, apiOk, withUserApiRoute } from "@/lib/auth/api-guards"
import { listMyBusinessPaymentTransactions } from "@/services/business/business-platform-service"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  return withUserApiRoute(request, async (auth) => {
    try {
      const transactions = await listMyBusinessPaymentTransactions({
        userId: auth.user.id,
        businessAccountId: request.nextUrl.searchParams.get("businessAccountId"),
      })
      return apiOk({ transactions })
    } catch (error) {
      return apiError(apiErrorMessage(error, "Unable to list payment history"))
    }
  })
}
