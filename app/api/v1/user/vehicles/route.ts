import { NextRequest } from "next/server"

import {
  apiCreated,
  apiError,
  apiErrorMessage,
  apiOk,
  isUniqueConstraintError,
  readJsonBody,
  withCustomerApiRoute,
} from "@/lib/auth/api-guards"
import {
  createUserVehicle,
  listUserVehicles,
  type UserVehicleInput,
} from "@/services/user-vehicles/user-vehicle-service"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  return withCustomerApiRoute(request, async (user) => {
    const page = Number.parseInt(request.nextUrl.searchParams.get("page") ?? "1", 10)
    const pageSize = Number.parseInt(request.nextUrl.searchParams.get("pageSize") ?? "50", 10)

    return apiOk(await listUserVehicles(user.id, page, pageSize))
  })
}

export async function POST(request: NextRequest) {
  return withCustomerApiRoute(request, async (user) => {
    const parsed = await readJsonBody<UserVehicleInput>(request)
    if (!parsed.ok) return apiError(parsed.message)

    try {
      const vehicle = await createUserVehicle(user.id, parsed.body)
      return apiCreated({ vehicle })
    } catch (error) {
      const message = isUniqueConstraintError(error)
        ? "A vehicle with this VIN already exists in your account"
        : apiErrorMessage(error, "Unable to save vehicle")

      return apiError(message)
    }
  })
}
