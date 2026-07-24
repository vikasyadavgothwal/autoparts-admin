import { createHash, randomInt, randomUUID } from "crypto"
import nodemailer from "nodemailer"

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

const smtpConfig = () => {
  const host = process.env.SMTP_HOST?.trim()
  const user = process.env.SMTP_USER?.trim()
  const pass = process.env.SMTP_PASS?.trim()
  const from =
    process.env.SMTP_FROM?.trim() ||
    process.env.MAIL_FROM?.trim() ||
    process.env.EMAIL_FROM?.trim()
  const port = Number(process.env.SMTP_PORT ?? 587)

  if (!host || !user || !pass || !from) return null

  return {
    host,
    port: Number.isFinite(port) ? port : 587,
    secure:
      process.env.SMTP_SECURE === "true" ||
      process.env.SMTP_PORT === "465",
    auth: { user, pass },
    from,
  }
}

const sendSmtpOtp = async ({
  to,
  otp,
}: {
  to: string
  otp: string
}) => {
  const config = smtpConfig()
  if (!config) return false

  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: config.auth,
  })

  await transporter.sendMail({
    from: config.from,
    to,
    subject: "AutoPartsPro password reset OTP",
    text: `Your AutoPartsPro password reset OTP is ${otp}. It expires in ${OTP_TTL_MINUTES} minutes.`,
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.5;color:#111">
        <h2>Password reset OTP</h2>
        <p>Your AutoPartsPro password reset OTP is:</p>
        <p style="font-size:28px;font-weight:700;letter-spacing:4px">${otp}</p>
        <p>This OTP expires in ${OTP_TTL_MINUTES} minutes.</p>
        <p>If you did not request this, you can ignore this email.</p>
      </div>
    `,
  })

  return true
}

const passwordResetWebhookUrl = () =>
  process.env.USER_PASSWORD_RESET_OTP_WEBHOOK_URL?.trim() ||
  process.env.USER_EMAIL_VERIFICATION_WEBHOOK_URL?.trim() ||
  process.env.FLEET_EMAIL_VERIFICATION_WEBHOOK_URL?.trim() ||
  process.env.SUPPLIER_EMAIL_VERIFICATION_WEBHOOK_URL?.trim() ||
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

  const webhookSent = await sendWebhook(passwordResetWebhookUrl(), {
    to: email,
    email,
    otp,
    purpose: "password_reset",
    accountType: "User",
    origin,
    expiresInMinutes: OTP_TTL_MINUTES,
  })
  const smtpSent = webhookSent
    ? false
    : await sendSmtpOtp({ to: email, otp })
  const sent = webhookSent || smtpSent

  if (!sent && process.env.NODE_ENV === "production") {
    throw new Error(
      "Password reset email sender is not configured. Configure USER_PASSWORD_RESET_OTP_WEBHOOK_URL or SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, and SMTP_FROM.",
    )
  }

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
