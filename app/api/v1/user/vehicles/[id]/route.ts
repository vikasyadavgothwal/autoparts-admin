import { NextRequest, NextResponse } from "next/server"

import { requireCustomerUserFromRequest, readJsonBody } from "@/lib/parts-mapping/auth"
import {
  deleteUserVehicle,
  updateUserVehicle,
  type UserVehicleInput,
} from "@/services/user-vehicles/user-vehicle-service"

export const dynamic = "force-dynamic"

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireCustomerUserFromRequest(request)
  if (!auth.ok) return auth.response

  const parsed = await readJsonBody<UserVehicleInput>(request)
  if (!parsed.ok) {
    return NextResponse.json({ ok: false, message: parsed.message }, { status: 400 })
  }

  try {
    const { id } = await context.params
    const vehicle = await updateUserVehicle(auth.user.id, id, parsed.body)
    return NextResponse.json({ ok: true, vehicle })
  } catch (error) {
    const message =
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2002"
        ? "A vehicle with this VIN already exists in your account"
        : error instanceof Error
          ? error.message
          : "Unable to save vehicle"

    return NextResponse.json({ ok: false, message }, { status: 400 })
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireCustomerUserFromRequest(request)
  if (!auth.ok) return auth.response

  try {
    const { id } = await context.params
    return NextResponse.json({
      ok: true,
      ...(await deleteUserVehicle(auth.user.id, id)),
    })
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : "Unable to delete vehicle" },
      { status: 400 },
    )
  }
}
