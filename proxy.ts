import { NextResponse, type NextRequest } from "next/server"

const ALLOWED_METHODS = "GET, POST, PUT, PATCH, DELETE, OPTIONS"
const DEFAULT_ALLOWED_HEADERS = [
  "Accept",
  "Authorization",
  "Content-Type",
  "Cookie",
  "Origin",
  "X-Requested-With",
].join(", ")

const applyCorsHeaders = (request: NextRequest, response: NextResponse) => {
  const origin = request.headers.get("origin")
  const requestedHeaders = request.headers.get("access-control-request-headers")

  response.headers.set("Access-Control-Allow-Origin", origin || "*")
  response.headers.set("Access-Control-Allow-Credentials", "true")
  response.headers.set("Access-Control-Allow-Methods", ALLOWED_METHODS)
  response.headers.set(
    "Access-Control-Allow-Headers",
    requestedHeaders || DEFAULT_ALLOWED_HEADERS,
  )
  response.headers.set("Access-Control-Max-Age", "86400")
  response.headers.append("Vary", "Origin")
  response.headers.append("Vary", "Access-Control-Request-Headers")
  response.headers.append("Vary", "Access-Control-Request-Method")

  return response
}

export function proxy(request: NextRequest) {
  if (request.method === "OPTIONS") {
    return applyCorsHeaders(request, new NextResponse(null, { status: 204 }))
  }

  return applyCorsHeaders(request, NextResponse.next())
}

export const config = {
  matcher: "/api/:path*",
}
