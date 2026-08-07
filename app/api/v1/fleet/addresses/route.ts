import { NextRequest, NextResponse } from "next/server"

import {
  readJsonBody,
  requireFleetFromRequest,
} from "@/lib/auth/api-guards"
import {
  createUserAddress,
  listUserAddresses,
} from "@/services/user-addresses/user-address-service"
import type { UserAddressInput } from "@/types/user-addresses/user-addresses"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const auth = await requireFleetFromRequest(request)
  if (!auth.ok) return auth.response

  return NextResponse.json({
    ok: true,
    addresses: await listUserAddresses(auth.user.id),
  })
}

export async function POST(request: NextRequest) {
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
    return NextResponse.json(
      {
        ok: true,
        address: await createUserAddress(auth.user.id, parsed.body),
      },
      { status: 201 },
    )
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message:
          error instanceof Error ? error.message : "Unable to save address",
      },
      { status: 400 },
    )
  }
}
