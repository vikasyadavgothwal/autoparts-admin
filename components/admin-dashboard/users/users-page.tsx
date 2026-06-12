import { PageHeading } from "@/components/admin-dashboard/shared/page-heading"
import {
  USERS,
  USERS_KPIS,
  USER_ACTIVITY,
  USER_TABLE_COLUMNS,
} from "@/services/admin-dashboard/users/users-data"
import { UsersSection } from "./users-section"
import { UsersStatCards } from "./users-stat-cards"
import { UsersTable } from "./users-table"

export function UsersPage() {
  return (
    <div className="space-y-8">
      <PageHeading
        title="User Management"
        subtitle="Monitor and manage platform users."
      />

      <UsersStatCards items={USERS_KPIS} />

      <UsersTable rows={USERS} columns={USER_TABLE_COLUMNS} />

      <UsersSection items={USER_ACTIVITY} />
    </div>
  )
}
