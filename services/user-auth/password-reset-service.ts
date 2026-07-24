import { createHash, randomBytes, randomUUID } from "crypto"
import nodemailer from "nodemailer"

import { db } from "@/lib/database/prisma"
import { hashPassword } from "@/lib/auth/password"

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const RESET_LINK_TTL_MINUTES = 30

const normalizeEmail = (value: string | null | undefined) => {
  const email = value?.trim().toLowerCase() ?? ""
  if (!email || !EMAIL_PATTERN.test(email)) {
    throw new Error("Enter a valid email address")
  }
  return email
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
    console.error("Password reset webhook failed", error)
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

const sendSmtpResetLink = async ({
  to,
  resetLink,
}: {
  to: string
  resetLink: string
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
    subject: "Reset your AutoPartsPro password",
    text: `Open this link to reset your AutoPartsPro password: ${resetLink}\n\nThis link expires in ${RESET_LINK_TTL_MINUTES} minutes.`,
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.5;color:#111">
        <h2>Reset your password</h2>
        <p>Click the button below to set a new AutoPartsPro password.</p>
        <p>
          <a href="${resetLink}" style="display:inline-block;background:#111;color:#fff;padding:12px 18px;border-radius:8px;text-decoration:none;font-weight:700">
            Reset password
          </a>
        </p>
        <p style="word-break:break-all">If the button does not work, open this link: ${resetLink}</p>
        <p>This link expires in ${RESET_LINK_TTL_MINUTES} minutes.</p>
        <p>If you did not request this, you can ignore this email.</p>
      </div>
    `,
  })

  return true
}

const passwordResetWebhookUrl = () =>
  process.env.USER_PASSWORD_RESET_URL_WEBHOOK_URL?.trim() ||
  process.env.USER_PASSWORD_RESET_OTP_WEBHOOK_URL?.trim() ||
  process.env.USER_EMAIL_VERIFICATION_WEBHOOK_URL?.trim() ||
  process.env.FLEET_EMAIL_VERIFICATION_WEBHOOK_URL?.trim() ||
  process.env.SUPPLIER_EMAIL_VERIFICATION_WEBHOOK_URL?.trim() ||
  process.env.GARAGE_EMAIL_VERIFICATION_WEBHOOK_URL?.trim()

const resetBaseUrl = (origin: string | null) =>
  process.env.USER_PASSWORD_RESET_BASE_URL?.trim().replace(/\/+$/, "") ||
  origin?.trim().replace(/\/+$/, "") ||
  process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/+$/, "") ||
  process.env.PUBLIC_SITE_URL?.trim().replace(/\/+$/, "") ||
  "http://localhost:3001"

export async function requestUserPasswordResetLink(
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

  const token = randomBytes(32).toString("hex")
  const expiresAt = new Date(Date.now() + RESET_LINK_TTL_MINUTES * 60 * 1000)
  const resetLink = `${resetBaseUrl(origin)}/reset-password?token=${token}`

  await db.garageVerificationRequest.create({
    data: {
      id: randomUUID(),
      garageId: user.id,
      target: "email",
      targetValue: email,
      tokenHash: hashSecret(`password-reset:${token}`),
      expiresAt,
    },
  })

  const webhookSent = await sendWebhook(passwordResetWebhookUrl(), {
    to: email,
    email,
    resetLink,
    passwordResetLink: resetLink,
    purpose: "password_reset",
    accountType: "User",
    origin,
    expiresInMinutes: RESET_LINK_TTL_MINUTES,
  })
  const smtpSent = webhookSent
    ? false
    : await sendSmtpResetLink({ to: email, resetLink })
  const sent = webhookSent || smtpSent

  if (!sent && process.env.NODE_ENV === "production") {
    throw new Error(
      "Password reset email sender is not configured. Configure USER_PASSWORD_RESET_URL_WEBHOOK_URL or SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, and SMTP_FROM.",
    )
  }

  return {
    ok: true as const,
    message: sent
      ? "Password reset link sent to your email"
      : "Password reset link created. Configure USER_PASSWORD_RESET_URL_WEBHOOK_URL to send it automatically.",
    ...(process.env.NODE_ENV === "production" ? {} : { resetLink }),
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
  if (password.length < 8) {
    throw new Error("Password must be at least 8 characters")
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
