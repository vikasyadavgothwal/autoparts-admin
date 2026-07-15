import { NextRequest, NextResponse } from "next/server"

import {
  getUserSavedPartStatusAction,
  listUserSavedPartsAction,
  removeUserSavedPartAction,
  saveUserPartAction,
} from "@/actions/user/saved-parts"
import {
  readJsonBody,
  requireCustomerUserFromRequest,
} from "@/lib/parts-mapping/auth"
import type { SaveUserPartInput } from "@/types/user/saved-parts"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const auth = await requireCustomerUserFromRequest(request)
  if (!auth.ok) return auth.response

  const partUid = request.nextUrl.searchParams.get("partUid")
  if (partUid) {
    return NextResponse.json({
      ok: true,
      ...(await getUserSavedPartStatusAction(auth.user.id, partUid)),
    })
  }

  return NextResponse.json({
    ok: true,
    ...(await listUserSavedPartsAction(auth.user.id)),
  })
}

export async function POST(request: NextRequest) {
  const auth = await requireCustomerUserFromRequest(request)
  if (!auth.ok) return auth.response

  const parsed = await readJsonBody<SaveUserPartInput>(request)
  if (!parsed.ok) {
    return NextResponse.json(
      { ok: false, message: parsed.message },
      { status: 400 },
    )
  }

  const result = await saveUserPartAction(auth.user.id, parsed.body)
  return NextResponse.json(result, { status: result.statusCode })
}

export async function DELETE(request: NextRequest) {
  const auth = await requireCustomerUserFromRequest(request)
  if (!auth.ok) return auth.response

  const parsed = await readJsonBody<SaveUserPartInput>(request)
  if (!parsed.ok) {
    return NextResponse.json(
      { ok: false, message: parsed.message },
      { status: 400 },
    )
  }

  const result = await removeUserSavedPartAction(auth.user.id, parsed.body)
  return NextResponse.json(result, { status: result.statusCode })
}
