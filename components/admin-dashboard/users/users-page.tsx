import { PageHeading } from "@/components/admin-dashboard/shared/page-heading"
import { USER_TABLE_COLUMNS } from "@/services/admin-dashboard/users/users-data"
import {
  buildUserActivity,
  buildUserKpis,
  listAdminUsers,
} from "@/services/admin-dashboard/users/user-management-service"
import { UsersSection } from "./users-section"
import { UsersStatCards } from "./users-stat-cards"
import { UsersTable } from "./users-table"

export async function UsersPage() {
  const users = await listAdminUsers()

  return (
    <div className="space-y-8">
      <PageHeading
        title="User Management"
        subtitle="Monitor and manage platform users."
      />

      <UsersStatCards items={buildUserKpis(users)} />

      <UsersTable rows={users} columns={USER_TABLE_COLUMNS} />

      <UsersSection items={buildUserActivity(users)} />
    </div>
  )
}
