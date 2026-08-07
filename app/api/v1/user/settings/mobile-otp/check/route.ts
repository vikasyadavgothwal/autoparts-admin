import { NextRequest } from "next/server"

import {
  apiError,
  apiErrorMessage,
  apiOk,
  readJsonBody,
  withCustomerApiRoute,
} from "@/lib/auth/api-guards"
import { assertMobileNumberAvailable } from "@/services/user-auth/mobile-availability-service"

type CheckBody = { phone?: unknown }

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  return withCustomerApiRoute(request, async (user) => {
    const parsed = await readJsonBody<CheckBody>(request)
    if (!parsed.ok) return apiError(parsed.message)

    try {
      await assertMobileNumberAvailable(
        user.id,
        typeof parsed.body.phone === "string" ? parsed.body.phone : "",
      )
      return apiOk({ message: "Mobile number is available" })
    } catch (error) {
      return apiError(apiErrorMessage(error, "Unable to check mobile number"))
    }
  })
}
