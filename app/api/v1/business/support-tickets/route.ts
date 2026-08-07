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
  createBusinessSupportTicket,
  listBusinessSupportTickets,
} from "@/services/business/business-platform-service"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  return withUserApiRoute(request, async (auth) => {
    try {
      const supportTickets = await listBusinessSupportTickets({
        userId: auth.user.id,
        businessAccountId: request.nextUrl.searchParams.get("businessAccountId"),
      })
      return apiOk({ supportTickets })
    } catch (error) {
      return apiError(apiErrorMessage(error, "Unable to list support tickets"))
    }
  })
}

export async function POST(request: NextRequest) {
  return withUserApiRoute(request, async (auth) => {
    const body = await readJsonBody<{
      businessAccountId?: unknown
      subject?: unknown
      message?: unknown
    }>(request)
    if (!body.ok) return apiError(body.message)

    try {
      const supportTicket = await createBusinessSupportTicket({
        userId: auth.user.id,
        businessAccountId: body.body.businessAccountId,
        subject: body.body.subject,
        message: body.body.message,
      })
      return apiCreated({ supportTicket })
    } catch (error) {
      return apiError(apiErrorMessage(error, "Unable to create support ticket"))
    }
  })
}
