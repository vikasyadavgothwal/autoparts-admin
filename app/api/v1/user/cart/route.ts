import { NextRequest, NextResponse } from "next/server"

import {
  clearUserCartAction,
  getUserCartAction,
  replaceUserCartAction,
} from "@/actions/user/cart"
import {
  apiError,
  apiOk,
  readJsonBody,
  withCustomerApiRoute,
} from "@/lib/auth/api-guards"
import type { UserCartPayload } from "@/types/user/cart"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  return withCustomerApiRoute(request, async (user) =>
    apiOk(await getUserCartAction(user.id)),
  )
}

export async function PUT(request: NextRequest) {
  return withCustomerApiRoute(request, async (user) => {
    const parsed = await readJsonBody<UserCartPayload>(request)
    if (!parsed.ok) return apiError(parsed.message)

    const result = await replaceUserCartAction(user.id, parsed.body.items)
    return NextResponse.json(result, { status: result.statusCode })
  })
}

export async function DELETE(request: NextRequest) {
  return withCustomerApiRoute(request, async (user) => {
    const result = await clearUserCartAction(user.id)
    return NextResponse.json(result, { status: result.statusCode })
  })
}
