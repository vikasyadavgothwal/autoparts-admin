import { UsersPage } from "@/components/admin-dashboard/users/users-page"

export const dynamic = "force-dynamic"

type UserManagementPageProps = {
  searchParams: Promise<{
    page?: string
    search?: string
  }>
}

export default async function UserManagementPage({
  searchParams,
}: UserManagementPageProps) {
  const params = await searchParams
  return <UsersPage page={params.page} search={params.search} />
}
