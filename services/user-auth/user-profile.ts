import type { UserRole } from "@/lib/generated/prisma/client"
import type { UserProfile } from "@/types/user-auth/user-auth"

type UserProfileRecord = {
  id: string
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
  emailVerifiedAt: Date | null
  lastLoginAt: Date | null
  createdAt: Date
  updatedAt: Date
}

export function mapUserProfile(user: UserProfileRecord): UserProfile {
  return {
    ...user,
    emailVerifiedAt: user.emailVerifiedAt?.toISOString() ?? null,
    lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  }
}
