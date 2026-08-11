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
      const ticketPage = await listBusinessSupportTickets({
        userId: auth.user.id,
        businessAccountId: request.nextUrl.searchParams.get("businessAccountId"),
        page: request.nextUrl.searchParams.get("page"),
        pageSize: request.nextUrl.searchParams.get("pageSize"),
      })
      const { items: supportTickets, ...pagination } = ticketPage
      return apiOk({ supportTickets, pagination })
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
      category?: unknown
    }>(request)
    if (!body.ok) return apiError(body.message)

    try {
      const supportTicket = await createBusinessSupportTicket({
        userId: auth.user.id,
        businessAccountId: body.body.businessAccountId,
        subject: body.body.subject,
        message: body.body.message,
        category: body.body.category,
      })
      return apiCreated({ supportTicket })
    } catch (error) {
      return apiError(apiErrorMessage(error, "Unable to create support ticket"))
    }
  })
}
