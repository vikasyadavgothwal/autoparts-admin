import { NextRequest } from "next/server"

import {
  apiError,
  apiErrorMessage,
  apiOk,
  readJsonBody,
  withSupplierApiRoute,
} from "@/lib/auth/api-guards"
import { BusinessAccountType } from "@/lib/generated/prisma/client"
import { getBusinessAccountOwnerId } from "@/services/business/business-platform-service"
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
      const supplierId = await getBusinessAccountOwnerId(user.id, BusinessAccountType.Supplier);
      if (supplierId !== user.id) {
        return apiError("Only the supplier owner can update workspace settings", 403);
      }
      if (parsed.body.target === "supplierContactPhone") {
        await assertSupplierContactPhoneAvailable(supplierId, phone);
      } else {
        await assertMobileNumberAvailable(supplierId, phone);
      }
      return apiOk({ message: "Mobile number is available" })
    } catch (error) {
      return apiError(apiErrorMessage(error, "Unable to check mobile number"))
    }
  })
}
