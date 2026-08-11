import { NextRequest } from "next/server"

import { apiError, apiErrorMessage, apiOk, readJsonBody, withUserApiRoute } from "@/lib/auth/api-guards"
import {
  getBusinessLoginSecurityStatus,
  requestBusinessPinOtp,
  saveBusinessPin,
  saveBusinessStaffLoginMethod,
} from "@/services/business-login-security/business-login-security-service"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  return withUserApiRoute(request, async (auth) => apiOk({ security: await getBusinessLoginSecurityStatus(auth.user.id) }))
}

export async function POST(request: NextRequest) {
  return withUserApiRoute(request, async (auth) => {
    const body = await readJsonBody<{ action?: unknown; pin?: unknown; otp?: unknown; businessAccountId?: unknown; staffLoginMethod?: unknown }>(request)
    if (!body.ok) return apiError(body.message)
    try {
      if (body.body.action === "request-pin-otp") return apiOk(await requestBusinessPinOtp(auth.user.id))
      if (body.body.action === "save-pin") return apiOk(await saveBusinessPin({ userId: auth.user.id, pin: body.body.pin, otp: body.body.otp }))
      if (body.body.action === "save-staff-login-method") {
        return apiOk(await saveBusinessStaffLoginMethod({
          userId: auth.user.id,
          businessAccountId: body.body.businessAccountId,
          staffLoginMethod: body.body.staffLoginMethod,
        }))
      }
      return apiError("Invalid login security action")
    } catch (error) {
      return apiError(apiErrorMessage(error, "Unable to update login security"))
    }
  })
}
