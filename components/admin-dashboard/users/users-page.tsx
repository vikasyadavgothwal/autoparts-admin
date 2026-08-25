import { PageHeading } from "@/components/admin-dashboard/shared/page-heading"
import { USER_TABLE_COLUMNS } from "@/services/admin-dashboard/users/users-data"
import {
  buildUserActivity,
  buildUserKpis,
  getAdminUsersSummary,
  listAdminUsers,
} from "@/services/admin-dashboard/users/user-management-service"
import { UsersSection } from "./users-section"
import { UsersStatCards } from "./users-stat-cards"
import { UsersTable } from "./users-table"

type UsersPageProps = {
  page?: string
  search?: string
}

export async function UsersPage({ page, search }: UsersPageProps) {
  const normalizedSearch = search?.trim() ?? ""
  const [{ users, pagination }, summary] = await Promise.all([
    listAdminUsers({ page, search: normalizedSearch }),
    getAdminUsersSummary(),
  ])

  return (
    <div className="space-y-8">
      <PageHeading
        title="User Management"
        subtitle="Monitor and manage platform users."
      />

      <UsersStatCards items={buildUserKpis(summary)} />

      <UsersTable
        rows={users}
        columns={USER_TABLE_COLUMNS}
        pagination={pagination}
        search={normalizedSearch}
      />

      <UsersSection items={buildUserActivity(users)} />
    </div>
  )
}
