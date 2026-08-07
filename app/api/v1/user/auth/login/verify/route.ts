import { NextRequest, NextResponse } from "next/server"

import { setUserAuthCookies } from "@/lib/user-auth/cookies"
import { consumeUserAuthRateLimit, getClientIp, getUserRequestContext, isAllowedUserAuthOrigin, setUserAuthCorsHeaders } from "@/lib/user-auth/security"
import { verifyBusinessLoginChallenge } from "@/services/business-login-security/business-login-security-service"

export const dynamic = "force-dynamic"

const withCors = <T extends NextResponse>(request: NextRequest, response: T): T => {
  setUserAuthCorsHeaders(request, response)
  return response
}

export async function POST(request: NextRequest) {
  if (!isAllowedUserAuthOrigin(request)) {
    return withCors(request, NextResponse.json({ ok: false, success: false, message: "Origin is not allowed" }, { status: 403 }))
  }
  const rateLimit = await consumeUserAuthRateLimit(`user-login-verify:${getClientIp(request) ?? "unknown"}`, 10, 15 * 60 * 1_000)
  if (!rateLimit.allowed) {
    return withCors(request, NextResponse.json({ ok: false, success: false, message: "Too many verification attempts" }, { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSeconds) } }))
  }
  const body = await request.json().catch(() => null) as { challengeId?: unknown; code?: unknown; method?: unknown; deviceName?: unknown; deviceIdentifier?: unknown; deviceMacAddress?: unknown } | null
  if (!body || typeof body !== "object") {
    return withCors(request, NextResponse.json({ ok: false, success: false, message: "Invalid request body" }, { status: 400 }))
  }
  try {
    const deviceName = typeof body.deviceName === "string" ? body.deviceName : null
    const deviceIdentifier = typeof body.deviceIdentifier === "string" ? body.deviceIdentifier : null
    const deviceMacAddress = typeof body.deviceMacAddress === "string" ? body.deviceMacAddress : null
    const result = await verifyBusinessLoginChallenge({ challengeId: body.challengeId, code: body.code, method: body.method, context: getUserRequestContext(request, deviceName, deviceIdentifier, deviceMacAddress) })
    const response = NextResponse.json({ ok: true, success: true, user: result.user, accessToken: result.issued.accessToken, refreshToken: result.issued.refreshToken, expiresAt: result.issued.accessExpiresAt.toISOString(), refreshExpiresAt: result.issued.refreshExpiresAt.toISOString() })
    setUserAuthCookies(response, result.issued)
    return withCors(request, response)
  } catch (error) {
    return withCors(request, NextResponse.json({ ok: false, success: false, message: error instanceof Error ? error.message : "Unable to verify login" }, { status: 400 }))
  }
}
