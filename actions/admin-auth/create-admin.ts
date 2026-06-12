"use server"

import { createAdminWithCredentials } from "@/services/admin-auth/admin-auth-service"
import type { CreateAdminInput } from "@/types/admin-auth/admin-auth"
import { getCurrentAdminSession } from "@/actions/admin-auth/me"

export async function createAdmin(input: CreateAdminInput) {
  const actor = await getCurrentAdminSession()

  if (!actor.ok) {
    return {
      ok: false,
      message: "Unauthorized",
    } 
  }

  if (!actor.admin.isActive) {
    return {
      ok: false,
      message: "Admin is deactivated",
    }
  }

  if (!input?.email || !input?.password) {
    return {
      ok: false,
      message: "Email and password are required",
    }
  }

  return createAdminWithCredentials({
    email: input.email,
    password: input.password,
  })
}
