import { headers } from "next/headers"

export type AuthRequestContext = {
  ipAddress: string | null
  userAgent: string | null
}

export const getRequestContext = async (): Promise<AuthRequestContext> => {
  const requestHeaders = await headers()

  const rawIp =
    requestHeaders.get("x-forwarded-for") ||
    requestHeaders.get("x-real-ip") ||
    requestHeaders.get("cf-connecting-ip") ||
    requestHeaders.get("x-client-ip")

  const ipAddress = rawIp ? rawIp.split(",")[0]?.trim() ?? null : null
  const userAgent = requestHeaders.get("user-agent")

  return {
    ipAddress,
    userAgent,
  }
}
