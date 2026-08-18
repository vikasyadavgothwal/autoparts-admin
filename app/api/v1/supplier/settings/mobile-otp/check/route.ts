import { NextRequest } from "next/server"

import {
  apiError,
  apiErrorMessage,
  apiOk,
  readJsonBody,
  withSupplierApiRoute,
} from "@/lib/auth/api-guards"
import { assertMobileNumberAvailable } from "@/services/user-auth/mobile-availability-service"
import { assertSupplierContactPhoneAvailable } from "@/services/supplier/supplier-settings-service";

type CheckBody = { phone?: unknown; target?: unknown }

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  return withSupplierApiRoute(request, async (user) => {
    const parsed = await readJsonBody<CheckBody>(request)
    if (!parsed.ok) return apiError(parsed.message)

    try {
      const phone = typeof parsed.body.phone === "string" ? parsed.body.phone : "";
      if (parsed.body.target === "supplierContactPhone") {
        await assertSupplierContactPhoneAvailable(user.id, phone);
      } else {
        await assertMobileNumberAvailable(user.id, phone);
      }
      return apiOk({ message: "Mobile number is available" })
    } catch (error) {
      return apiError(apiErrorMessage(error, "Unable to check mobile number"))
    }
  })
}
