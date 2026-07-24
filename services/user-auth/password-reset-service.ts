import { createHash, randomInt, randomUUID } from "crypto"

import { db } from "@/lib/database/prisma"
import { hashPassword } from "@/lib/auth/password"

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const OTP_TTL_MINUTES = 10

const normalizeEmail = (value: string | null | undefined) => {
  const email = value?.trim().toLowerCase() ?? ""
  if (!email || !EMAIL_PATTERN.test(email)) {
    throw new Error("Enter a valid email address")
  }
  return email
}

const normalizeOtp = (value: string | null | undefined) => {
  const otp = value?.trim() ?? ""
  if (!/^\d{6}$/.test(otp)) {
    throw new Error("Enter the 6 digit OTP")
  }
  return otp
}

const hashSecret = (value: string) =>
  createHash("sha256").update(value).digest("hex")

const sendWebhook = async (
  url: string | undefined,
  payload: Record<string, unknown>,
) => {
  if (!url) return false

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    })
    return response.ok
  } catch (error) {
    console.error("Password reset OTP webhook failed", error)
    return false
  }
}

const passwordResetWebhookUrl = () =>
  process.env.USER_PASSWORD_RESET_OTP_WEBHOOK_URL?.trim() ||
  process.env.USER_EMAIL_VERIFICATION_WEBHOOK_URL?.trim() ||
  process.env.GARAGE_EMAIL_VERIFICATION_WEBHOOK_URL?.trim()

export async function requestUserPasswordResetOtp(
  emailInput: string | null | undefined,
  origin: string | null,
) {
  const email = normalizeEmail(emailInput)
  const user = await db.user.findUnique({
    where: { email },
    select: { id: true, email: true, isActive: true },
  })

  if (!user || !user.isActive) {
    throw new Error("No active account exists for this email")
  }

  const otp = String(randomInt(100000, 1000000))
  const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000)

  await db.garageVerificationRequest.create({
    data: {
      id: randomUUID(),
      garageId: user.id,
      target: "email",
      targetValue: email,
      otpHash: hashSecret(`password-reset:${otp}`),
      expiresAt,
    },
  })

  const sent = await sendWebhook(passwordResetWebhookUrl(), {
    to: user.email,
    email: user.email,
    otp,
    purpose: "password_reset",
    accountType: "User",
    origin,
    expiresInMinutes: OTP_TTL_MINUTES,
  })

  return {
    ok: true as const,
    message: sent
      ? "Password reset OTP sent to your email"
      : "Password reset OTP created. Configure USER_PASSWORD_RESET_OTP_WEBHOOK_URL to send it automatically.",
    ...(process.env.NODE_ENV === "production" ? {} : { otp }),
  }
}

export async function resetUserPasswordWithOtp(input: {
  email?: unknown
  otp?: unknown
  password?: unknown
}) {
  const email = normalizeEmail(typeof input.email === "string" ? input.email : "")
  const otp = normalizeOtp(typeof input.otp === "string" ? input.otp : "")
  const password = typeof input.password === "string" ? input.password : ""

  if (password.length < 8) {
    throw new Error("Password must be at least 8 characters")
  }

  const user = await db.user.findUnique({
    where: { email },
    select: { id: true, isActive: true, emailVerifiedAt: true },
  })

  if (!user || !user.isActive) {
    throw new Error("No active account exists for this email")
  }

  const updated = await db.garageVerificationRequest.updateMany({
    where: {
      garageId: user.id,
      target: "email",
      targetValue: email,
      otpHash: hashSecret(`password-reset:${otp}`),
      consumedAt: null,
      expiresAt: { gt: new Date() },
    },
    data: { consumedAt: new Date() },
  })

  if (updated.count < 1) {
    throw new Error("OTP is invalid or expired")
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
