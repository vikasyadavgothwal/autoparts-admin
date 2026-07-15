/**
 * @swagger
 * /api/v1/user/auth/create:
 *   post:
 *     tags: [User Auth]
 *     summary: Create a user account
 *     responses:
 *       201:
 *         description: User created
 *       400:
 *         description: Invalid request
 *       409:
 *         description: Email already exists
 */

import { NextRequest, NextResponse } from "next/server"

import { createUserViaApi } from "@/actions/user-auth/user-auth"
import {
  consumeUserAuthRateLimit,
  getClientIp,
  isAllowedUserAuthOrigin,
} from "@/lib/user-auth/security"
import type {
  CreateUserApiBody,
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

  const rateLimit = await consumeUserAuthRateLimit(
    `user-create:${getClientIp(request) ?? "unknown"}`,
    10,
    15 * 60 * 1_000,
  )
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { ok: false, success: false, message: "Too many requests" },
      {
        status: 429,
        headers: { "Retry-After": String(rateLimit.retryAfterSeconds) },
      },
    )
  }

  let body: CreateUserApiBody

  try {
    body = await request.json() as CreateUserApiBody
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

  const result = await createUserViaApi(body)

  if (!result.ok) {
    return NextResponse.json(
      { ok: false, success: false, message: result.message },
      { status: result.statusCode },
    )
  }

  return NextResponse.json(
    { ok: true, success: true, user: result.user },
    { status: result.statusCode },
  )
}
