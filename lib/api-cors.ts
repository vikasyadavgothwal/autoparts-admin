import type { NextRequest, NextResponse } from "next/server"

const DEVELOPMENT_ORIGINS = [
  "http://localhost:3000",
  "http://localhost:3001",
  "http://localhost:3002",
  "http://localhost:3003",
  "http://localhost:3004",
  "http://localhost:4001",
] as const

const ALLOWED_METHODS = "GET, POST, PUT, PATCH, DELETE, OPTIONS"
const ALLOWED_HEADERS = [
  "Accept",
  "Authorization",
  "Content-Type",
  "X-Requested-With",
].join(", ")

const configuredOrigins = (() => {
  const configured = (process.env.USER_AUTH_ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean)

  const origins =
    configured.length > 0
      ? configured
    : process.env.NODE_ENV === "production"
      ? []
      : [...DEVELOPMENT_ORIGINS]

  return new Set(origins)
})()

export function isApiOriginAllowed(request: NextRequest): boolean {
  const origin = request.headers.get("origin")

  // React Native, native apps, same-origin server requests, and server-to-server
  // clients normally do not send the browser Origin header.
  if (!origin) return true

  return configuredOrigins.has(origin)
}

export function setApiCorsHeaders(
  request: NextRequest,
  response: NextResponse,
): void {
  const origin = request.headers.get("origin")
  if (!origin || !isApiOriginAllowed(request)) return

  response.headers.set("Access-Control-Allow-Origin", origin)
  response.headers.set("Access-Control-Allow-Credentials", "true")
  response.headers.set("Access-Control-Allow-Methods", ALLOWED_METHODS)
  response.headers.set("Access-Control-Allow-Headers", ALLOWED_HEADERS)
  response.headers.set("Access-Control-Max-Age", "86400")
  response.headers.append("Vary", "Origin")
}
