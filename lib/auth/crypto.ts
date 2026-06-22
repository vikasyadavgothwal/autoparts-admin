import {
  createHmac,
  randomBytes,
  randomUUID,
} from "node:crypto"

import { ADMIN_AUTH } from "@/lib/auth/config"
export { hashPassword, verifyPassword } from "@/lib/auth/password"

const getPepper = () => {
  if (!ADMIN_AUTH.tokenPepper) {
    return ""
  }

  return ADMIN_AUTH.tokenPepper
}

export const makeSecretHash = (value: string): string => {
  const pepper = getPepper()
  const source = `${value}:${pepper}`

  return createHmac("sha256", "admin-auth-secret").update(source).digest("hex")
}

export const hashRefreshToken = (token: string): string =>
  createHmac("sha256", getPepper() || "admin-token-secret")
    .update(token)
    .digest("hex")

export const hashIpAddress = (ip: string | null): string =>
  makeSecretHash(`ip:${ip ?? "unknown"}`)

export const hashUserAgent = (userAgent: string | null): string =>
  makeSecretHash(`ua:${userAgent ?? "unknown"}`)

export const generateSecureToken = (bytes = 48): string =>
  randomBytes(bytes).toString("base64url")

export const generateSessionId = (): string => randomUUID()
