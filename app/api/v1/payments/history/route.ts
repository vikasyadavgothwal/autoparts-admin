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

const positiveIntParam = (value: string | null, fallback: number) => {
  const number = Number.parseInt(value ?? "", 10);
  return Number.isFinite(number) && number > 0 ? number : fallback;
};

const dateParam = (value: string | null, endOfDay = false) => {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return null;
  if (endOfDay) date.setUTCDate(date.getUTCDate() + 1);
  return date;
};

export async function GET(request: NextRequest) {
  return withUserApiRoute(request, async (auth) => {
    try {
      const scope = request.nextUrl.searchParams.get("scope") ?? "user";
      const businessAccountId = request.nextUrl.searchParams.get("businessAccountId");
      const filters = {
        page: positiveIntParam(request.nextUrl.searchParams.get("page"), 1),
        pageSize: positiveIntParam(request.nextUrl.searchParams.get("pageSize"), 10),
        from: dateParam(request.nextUrl.searchParams.get("from")),
        to: dateParam(request.nextUrl.searchParams.get("to"), true),
      };
      const history =
        scope === "business"
          ? await listBusinessPaymentHistory({
              userId: auth.user.id,
              businessAccountId,
              ...filters,
            })
          : await listUserPaymentHistory(auth.user.id, filters);

      return apiOk(history);
    } catch (error) {
      return apiError(apiErrorMessage(error, "Unable to load payment history"));
    }
  });
}
