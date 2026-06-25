"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

import { getCurrentAdminSession } from "@/actions/admin-auth/me"
import { appRoutes } from "@/lib/routes"
import {
  createVehicle,
  deleteVehicle,
  getVehicleCatalog,
  importVehicles,
  updateVehicle,
} from "@/services/admin-dashboard/vehicles/vehicle-service"
import type {
  VehicleActionResult,
  VehicleBulkRow,
  VehicleInput,
  VehiclePageResult,
  VehicleSearchInput,
} from "@/types/admin-dashboard/vehicles/vehicles"

const VEHICLES_PATH = "/vehicles"

const requireActiveAdmin = async (options?: { redirectOnFail?: boolean }) => {
  const session = await getCurrentAdminSession()

  if (!session.ok || !session.admin.isActive) {
    if (options?.redirectOnFail) {
      redirect(appRoutes.login)
    }

    throw new Error("Unauthorized")
  }
}

const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    if (error.message.includes("Unique constraint")) {
      if (error.message.includes("sku")) {
        return "This SKU already exists"
      }

      return "This brand, car, variant, and model year already exists"
    }

    if (error.message.includes("Record to update not found")) {
      return "Record not found"
    }

    if (error.message.includes("Record to delete does not exist")) {
      return "Record not found"
    }

    return error.message
  }

  return "Unable to complete the request"
}

export async function fetchVehicles(
  input: VehicleSearchInput = {},
): Promise<VehiclePageResult> {
  await requireActiveAdmin({ redirectOnFail: true })
  return getVehicleCatalog(input)
}

export async function createVehicleAction(
  input: VehicleInput,
): Promise<VehicleActionResult> {
  try {
    await requireActiveAdmin()
    await createVehicle(input)
    revalidatePath(VEHICLES_PATH)
    return { ok: true, message: "Vehicle created" }
  } catch (error) {
    return { ok: false, message: getErrorMessage(error) }
  }
}

export async function updateVehicleAction(
  id: string,
  input: VehicleInput,
): Promise<VehicleActionResult> {
  try {
    await requireActiveAdmin()
    await updateVehicle(id, input)
    revalidatePath(VEHICLES_PATH)
    return { ok: true, message: "Vehicle updated" }
  } catch (error) {
    return { ok: false, message: getErrorMessage(error) }
  }
}

export async function deleteVehicleAction(id: string): Promise<VehicleActionResult> {
  try {
    await requireActiveAdmin()
    await deleteVehicle(id)
    revalidatePath(VEHICLES_PATH)
    return { ok: true, message: "Vehicle deleted" }
  } catch (error) {
    return { ok: false, message: getErrorMessage(error) }
  }
}

export async function importVehiclesAction(
  rows: VehicleBulkRow[],
): Promise<VehicleActionResult> {
  try {
    await requireActiveAdmin()
    const result = await importVehicles(rows)
    revalidatePath(VEHICLES_PATH)

    return {
      ok: true,
      message: `${result.imported} vehicle rows imported`,
      ...result,
    }
  } catch (error) {
    return { ok: false, message: getErrorMessage(error) }
  }
}
