import { NextRequest, NextResponse } from "next/server"

import { sendDueRfqQuoteSummaryEmails } from "@/services/fleet/fleet-service"

export const dynamic = "force-dynamic"
export const maxDuration = 60

const isAuthorizedCronRequest = (request: NextRequest) => {
  const secret = process.env.CRON_SECRET?.trim()
  if (!secret) return false
  const bearer = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim()
  const headerSecret = request.headers.get("x-cron-secret")?.trim()
  const querySecret = request.nextUrl.searchParams.get("secret")?.trim()
  return bearer === secret || headerSecret === secret || querySecret === secret
}

export async function GET(request: NextRequest) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 })
  }

  const result = await sendDueRfqQuoteSummaryEmails()
  return NextResponse.json({ ok: true, ...result })
}
