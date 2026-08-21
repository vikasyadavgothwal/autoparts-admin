import { NextRequest } from "next/server";

import {
  apiError,
  apiErrorMessage,
  apiOk,
  withUserApiRoute,
} from "@/lib/auth/api-guards";
import {
  listBusinessPaymentHistory,
  listUserPaymentHistory,
} from "@/services/payments/stripe-payment-service";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  return withUserApiRoute(request, async (auth) => {
    try {
      const scope = request.nextUrl.searchParams.get("scope") ?? "user";
      const businessAccountId = request.nextUrl.searchParams.get("businessAccountId");
      const payments =
        scope === "business"
          ? await listBusinessPaymentHistory({
              userId: auth.user.id,
              businessAccountId,
            })
          : await listUserPaymentHistory(auth.user.id);

      return apiOk({ payments });
    } catch (error) {
      return apiError(apiErrorMessage(error, "Unable to load payment history"));
    }
  });
}
