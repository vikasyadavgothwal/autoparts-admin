import { NextRequest } from "next/server";

import {
  apiError,
  apiErrorMessage,
  apiOk,
  readJsonBody,
  withCustomerApiRoute,
} from "@/lib/auth/api-guards";
import {
  getUserProfile,
  updateUserProfile,
} from "@/services/user/user-settings-service";
import type { UserProfileInput } from "@/types/user/settings";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  return withCustomerApiRoute(request, async (user) =>
    apiOk({ profile: await getUserProfile(user.id) }),
  );
}

export async function PATCH(request: NextRequest) {
  return withCustomerApiRoute(request, async (user) => {
    const parsed = await readJsonBody<UserProfileInput>(request);
    if (!parsed.ok) return apiError(parsed.message);

    try {
      return apiOk({
        profile: await updateUserProfile(user.id, parsed.body),
      });
    } catch (error) {
      return apiError(apiErrorMessage(error, "Unable to update settings"));
    }
  });
}
