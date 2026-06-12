import { Building, FileText, ShoppingCart, Users as UsersIcon } from "lucide-react"
import type {
  UserActivity,
  UserRecord,
  UsersKpi,
  UsersTableColumn,
} from "@/types/admin-dashboard/users/users-types"

export const USERS_KPIS: readonly UsersKpi[] = [
  {
    id: "users",
    title: "Total Users",
    value: "4",
    icon: UsersIcon,
    iconTone: "primary",
  },
  {
    id: "buyers",
    title: "Buyers",
    value: "2",
    icon: ShoppingCart,
    iconTone: "info",
  },
  {
    id: "fleet",
    title: "Fleet Managers",
    value: "1",
    icon: Building,
    iconTone: "success",
  },
  {
    id: "garages",
    title: "Garage Owners",
    value: "1",
    icon: FileText,
    iconTone: "warning",
  },
]

export const USER_TABLE_COLUMNS: readonly UsersTableColumn[] = [
  { key: "id", label: "User ID", className: "w-[10%]" },
  { key: "name", label: "Name", className: "w-[18%]" },
  { key: "email", label: "Email", className: "w-[20%]" },
  { key: "role", label: "Role", className: "w-[12%]" },
  { key: "orders", label: "Orders", className: "w-[8%]" },
  { key: "rfqs", label: "RFQs", className: "w-[8%]" },
  { key: "joined", label: "Joined", className: "w-[12%]" },
  { key: "status", label: "Status", className: "w-[10%]" },
  { key: "actions", label: "Actions", className: "w-[2%]" },
]

export const USERS: readonly UserRecord[] = [
  {
    id: "USR-001",
    name: "John Doe",
    email: "john.doe@email.com",
    role: "Buyer",
    orders: 12,
    rfqs: 5,
    joined: "2023-09-15",
    status: "Active",
  },
  {
    id: "USR-002",
    name: "Jane Smith",
    email: "jane.smith@company.com",
    role: "Fleet Manager",
    orders: 34,
    rfqs: 18,
    joined: "2023-07-22",
    status: "Active",
  },
  {
    id: "USR-003",
    name: "Mike Johnson",
    email: "mike@garage.com",
    role: "Garage Owner",
    orders: 0,
    rfqs: 0,
    joined: "2024-01-10",
    status: "Active",
  },
  {
    id: "USR-004",
    name: "Sarah Williams",
    email: "sarah.w@email.com",
    role: "Buyer",
    orders: 3,
    rfqs: 2,
    joined: "2023-12-05",
    status: "Suspended",
  },
]

export const USER_ACTIVITY: readonly UserActivity[] = [
  {
    user: "John Doe",
    action: "Placed an order",
    time: "5 minutes ago",
  },
  {
    user: "Jane Smith",
    action: "Created a bulk RFQ",
    time: "12 minutes ago",
  },
  {
    user: "Mike Johnson",
    action: "Added a new service",
    time: "1 hour ago",
  },
  {
    user: "Sarah Williams",
    action: "Updated vehicle information",
    time: "2 hours ago",
  },
]
