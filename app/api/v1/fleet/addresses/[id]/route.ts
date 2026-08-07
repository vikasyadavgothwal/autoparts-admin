import { NextRequest, NextResponse } from "next/server"

import {
  readJsonBody,
  requireFleetFromRequest,
} from "@/lib/auth/api-guards"
import {
  deleteUserAddress,
  updateUserAddress,
} from "@/services/user-addresses/user-address-service"
import type { UserAddressInput } from "@/types/user-addresses/user-addresses"

export const dynamic = "force-dynamic"

type AddressContext = {
  params: Promise<{ id: string }>
}

export async function PATCH(request: NextRequest, context: AddressContext) {
  const auth = await requireFleetFromRequest(request)
  if (!auth.ok) return auth.response

  const parsed = await readJsonBody<UserAddressInput>(request)
  if (!parsed.ok) {
    return NextResponse.json(
      { ok: false, message: parsed.message },
      { status: 400 },
    )
  }

  try {
    const { id } = await context.params
    return NextResponse.json({
      ok: true,
      address: await updateUserAddress(auth.user.id, id, parsed.body),
    })
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message:
          error instanceof Error ? error.message : "Unable to update address",
      },
      { status: 400 },
    )
  }
}

export async function DELETE(request: NextRequest, context: AddressContext) {
  const auth = await requireFleetFromRequest(request)
  if (!auth.ok) return auth.response

  try {
    const { id } = await context.params
    return NextResponse.json(await deleteUserAddress(auth.user.id, id))
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message:
          error instanceof Error ? error.message : "Unable to delete address",
      },
      { status: 400 },
    )
  }
}
