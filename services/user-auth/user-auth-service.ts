import { db } from "@/lib/database/prisma"
import { getFirebaseAuth } from "@/lib/firebase/admin"
import { Prisma, UserRole } from "@/lib/generated/prisma/client"
import { hashPassword, verifyPassword } from "@/lib/auth/password"
import { createUserSession } from "@/services/user-auth/user-session-service"
import { mapUserProfile } from "@/services/user-auth/user-profile"
import type {
  CreateUserInput,
  FirebaseUserIdentity,
  IssuedUserSession,
  LoginUserInput,
  UserProfile,
  UserSessionRequestContext,
} from "@/types/user-auth/user-auth"

const VERIFIED_ACCOUNT_ROLE_REQUIRED_MESSAGE =
  "Choose an account type to finish creating your account"

const getFirebaseWebApiKey = (apiKey?: string | null) =>
  apiKey?.trim() ||
  process.env.NEXT_PUBLIC_FIREBASE_API_KEY?.trim() ||
  process.env.FIREBASE_WEB_API_KEY?.trim() ||
  null

const normalizeText = (value: string | null | undefined): string | null => {
  const normalized = value?.trim().replace(/\s+/g, " ") ?? ""
  return normalized || null
}

const normalizeEmail = (value: string | null | undefined): string | null => {
  const normalized = value?.trim().toLowerCase() ?? ""
  return normalized || null
}

const getNameParts = (
  value: string | null,
): { firstName: string | null; lastName: string | null } => {
  const normalized = normalizeText(value)
  if (!normalized) {
    return { firstName: null, lastName: null }
  }

  const [firstName, ...remainingNames] = normalized.split(" ")
  return {
    firstName: firstName || null,
    lastName: remainingNames.join(" ") || null,
  }
}

async function verifyFirebasePassword(input: {
  email: string | null
  password: string
  apiKey?: string | null
  origin?: string | null
}) {
  if (!input.email) {
    throw new Error("Current password cannot be verified for this account")
  }

  const apiKey = getFirebaseWebApiKey(input.apiKey)
  if (!apiKey) {
    throw new Error("Firebase password verification is not configured")
  }

  const headers = new Headers({ "content-type": "application/json" })
  if (input.origin) {
    headers.set("referer", input.origin.endsWith("/") ? input.origin : `${input.origin}/`)
  }

  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      headers,
      body: JSON.stringify({
        email: input.email,
        password: input.password,
        returnSecureToken: false,
      }),
    },
  )

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as
      | { error?: { message?: string } }
      | null
    if (payload?.error?.message?.includes("API_KEY_HTTP_REFERRER_BLOCKED")) {
      throw new Error("Firebase password verification origin is not allowed")
    }
    throw new Error("Current password is incorrect")
  }
}

async function updateFirebasePassword(input: {
  firebaseUid: string | null
  newPassword: string
}) {
  if (!input.firebaseUid) return

  try {
    await getFirebaseAuth().updateUser(input.firebaseUid, {
      password: input.newPassword,
    })
  } catch (error) {
    console.error("Firebase password update failed", error)
    throw new Error("Unable to update Firebase password")
  }
}

export async function createUser(input: CreateUserInput): Promise<UserProfile> {
  const roles = Array.from(
    new Set(input.roles?.length ? input.roles : [UserRole.User]),
  )
  const activeRole =
    input.activeRole && roles.includes(input.activeRole)
      ? input.activeRole
      : roles.includes(UserRole.User)
        ? UserRole.User
        : roles[0]

  const user = await db.user.create({
    data: {
      email: input.email.trim().toLowerCase(),
      passwordHash: hashPassword(input.password),
      firstName: input.firstName.trim(),
      lastName: input.lastName.trim(),
      phone: normalizeText(input.phone),
      avatarUrl: normalizeText(input.avatarUrl),
      companyName: normalizeText(input.companyName),
      addressLine1: normalizeText(input.addressLine1),
      addressLine2: normalizeText(input.addressLine2),
      city: normalizeText(input.city),
      state: normalizeText(input.state),
      postalCode: normalizeText(input.postalCode),
      country: normalizeText(input.country),
      supplierContactPerson: normalizeText(input.supplierContactPerson),
      supplierDesignation: normalizeText(input.supplierDesignation),
      roles,
      activeRole,
    },
  })

  return mapUserProfile(user)
}

export async function updateUserActiveRole(
  userId: string,
  activeRole: UserRole,
): Promise<UserProfile | null> {
  const updated = await db.user.updateMany({
    where: {
      id: userId,
      isActive: true,
      roles: { has: activeRole },
    },
    data: { activeRole },
  })

  if (updated.count !== 1) {
    return null
  }

  const user = await db.user.findUnique({ where: { id: userId } })
  return user ? mapUserProfile(user) : null
}

export async function changeUserPassword(input: {
  userId: string
  currentPassword: string
  newPassword: string
  firebaseWebApiKey?: string | null
  firebaseAuthOrigin?: string | null
}) {
  if (input.currentPassword.length < 1) {
    throw new Error("Current password is required")
  }
  if (input.newPassword.length < 8 || input.newPassword.length > 128) {
    throw new Error("New password must be between 8 and 128 characters")
  }
  if (input.currentPassword === input.newPassword) {
    throw new Error("New password must be different from current password")
  }

  const user = await db.user.findUnique({
    where: { id: input.userId },
    select: {
      id: true,
      email: true,
      firebaseUid: true,
      passwordHash: true,
      isActive: true,
    },
  })
  if (!user || !user.isActive) throw new Error("User account is inactive")
  if (user.passwordHash && !verifyPassword(input.currentPassword, user.passwordHash)) {
    throw new Error("Current password is incorrect")
  }
  if (!user.passwordHash) {
    await verifyFirebasePassword({
      email: user.email,
      password: input.currentPassword,
      apiKey: input.firebaseWebApiKey,
      origin: input.firebaseAuthOrigin,
    })
  }

  await updateFirebasePassword({
    firebaseUid: user.firebaseUid,
    newPassword: input.newPassword,
  })

  await db.user.update({
    where: { id: user.id },
    data: { passwordHash: hashPassword(input.newPassword) },
  })

  return { ok: true as const, message: "Password changed successfully" }
}

export async function loginUser(
  input: LoginUserInput,
  context: UserSessionRequestContext,
): Promise<{
  user: UserProfile
  issued: IssuedUserSession
}> {
  const user = await db.user.findUnique({
    where: { email: input.email.trim().toLowerCase() },
  })

  if (
    !user ||
    !user.passwordHash ||
    !verifyPassword(input.password, user.passwordHash)
  ) {
    throw new Error("Invalid email or password")
  }

  if (!user.isActive) {
    throw new Error("User account is inactive")
  }

  const loggedInAt = new Date()
  const issued = await createUserSession(user, context)
  const updatedUser = await db.user.update({
    where: { id: user.id },
    data: { lastLoginAt: loggedInAt },
  })

  return {
    user: mapUserProfile(updatedUser),
    issued,
  }
}

export async function loginUserWithFirebase(
  identity: FirebaseUserIdentity,
  context: UserSessionRequestContext,
  requestedRole: UserRole | null = null,
  requestedDisplayName: string | null = null,
  requestedSupplierDetails: {
    contactPerson: string | null
    designation: string | null
    phone: string | null
  } | null = null,
): Promise<{
  user: UserProfile
  issued: IssuedUserSession
}> {
  const firebaseUid = identity.uid.trim()
  const email = normalizeEmail(identity.email)
  const phone = normalizeText(identity.phone)
  const avatarUrl = normalizeText(identity.picture)
  const { firstName, lastName } = getNameParts(identity.name)
  const registrationName = normalizeText(requestedDisplayName)
  const registrationNameParts = getNameParts(registrationName)
  const supplierPhone =
    requestedRole === UserRole.Supplier
      ? normalizeText(requestedSupplierDetails?.phone)
      : null

  if (!firebaseUid) {
    throw new Error("Invalid Firebase ID token")
  }

  if (
    email &&
    identity.signInProvider === "password" &&
    !identity.emailVerified
  ) {
    throw new Error("Email address is not verified")
  }

  const identityFilters: Prisma.UserWhereInput[] = [{ firebaseUid }]
  if (email) identityFilters.push({ email })
  if (phone) identityFilters.push({ phone })

  const matchingUsers = await db.user.findMany({
    where: { OR: identityFilters },
  })

  const phoneSignIn = identity.signInProvider === "phone"
  const phoneMatchedUser =
    phoneSignIn && phone
      ? matchingUsers.find((user) => user.phone === phone)
      : undefined
  const uidMatchedUser = matchingUsers.find(
    (user) => user.firebaseUid === firebaseUid,
  )
  const emailMatchedUser =
    email ? matchingUsers.find((user) => user.email === email) : undefined

  const existingUser = phoneMatchedUser ?? uidMatchedUser ?? emailMatchedUser

  if (
    matchingUsers.some((user) => user.id !== existingUser?.id) &&
    !(phoneSignIn && phoneMatchedUser)
  ) {
    throw new Error("Firebase identity conflicts with existing user accounts")
  }

  if (
    existingUser?.firebaseUid &&
    existingUser.firebaseUid !== firebaseUid &&
    !(phoneSignIn && existingUser.phone === phone)
  ) {
    throw new Error("Firebase identity conflicts with an existing user account")
  }

  if (existingUser && !existingUser.isActive) {
    throw new Error("User account is inactive")
  }

  if (!existingUser && !requestedRole) {
    throw new Error(VERIFIED_ACCOUNT_ROLE_REQUIRED_MESSAGE)
  }
  if (!existingUser && requestedRole === UserRole.Supplier) {
    if (!normalizeText(requestedSupplierDetails?.contactPerson)) {
      throw new Error("Authorized person name is required for supplier accounts")
    }
    if (!normalizeText(requestedSupplierDetails?.designation)) {
      throw new Error("Designation is required for supplier accounts")
    }
    if (!supplierPhone) {
      throw new Error("Enter a valid supplier phone number with country code")
    }
  }

  const loggedInAt = new Date()
  const verifiedAt = identity.emailVerified && email ? loggedInAt : null
  const user = existingUser
    ? await db.user.update({
        where: { id: existingUser.id },
        data: {
          firebaseUid: existingUser.firebaseUid ?? firebaseUid,
          email: existingUser.email ?? email,
          phone: existingUser.phone ?? phone,
          firstName: existingUser.firstName ?? firstName,
          lastName: existingUser.lastName ?? lastName,
          avatarUrl: existingUser.avatarUrl ?? avatarUrl,
          emailVerifiedAt: existingUser.emailVerifiedAt ?? verifiedAt,
          lastLoginAt: loggedInAt,
        },
      })
    : await db.user.create({
        data: {
          firebaseUid,
          email,
          phone: phone ?? supplierPhone,
          firstName: registrationNameParts.firstName ?? firstName,
          lastName: registrationNameParts.lastName ?? lastName,
          avatarUrl,
          companyName:
            requestedRole && requestedRole !== UserRole.User
              ? registrationName ?? normalizeText(identity.name)
              : null,
          supplierContactPerson:
            requestedRole === UserRole.Supplier
              ? normalizeText(requestedSupplierDetails?.contactPerson)
              : null,
          supplierDesignation:
            requestedRole === UserRole.Supplier
              ? normalizeText(requestedSupplierDetails?.designation)
              : null,
          roles: [requestedRole ?? UserRole.User],
          activeRole: requestedRole ?? UserRole.User,
          emailVerifiedAt: verifiedAt,
          lastLoginAt: loggedInAt,
        },
      })

  const issued = await createUserSession(user, context)
  return { user: mapUserProfile(user), issued }
}
