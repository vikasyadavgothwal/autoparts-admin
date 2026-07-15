"use server"

import { updateAdminUserStatus } from "@/services/admin-dashboard/users/user-management-service"

export async function setUserAccountStatus(
  userId: string,
  isActive: boolean,
) {
  return updateAdminUserStatus(userId, isActive)
}
