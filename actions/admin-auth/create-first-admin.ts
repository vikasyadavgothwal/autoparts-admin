"use server"

import { ADMIN_AUTH } from "@/lib/auth/config"
import { createFirstAdmin } from "@/services/admin-auth/admin-auth-service"
import type {
  CreateFirstAdminApiBody,
  CreateFirstAdminApiResult,
} from "@/types/admin-auth/admin-first-admin-api"

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const normalizeEmail = (value: unknown): string =>
  typeof value === "string" ? value.trim().toLowerCase() : ""

const normalizePassword = (value: unknown): string => {
  if (typeof value !== "string") {
    return ""
  }

  return value
}

const normalizeToken = (value: unknown): string => (typeof value === "string" ? value.trim() : "")

const unauthorized = (
  message: string,
  statusCode: 401 | 403,
): CreateFirstAdminApiResult => ({
  ok: false,
  message,
  statusCode,
})

const badRequest = (message: string): CreateFirstAdminApiResult => ({
  ok: false,
  message,
  statusCode: 400,
})

const validatePayload = (body: CreateFirstAdminApiBody) => {
  const email = normalizeEmail(body.email)
  const password = normalizePassword(body.password)

  if (!email || !EMAIL_PATTERN.test(email)) {
    return { ok: false as const, message: "A valid email is required" }
  }

  if (!password) {
    return { ok: false as const, message: "Password is required" }
  }

  if (password.length < 8) {
    return { ok: false as const, message: "Password must be at least 8 characters" }
  }

  return { ok: true as const, email, password }
}

const buildUnauthorizedError = (statusCode: 401 | 403, token: string) => {
  if (statusCode === 403) {
    return unauthorized("Invalid first admin token", 403)
  }

  return token
    ? unauthorized("Invalid first admin token", 401)
    : unauthorized("First admin token is required", 401)
}

export async function createFirstAdminViaApi(
  body: CreateFirstAdminApiBody,
  tokenFromHeader: string | null,
): Promise<CreateFirstAdminApiResult> {
  if (!ADMIN_AUTH.firstAdminToken) {
    return {
      ok: false,
      message: "First admin creation is not configured",
      statusCode: 500,
    }
  }

  const requestToken = normalizeToken(tokenFromHeader)
  const bodyToken = normalizeToken(body.firstAdminToken)
  const activeToken = requestToken || bodyToken

  if (!activeToken) {
    return buildUnauthorizedError(401, "")
  }

  if (activeToken !== ADMIN_AUTH.firstAdminToken) {
    return buildUnauthorizedError(403, activeToken)
  }

  const validation = validatePayload(body)
  if (!validation.ok) {
    return badRequest(validation.message)
  }

  const created = await createFirstAdmin({
    email: validation.email,
    password: validation.password,
  })

  if (!created.ok) {
    const message = created.message
    const lowered = message.toLowerCase()

    return {
      ok: false,
      message,
      statusCode: lowered.includes("already")
        ? 409
        : lowered.includes("already exists")
          ? 409
          : 400,
    }
  }

  return {
    ok: true,
    admin: created.admin,
  }
}
