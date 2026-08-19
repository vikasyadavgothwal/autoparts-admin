import { BusinessAccountType } from "@/lib/generated/prisma/client"
import {
  getFleetProfile,
  updateFleetProfile,
} from "@/services/fleet/fleet-settings-service"
import {
  getGarageProfile,
  updateGarageProfile,
} from "@/services/garage/garage-settings-service"
import {
  getSupplierProfile,
  updateSupplierDeveloperProfile,
} from "@/services/supplier/supplier-settings-service"

const profileFields = {
  Garage: [
    "garageName", "workingDays", "workingHours", "workingHoursByDay",
    "address", "country", "state", "city",
    "jobCompletedNumber", "yearsExperience", "responseTime",
    "certifications", "about",
  ],
  Fleet: [
    "companyName", "firstName", "lastName", "addressLine1", "addressLine2",
    "city", "state", "country",
  ],
  Supplier: [
    "companyName", "firstName", "lastName", "contactPerson", "designation",
    "addressLine1", "addressLine2", "city", "state", "country",
  ],
} satisfies Record<BusinessAccountType, string[]>

const editableValues = (
  accountType: BusinessAccountType,
  value: unknown,
) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Request body must be a JSON object")
  }
  const source = value as Record<string, unknown>
  return Object.fromEntries(
    profileFields[accountType]
      .filter((field) => Object.hasOwn(source, field))
      .map((field) => [field, source[field]]),
  )
}

const publicProfile = (
  accountType: BusinessAccountType,
  value: Record<string, unknown>,
) => Object.fromEntries(profileFields[accountType].map((field) => [field, value[field] ?? null]))

export async function getDeveloperProfile(
  accountType: BusinessAccountType,
  ownerUserId: string,
) {
  const profile = accountType === BusinessAccountType.Garage
    ? await getGarageProfile(ownerUserId)
    : accountType === BusinessAccountType.Fleet
      ? await getFleetProfile(ownerUserId)
      : await getSupplierProfile(ownerUserId)
  return publicProfile(accountType, profile as unknown as Record<string, unknown>)
}

export async function updateDeveloperProfile(
  accountType: BusinessAccountType,
  ownerUserId: string,
  body: unknown,
) {
  const changes = editableValues(accountType, body)
  if (!Object.keys(changes).length) {
    throw new Error(`Include at least one editable ${accountType.toLowerCase()} profile field`)
  }

  const profile = accountType === BusinessAccountType.Garage
    ? await updateGarageProfile(ownerUserId, {
        ...(await getGarageProfile(ownerUserId)),
        ...changes,
      })
    : accountType === BusinessAccountType.Fleet
      ? await updateFleetProfile(ownerUserId, {
          ...(await getFleetProfile(ownerUserId)),
          ...changes,
        })
      : await updateSupplierDeveloperProfile(ownerUserId, changes)

  return publicProfile(accountType, profile as unknown as Record<string, unknown>)
}
