/**
 * @swagger
 * /api/v1/user/auth/login:
 *   post:
 *     tags: [User Auth]
 *     summary: Log in a user
 *     responses:
 *       200:
 *         description: Login successful
 *       400:
 *         description: Invalid request
 *       401:
 *         description: Invalid credentials
 *       403:
 *         description: User is inactive
 */

import { NextRequest, NextResponse } from "next/server"

import { loginUserViaApi } from "@/actions/user-auth/user-auth"
import { setUserAuthCookies } from "@/lib/user-auth/cookies"
import {
  consumeUserAuthRateLimit,
  getClientIp,
  getUserRequestContext,
  isAllowedUserAuthOrigin,
  setUserAuthCorsHeaders,
} from "@/lib/user-auth/security"
import type {
  LoginUserApiBody,
} from "@/types/user-auth/user-auth"

export const dynamic = "force-dynamic"

const withCors = <T extends NextResponse>(
  request: NextRequest,
  response: T,
): T => {
  setUserAuthCorsHeaders(request, response)
  return response
}

export async function OPTIONS(request: NextRequest): Promise<NextResponse> {
  if (!isAllowedUserAuthOrigin(request)) {
    return NextResponse.json(
      { ok: false, success: false, message: "Origin is not allowed" },
      { status: 403 },
    )
  }

  return withCors(request, new NextResponse(null, { status: 204 }))
}

export async function POST(
  request: NextRequest,
): Promise<NextResponse> {
  if (!isAllowedUserAuthOrigin(request)) {
    return withCors(request, NextResponse.json(
      { ok: false, success: false, message: "Origin is not allowed" },
      { status: 403 },
    ))
  }

  const rateLimit = await consumeUserAuthRateLimit(
    `user-login:${getClientIp(request) ?? "unknown"}`,
    10,
    15 * 60 * 1_000,
  )
  if (!rateLimit.allowed) {
    return withCors(request, NextResponse.json(
      { ok: false, success: false, message: "Too many login attempts" },
      {
        status: 429,
        headers: { "Retry-After": String(rateLimit.retryAfterSeconds) },
      },
    ))
  }

  let body: LoginUserApiBody

  try {
    body = await request.json() as LoginUserApiBody
  } catch {
    return withCors(request, NextResponse.json(
      { ok: false, success: false, message: "Invalid JSON body" },
      { status: 400 },
    ))
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return withCors(request, NextResponse.json(
      { ok: false, success: false, message: "Invalid request body" },
      { status: 400 },
    ))
  }

  const installationId =
    typeof body.installationId === "string"
      ? body.installationId.trim().slice(0, 200)
      : ""
  const deviceIdentifier =
    typeof body.deviceIdentifier === "string"
      ? body.deviceIdentifier.trim().slice(0, 200)
      : installationId
  const deviceMacAddress =
    typeof body.deviceMacAddress === "string"
      ? body.deviceMacAddress.trim().slice(0, 120)
      : null
  const deviceName =
    typeof body.deviceName === "string" && body.deviceName.trim()
      ? body.deviceName
      : installationId
        ? `Device ${installationId.slice(0, 12)}`
        : null
  const result = await loginUserViaApi(
    body,
    getUserRequestContext(request, deviceName, deviceIdentifier, deviceMacAddress),
  )

  if (!result.ok) {
    return withCors(request, NextResponse.json(
      { ok: false, success: false, message: result.message },
      { status: result.statusCode },
    ))
  }

  if (result.mfa) {
    return withCors(request, NextResponse.json({ ok: true, success: true, user: result.user, mfa: result.mfa }, { status: result.statusCode }))
  }

  if (
    !result.accessToken ||
    !result.refreshToken ||
    !result.expiresAt ||
    !result.refreshExpiresAt
  ) {
    return withCors(request, NextResponse.json(
      {
        ok: false,
        success: false,
        message: "Login token could not be issued",
      },
      { status: 500 },
    ))
  }
  const response = NextResponse.json(
    {
      ok: true as const,
      success: true as const,
      user: result.user,
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      expiresAt: result.expiresAt,
      refreshExpiresAt: result.refreshExpiresAt,
    },
    { status: result.statusCode },
  )

  setUserAuthCookies(response, {
    accessToken: result.accessToken,
    refreshToken: result.refreshToken,
    accessExpiresAt: new Date(result.expiresAt),
    refreshExpiresAt: new Date(result.refreshExpiresAt),
  })
  setUserAuthCorsHeaders(request, response)

  return response
}
