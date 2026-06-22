import { createHash } from "node:crypto"
import type { NextRequest, NextResponse } from "next/server"

import type { UserSessionRequestContext } from "@/types/user-auth/user-auth"

type RateLimitEntry = {
  count: number
  resetAt: number
}

const rateLimitStore = new Map<string, RateLimitEntry>()

export function hashUserIp(ipAddress: string | null): string | null {
  if (!ipAddress) {
    return null
  }

  return createHash("sha256").update(ipAddress).digest("hex")
}

export function getClientIp(request: NextRequest): string | null {
  const rawIp =
    request.headers.get("x-forwarded-for") ||
    request.headers.get("x-real-ip") ||
    request.headers.get("cf-connecting-ip")

  return rawIp?.split(",")[0]?.trim() || null
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

export function isAllowedUserAuthOrigin(request: NextRequest): boolean {
  const origin = request.headers.get("origin")
  if (!origin) {
    return true
  }

  const configuredOrigins = (process.env.USER_AUTH_ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)

  try {
    const requestOrigin = new URL(request.url).origin
    if (origin === requestOrigin || configuredOrigins.includes(origin)) {
      return true
    }

    if (process.env.NODE_ENV !== "production") {
      const originUrl = new URL(origin)
      const requestUrl = new URL(request.url)
      const localHosts = new Set(["localhost", "127.0.0.1", "::1"])
      return (
        localHosts.has(originUrl.hostname) &&
        localHosts.has(requestUrl.hostname)
      )
    }

    return false
  } catch {
    return false
  }
}

export function setUserAuthCorsHeaders(
  request: NextRequest,
  response: NextResponse,
): void {
  const origin = request.headers.get("origin")
  if (!origin || !isAllowedUserAuthOrigin(request)) {
    return
  }

  response.headers.set("Access-Control-Allow-Origin", origin)
  response.headers.set("Access-Control-Allow-Credentials", "true")
  response.headers.set("Access-Control-Allow-Headers", "Content-Type")
  response.headers.set("Access-Control-Allow-Methods", "POST, OPTIONS")
  response.headers.append("Vary", "Origin")
}

export function consumeUserAuthRateLimit(
  key: string,
  limit: number,
  windowMs: number,
): { allowed: true } | { allowed: false; retryAfterSeconds: number } {
  const currentTime = Date.now()
  const existing = rateLimitStore.get(key)

  if (!existing || existing.resetAt <= currentTime) {
    rateLimitStore.set(key, {
      count: 1,
      resetAt: currentTime + windowMs,
    })
    return { allowed: true }
  }

  if (existing.count >= limit) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(
        1,
        Math.ceil((existing.resetAt - currentTime) / 1_000),
      ),
    }
  }

  existing.count += 1
  return { allowed: true }
}
