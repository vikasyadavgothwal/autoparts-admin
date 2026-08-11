import { createHash, randomUUID } from "node:crypto"
import { compare, hash } from "bcryptjs"

import { db } from "@/lib/database/prisma"
import { signJwt, verifyJwt } from "@/lib/auth/jwt"
import { USER_AUTH } from "@/lib/user-auth/config"
import { hashUserIp } from "@/lib/user-auth/security"
import { mapUserProfile } from "@/services/user-auth/user-profile"
import type {
  AuthenticatedUserSession,
  IssuedUserSession,
  UserAccessClaims,
  UserDeviceSession,
  UserRefreshClaims,
  UserSessionRequestContext,
} from "@/types/user-auth/user-auth"

const now = (): Date => new Date()

const addSeconds = (date: Date, seconds: number): Date =>
  new Date(date.getTime() + seconds * 1_000)

const addDays = (date: Date, days: number): Date =>
  new Date(date.getTime() + days * 24 * 60 * 60 * 1_000)

const createServerDeviceIdentifier = (
  context: UserSessionRequestContext,
): string | null => {
  const explicitIdentifier = context.deviceIdentifier?.trim()
  if (explicitIdentifier) return explicitIdentifier.slice(0, 200)

  const ipHash = hashUserIp(context.ipAddress)
  const userAgent = context.userAgent?.trim()
  if (!ipHash && !userAgent) return null

  return `server:${createHash("sha256")
    .update(`${userAgent ?? ""}|${ipHash ?? ""}`)
    .digest("hex")}`
}

const ensureConfigured = (): void => {
  if (!USER_AUTH.accessTokenSecret || !USER_AUTH.refreshTokenSecret) {
    throw new Error(
      "User authentication is not configured. Set USER_JWT_ACCESS_SECRET and USER_JWT_REFRESH_SECRET.",
    )
  }
}

const readAccessClaims = (token: string): UserAccessClaims | null => {
  const claims = verifyJwt<UserAccessClaims>(
    token,
    USER_AUTH.accessTokenSecret ?? "",
  )

  if (
    !claims ||
    claims.type !== "user_access" ||
    typeof claims.sub !== "string" ||
    typeof claims.sessionId !== "string" ||
    typeof claims.jti !== "string" ||
    !Number.isInteger(claims.authVersion)
  ) {
    return null
  }

  return claims
}

const readRefreshClaims = (token: string): UserRefreshClaims | null => {
  const claims = verifyJwt<UserRefreshClaims>(
    token,
    USER_AUTH.refreshTokenSecret ?? "",
  )

  if (
    !claims ||
    claims.type !== "user_refresh" ||
    typeof claims.sub !== "string" ||
    typeof claims.sessionId !== "string" ||
    typeof claims.jti !== "string"
  ) {
    return null
  }

  return claims
}

const createAccessToken = (
  userId: string,
  sessionId: string,
  accessJti: string,
  authVersion: number,
  issuedAt: Date,
): { token: string; expiresAt: Date } => {
  const expiresAt = addSeconds(issuedAt, USER_AUTH.accessTokenTtlSeconds)
  const claims: UserAccessClaims = {
    sub: userId,
    sessionId,
    jti: accessJti,
    authVersion,
    type: "user_access",
    iat: Math.floor(issuedAt.getTime() / 1_000),
    exp: Math.floor(expiresAt.getTime() / 1_000),
  }

  return {
    token: signJwt(claims, USER_AUTH.accessTokenSecret ?? ""),
    expiresAt,
  }
}

const createRefreshToken = (
  userId: string,
  sessionId: string,
  issuedAt: Date,
): { token: string; expiresAt: Date } => {
  const expiresAt = addDays(issuedAt, USER_AUTH.refreshTokenTtlDays)
  const claims: UserRefreshClaims = {
    sub: userId,
    sessionId,
    jti: randomUUID(),
    type: "user_refresh",
    iat: Math.floor(issuedAt.getTime() / 1_000),
    exp: Math.floor(expiresAt.getTime() / 1_000),
  }

  return {
    token: signJwt(claims, USER_AUTH.refreshTokenSecret ?? ""),
    expiresAt,
  }
}

export async function createUserSession(
  user: { id: string; authVersion: number },
  context: UserSessionRequestContext,
): Promise<IssuedUserSession> {
  ensureConfigured()

  const issuedAt = now()
  const sessionId = randomUUID()
  const accessJti = randomUUID()
  const ipHash = hashUserIp(context.ipAddress)
  const deviceIdentifier = createServerDeviceIdentifier(context)
  const access = createAccessToken(
    user.id,
    sessionId,
    accessJti,
    user.authVersion,
    issuedAt,
  )
  const refresh = createRefreshToken(user.id, sessionId, issuedAt)
  const refreshTokenHash = await hash(
    refresh.token,
    USER_AUTH.refreshTokenHashRounds,
  )

  await db.$transaction([
    ...(deviceIdentifier || (context.userAgent && ipHash)
      ? [
          db.userSession.updateMany({
            where: {
              userId: user.id,
              revokedAt: null,
              expiresAt: { gt: issuedAt },
              OR: [
                ...(deviceIdentifier ? [{ deviceIdentifier }] : []),
                ...(context.userAgent && ipHash
                  ? [{ userAgent: context.userAgent, ipHash }]
                  : []),
              ],
            },
            data: { revokedAt: issuedAt },
          }),
        ]
      : []),
    db.userSession.create({
      data: {
        id: sessionId,
        userId: user.id,
        refreshTokenHash,
        accessJti,
        deviceName: context.deviceName,
        deviceMacAddress: context.deviceMacAddress,
        deviceIdentifier,
        userAgent: context.userAgent,
        ipHash,
        lastUsedAt: issuedAt,
        expiresAt: refresh.expiresAt,
      },
    }),
  ])

  return {
    accessToken: access.token,
    refreshToken: refresh.token,
    accessExpiresAt: access.expiresAt,
    refreshExpiresAt: refresh.expiresAt,
    sessionId,
  }
}

export async function authenticateUserAccessToken(
  token: string,
): Promise<AuthenticatedUserSession | null> {
  ensureConfigured()

  const claims = readAccessClaims(token)
  if (!claims) {
    return null
  }

  const session = await db.userSession.findUnique({
    where: { id: claims.sessionId },
    include: { user: true },
  })

  if (
    !session ||
    session.userId !== claims.sub ||
    session.revokedAt ||
    session.expiresAt <= now() ||
    session.accessJti !== claims.jti ||
    !session.user.isActive ||
    session.user.authVersion !== claims.authVersion
  ) {
    return null
  }

  await db.userSession.update({
    where: { id: session.id },
    data: { lastUsedAt: now() },
  })

  return {
    user: mapUserProfile(session.user),
    session: {
      id: session.id,
      accessJti: session.accessJti,
      expiresAt: session.expiresAt.toISOString(),
    },
  }
}

export async function rotateUserSession(
  refreshToken: string,
  context: UserSessionRequestContext,
): Promise<IssuedUserSession | null> {
  ensureConfigured()

  const claims = readRefreshClaims(refreshToken)
  if (!claims) {
    return null
  }

  const session = await db.userSession.findUnique({
    where: { id: claims.sessionId },
    include: { user: true },
  })

  if (
    !session ||
    session.userId !== claims.sub ||
    session.revokedAt ||
    session.expiresAt <= now() ||
    !session.user.isActive
  ) {
    return null
  }

  const refreshMatches = await compare(refreshToken, session.refreshTokenHash)
  if (!refreshMatches) {
    await db.userSession.updateMany({
      where: { id: session.id, revokedAt: null },
      data: { revokedAt: now() },
    })
    console.warn("User refresh token reuse detected; session revoked", {
      sessionId: session.id,
      userId: session.userId,
    })
    return null
  }

  const issuedAt = now()
  const accessJti = randomUUID()
  const access = createAccessToken(
    session.userId,
    session.id,
    accessJti,
    session.user.authVersion,
    issuedAt,
  )
  const refresh = createRefreshToken(session.userId, session.id, issuedAt)
  const refreshTokenHash = await hash(
    refresh.token,
    USER_AUTH.refreshTokenHashRounds,
  )
  const updateResult = await db.userSession.updateMany({
    where: {
      id: session.id,
      refreshTokenHash: session.refreshTokenHash,
      revokedAt: null,
      expiresAt: { gt: issuedAt },
    },
    data: {
      refreshTokenHash,
      accessJti,
      deviceName: context.deviceName ?? session.deviceName,
      deviceMacAddress: context.deviceMacAddress ?? session.deviceMacAddress,
      deviceIdentifier: context.deviceIdentifier ?? session.deviceIdentifier,
      userAgent: context.userAgent,
      ipHash: hashUserIp(context.ipAddress),
      lastUsedAt: issuedAt,
      expiresAt: refresh.expiresAt,
    },
  })

  if (updateResult.count !== 1) {
    await db.userSession.updateMany({
      where: { id: session.id, revokedAt: null },
      data: { revokedAt: now() },
    })
    console.warn("Concurrent user refresh detected; session revoked", {
      sessionId: session.id,
      userId: session.userId,
    })
    return null
  }

  return {
    accessToken: access.token,
    refreshToken: refresh.token,
    accessExpiresAt: access.expiresAt,
    refreshExpiresAt: refresh.expiresAt,
    sessionId: session.id,
  }
}

export async function revokeUserSessionByToken(
  accessToken: string | null,
  refreshToken: string | null,
): Promise<boolean> {
  ensureConfigured()

  const accessClaims = accessToken ? readAccessClaims(accessToken) : null
  const refreshClaims = refreshToken ? readRefreshClaims(refreshToken) : null
  const sessionId = accessClaims?.sessionId ?? refreshClaims?.sessionId
  const userId = accessClaims?.sub ?? refreshClaims?.sub

  if (!sessionId || !userId) {
    return false
  }

  const result = await db.userSession.updateMany({
    where: { id: sessionId, userId, revokedAt: null },
    data: { revokedAt: now() },
  })

  return result.count === 1
}

export async function revokeAllUserSessions(userId: string): Promise<void> {
  await db.$transaction([
    db.user.update({
      where: { id: userId },
      data: { authVersion: { increment: 1 } },
    }),
    db.userSession.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: now() },
    }),
  ])
}

export async function listUserSessions(
  userId: string,
  currentSessionId: string,
): Promise<UserDeviceSession[]> {
  const sessions = await db.userSession.findMany({
    where: {
      userId,
      revokedAt: null,
      expiresAt: { gt: now() },
    },
    orderBy: { lastUsedAt: "desc" },
    select: {
      id: true,
      deviceName: true,
      deviceMacAddress: true,
      deviceIdentifier: true,
      userAgent: true,
      createdAt: true,
      lastUsedAt: true,
    },
  })

  return sessions.map((session) => ({
    id: session.id,
    deviceName: session.deviceName,
    deviceMacAddress: session.deviceMacAddress,
    deviceIdentifier: session.deviceIdentifier,
    userAgent: session.userAgent,
    createdAt: session.createdAt.toISOString(),
    lastUsedAt: session.lastUsedAt?.toISOString() ?? null,
    current: session.id === currentSessionId,
  }))
}

export async function revokeUserSession(
  userId: string,
  sessionId: string,
): Promise<boolean> {
  const result = await db.userSession.updateMany({
    where: { id: sessionId, userId, revokedAt: null },
    data: { revokedAt: now() },
  })

  return result.count === 1
}
