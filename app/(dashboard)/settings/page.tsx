import { redirect } from "next/navigation"
import { getCurrentAdminSession } from "@/actions/admin-auth/me"
import { AdminSettingsPage } from "@/components/settings/admin-settings-page"

export const dynamic = "force-dynamic"

export default async function SettingsPage() {
  const session = await getCurrentAdminSession()
  if (!session.ok) redirect("/login")
  return <AdminSettingsPage admin={session.admin} />
}
