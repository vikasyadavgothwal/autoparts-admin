import { NextRequest } from "next/server"

import {
  apiError,
  apiErrorMessage,
  apiOk,
  readJsonBody,
  withUserApiRoute,
} from "@/lib/auth/api-guards"
import { changeBusinessAccountPlan } from "@/services/business/business-platform-service"

export async function PATCH(request: NextRequest) {
  return withUserApiRoute(request, async (auth) => {
    const body = await readJsonBody<{
      businessAccountId?: unknown
      planId?: unknown
      billingCycle?: unknown
      autoRenewConsent?: unknown
      paymentSuccessUrl?: unknown
      paymentCancelUrl?: unknown
    }>(request)
    if (!body.ok) return apiError(body.message)

    try {
      return apiOk(await changeBusinessAccountPlan({
        ownerUserId: auth.user.id,
        businessAccountId: body.body.businessAccountId,
        planId: body.body.planId,
        billingCycle: body.body.billingCycle,
        autoRenewConsent: body.body.autoRenewConsent,
        idempotencyKey: request.headers.get("idempotency-key") ?? undefined,
        paymentSuccessUrl: body.body.paymentSuccessUrl,
        paymentCancelUrl: body.body.paymentCancelUrl,
      }))
    } catch (error) {
      return apiError(apiErrorMessage(error, "Unable to change plan"))
    }
  })
}
