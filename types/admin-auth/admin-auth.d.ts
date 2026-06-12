export type AdminCredentialInput = {
  email: string
  password: string
}

export type CreateAdminInput = {
  email: string
  password: string
}

export type AuthenticatedAdmin = {
  id: string
  email: string
  name: string | null
  isActive: boolean
}

export type AuthTokenClaims = {
  sub: string
  sid: string
  jti: string
  type: "access" | "refresh"
  iat: number
  exp: number
}

export type AuthIssuedTokens = {
  accessToken: string
  refreshToken: string
  accessExpiresAt: Date
  refreshExpiresAt: Date
}

export type AuthRequestContext = {
  ipAddress: string | null
  userAgent: string | null
}

export type AuthSessionSnapshot = {
  admin: AuthenticatedAdmin
  sessionId: string
  sessionJti: string
  accessExpiresAt: Date
  refreshExpiresAt: Date
}

export type ActionResult = {
  ok: boolean
  message?: string
}

export type AuthActionResult = ActionResult & {
  redirectTo?: string
}

export type AdminLoginResult =
  | { ok: true; session: AuthSessionSnapshot }
  | (ActionResult & { ok: false })

export type AdminLookupResult =
  | { ok: true; admin: AuthenticatedAdmin }
  | { ok: false; message?: string }
