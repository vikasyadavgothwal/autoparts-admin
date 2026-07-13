import { NextRequest, NextResponse } from "next/server"

import { getCurrentAdminSession } from "@/actions/admin-auth/me"
import { requireUserAuth } from "@/actions/user-auth/user-auth"
import { USER_AUTH } from "@/lib/user-auth/config"
import { isSupplierUser } from "@/services/parts-mapping/parts-mapping-service"

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
