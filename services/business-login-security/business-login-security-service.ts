import { randomBytes, randomInt } from "node:crypto"

import { db } from "@/lib/database/prisma"
import { BusinessAccountType, BusinessPlanCode, type User, type UserRole } from "@/lib/generated/prisma/client"
import { hashPassword, verifyPassword } from "@/lib/auth/password"
import { sendSmtpMail } from "@/lib/email/smtp"
import { createUserSession } from "@/services/user-auth/user-session-service"
import { mapUserProfile } from "@/services/user-auth/user-profile"
import type { UserSessionRequestContext } from "@/types/user-auth/user-auth"

export type StaffLoginMethod = "any" | "google" | "password"
export type BusinessLoginProvider = "password" | "google" | "other"

const BUSINESS_ROLES = new Set<UserRole>(["Fleet", "Garage", "Supplier"] as UserRole[])
const STAFF_LOGIN_METHODS = new Set<StaffLoginMethod>(["any", "google", "password"])
const token = () => randomBytes(32).toString("hex")
const otp = () => String(randomInt(100000, 1000000))
const accountTypeForRole = (role: UserRole) => role as unknown as BusinessAccountType
let tableReady = false
let policyTableReady = false

type BusinessLoginAccount = { id: string; type: BusinessAccountType; plan: { code: BusinessPlanCode; name: string; loginSecurityMode: string } }

export type BusinessLoginChallenge = {
  required: true
  challengeId: string
  method: "otp" | "pin_or_otp"
  planCode: BusinessPlanCode
  hasPin: boolean
  message: string
}

async function findBusinessAccount(userId: string, role: UserRole | null): Promise<BusinessLoginAccount | null> {
  if (!role || !BUSINESS_ROLES.has(role)) return null
  const type = accountTypeForRole(role)
  const owned = await db.businessAccount.findFirst({ where: { ownerUserId: userId, type, isActive: true }, include: { plan: true } })
  if (owned) return owned
  const membership = await db.businessAccountMember.findFirst({ where: { userId, status: "Active", businessAccount: { type, isActive: true } }, include: { businessAccount: { include: { plan: true } } } })
  return membership?.businessAccount ?? null
}

async function ensureRow(accountId: string, userId: string) {
  if (!tableReady) {
    await db.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "business_login_security" (
        "id" TEXT PRIMARY KEY,
        "businessAccountId" TEXT NOT NULL REFERENCES "business_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE,
        "userId" TEXT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
        "pinHash" TEXT,
        "otpHash" TEXT,
        "otpExpiresAt" TIMESTAMP(3),
        "otpConsumedAt" TIMESTAMP(3),
        "loginChallengeHash" TEXT,
        "loginChallengeExpiresAt" TIMESTAMP(3),
        "loginChallengeConsumedAt" TIMESTAMP(3),
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `)
    await db.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "business_login_security_businessAccountId_userId_key" ON "business_login_security"("businessAccountId", "userId")`)
    await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "business_login_security_userId_idx" ON "business_login_security"("userId")`)
    await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "business_login_security_loginChallengeHash_idx" ON "business_login_security"("loginChallengeHash")`)
    tableReady = true
  }
  const [row] = await db.$queryRaw<Array<{ id: string; pinHash: string | null }>>`
    INSERT INTO "business_login_security" ("id", "businessAccountId", "userId")
    VALUES (${token()}, ${accountId}, ${userId})
    ON CONFLICT ("businessAccountId", "userId") DO UPDATE SET "updatedAt" = CURRENT_TIMESTAMP
    RETURNING "id", "pinHash"
  `
  return row
}

async function ensurePolicyTable() {
  if (policyTableReady) return
  await db.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "business_login_policies" (
      "id" TEXT PRIMARY KEY,
      "businessAccountId" TEXT NOT NULL UNIQUE REFERENCES "business_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE,
      "staffLoginMethod" TEXT NOT NULL DEFAULT 'any',
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `)
  await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "business_login_policies_businessAccountId_idx" ON "business_login_policies"("businessAccountId")`)
  policyTableReady = true
}

const normalizeStaffLoginMethod = (value: unknown): StaffLoginMethod =>
  STAFF_LOGIN_METHODS.has(value as StaffLoginMethod) ? value as StaffLoginMethod : "any"

async function getBusinessLoginPolicy(accountId: string) {
  await ensurePolicyTable()
  await db.$executeRaw`
    INSERT INTO "business_login_policies" ("id", "businessAccountId")
    VALUES (${token()}, ${accountId})
    ON CONFLICT ("businessAccountId") DO NOTHING
  `
  const [row] = await db.$queryRaw<Array<{ staffLoginMethod: string }>>`
    SELECT "staffLoginMethod" FROM "business_login_policies" WHERE "businessAccountId" = ${accountId}
  `
  return { staffLoginMethod: normalizeStaffLoginMethod(row?.staffLoginMethod) }
}

async function saveBusinessLoginPolicy(accountId: string, staffLoginMethod: StaffLoginMethod) {
  await ensurePolicyTable()
  await db.$executeRaw`
    INSERT INTO "business_login_policies" ("id", "businessAccountId", "staffLoginMethod")
    VALUES (${token()}, ${accountId}, ${staffLoginMethod})
    ON CONFLICT ("businessAccountId") DO UPDATE SET "staffLoginMethod" = ${staffLoginMethod}, "updatedAt" = CURRENT_TIMESTAMP
  `
}

async function sendOtp(email: string | null, code: string, subject: string) {
  if (!email) throw new Error("This account does not have an email for OTP verification")
  await sendSmtpMail({ to: email, subject, text: `Your AutoParts Pro verification code is ${code}. It expires in 10 minutes.`, html: `<p>Your AutoParts Pro verification code is <strong>${code}</strong>.</p><p>It expires in 10 minutes.</p>` })
}

export async function createBusinessLoginChallenge(input: { user: User; role: UserRole | null }) {
  const account = await findBusinessAccount(input.user.id, input.role)
  const mode = account?.plan.loginSecurityMode ?? (account?.plan.code === "Enterprise" || account?.plan.code === "Pro" ? "otp" : "password")
  if (!account || mode === "password") return null
  const row = await ensureRow(account.id, input.user.id)
  const challengeId = token()
  const code = otp()
  await db.$executeRaw`
    UPDATE "business_login_security"
    SET "otpHash" = ${hashPassword(code)}, "otpExpiresAt" = NOW() + INTERVAL '10 minutes', "otpConsumedAt" = NULL,
        "loginChallengeHash" = ${hashPassword(challengeId)}, "loginChallengeExpiresAt" = NOW() + INTERVAL '10 minutes', "loginChallengeConsumedAt" = NULL,
        "updatedAt" = CURRENT_TIMESTAMP
    WHERE "id" = ${row.id}
  `
  await sendOtp(input.user.email, code, "AutoParts Pro login verification")
  return {
    required: true as const,
    challengeId,
    method: row.pinHash ? "pin_or_otp" as const : "otp" as const,
    planCode: account.plan.code,
    hasPin: Boolean(row.pinHash),
    message: "Enter the OTP sent to your email to continue.",
  }
}

export async function ensureBusinessStaffLoginMethodAllowed(input: { businessAccountId: string; provider: BusinessLoginProvider }) {
  const { staffLoginMethod } = await getBusinessLoginPolicy(input.businessAccountId)
  if (staffLoginMethod === "any" || staffLoginMethod === input.provider) return
  if (staffLoginMethod === "google") throw new Error("Your owner requires staff to sign in with Google.")
  throw new Error("Your owner requires staff to sign in with email and password.")
}

export async function verifyBusinessLoginChallenge(input: { challengeId: unknown; code: unknown; method: unknown; context: UserSessionRequestContext }) {
  const challengeId = typeof input.challengeId === "string" ? input.challengeId.trim() : ""
  const code = typeof input.code === "string" ? input.code.trim() : ""
  const method = input.method === "pin" ? "pin" : "otp"
  if (!challengeId || !/^\d{6}$/.test(code)) throw new Error("Enter a valid 6-digit code")
  const rows = await db.$queryRaw<Array<{ id: string; userId: string; pinHash: string | null; otpHash: string | null; loginChallengeHash: string | null; loginChallengeExpiresAt: Date | null; loginChallengeConsumedAt: Date | null }>>`
    SELECT "id", "userId", "pinHash", "otpHash", "loginChallengeHash", "loginChallengeExpiresAt", "loginChallengeConsumedAt"
    FROM "business_login_security"
    WHERE "loginChallengeHash" IS NOT NULL AND "loginChallengeExpiresAt" > NOW() AND "loginChallengeConsumedAt" IS NULL
  `
  const row = rows.find((item) => item.loginChallengeHash && verifyPassword(challengeId, item.loginChallengeHash))
  if (!row) throw new Error("Login verification expired. Sign in again.")
  const ok = method === "pin" ? Boolean(row.pinHash && verifyPassword(code, row.pinHash)) : Boolean(row.otpHash && verifyPassword(code, row.otpHash))
  if (!ok) throw new Error("Invalid verification code")
  await db.$executeRaw`UPDATE "business_login_security" SET "loginChallengeConsumedAt" = NOW(), "otpConsumedAt" = CASE WHEN ${method} = 'otp' THEN NOW() ELSE "otpConsumedAt" END, "updatedAt" = CURRENT_TIMESTAMP WHERE "id" = ${row.id}`
  const user = await db.user.update({ where: { id: row.userId }, data: { lastLoginAt: new Date() } })
  const issued = await createUserSession(user, input.context)
  return { user: mapUserProfile(user), issued }
}

export async function getBusinessLoginSecurityStatus(userId: string) {
  const access = await db.businessAccount.findFirst({
    where: { OR: [{ ownerUserId: userId }, { members: { some: { userId, status: "Active" } } }], isActive: true, plan: { code: "Enterprise" } },
    select: { id: true, ownerUserId: true },
  })
  if (!access) return { enterprise: false, hasPin: false, staffLoginMethod: "any", canManageStaffLoginPolicy: false }
  const row = await ensureRow(access.id, userId)
  const policy = await getBusinessLoginPolicy(access.id)
  return {
    enterprise: true,
    hasPin: Boolean(row.pinHash),
    businessAccountId: access.id,
    staffLoginMethod: policy.staffLoginMethod,
    canManageStaffLoginPolicy: access.ownerUserId === userId,
  }
}

export async function requestBusinessPinOtp(userId: string) {
  const status = await getBusinessLoginSecurityStatus(userId)
  if (!status.enterprise || !status.businessAccountId) throw new Error("PIN is available only on Enterprise plans")
  const user = await db.user.findUniqueOrThrow({ where: { id: userId } })
  const row = await ensureRow(status.businessAccountId, userId)
  const code = otp()
  await db.$executeRaw`UPDATE "business_login_security" SET "otpHash" = ${hashPassword(code)}, "otpExpiresAt" = NOW() + INTERVAL '10 minutes', "otpConsumedAt" = NULL, "updatedAt" = CURRENT_TIMESTAMP WHERE "id" = ${row.id}`
  await sendOtp(user.email, code, "AutoParts Pro PIN verification")
  return { message: "OTP sent to your email" }
}

export async function saveBusinessPin(input: { userId: string; pin: unknown; otp: unknown }) {
  const status = await getBusinessLoginSecurityStatus(input.userId)
  if (!status.enterprise || !status.businessAccountId) throw new Error("PIN is available only on Enterprise plans")
  const pin = typeof input.pin === "string" ? input.pin.trim() : ""
  const code = typeof input.otp === "string" ? input.otp.trim() : ""
  if (!/^\d{6}$/.test(pin)) throw new Error("PIN must be exactly 6 digits")
  if (!/^\d{6}$/.test(code)) throw new Error("OTP must be exactly 6 digits")
  const rows = await db.$queryRaw<Array<{ id: string; otpHash: string | null }>>`
    SELECT "id", "otpHash" FROM "business_login_security"
    WHERE "businessAccountId" = ${status.businessAccountId} AND "userId" = ${input.userId} AND "otpExpiresAt" > NOW() AND "otpConsumedAt" IS NULL
  `
  const row = rows[0]
  if (!row?.otpHash || !verifyPassword(code, row.otpHash)) throw new Error("Invalid or expired OTP")
  await db.$executeRaw`UPDATE "business_login_security" SET "pinHash" = ${hashPassword(pin)}, "otpConsumedAt" = NOW(), "updatedAt" = CURRENT_TIMESTAMP WHERE "id" = ${row.id}`
  return { message: "PIN saved successfully" }
}

export async function saveBusinessStaffLoginMethod(input: { userId: string; businessAccountId: unknown; staffLoginMethod: unknown }) {
  const staffLoginMethod = typeof input.staffLoginMethod === "string" && STAFF_LOGIN_METHODS.has(input.staffLoginMethod as StaffLoginMethod)
    ? input.staffLoginMethod as StaffLoginMethod
    : null
  const businessAccountId = typeof input.businessAccountId === "string" ? input.businessAccountId.trim() : ""
  if (!staffLoginMethod) throw new Error("Choose a valid staff login method")
  const account = await db.businessAccount.findFirst({
    where: {
      ownerUserId: input.userId,
      isActive: true,
      plan: { code: "Enterprise" },
      ...(businessAccountId ? { id: businessAccountId } : {}),
    },
    select: { id: true },
  })
  if (!account) throw new Error("Only Enterprise owners can manage staff login policy")
  await saveBusinessLoginPolicy(account.id, staffLoginMethod)
  return { message: "Staff login policy saved", businessAccountId: account.id, staffLoginMethod }
}
