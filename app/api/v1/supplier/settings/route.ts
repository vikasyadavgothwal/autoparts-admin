import { NextRequest } from "next/server";

import {
  apiError,
  apiErrorMessage,
  apiOk,
  readJsonBody,
  withSupplierApiRoute,
} from "@/lib/auth/api-guards";
import { BusinessAccountType } from "@/lib/generated/prisma/client";
import { getBusinessAccountOwnerId } from "@/services/business/business-platform-service";
import {
  getSupplierProfile,
  updateSupplierProfile,
} from "@/services/supplier/supplier-settings-service";
import type { SupplierProfileInput } from "@/types/supplier/settings";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  return withSupplierApiRoute(request, async (user) => {
    const supplierId = await getBusinessAccountOwnerId(user.id, BusinessAccountType.Supplier);
    return apiOk({ profile: await getSupplierProfile(supplierId) });
  });
}

export async function PATCH(request: NextRequest) {
  return withSupplierApiRoute(request, async (user) => {
    const parsed = await readJsonBody<SupplierProfileInput>(request);
    if (!parsed.ok) return apiError(parsed.message);

    try {
      const supplierId = await getBusinessAccountOwnerId(user.id, BusinessAccountType.Supplier);
      if (supplierId !== user.id) {
        return apiError("Only the supplier owner can update workspace settings", 403);
      }
      return apiOk({
        profile: await updateSupplierProfile(supplierId, parsed.body),
      });
    } catch (error) {
      return apiError(apiErrorMessage(error, "Unable to update supplier settings"));
    }
  });
}
