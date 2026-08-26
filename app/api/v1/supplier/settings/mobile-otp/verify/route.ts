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
  verifySupplierContactPhoneWithFirebase,
  verifySupplierMobileWithFirebase,
} from "@/services/supplier/supplier-settings-service";

type VerifyOtpBody = {
  firebaseIdToken?: unknown;
  target?: unknown;
};

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  return withSupplierApiRoute(request, async (user) => {
    const parsed = await readJsonBody<VerifyOtpBody>(request);
    if (!parsed.ok) return apiError(parsed.message);

    try {
      const firebaseIdToken =
        typeof parsed.body.firebaseIdToken === "string"
          ? parsed.body.firebaseIdToken
          : "";
      if (!firebaseIdToken) return apiError("Firebase ID token is required");
      const target =
        parsed.body.target === "supplierContactPhone"
          ? "supplierContactPhone"
          : "authorizedPhone";
      const supplierId = await getBusinessAccountOwnerId(user.id, BusinessAccountType.Supplier);
      if (supplierId !== user.id) {
        return apiError("Only the supplier owner can update workspace settings", 403);
      }

      return apiOk({
        profile:
          target === "supplierContactPhone"
            ? await verifySupplierContactPhoneWithFirebase(
                supplierId,
                firebaseIdToken,
              )
            : await verifySupplierMobileWithFirebase(
                supplierId,
                firebaseIdToken,
              ),
      });
    } catch (error) {
      return apiError(apiErrorMessage(error, "Unable to verify OTP"));
    }
  });
}
