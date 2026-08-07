import { db } from "@/lib/database/prisma"
import { ADMIN_AUTH } from "@/lib/auth/config"
import {
  generateSessionId,
  hashIpAddress,
  hashPassword,
  hashRefreshToken,
  hashUserAgent,
  verifyPassword,
} from "@/lib/auth/crypto"
import { signJwt, verifyJwt } from "@/lib/auth/jwt"
import {
  type AdminCredentialInput,
  type AuthRequestContext,
  type AuthenticatedAdmin,
  type AuthTokenClaims,
  type CreateAdminInput,
} from "@/types/admin-auth/admin-auth"
const ADMIN_LOCK_MINUTES = 15
const MAX_FAILED_ATTEMPTS = 5
type AdminLoginRecord = {
  id: string
  email: string
  name: string | null
  passwordHash: string
  isActive: boolean
  failedLoginCount: number
  lockedUntil: Date | null
}
type AdminLookupRecord = {
  id: string
  email: string
  name: string | null
  isActive: boolean
}
const toActionMessage = (message: string) => ({ ok: false as const, message })
const now = () => new Date()
const addMinutesFromNow = (minutes: number): Date => {
  const target = now()
  target.setMinutes(target.getMinutes() + minutes)
  return target
}
const addSeconds = (seconds: number): Date => {
  const target = now()
  target.setSeconds(target.getSeconds() + seconds)
  return target
}
const addDays = (days: number): Date => {
  const target = now()
  target.setDate(target.getDate() + days)
  return target
}
const ensureConfigured = () => {
  if (!ADMIN_AUTH.accessTokenSecret || !ADMIN_AUTH.refreshTokenSecret) {
    throw new Error(
      "Admin auth secrets are not configured. Set ADMIN_JWT_ACCESS_SECRET and ADMIN_JWT_REFRESH_SECRET.",
    )
  }
}
const buildAdminPayload = (adminId: string, sessionId: string, sessionJti: string): AuthTokenClaims => {
  const issuedAt = Math.floor(now().getTime() / 1000)
  const expiresAt = Math.floor(
    addSeconds(ADMIN_AUTH.accessTokenTtlSeconds).getTime() / 1000,
  )

  return {
    sub: adminId,
    sid: sessionId,
    jti: sessionJti,
    type: "access",
    iat: issuedAt,
    exp: expiresAt,
  }
}
const buildRefreshPayload = (
  adminId: string,
  familyTokenId: string,
): AuthTokenClaims => {
  const issuedAt = Math.floor(now().getTime() / 1000)
  const expiresAt = Math.floor(
    addDays(ADMIN_AUTH.refreshTokenTtlDays).getTime() / 1000,
  )

  return {
    sub: adminId,
    sid: familyTokenId,
    jti: generateSessionId(),
    type: "refresh",
    iat: issuedAt,
    exp: expiresAt,
  }
}
export const findAdminByEmail = async (
  email: string,
): Promise<AdminLookupRecord | null> => {
  const record = await db.admin.findUnique({
    where: { email },
    select: {
      id: true,
      email: true,
      name: true,
      isActive: true,
    },
  })

  return record
}
export const authenticateAdmin = async (
  input: AdminCredentialInput,
): Promise<{ ok: true; admin: AdminLoginRecord } | { ok: false; message: string }> => {
  const normalizedEmail = input.email.trim().toLowerCase()

  const admin = await db.admin.findUnique({
    where: { email: normalizedEmail },
    select: {
      id: true,
      email: true,
      name: true,
      passwordHash: true,
      isActive: true,
      failedLoginCount: true,
      lockedUntil: true,
    },
  })

  if (!admin) {
    return toActionMessage("Invalid credentials")
  }

  if (!admin.isActive) {
    return toActionMessage("Admin account is deactivated")
  }

  if (admin.lockedUntil && admin.lockedUntil > now()) {
    return toActionMessage("Admin account is temporarily locked")
  }

  if (!admin.passwordHash) {
    return toActionMessage("Admin account is not configured with password")
  }

  const isPasswordValid = verifyPassword(input.password, admin.passwordHash)
  if (!isPasswordValid) {
    const attempts = admin.failedLoginCount + 1
    const shouldLock = attempts >= MAX_FAILED_ATTEMPTS

    await db.admin.update({
      where: { id: admin.id },
      data: {
        failedLoginCount: attempts,
        lockedUntil: shouldLock ? addMinutesFromNow(ADMIN_LOCK_MINUTES) : null,
      },
    })

    return toActionMessage(
      shouldLock
        ? `Too many attempts. Account locked for ${ADMIN_LOCK_MINUTES} minutes.`
        : "Invalid credentials",
    )
  }

  await db.admin.update({
    where: { id: admin.id },
    data: {
      failedLoginCount: 0,
      lockedUntil: null,
    },
  })

  return {
    ok: true,
    admin,
  }
}
export const createAdminSession = async (
  adminId: string,
  requestContext: AuthRequestContext,
): Promise<{
  accessToken: string
  refreshToken: string
  accessExpiresAt: Date
  refreshExpiresAt: Date
  session: { id: string; accessJti: string }
}> => {
  ensureConfigured()

  const accessJti = generateSessionId()
  const familyTokenId = generateSessionId()
  const refreshToken = signJwt(
    buildRefreshPayload(adminId, familyTokenId),
    ADMIN_AUTH.refreshTokenSecret ?? "",
  )
  const refreshTokenHash = hashRefreshToken(refreshToken)
  const accessExpiresAt = addSeconds(ADMIN_AUTH.accessTokenTtlSeconds)
  const refreshExpiresAt = addDays(ADMIN_AUTH.refreshTokenTtlDays)
  const deviceHash = hashUserAgent(requestContext.userAgent)
  const ipHash = hashIpAddress(requestContext.ipAddress)

  const session = await db.adminSession.create({
    data: {
      adminId,
      refreshTokenHash,
      accessJti,
      deviceHash,
      ipHash,
      userAgent: requestContext.userAgent,
      familyTokenId,
      expiresAt: refreshExpiresAt,
      lastUsedAt: now(),
    },
  })

  const payload = buildAdminPayload(adminId, session.id, accessJti)
  const accessToken = signJwt(payload, ADMIN_AUTH.accessTokenSecret ?? "")

  return {
    accessToken,
    refreshToken,
    accessExpiresAt,
    refreshExpiresAt,
    session: {
      id: session.id,
      accessJti,
    },
  }
}
export const createAdminWithCredentials = async (
  input: CreateAdminInput,
): Promise<{ ok: true; admin: AuthenticatedAdmin } | { ok: false; message: string }> => {
  const normalizedEmail = input.email.trim().toLowerCase()

  if (!normalizedEmail || !input.password) {
    return toActionMessage("Email and password are required")
  }

  const existing = await db.admin.findUnique({
    where: { email: normalizedEmail },
  })

  if (existing) {
    return toActionMessage("Admin already exists for this email")
  }

  const passwordHash = hashPassword(input.password)

  const admin = await db.admin.create({
    data: {
      email: normalizedEmail,
      passwordHash,
      isActive: true,
    },
    select: {
      id: true,
      email: true,
      name: true,
      isActive: true,
    },
  })

  return { ok: true, admin }
}
export const createFirstAdmin = async (
  input: CreateAdminInput,
): Promise<{ ok: true; admin: AuthenticatedAdmin } | { ok: false; message: string }> => {
  const existingCount = await db.admin.count()
  if (existingCount > 0) {
    return toActionMessage("First admin is already configured")
  }

  return createAdminWithCredentials(input)
}

export const changeAdminPassword = async (input: {
  adminId: string
  currentPassword: string
  newPassword: string
}): Promise<{ ok: true } | { ok: false; message: string }> => {
  if (!input.currentPassword || !input.newPassword) {
    return toActionMessage("Current password and new password are required")
  }
  if (input.newPassword.length < 8) {
    return toActionMessage("New password must be at least 8 characters")
  }
  if (input.currentPassword === input.newPassword) {
    return toActionMessage("New password must be different from current password")
  }

  const admin = await db.admin.findUnique({
    where: { id: input.adminId },
    select: { id: true, passwordHash: true, isActive: true },
  })
  if (!admin || !admin.isActive) {
    return toActionMessage("Admin account is not active")
  }
  if (!verifyPassword(input.currentPassword, admin.passwordHash)) {
    return toActionMessage("Current password is incorrect")
  }

  await db.$transaction([
    db.admin.update({
      where: { id: admin.id },
      data: {
        passwordHash: hashPassword(input.newPassword),
        failedLoginCount: 0,
        lockedUntil: null,
      },
    }),
    db.adminSession.updateMany({
      where: { adminId: admin.id, revokedAt: null },
      data: { revokedAt: now() },
    }),
  ])

  return { ok: true }
}

export const getAdminByAccessToken = async (
  token: string,
): Promise<{ ok: true; admin: AdminLookupRecord; sessionId: string } | { ok: false; message: string }> => {
  ensureConfigured()

  const payload = verifyJwt(token, ADMIN_AUTH.accessTokenSecret ?? "")
  if (!payload || payload.type !== "access") {
    return toActionMessage("Invalid token")
  }

  const session = await db.adminSession.findUnique({
    where: { id: payload.sid },
    select: {
      id: true,
      adminId: true,
      accessJti: true,
      revokedAt: true,
      expiresAt: true,
      admin: {
        select: {
          id: true,
          email: true,
          name: true,
          isActive: true,
        },
      },
    },
  })

  if (!session || session.adminId !== payload.sub) {
    return toActionMessage("Session not found")
  }

  if (session.revokedAt) {
    return toActionMessage("Session revoked")
  }

  if (session.expiresAt <= now()) {
    return toActionMessage("Session expired")
  }

  if (session.accessJti !== payload.jti) {
    return toActionMessage("Session token mismatch")
  }

  if (!session.admin.isActive) {
    return toActionMessage("Admin account is not active")
  }

  return {
    ok: true,
    admin: {
      ...session.admin,
    },
    sessionId: session.id,
  }
}
export const refreshAdminSession = async (
  token: string,
  requestContext: AuthRequestContext,
): Promise<{ ok: true; accessToken: string; refreshToken: string; accessExpiresAt: Date; refreshExpiresAt: Date } | { ok: false; message: string }> => {
  ensureConfigured()

  const payload = verifyJwt(token, ADMIN_AUTH.refreshTokenSecret ?? "")
  if (!payload || payload.type !== "refresh") {
    return toActionMessage("Invalid refresh token")
  }

  const tokenHash = hashRefreshToken(token)
  const existingSession = await db.adminSession.findUnique({
    where: { refreshTokenHash: tokenHash },
    include: {
      admin: {
        select: {
          id: true,
          email: true,
          name: true,
          isActive: true,
        },
      },
    },
  })

  if (!existingSession || existingSession.adminId !== payload.sub) {
    return toActionMessage("Session not found")
  }

  if (existingSession.familyTokenId !== payload.sid) {
    return toActionMessage("Session mismatch")
  }

  if (!existingSession.admin.isActive) {
    return toActionMessage("Admin account is not active")
  }

  if (existingSession.revokedAt) {
    return toActionMessage("Session revoked")
  }

  if (existingSession.expiresAt <= now()) {
    return toActionMessage("Session expired")
  }

  const expectedIpHash = hashIpAddress(requestContext.ipAddress)
  const expectedDeviceHash = hashUserAgent(requestContext.userAgent)
  if (
    existingSession.ipHash !== expectedIpHash ||
    existingSession.deviceHash !== expectedDeviceHash
  ) {
    await db.adminSession.update({
      where: { id: existingSession.id },
      data: {
        revokedAt: now(),
      },
    })

    return toActionMessage("Session security check failed")
  }

  const refreshedAccessJti = generateSessionId()
  const refreshToken = signJwt(
    buildRefreshPayload(existingSession.adminId, existingSession.familyTokenId),
    ADMIN_AUTH.refreshTokenSecret ?? "",
  )
  const refreshTokenHash = hashRefreshToken(refreshToken)
  const accessExpiresAt = addSeconds(ADMIN_AUTH.accessTokenTtlSeconds)
  const refreshExpiresAt = addDays(ADMIN_AUTH.refreshTokenTtlDays)

  const freshSession = await db.adminSession.create({
    data: {
      adminId: existingSession.adminId,
      refreshTokenHash,
      accessJti: refreshedAccessJti,
      deviceHash: existingSession.deviceHash,
      ipHash: existingSession.ipHash,
      userAgent: requestContext.userAgent,
      familyTokenId: existingSession.familyTokenId,
      expiresAt: refreshExpiresAt,
      lastUsedAt: now(),
      rotationCount: existingSession.rotationCount + 1,
    },
  })

  await db.adminSession.update({
    where: { id: existingSession.id },
    data: {
      revokedAt: now(),
      replacedBy: freshSession.id,
    },
  })

  const accessPayload = buildAdminPayload(
    existingSession.adminId,
    freshSession.id,
    refreshedAccessJti,
  )

  const accessToken = signJwt(accessPayload, ADMIN_AUTH.accessTokenSecret ?? "")
  return {
    ok: true,
    accessToken,
    refreshToken,
    accessExpiresAt,
    refreshExpiresAt,
  }
}
export const logoutByRefreshToken = async (token: string | null): Promise<void> => {
  if (!token) {
    return
  }

  const tokenHash = hashRefreshToken(token)
  await db.adminSession.updateMany({
    where: { refreshTokenHash: tokenHash, revokedAt: null },
    data: { revokedAt: now() },
  })
}
