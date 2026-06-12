import {
  createHmac,
  randomBytes,
  randomUUID,
  scryptSync,
  timingSafeEqual,
} from "node:crypto"

import { ADMIN_AUTH } from "@/lib/auth/config"

const SALT_BYTES = 16
const HASH_BYTES = 64

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

export const hashPassword = (password: string): string => {
  const salt = randomBytes(SALT_BYTES).toString("hex")
  const derived = scryptSync(password, salt, HASH_BYTES)

  return `${salt}:${derived.toString("hex")}`
}

export const verifyPassword = (password: string, hashedPassword: string): boolean => {
  const [rawSalt, storedHash] = hashedPassword.split(":")

  if (!rawSalt || !storedHash) {
    return false
  }

  const candidate = scryptSync(password, rawSalt, HASH_BYTES)
  const current = Buffer.from(storedHash, "hex")

  if (candidate.length !== current.length) {
    return false
  }

  return timingSafeEqual(candidate, current)
}

export const generateSessionId = (): string => randomUUID()
