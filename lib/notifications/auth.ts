import { NextRequest, NextResponse } from "next/server"

import {
  getOptionalUserFromRequest,
  requireAdminFromRequest,
} from "@/lib/auth/api-guards"
import type { NotificationScope } from "@/types/notifications/notifications"

export async function getNotificationScopeFromRequest(
  request: NextRequest,
): Promise<
  | { ok: true; scope: NotificationScope }
  | { ok: false; response: NextResponse }
> {
  const userAuth = await getOptionalUserFromRequest(request)
  if (userAuth) {
    return { ok: true, scope: { kind: "user", id: userAuth.user.id } }
  }

  const adminAuth = await requireAdminFromRequest()
  if (adminAuth.ok) {
    return { ok: true, scope: { kind: "admin", id: adminAuth.admin.id } }
  }

  return {
    ok: false,
    response: NextResponse.json(
      { ok: false, message: "Unauthorized" },
      { status: 401 },
    ),
  }
}
