import { NextRequest, NextResponse } from "next/server"

import {
  clearUserCartAction,
  getUserCartAction,
  replaceUserCartAction,
} from "@/actions/user/cart"
import {
  readJsonBody,
  requireCustomerUserFromRequest,
} from "@/lib/parts-mapping/auth"
import type { UserCartPayload } from "@/types/user/cart"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const auth = await requireCustomerUserFromRequest(request)
  if (!auth.ok) return auth.response

  return NextResponse.json({
    ok: true,
    ...(await getUserCartAction(auth.user.id)),
  })
}

export async function PUT(request: NextRequest) {
  const auth = await requireCustomerUserFromRequest(request)
  if (!auth.ok) return auth.response

  const parsed = await readJsonBody<UserCartPayload>(request)
  if (!parsed.ok) {
    return NextResponse.json(
      { ok: false, message: parsed.message },
      { status: 400 },
    )
  }

  const result = await replaceUserCartAction(auth.user.id, parsed.body.items)
  return NextResponse.json(result, { status: result.statusCode })
}

export async function DELETE(request: NextRequest) {
  const auth = await requireCustomerUserFromRequest(request)
  if (!auth.ok) return auth.response

  const result = await clearUserCartAction(auth.user.id)
  return NextResponse.json(result, { status: result.statusCode })
}
