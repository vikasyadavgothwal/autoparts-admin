import { headers } from "next/headers"

export type AuthRequestContext = {
  ipAddress: string | null
  userAgent: string | null
}

export const getRequestContext = async (): Promise<AuthRequestContext> => {
  const requestHeaders = await headers()

  const cloudflareIp = requestHeaders.get("cf-connecting-ip")?.trim()
  const realIp = requestHeaders.get("x-real-ip")?.trim()
  const forwarded = requestHeaders.get("x-forwarded-for")
  const ipAddress =
    cloudflareIp ||
    realIp ||
    forwarded?.split(",").at(-1)?.trim() ||
    requestHeaders.get("x-client-ip")?.trim() ||
    null
  const userAgent = requestHeaders.get("user-agent")

  return {
    ipAddress,
    userAgent,
  }
}
