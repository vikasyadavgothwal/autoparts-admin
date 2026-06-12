import { createHmac, timingSafeEqual } from "node:crypto"

import type { AuthTokenClaims } from "@/types/admin-auth/admin-auth"

const HEADER = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9"

const encodeBase64Url = (value: string): string =>
  Buffer.from(value, "utf8").toString("base64url")

const decodeBase64Url = (value: string): string => {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/")
  const padded = `${base64}${"=".repeat((4 - (base64.length % 4)) % 4)}`

  return Buffer.from(padded, "base64").toString("utf8")
}

const buildSignature = (data: string, secret: string): string =>
  createHmac("sha256", secret).update(data).digest("base64url")

export const signJwt = (
  payload: AuthTokenClaims,
  secret: string,
): string => {
  const encodedHeader = HEADER
  const encodedPayload = encodeBase64Url(JSON.stringify(payload))
  const signature = buildSignature(`${encodedHeader}.${encodedPayload}`, secret)

  return `${encodedHeader}.${encodedPayload}.${signature}`
}

export const verifyJwt = (token: string, secret: string): AuthTokenClaims | null => {
  const parts = token.split(".")
  if (parts.length !== 3) {
    return null
  }

  const [encodedHeader, encodedPayload, encodedSignature] = parts
  if (encodedHeader !== HEADER) {
    return null
  }

  const expectedSignature = buildSignature(
    `${encodedHeader}.${encodedPayload}`,
    secret,
  )

  if (expectedSignature.length !== encodedSignature.length) {
    return null
  }

  const signatureMatches = timingSafeEqual(
    Buffer.from(expectedSignature),
    Buffer.from(encodedSignature),
  )

  if (!signatureMatches) {
    return null
  }

  let tokenPayload: AuthTokenClaims
  try {
    tokenPayload = JSON.parse(decodeBase64Url(encodedPayload)) as AuthTokenClaims
  } catch {
    return null
  }

  const nowInSeconds = Math.floor(Date.now() / 1000)
  if (tokenPayload.exp <= nowInSeconds) {
    return null
  }

  return tokenPayload
}
