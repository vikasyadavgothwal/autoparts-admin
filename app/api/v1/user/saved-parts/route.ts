import { NextRequest, NextResponse } from "next/server"

import {
  getUserSavedPartStatusAction,
  listUserSavedPartsAction,
  removeUserSavedPartAction,
  saveUserPartAction,
} from "@/actions/user/saved-parts"
import {
  apiError,
  apiOk,
  readJsonBody,
  withCustomerApiRoute,
} from "@/lib/auth/api-guards"
import type { SaveUserPartInput } from "@/types/user/saved-parts"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  return withCustomerApiRoute(request, async (user) => {
    const partUid = request.nextUrl.searchParams.get("partUid")
    if (partUid) {
      return apiOk(await getUserSavedPartStatusAction(user.id, partUid))
    }

    return apiOk(await listUserSavedPartsAction(user.id))
  })
}

export async function POST(request: NextRequest) {
  return withCustomerApiRoute(request, async (user) => {
    const parsed = await readJsonBody<SaveUserPartInput>(request)
    if (!parsed.ok) return apiError(parsed.message)

    const result = await saveUserPartAction(user.id, parsed.body)
    return NextResponse.json(result, { status: result.statusCode })
  })
}

export async function DELETE(request: NextRequest) {
  return withCustomerApiRoute(request, async (user) => {
    const parsed = await readJsonBody<SaveUserPartInput>(request)
    if (!parsed.ok) return apiError(parsed.message)

    const result = await removeUserSavedPartAction(user.id, parsed.body)
    return NextResponse.json(result, { status: result.statusCode })
  })
}
