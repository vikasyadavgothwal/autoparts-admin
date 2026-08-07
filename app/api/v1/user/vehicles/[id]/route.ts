import { NextRequest } from "next/server"

import {
  apiError,
  apiErrorMessage,
  apiOk,
  isUniqueConstraintError,
  readJsonBody,
  withCustomerApiRoute,
} from "@/lib/auth/api-guards"
import {
  deleteUserVehicle,
  updateUserVehicle,
  type UserVehicleInput,
} from "@/services/user-vehicles/user-vehicle-service"

export const dynamic = "force-dynamic"

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  return withCustomerApiRoute(request, async (user) => {
    const parsed = await readJsonBody<UserVehicleInput>(request)
    if (!parsed.ok) return apiError(parsed.message)

    try {
      const { id } = await context.params
      const vehicle = await updateUserVehicle(user.id, id, parsed.body)
      return apiOk({ vehicle })
    } catch (error) {
      const message = isUniqueConstraintError(error)
        ? "A vehicle with this VIN already exists in your account"
        : apiErrorMessage(error, "Unable to save vehicle")

      return apiError(message)
    }
  })
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  return withCustomerApiRoute(request, async (user) => {
    try {
      const { id } = await context.params
      return apiOk(await deleteUserVehicle(user.id, id))
    } catch (error) {
      return apiError(apiErrorMessage(error, "Unable to delete vehicle"))
    }
  })
}
