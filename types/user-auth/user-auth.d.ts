import type { UserRole } from "@/lib/generated/prisma/client"

export type UserProfile = {
  id: string
  firebaseUid: string | null
  email: string | null
  phone: string | null
  googleId: string | null
  firstName: string | null
  lastName: string | null
  avatarUrl: string | null
  companyName: string | null
  addressLine1: string | null
  addressLine2: string | null
  city: string | null
  state: string | null
  postalCode: string | null
  country: string | null
  roles: UserRole[]
  activeRole: UserRole
  isActive: boolean
  emailVerifiedAt: string | null
  lastLoginAt: string | null
  createdAt: string
  updatedAt: string
}

export type CreateUserInput = {
  email: string
  password: string
  firstName: string
  lastName: string
  phone?: string | null
  avatarUrl?: string | null
  companyName?: string | null
  addressLine1?: string | null
  addressLine2?: string | null
  city?: string | null
  state?: string | null
  postalCode?: string | null
  country?: string | null
  supplierContactPerson?: string | null
  supplierDesignation?: string | null
  roles?: UserRole[]
  activeRole?: UserRole
}

export type LoginUserInput = {
  email: string
  password: string
  deviceName?: string | null
}

export type FirebaseUserIdentity = {
  uid: string
  email: string | null
  phone: string | null
  name: string | null
  picture: string | null
  emailVerified: boolean
  signInProvider: string | null
}

export type UserAccessClaims = {
  sub: string
  sessionId: string
  jti: string
  authVersion: number
  type: "user_access"
  iat: number
  exp: number
}

export type UserRefreshClaims = {
  sub: string
  sessionId: string
  jti: string
  type: "user_refresh"
  iat: number
  exp: number
}

export type UserSessionRequestContext = {
  ipAddress: string | null
  userAgent: string | null
  deviceName: string | null
}

export type IssuedUserSession = {
  accessToken: string
  refreshToken: string
  accessExpiresAt: Date
  refreshExpiresAt: Date
  sessionId: string
}

export type AuthenticatedUserSession = {
  user: UserProfile
  session: {
    id: string
    accessJti: string
    expiresAt: string
  }
}

export type UserDeviceSession = {
  id: string
  deviceName: string | null
  userAgent: string | null
  createdAt: string
  lastUsedAt: string | null
  current: boolean
}

export type UserAuthApiSuccess = {
  ok: true
  success: true
  user: UserProfile
  expiresAt?: string
}

export type UserAuthApiError = {
  ok: false
  success: false
  message: string
}

export type UserAuthApiResponse = UserAuthApiSuccess | UserAuthApiError

export type UserLogoutApiResponse =
  | {
      ok: true
      success: true
      message: string
    }
  | UserAuthApiError

export type UserAuthActionResult =
  | (UserAuthApiSuccess & {
      accessToken?: string
      refreshToken?: string
      refreshExpiresAt?: string
      statusCode: 200 | 201
    })
  | (UserAuthApiError & {
      statusCode: 400 | 401 | 403 | 409 | 429 | 500
    })

export type CreateUserApiBody = Partial<Record<keyof CreateUserInput, unknown>>

export type LoginUserApiBody = {
  email?: unknown
  password?: unknown
  deviceName?: unknown
  firebaseIdToken?: unknown
  installationId?: unknown
  requestedRole?: unknown
  requestedRoleUid?: unknown
  requestedDisplayName?: unknown
  requestedSupplierContactPerson?: unknown
  requestedSupplierDesignation?: unknown
  requestedSupplierPhone?: unknown
}

export type UpdateActiveRoleApiBody = {
  activeRole?: unknown
}
