import { NextRequest, NextResponse } from "next/server"

import { apiError, apiErrorMessage, withUserApiRoute } from "@/lib/auth/api-guards"
import { businessAuditLogsCsv } from "@/services/business/business-platform-service"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  return withUserApiRoute(request, async (auth) => {
    try {
      const csv = await businessAuditLogsCsv({
        userId: auth.user.id,
        businessAccountId: request.nextUrl.searchParams.get("businessAccountId"),
      })
      return new NextResponse(csv, {
        headers: {
          "content-type": "text/csv; charset=utf-8",
          "content-disposition": "attachment; filename=business-audit-logs.csv",
        },
      })
    } catch (error) {
      return apiError(apiErrorMessage(error, "Unable to export audit logs"))
    }
  })
}
