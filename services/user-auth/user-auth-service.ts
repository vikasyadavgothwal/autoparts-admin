import { db } from "@/lib/database/prisma"
import { UserRole } from "@/lib/generated/prisma/client"
import { hashPassword, verifyPassword } from "@/lib/auth/password"
import { createUserSession } from "@/services/user-auth/user-session-service"
import { mapUserProfile } from "@/services/user-auth/user-profile"
import type {
  CreateUserInput,
  IssuedUserSession,
  LoginUserInput,
  UserProfile,
  UserSessionRequestContext,
} from "@/types/user-auth/user-auth"

const normalizeText = (value: string | null | undefined): string | null => {
  const normalized = value?.trim().replace(/\s+/g, " ") ?? ""
  return normalized || null
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
