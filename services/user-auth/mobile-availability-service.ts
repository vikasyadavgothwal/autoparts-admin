import { db } from "@/lib/database/prisma"

const normalizeMobileValue = (value: string | null | undefined) => {
  const normalized = value?.trim().replace(/[^\d+]/g, "") ?? ""
  if (!normalized) return null
  const prefixed = normalized.startsWith("+") ? normalized : `+${normalized}`
  return /^\+\d{8,18}$/.test(prefixed) ? prefixed : null
}

export async function assertMobileNumberAvailable(
  userId: string,
  value: string | null | undefined,
) {
  const phone = normalizeMobileValue(value)
  if (!phone) {
    throw new Error("Enter a valid mobile number with country code")
  }

  const existing = await db.user.findFirst({
    where: {
      phone,
      NOT: { id: userId },
    },
    select: { id: true },
  })

  if (existing) {
    throw new Error("This mobile number is already used by another account")
  }

  return phone
}
