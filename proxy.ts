import { NextRequest, NextResponse } from "next/server"
import { isApiOriginAllowed, setApiCorsHeaders } from "@/lib/api-cors"

const accessCookie = process.env.ADMIN_ACCESS_COOKIE_NAME ?? "admin_access_token"
const refreshCookie = process.env.ADMIN_REFRESH_COOKIE_NAME ?? "admin_refresh_token"

const expiresSoon = (token: string) => {
  try {
    const payload = token.split(".")[1]
    if (!payload) return true
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/")
    const decoded = JSON.parse(
      atob(normalized + "=".repeat((4 - (normalized.length % 4)) % 4)),
    ) as { exp?: number }

    return !decoded.exp || decoded.exp * 1000 <= Date.now() + 30_000
  } catch {
    return true
  }
}

export function proxy(request: NextRequest) {
  const requestId =
    request.headers.get("x-request-id") ??
    (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`)

  if (request.nextUrl.pathname.startsWith("/api/")) {
    if (!isApiOriginAllowed(request)) {
      const response = NextResponse.json(
        { ok: false, message: "Origin is not allowed" },
        { status: 403 },
      )
      response.headers.set("x-request-id", requestId)
      return response
    }

    if (request.method === "OPTIONS") {
      const response = new NextResponse(null, { status: 204 })
      response.headers.set("x-request-id", requestId)
      setApiCorsHeaders(request, response)
      return response
    }

    const requestHeaders = new Headers(request.headers)
    requestHeaders.set("x-request-id", requestId)
    const response = NextResponse.next({ request: { headers: requestHeaders } })
    response.headers.set("x-request-id", requestId)
    setApiCorsHeaders(request, response)
    return response
  }

  if (
    request.method !== "GET" ||
    !request.headers.get("accept")?.includes("text/html")
  ) {
    return NextResponse.next()
  }

  const pathname = request.nextUrl.pathname
  if (
    pathname === "/login" ||
    pathname.startsWith("/_next/")
  ) {
    return NextResponse.next()
  }

  const refresh = request.cookies.get(refreshCookie)?.value
  const access = request.cookies.get(accessCookie)?.value
  if (!refresh || (access && !expiresSoon(access))) return NextResponse.next()

  const destination = request.nextUrl.clone()
  destination.pathname = "/api/v1/admin/auth/refresh"
  destination.search = ""
  destination.searchParams.set(
    "returnTo",
    `${pathname}${request.nextUrl.search}`,
  )

  return NextResponse.redirect(destination)
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
}
