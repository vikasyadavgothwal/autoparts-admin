/**
 * @swagger
 * /api/v1/user/auth/logout:
 *   post:
 *     tags: [User Auth]
 *     summary: Log out a user and invalidate existing access tokens
 *     responses:
 *       200:
 *         description: Logout successful
 *       401:
 *         description: Missing or invalid token
 */

import { NextRequest, NextResponse } from "next/server"

import { logoutUserViaApi } from "@/actions/user-auth/user-auth"
import { clearUserAuthCookies } from "@/lib/user-auth/cookies"
import { USER_AUTH } from "@/lib/user-auth/config"
import { isAllowedUserAuthOrigin } from "@/lib/user-auth/security"
import type { UserLogoutApiResponse } from "@/types/user-auth/user-auth"

export const dynamic = "force-dynamic"

const getAccessToken = (request: NextRequest): string | null => {
  const authorization = request.headers.get("authorization")?.trim() ?? ""

  if (authorization.toLowerCase().startsWith("bearer ")) {
    return authorization.slice(7).trim() || null
  }

  return request.cookies.get(USER_AUTH.accessCookieName)?.value ?? null
}

export async function POST(
  request: NextRequest,
): Promise<NextResponse<UserLogoutApiResponse>> {
  if (!isAllowedUserAuthOrigin(request)) {
    return NextResponse.json(
      { ok: false, success: false, message: "Origin is not allowed" },
      { status: 403 },
    )
  }

  const loggedOut = await logoutUserViaApi(
    getAccessToken(request),
    request.cookies.get(USER_AUTH.refreshCookieName)?.value ?? null,
  )
  const response = NextResponse.json(
    loggedOut
      ? {
          ok: true as const,
          success: true as const,
          message: "Logged out successfully",
        }
      : {
          ok: false as const,
          success: false as const,
          message: "Invalid or expired session",
        },
    { status: loggedOut ? 200 : 401 },
  )

  clearUserAuthCookies(response)

  return response
}
