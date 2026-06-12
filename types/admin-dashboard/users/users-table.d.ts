import type { UserRecord, UsersTableColumn } from "@/types/admin-dashboard/users/users-types"

export type UsersTableProps = {
  rows: readonly UserRecord[]
  columns: readonly UsersTableColumn[]
}
