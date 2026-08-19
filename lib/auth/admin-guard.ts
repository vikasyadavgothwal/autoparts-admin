import { getCurrentAdminSession } from "@/actions/admin-auth/me"
import { db } from "@/lib/database/prisma"

type AdminPermissionResult =
  | { ok: true; admin: { id: string; email: string; name: string | null } }
  | { ok: false; error: string }

export async function requireAdminPermission(
  permissionCode: string,
): Promise<AdminPermissionResult> {
  const session = await getCurrentAdminSession()

  if (!session.ok) {
    return { ok: false, error: "Unauthorized" }
  }

  if (!session.admin.isActive) {
    return { ok: false, error: "Admin is deactivated" }
  }

  const [admin, permission] = await Promise.all([
    db.admin.findUnique({
      where: { id: session.admin.id },
      select: { roleIds: true, isActive: true },
    }),
    db.permission.findUnique({
      where: { code: permissionCode },
      select: { id: true },
    }),
  ])

  if (!admin?.isActive) {
    return { ok: false, error: "Admin is deactivated" }
  }

  if (!permission || !admin.roleIds.length) {
    return { ok: false, error: "Forbidden" }
  }

  const roles = await db.role.findMany({
    where: { id: { in: admin.roleIds } },
    select: { permissionIds: true },
  })

  if (!roles.some((role) => role.permissionIds.includes(permission.id))) {
    return { ok: false, error: "Forbidden" }
  }

  return {
    ok: true,
    admin: {
      id: session.admin.id,
      email: session.admin.email,
      name: session.admin.name,
    },
  }
}
