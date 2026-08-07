import { NextRequest } from "next/server";

import {
  apiError,
  apiErrorMessage,
  apiOk,
  readJsonBody,
  withSupplierApiRoute,
} from "@/lib/auth/api-guards";
import {
  getSupplierProfile,
  updateSupplierProfile,
} from "@/services/supplier/supplier-settings-service";
import type { SupplierProfileInput } from "@/types/supplier/settings";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  return withSupplierApiRoute(request, async (user) =>
    apiOk({ profile: await getSupplierProfile(user.id) }),
  );
}

export async function PATCH(request: NextRequest) {
  return withSupplierApiRoute(request, async (user) => {
    const parsed = await readJsonBody<SupplierProfileInput>(request);
    if (!parsed.ok) return apiError(parsed.message);

    try {
      return apiOk({
        profile: await updateSupplierProfile(user.id, parsed.body),
      });
    } catch (error) {
      return apiError(apiErrorMessage(error, "Unable to update supplier settings"));
    }
  });
}
