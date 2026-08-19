import { UserRole } from "@/lib/generated/prisma/client"
import {
  createUser,
  loginUser,
  loginUserWithFirebase,
  updateUserActiveRole,
} from "@/services/user-auth/user-auth-service"
import { verifyFirebaseIdToken } from "@/lib/firebase/admin"
import {
  authenticateUserAccessToken,
  listUserSessions,
  revokeAllUserSessions,
  revokeUserSession,
  revokeUserSessionByToken,
  rotateUserSession,
} from "@/services/user-auth/user-session-service"
import type {
  AuthenticatedUserSession,
  CreateUserApiBody,
  CreateUserInput,
  IssuedUserSession,
  LoginUserApiBody,
  UpdateActiveRoleApiBody,
  UserAuthActionResult,
  UserDeviceSession,
  UserProfile,
  UserSessionRequestContext,
} from "@/types/user-auth/user-auth"

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PHONE_PATTERN = /^\+[1-9]\d{6,14}$/
const VALID_ROLES = new Set<UserRole>(Object.values(UserRole))
const VERIFIED_ACCOUNT_ROLE_REQUIRED_MESSAGE =
  "Choose an account type to finish creating your account"

const readString = (value: unknown): string =>
  typeof value === "string"
    ? value.replace(/[\r\n\t]+/g, " ").replace(/\s+/g, " ").trim()
    : ""

const readOptionalString = (value: unknown): string | null => {
  const normalized = readString(value)
  return normalized || null
}

const readRoles = (value: unknown): UserRole[] | null => {
  if (!Array.isArray(value)) {
    return null
  }

  const normalized = value.map((role) =>
    typeof role === "string" ? role.trim() : "",
  )
  if (
    normalized.some((role) => !VALID_ROLES.has(role as UserRole))
  ) {
    return null
  }

  return Array.from(new Set(normalized as UserRole[]))
}

const invalid = (message: string): UserAuthActionResult => ({
  ok: false,
  success: false,
  message,
  statusCode: 400,
})

const exceedsLength = (
  values: Array<string | null>,
  maximum: number,
): boolean => values.some((value) => (value?.length ?? 0) > maximum)

const mapError = (error: unknown): UserAuthActionResult => {
  const message =
    error instanceof Error ? error.message : "Unable to process request"

  if (message.includes("Unique constraint")) {
    return {
      ok: false,
      success: false,
      message: "A user with this email or phone already exists",
      statusCode: 409,
    }
  }

  if (message === "Invalid email or password") {
    return { ok: false, success: false, message, statusCode: 401 }
  }

  if (message === "Invalid Firebase ID token") {
    return { ok: false, success: false, message, statusCode: 401 }
  }

  if (message === "Email address is not verified") {
    return { ok: false, success: false, message, statusCode: 403 }
  }

  if (message === VERIFIED_ACCOUNT_ROLE_REQUIRED_MESSAGE) {
    return { ok: false, success: false, message, statusCode: 409 }
  }

  if (message.includes("Firebase identity conflicts")) {
    return { ok: false, success: false, message, statusCode: 409 }
  }

  if (message === "User account is inactive") {
    return { ok: false, success: false, message, statusCode: 403 }
  }

  if (message === "Your account is disabled by your owner.") {
    return { ok: false, success: false, message, statusCode: 403 }
  }

  return { ok: false, success: false, message, statusCode: 500 }
}

export async function createUserViaApi(
  body: CreateUserApiBody,
): Promise<UserAuthActionResult> {
  const email = readString(body.email).toLowerCase()
  const password = typeof body.password === "string" ? body.password : ""
  const firstName = readString(body.firstName)
  const lastName = readString(body.lastName)
  const roles = readRoles(body.roles)
  const rawActiveRole = readString(body.activeRole)
  const phone = readOptionalString(body.phone)
  const avatarUrl = readOptionalString(body.avatarUrl)
  const companyName = readOptionalString(body.companyName)
  const addressLine1 = readOptionalString(body.addressLine1)
  const addressLine2 = readOptionalString(body.addressLine2)
  const city = readOptionalString(body.city)
  const state = readOptionalString(body.state)
  const country = readOptionalString(body.country)
  const supplierContactPerson = readOptionalString(body.supplierContactPerson)
  const supplierDesignation = readOptionalString(body.supplierDesignation)

  if (!EMAIL_PATTERN.test(email) || email.length > 254) {
    return invalid("A valid email is required")
  }

  if (password.length < 8 || password.length > 128) {
    return invalid("Password must be between 8 and 128 characters")
  }

  if (!firstName || !lastName) {
    return invalid("First name and last name are required")
  }

  if (exceedsLength([firstName, lastName], 100)) {
    return invalid("First name and last name must be 100 characters or fewer")
  }

  if (
    exceedsLength(
      [
        phone,
        companyName,
        city,
        state,
        country,
        supplierContactPerson,
        supplierDesignation,
      ],
      150,
    )
  ) {
    return invalid("One or more profile fields exceed the allowed length")
  }

  if (
    exceedsLength([addressLine1, addressLine2], 255) ||
    exceedsLength([avatarUrl], 2_048)
  ) {
    return invalid("One or more profile fields exceed the allowed length")
  }

  if (body.roles !== undefined && (!roles || roles.length === 0)) {
    return invalid(
      "Roles must contain one or more of Fleet, User, Garage, or Supplier",
    )
  }

  if (rawActiveRole && !VALID_ROLES.has(rawActiveRole as UserRole)) {
    return invalid("Active role must be Fleet, User, Garage, or Supplier")
  }

  if (
    rawActiveRole &&
    roles &&
    !roles.includes(rawActiveRole as UserRole)
  ) {
    return invalid("Active role must be included in roles")
  }

  const isSupplierSignup =
    rawActiveRole === UserRole.Supplier || roles?.includes(UserRole.Supplier)
  if (isSupplierSignup) {
    if (!companyName) {
      return invalid("Business name is required for supplier accounts")
    }
    if (!supplierContactPerson) {
      return invalid("Authorized person name is required for supplier accounts")
    }
    if (!supplierDesignation) {
      return invalid("Designation is required for supplier accounts")
    }
    if (!phone || !PHONE_PATTERN.test(phone)) {
      return invalid("Enter a valid supplier phone number with country code")
    }
  }

  const input: CreateUserInput = {
    email,
    password,
    firstName,
    lastName,
    phone,
    avatarUrl,
    companyName,
    addressLine1,
    addressLine2,
    city,
    state,
    country,
    supplierContactPerson,
    supplierDesignation,
    roles: roles ?? [UserRole.User],
    activeRole: rawActiveRole
      ? (rawActiveRole as UserRole)
      : UserRole.User,
  }

  try {
    const user = await createUser(input)
    return { ok: true, success: true, user, statusCode: 201 }
  } catch (error) {
    return mapError(error)
  }
}

export async function updateActiveUserRoleViaApi(
  accessToken: string | null,
  body: UpdateActiveRoleApiBody,
): Promise<
  | { ok: true; user: UserProfile }
  | { ok: false; message: string; statusCode: 400 | 401 | 403 }
> {
  const auth = await requireUserAuth(accessToken)
  if (!auth) {
    return { ok: false, message: "Unauthorized", statusCode: 401 }
  }

  const rawActiveRole = readString(body.activeRole)
  if (!VALID_ROLES.has(rawActiveRole as UserRole)) {
    return {
      ok: false,
      message: "Active role must be Fleet, User, Garage, or Supplier",
      statusCode: 400,
    }
  }

  const user = await updateUserActiveRole(
    auth.user.id,
    rawActiveRole as UserRole,
  )
  if (!user) {
    return {
      ok: false,
      message: "User is not authorized for this dashboard",
      statusCode: 403,
    }
  }

  return { ok: true, user }
}

export async function loginUserViaApi(
  body: LoginUserApiBody,
  context: UserSessionRequestContext,
): Promise<UserAuthActionResult> {
  const hasFirebaseToken = body.firebaseIdToken !== undefined
  const firebaseIdToken = readString(body.firebaseIdToken)
  const requestedRoleValue = readString(body.requestedRole)
  const requestedRole = requestedRoleValue
    ? (requestedRoleValue as UserRole)
    : null
  const requestedRoleUid = readString(body.requestedRoleUid)
  const requestedDisplayName = readOptionalString(body.requestedDisplayName)
  const requestedSupplierContactPerson = readOptionalString(
    body.requestedSupplierContactPerson,
  )
  const requestedSupplierDesignation = readOptionalString(
    body.requestedSupplierDesignation,
  )
  const requestedSupplierPhone = readOptionalString(body.requestedSupplierPhone)

  if (hasFirebaseToken) {
    if (!firebaseIdToken || firebaseIdToken.length > 20_000) {
      return invalid("Firebase ID token is required")
    }
    if (requestedRole && !VALID_ROLES.has(requestedRole)) {
      return invalid("Requested role must be Fleet, User, Garage, or Supplier")
    }
    if (requestedDisplayName && requestedDisplayName.length > 120) {
      return invalid("Requested display name must not exceed 120 characters")
    }
    if (requestedDisplayName && !requestedRole) {
      return invalid("Requested display name requires an account role")
    }
    if (requestedRole === UserRole.Supplier) {
      if (requestedSupplierPhone && !PHONE_PATTERN.test(requestedSupplierPhone)) {
        return invalid("Enter a valid supplier phone number with country code")
      }
      if (
        exceedsLength(
          [
            requestedSupplierContactPerson,
            requestedSupplierDesignation,
            requestedSupplierPhone,
          ],
          150,
        )
      ) {
        return invalid("One or more supplier fields exceed the allowed length")
      }
    }

    try {
      const decodedToken = await verifyFirebaseIdToken(firebaseIdToken)
      if (requestedRole && requestedRoleUid !== decodedToken.uid) {
        return invalid("Requested role does not match the authenticated user")
      }
      const result = await loginUserWithFirebase(
        {
          uid: decodedToken.uid,
          email: readOptionalString(decodedToken.email)?.toLowerCase() ?? null,
          phone: readOptionalString(decodedToken.phone_number),
          name: readOptionalString(decodedToken.name),
          picture: readOptionalString(decodedToken.picture),
          emailVerified: decodedToken.email_verified === true,
          signInProvider: readOptionalString(
            decodedToken.firebase?.sign_in_provider,
          ),
        },
        context,
        requestedRole,
        requestedDisplayName,
        requestedRole === UserRole.Supplier
          ? {
              contactPerson: requestedSupplierContactPerson,
              designation: requestedSupplierDesignation,
              phone: requestedSupplierPhone,
            }
          : null,
      )

      if (result.challenge) return { ok: true, success: true, user: result.user, mfa: result.challenge, statusCode: 200 }
      if (!result.issued) return mapError(new Error("Unable to create login session"))

      return {
        ok: true,
        success: true,
        user: result.user,
        accessToken: result.issued.accessToken,
        refreshToken: result.issued.refreshToken,
        expiresAt: result.issued.accessExpiresAt.toISOString(),
        refreshExpiresAt: result.issued.refreshExpiresAt.toISOString(),
        statusCode: 200,
      }
    } catch (error) {
      return mapError(error)
    }
  }

  const email = readString(body.email).toLowerCase()
  const password = typeof body.password === "string" ? body.password : ""

  if (!EMAIL_PATTERN.test(email) || !password) {
    return invalid("Valid email and password are required")
  }

  try {
    const result = await loginUser(
      {
        email,
        password,
        deviceName: readOptionalString(body.deviceName),
      },
      context,
    )
    if (result.challenge) return { ok: true, success: true, user: result.user, mfa: result.challenge, statusCode: 200 }
    if (!result.issued) return mapError(new Error("Unable to create login session"))

    return {
      ok: true,
      success: true,
      user: result.user,
      accessToken: result.issued.accessToken,
      refreshToken: result.issued.refreshToken,
      expiresAt: result.issued.accessExpiresAt.toISOString(),
      refreshExpiresAt: result.issued.refreshExpiresAt.toISOString(),
      statusCode: 200,
    }
  } catch (error) {
    return mapError(error)
  }
}

export async function refreshUserViaApi(
  refreshToken: string | null,
  context: UserSessionRequestContext,
): Promise<
  | { ok: true; issued: IssuedUserSession }
  | { ok: false; message: string }
> {
  if (!refreshToken) {
    return { ok: false, message: "Refresh token is required" }
  }

  try {
    const issued = await rotateUserSession(refreshToken, context)
    return issued
      ? { ok: true, issued }
      : { ok: false, message: "Invalid or expired refresh session" }
  } catch {
    return { ok: false, message: "Unable to refresh session" }
  }
}

export async function requireUserAuth(
  accessToken: string | null,
): Promise<AuthenticatedUserSession | null> {
  if (!accessToken) {
    return null
  }

  try {
    return await authenticateUserAccessToken(accessToken)
  } catch {
    return null
  }
}

export async function logoutUserViaApi(
  accessToken: string | null,
  refreshToken: string | null,
): Promise<boolean> {
  try {
    return await revokeUserSessionByToken(accessToken, refreshToken)
  } catch {
    return false
  }
}

export async function logoutAllUserSessionsViaApi(
  accessToken: string | null,
): Promise<boolean> {
  const auth = await requireUserAuth(accessToken)
  if (!auth) {
    return false
  }

  await revokeAllUserSessions(auth.user.id)
  return true
}

export async function listUserSessionsViaApi(
  accessToken: string | null,
): Promise<
  | { ok: true; sessions: UserDeviceSession[] }
  | { ok: false; message: string }
> {
  const auth = await requireUserAuth(accessToken)
  if (!auth) {
    return { ok: false, message: "Unauthorized" }
  }

  const sessions = await listUserSessions(auth.user.id, auth.session.id)
  return { ok: true, sessions }
}

export async function revokeUserSessionViaApi(
  accessToken: string | null,
  sessionId: string,
): Promise<
  | { ok: true; current: boolean }
  | { ok: false; message: string }
> {
  const auth = await requireUserAuth(accessToken)
  if (!auth) {
    return { ok: false, message: "Unauthorized" }
  }

  const revoked = await revokeUserSession(auth.user.id, sessionId)
  if (!revoked) {
    return { ok: false, message: "Session not found" }
  }

  return { ok: true, current: auth.session.id === sessionId }
}
