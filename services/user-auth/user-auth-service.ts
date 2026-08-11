import { db } from "@/lib/database/prisma"
import { getFirebaseAuth } from "@/lib/firebase/admin"
import { BusinessAccountType, BusinessMemberStatus, Prisma, UserRole } from "@/lib/generated/prisma/client"
import { hashPassword, verifyPassword } from "@/lib/auth/password"
import { ensureBusinessAccountForOwner } from "@/services/business/business-platform-service"
import { createUserSession } from "@/services/user-auth/user-session-service"
import {
  createBusinessLoginChallenge,
  ensureBusinessStaffLoginMethodAllowed,
  type BusinessLoginProvider,
} from "@/services/business-login-security/business-login-security-service"
import { mapUserProfile } from "@/services/user-auth/user-profile"
import { logError } from "@/lib/logger"
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

type BusinessUserRole = Extract<UserRole, "Fleet" | "Garage" | "Supplier">

const isBusinessUserRole = (role: UserRole): role is BusinessUserRole =>
  role === UserRole.Fleet || role === UserRole.Garage || role === UserRole.Supplier

const userRoleToAccountType = (role: BusinessUserRole): BusinessAccountType => {
  if (role === UserRole.Fleet) return BusinessAccountType.Fleet
  if (role === UserRole.Garage) return BusinessAccountType.Garage
  return BusinessAccountType.Supplier
}

const getFirebaseWebApiKey = (apiKey?: string | null) =>
  apiKey?.trim() ||
  process.env.NEXT_PUBLIC_FIREBASE_API_KEY?.trim() ||
  process.env.FIREBASE_WEB_API_KEY?.trim() ||
  null

const normalizeText = (value: string | null | undefined): string | null => {
  const normalized = value?.trim().replace(/\s+/g, " ") ?? ""
  return normalized || null
}

const firebaseProvider = (provider: string | null): BusinessLoginProvider =>
  provider === "google.com" || provider === "google"
    ? "google"
    : provider === "password"
      ? "password"
      : "other"

async function ensureBusinessStaffCanLogin(user: { id: string; activeRole: UserRole }, provider: BusinessLoginProvider) {
  if (!isBusinessUserRole(user.activeRole)) return
  const membership = await db.businessAccountMember.findFirst({
    where: {
      userId: user.id,
      businessAccount: {
        type: userRoleToAccountType(user.activeRole),
        ownerUserId: { not: user.id },
        isActive: true,
      },
    },
    select: {
      businessAccountId: true,
      status: true,
      businessAccount: { select: { plan: { select: { code: true } } } },
    },
  })
  if (membership && membership.status !== BusinessMemberStatus.Active) {
    throw new Error("Your account is disabled by your owner.")
  }
  if (membership?.businessAccount.plan.code === "Enterprise") {
    await ensureBusinessStaffLoginMethodAllowed({ businessAccountId: membership.businessAccountId, provider })
  }
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
    logError("Firebase password update failed", error)
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

  await ensureBusinessAccountForOwner({
    userId: user.id,
    role: activeRole,
    name: user.companyName || [user.firstName, user.lastName].filter(Boolean).join(" "),
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

export async function getCurrentUserAccount(userId: string) {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      phone: true,
      emailVerifiedAt: true,
      isActive: true,
    },
  })
  if (!user || !user.isActive) throw new Error("User account is inactive")
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    phone: user.phone,
    emailVerifiedAt: user.emailVerifiedAt?.toISOString() ?? null,
  }
}

export async function updateCurrentUserAccount(input: {
  userId: string
  firstName?: unknown
  lastName?: unknown
  email?: unknown
}) {
  const firstName = normalizeText(typeof input.firstName === "string" ? input.firstName : null)
  const lastName = normalizeText(typeof input.lastName === "string" ? input.lastName : null)
  const email = normalizeEmail(typeof input.email === "string" ? input.email : null)
  if (!firstName) throw new Error("First name is required")
  if (!lastName) throw new Error("Last name is required")
  if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("Enter a valid email address")
  }

  const currentUser = await db.user.findUnique({
    where: { id: input.userId },
    select: {
      id: true,
      email: true,
      firebaseUid: true,
      isActive: true,
    },
  })
  if (!currentUser || !currentUser.isActive) throw new Error("User account is inactive")

  const existingEmail = await db.user.findFirst({
    where: { email, NOT: { id: input.userId } },
    select: { id: true },
  })
  if (existingEmail) throw new Error("This email is already used by another account")

  if (currentUser.firebaseUid && currentUser.email !== email) {
    try {
      await getFirebaseAuth().updateUser(currentUser.firebaseUid, { email, emailVerified: true })
    } catch (error) {
      logError("Firebase email update failed", error)
      throw new Error("Unable to update Firebase email")
    }
  }

  const user = await db.user.update({
    where: { id: input.userId },
    data: {
      firstName,
      lastName,
      email,
      emailVerifiedAt: currentUser.email === email ? undefined : new Date(),
    },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      phone: true,
      emailVerifiedAt: true,
    },
  })

  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    phone: user.phone,
    emailVerifiedAt: user.emailVerifiedAt?.toISOString() ?? null,
  }
}

export async function loginUser(
  input: LoginUserInput,
  context: UserSessionRequestContext,
): Promise<{
  user: UserProfile
  issued?: IssuedUserSession
  challenge?: Awaited<ReturnType<typeof createBusinessLoginChallenge>>
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
  await ensureBusinessStaffCanLogin(user, "password")

  const challenge = await createBusinessLoginChallenge({ user, role: user.activeRole })
  if (challenge) return { user: mapUserProfile(user), challenge }

  const loggedInAt = new Date()
  const updatedUser = await db.user.update({
    where: { id: user.id },
    data: { lastLoginAt: loggedInAt },
  })
  const issued = await createUserSession(updatedUser, context)
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
  issued?: IssuedUserSession
  challenge?: Awaited<ReturnType<typeof createBusinessLoginChallenge>>
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
  if (existingUser) {
    await ensureBusinessStaffCanLogin(existingUser, firebaseProvider(identity.signInProvider))
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

  if (!existingUser) {
    await ensureBusinessAccountForOwner({
      userId: user.id,
      role: user.activeRole,
      name: user.companyName || [user.firstName, user.lastName].filter(Boolean).join(" "),
    })
  }

  const challenge = await createBusinessLoginChallenge({ user, role: requestedRole ?? user.activeRole })
  if (challenge) return { user: mapUserProfile(user), challenge }

  const issued = await createUserSession(user, context)
  return { user: mapUserProfile(user), issued, challenge }
}
