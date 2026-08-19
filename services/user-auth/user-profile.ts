import type { UserRole } from "@/lib/generated/prisma/client"
import type { UserProfile } from "@/types/user-auth/user-auth"

type UserProfileRecord = {
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
    id: user.id,
    firebaseUid: user.firebaseUid,
    email: user.email,
    phone: user.phone,
    googleId: user.googleId,
    firstName: user.firstName,
    lastName: user.lastName,
    avatarUrl: user.avatarUrl,
    companyName: user.companyName,
    addressLine1: user.addressLine1,
    addressLine2: user.addressLine2,
    city: user.city,
    state: user.state,
    country: user.country,
    roles: user.roles,
    activeRole: user.activeRole,
    isActive: user.isActive,
    emailVerifiedAt: user.emailVerifiedAt?.toISOString() ?? null,
    lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  }
}
