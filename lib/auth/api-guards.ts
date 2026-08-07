import { NextRequest, NextResponse } from "next/server"

import { getCurrentAdminSession } from "@/actions/admin-auth/me"
import { requireUserAuth } from "@/actions/user-auth/user-auth"
import { USER_AUTH } from "@/lib/user-auth/config"
import { isSupplierUser } from "@/services/parts-mapping"

export type UserApiAuth = NonNullable<Awaited<ReturnType<typeof requireUserAuth>>>

export const apiError = (message: string, status = 400) =>
  NextResponse.json({ ok: false, message }, { status })

export const apiOk = <T extends Record<string, unknown>>(payload: T) =>
  NextResponse.json({ ok: true, ...payload })

export const apiCreated = <T extends Record<string, unknown>>(payload: T) =>
  NextResponse.json({ ok: true, ...payload }, { status: 201 })

export const apiErrorMessage = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message : fallback

export async function requireUserFromRequest(request: NextRequest) {
  const auth = await getOptionalUserFromRequest(request)
  if (!auth) {
    return {
      ok: false as const,
      response: apiError("Unauthorized", 401),
    }
  }

  return { ok: true as const, auth }
}

export async function withUserApiRoute(
  request: NextRequest,
  handler: (auth: UserApiAuth) => Promise<Response>,
) {
  const auth = await requireUserFromRequest(request)
  if (!auth.ok) return auth.response
  return handler(auth.auth)
}

export async function withCustomerApiRoute(
  request: NextRequest,
  handler: (user: UserApiAuth["user"]) => Promise<Response>,
) {
  const auth = await requireCustomerUserFromRequest(request)
  if (!auth.ok) return auth.response
  return handler(auth.user)
}

export async function withFleetApiRoute(
  request: NextRequest,
  handler: (user: UserApiAuth["user"]) => Promise<Response>,
) {
  const auth = await requireFleetFromRequest(request)
  if (!auth.ok) return auth.response
  return handler(auth.user)
}

export async function withSupplierApiRoute(
  request: NextRequest,
  handler: (user: UserApiAuth["user"]) => Promise<Response>,
) {
  const auth = await requireSupplierFromRequest(request)
  if (!auth.ok) return auth.response
  return handler(auth.user)
}

export async function withGarageApiRoute(
  request: NextRequest,
  handler: (user: UserApiAuth["user"]) => Promise<Response>,
) {
  const auth = await requireGarageFromRequest(request)
  if (!auth.ok) return auth.response
  return handler(auth.user)
}

export const isUniqueConstraintError = (error: unknown) =>
  typeof error === "object" &&
  error !== null &&
  "code" in error &&
  error.code === "P2002"

export async function requireSupplierFromRequest(request: NextRequest) {
  const accessToken =
    request.cookies.get(USER_AUTH.accessCookieName)?.value ?? null
  const auth = await requireUserAuth(accessToken)

  if (!auth) {
    return {
      ok: false as const,
      response: NextResponse.json(
        { ok: false, message: "Unauthorized" },
        { status: 401 },
      ),
    }
  }

  if (!isSupplierUser(auth.user)) {
    return {
      ok: false as const,
      response: NextResponse.json(
        { ok: false, message: "Supplier role is required" },
        { status: 403 },
      ),
    }
  }

  return { ok: true as const, user: auth.user }
}

export async function getOptionalUserFromRequest(request: NextRequest) {
  const accessToken =
    request.cookies.get(USER_AUTH.accessCookieName)?.value ?? null
  return accessToken ? requireUserAuth(accessToken) : null
}

export async function requireFleetFromRequest(request: NextRequest) {
  const auth = await getOptionalUserFromRequest(request)
  if (!auth) {
    return {
      ok: false as const,
      response: NextResponse.json(
        { ok: false, message: "Unauthorized" },
        { status: 401 },
      ),
    }
  }
  if (!auth.user.roles.includes("Fleet")) {
    return {
      ok: false as const,
      response: NextResponse.json(
        { ok: false, message: "Fleet role is required" },
        { status: 403 },
      ),
    }
  }
  return { ok: true as const, user: auth.user }
}

export async function requireGarageFromRequest(request: NextRequest) {
  const auth = await getOptionalUserFromRequest(request)
  if (!auth) {
    return {
      ok: false as const,
      response: NextResponse.json(
        { ok: false, message: "Unauthorized" },
        { status: 401 },
      ),
    }
  }
  if (!auth.user.roles.includes("Garage")) {
    return {
      ok: false as const,
      response: NextResponse.json(
        { ok: false, message: "Garage role is required" },
        { status: 403 },
      ),
    }
  }
  return { ok: true as const, user: auth.user }
}

export async function requireCustomerUserFromRequest(request: NextRequest) {
  const auth = await getOptionalUserFromRequest(request)
  if (!auth) {
    return {
      ok: false as const,
      response: NextResponse.json(
        { ok: false, message: "Unauthorized" },
        { status: 401 },
      ),
    }
  }
  if (!auth.user.roles.includes("User") || auth.user.activeRole !== "User") {
    return {
      ok: false as const,
      response: NextResponse.json(
        { ok: false, message: "User role is required" },
        { status: 403 },
      ),
    }
  }
  return { ok: true as const, user: auth.user }
}

export async function requireAdminFromRequest() {
  const auth = await getCurrentAdminSession()

  if (!auth.ok || !auth.admin.isActive) {
    return {
      ok: false as const,
      response: NextResponse.json(
        { ok: false, message: "Unauthorized" },
        { status: 401 },
      ),
    }
  }

  return { ok: true as const, admin: auth.admin }
}

export async function readJsonBody<T>(request: NextRequest) {
  try {
    const body = (await request.json()) as T
    if (!body || typeof body !== "object") {
      return { ok: false as const, message: "Invalid request body" }
    }

    return { ok: true as const, body }
  } catch {
    return { ok: false as const, message: "Invalid JSON body" }
  }
}
