import { createHash } from "node:crypto"
import type { NextRequest, NextResponse } from "next/server"

import { isApiOriginAllowed, setApiCorsHeaders } from "@/lib/api-cors"
import { db } from "@/lib/database/prisma"
import type { UserSessionRequestContext } from "@/types/user-auth/user-auth"

export function hashUserIp(ipAddress: string | null): string | null {
  if (!ipAddress) {
    return null
  }

  return createHash("sha256").update(ipAddress).digest("hex")
}

export function getClientIp(request: NextRequest): string | null {
  const cloudflareIp = request.headers.get("cf-connecting-ip")?.trim()
  if (cloudflareIp) return cloudflareIp

  const realIp = request.headers.get("x-real-ip")?.trim()
  if (realIp) return realIp

  const forwarded = request.headers.get("x-forwarded-for")
  if (!forwarded) return null

  // Trusted reverse proxies append their connecting address to this list.
  // Reading the final value prevents a caller-controlled first entry from
  // becoming the rate-limit and audit identity.
  return forwarded.split(",").at(-1)?.trim() || null
}

export function getDeviceName(userAgent: string | null): string | null {
  if (!userAgent) {
    return null
  }

  if (/iphone|ipad|ios/i.test(userAgent)) return "Apple mobile device"
  if (/android/i.test(userAgent)) return "Android device"
  if (/windows/i.test(userAgent)) return "Windows device"
  if (/macintosh|mac os/i.test(userAgent)) return "Mac device"
  if (/linux/i.test(userAgent)) return "Linux device"

  return "Unknown device"
}

export function getUserRequestContext(
  request: NextRequest,
  requestedDeviceName?: string | null,
): UserSessionRequestContext {
  const userAgent = request.headers.get("user-agent")

  return {
    ipAddress: getClientIp(request),
    userAgent,
    deviceName: requestedDeviceName?.trim() || getDeviceName(userAgent),
  }
}

export function isAllowedUserAuthOrigin(request?: NextRequest): boolean {
  return request ? isApiOriginAllowed(request) : false
}

export function setUserAuthCorsHeaders(
  request: NextRequest,
  response: NextResponse,
): void {
  setApiCorsHeaders(request, response)
}

export async function consumeUserAuthRateLimit(
  key: string,
  limit: number,
  windowMs: number,
): Promise<
  { allowed: true } | { allowed: false; retryAfterSeconds: number }
> {
  const rows = await db.$queryRaw<Array<{ count: number; resetAt: Date }>>`
    INSERT INTO "api_rate_limits" ("key", "count", "resetAt", "updatedAt")
    VALUES (${key}, 1, NOW() + (${windowMs} * INTERVAL '1 millisecond'), NOW())
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE
        WHEN "api_rate_limits"."resetAt" <= NOW() THEN 1
        ELSE "api_rate_limits"."count" + 1
      END,
      "resetAt" = CASE
        WHEN "api_rate_limits"."resetAt" <= NOW()
          THEN NOW() + (${windowMs} * INTERVAL '1 millisecond')
        ELSE "api_rate_limits"."resetAt"
      END,
      "updatedAt" = NOW()
    RETURNING "count", "resetAt"
  `
  const entry = rows[0]

  if (!entry) throw new Error("Rate limiter did not return a result")

  if (entry.count > limit) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(
        1,
        Math.ceil((entry.resetAt.getTime() - Date.now()) / 1_000),
      ),
    }
  }

  return { allowed: true }
}
