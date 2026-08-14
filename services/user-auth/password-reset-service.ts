import { createHash } from "crypto"

import { db } from "@/lib/database/prisma"
import { hashPassword } from "@/lib/auth/password"

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PASSWORD_PATTERN = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/

const normalizeEmail = (value: string | null | undefined) => {
  const email = value?.trim().toLowerCase() ?? ""
  if (!email || !EMAIL_PATTERN.test(email)) {
    throw new Error("Enter a valid email address")
  }
  return email
}

const hashSecret = (value: string) =>
  createHash("sha256").update(value).digest("hex")

export async function assertUserPasswordResetAccountExists(
  emailInput: string | null | undefined,
) {
  const email = normalizeEmail(emailInput)
  const user = await db.user.findUnique({
    where: { email },
    select: { id: true, email: true, isActive: true },
  })

  if (!user || !user.isActive) {
    throw new Error("No active account exists for this email")
  }

  return {
    ok: true as const,
    email,
    message: "Account found. Send password reset email with Firebase.",
  }
}

export async function resetUserPasswordWithToken(input: {
  token?: unknown
  password?: unknown
}) {
  const token = typeof input.token === "string" ? input.token.trim() : ""
  const password = typeof input.password === "string" ? input.password : ""

  if (!/^[a-f0-9]{64}$/i.test(token)) {
    throw new Error("Password reset link is invalid or expired")
  }
  if (password.length < 8 || password.length > 128) {
    throw new Error("Password must be between 8 and 128 characters")
  }
  if (!PASSWORD_PATTERN.test(password)) {
    throw new Error("Password must include uppercase, lowercase, and number characters")
  }

  const [request] = await db.$queryRaw<Array<{
    id: string
    garageId: string
    targetValue: string
  }>>`
    UPDATE "garage_verification_requests"
    SET "consumedAt" = CURRENT_TIMESTAMP
    WHERE "id" = (
      SELECT "id"
      FROM "garage_verification_requests"
      WHERE
        "target" = 'email'::"GarageVerificationTarget"
        AND "tokenHash" = ${hashSecret(`password-reset:${token}`)}
        AND "consumedAt" IS NULL
        AND "expiresAt" > CURRENT_TIMESTAMP
      ORDER BY "expiresAt" DESC
      LIMIT 1
    )
    RETURNING "id", "garageId", "targetValue"
  `

  if (!request) {
    throw new Error("Password reset link is invalid or expired")
  }

  const user = await db.user.findUnique({
    where: { id: request.garageId },
    select: { id: true, isActive: true, emailVerifiedAt: true },
  })

  if (!user?.isActive) {
    throw new Error("No active account exists for this reset link")
  }

  await db.user.update({
    where: { id: user.id },
    data: {
      passwordHash: hashPassword(password),
      emailVerifiedAt: user.emailVerifiedAt ?? new Date(),
    },
  })

  return {
    ok: true as const,
    message: "Password reset successfully. Sign in with your new password.",
  }
}
