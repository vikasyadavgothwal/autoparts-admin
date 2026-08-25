import type {
  UserRecord,
  UsersPagination,
  UsersTableColumn,
} from "@/types/admin-dashboard/users/users-types"

export type UsersTableProps = {
  rows: readonly UserRecord[]
  columns: readonly UsersTableColumn[]
  pagination: UsersPagination
  search: string
}
