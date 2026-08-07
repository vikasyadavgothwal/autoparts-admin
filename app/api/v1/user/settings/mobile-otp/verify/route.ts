import { NextRequest } from "next/server";

import {
  apiError,
  apiErrorMessage,
  apiOk,
  readJsonBody,
  withCustomerApiRoute,
} from "@/lib/auth/api-guards";
import { verifyUserMobileWithFirebase } from "@/services/user/user-settings-service";

type VerifyOtpBody = {
  firebaseIdToken?: unknown;
};

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  return withCustomerApiRoute(request, async (user) => {
    const parsed = await readJsonBody<VerifyOtpBody>(request);
    if (!parsed.ok) return apiError(parsed.message);

    try {
      const firebaseIdToken =
        typeof parsed.body.firebaseIdToken === "string"
          ? parsed.body.firebaseIdToken
          : "";
      if (!firebaseIdToken) return apiError("Firebase ID token is required");

      return apiOk({
        profile: await verifyUserMobileWithFirebase(user.id, firebaseIdToken),
      });
    } catch (error) {
      return apiError(apiErrorMessage(error, "Unable to verify OTP"));
    }
  });
}
