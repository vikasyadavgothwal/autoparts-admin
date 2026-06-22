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
} from "@/lib/user-auth/security"
import type {
  LoginUserApiBody,
  UserAuthApiResponse,
} from "@/types/user-auth/user-auth"

export const dynamic = "force-dynamic"

export async function POST(
  request: NextRequest,
): Promise<NextResponse<UserAuthApiResponse>> {
  if (!isAllowedUserAuthOrigin(request)) {
    return NextResponse.json(
      { ok: false, success: false, message: "Origin is not allowed" },
      { status: 403 },
    )
  }

  const rateLimit = consumeUserAuthRateLimit(
    `user-login:${getClientIp(request) ?? "unknown"}`,
    10,
    15 * 60 * 1_000,
  )
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { ok: false, success: false, message: "Too many login attempts" },
      {
        status: 429,
        headers: { "Retry-After": String(rateLimit.retryAfterSeconds) },
      },
    )
  }

  let body: LoginUserApiBody

  try {
    body = await request.json() as LoginUserApiBody
  } catch {
    return NextResponse.json(
      { ok: false, success: false, message: "Invalid JSON body" },
      { status: 400 },
    )
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json(
      { ok: false, success: false, message: "Invalid request body" },
      { status: 400 },
    )
  }

  const deviceName =
    typeof body.deviceName === "string" ? body.deviceName : null
  const result = await loginUserViaApi(
    body,
    getUserRequestContext(request, deviceName),
  )

  if (!result.ok) {
    return NextResponse.json(
      { ok: false, success: false, message: result.message },
      { status: result.statusCode },
    )
  }

  if (
    !result.accessToken ||
    !result.refreshToken ||
    !result.expiresAt ||
    !result.refreshExpiresAt
  ) {
    return NextResponse.json(
      {
        ok: false,
        success: false,
        message: "Login token could not be issued",
      },
      { status: 500 },
    )
  }

  const response = NextResponse.json(
    {
      ok: true as const,
      success: true as const,
      user: result.user,
      expiresAt: result.expiresAt,
    },
    { status: result.statusCode },
  )

  setUserAuthCookies(response, {
    accessToken: result.accessToken,
    refreshToken: result.refreshToken,
    accessExpiresAt: new Date(result.expiresAt),
    refreshExpiresAt: new Date(result.refreshExpiresAt),
  })

  return response
}
