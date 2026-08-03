"use server"

import { getCurrentAdminSession } from "@/actions/admin-auth/me"
import { decodeAdminVin } from "@/services/vin-decoder/vin-decoder-service"
import type { AdminVinDecodeState } from "@/types/vin-decoder/vin-decoder"

export async function decodeAdminVinAction(
  _previousState: AdminVinDecodeState,
  formData: FormData,
): Promise<AdminVinDecodeState> {
  const session = await getCurrentAdminSession()
  if (!session.ok || !session.admin.isActive) {
    return { ok: false, message: "Admin session expired. Sign in again." }
  }

  try {
    const result = await decodeAdminVin(formData.get("vin"))
    return { ok: true, result }
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "VIN decode failed",
    }
  }
}
