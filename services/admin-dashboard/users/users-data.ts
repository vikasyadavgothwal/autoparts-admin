import type {
  UsersTableColumn,
} from "@/types/admin-dashboard/users/users-types"

export const USER_TABLE_COLUMNS: readonly UsersTableColumn[] = [
  { key: "id", label: "User ID", className: "w-[10%]" },
  { key: "name", label: "Name", className: "w-[16%]" },
  { key: "email", label: "Email", className: "w-[18%]" },
  { key: "role", label: "Role", className: "w-[15%]" },
  { key: "orders", label: "Orders", className: "w-[7%]" },
  { key: "rfqs", label: "RFQs", className: "w-[7%]" },
  { key: "joined", label: "Joined", className: "w-[11%]" },
  { key: "status", label: "Status", className: "w-[9%]" },
  { key: "actions", label: "Actions", className: "w-[7%]" },
]
