import { Star, TrendingUp, Users, Wrench } from "lucide-react"
import type {
  GarageActivity,
  GarageKpi,
  GarageTableColumn,
} from "@/types/admin-dashboard/garages/garages-types"

export const GARAGE_KPIS: readonly GarageKpi[] = [
  {
    id: "total-garages",
    title: "Total Garages",
    value: "5",
    icon: Wrench,
    iconTone: "primary",
  },
  {
    id: "active-garages",
    title: "Active Garages",
    value: "4",
    icon: Users,
    iconTone: "success",
  },
  {
    id: "avg-rating",
    title: "Avg Rating",
    value: "4.6",
    icon: Star,
    iconTone: "warning",
  },
  {
    id: "total-revenue",
    title: "Total Revenue",
    value: "$214K",
    icon: TrendingUp,
    iconTone: "info",
  },
]

export const GARAGE_FILTERS: readonly string[] = [
  "All Status",
  "Active",
  "Pending",
  "Suspended",
]

export const GARAGE_LOCATIONS: readonly string[] = [
  "All Locations",
  "Los Angeles",
  "San Diego",
  "San Francisco",
]

export const GARAGE_VERIFICATION: readonly string[] = [
  "Verification Status",
  "Verified",
  "Unverified",
]

export const GARAGE_TABLE_COLUMNS: readonly GarageTableColumn[] = [
  { key: "id", label: "Garage ID", className: "w-[11%]" },
  { key: "name", label: "Garage Name", className: "w-[22%]" },
  { key: "location", label: "Location", className: "w-[16%]" },
  { key: "rating", label: "Rating", className: "w-[12%]" },
  { key: "bookings", label: "Bookings", className: "w-[10%]" },
  { key: "revenue", label: "Revenue", className: "w-[12%]" },
  { key: "joinDate", label: "Join Date", className: "w-[10%]" },
  { key: "status", label: "Status", className: "w-[12%]" },
  { key: "actions", label: "", className: "w-[7%]" },
]

export const GARAGE_ACTIVITIES: readonly GarageActivity[] = [
  {
    title: "Elite Car Care submitted verification",
    time: "2 hours ago",
    action: "Review",
    actionTone: "danger",
  },
  {
    title: "Pro Mechanics Plus reached 300 bookings",
    time: "5 hours ago",
    action: "View",
    actionTone: "info",
  },
  {
    title: "New garage registration: Speedy Auto Repair",
    time: "1 day ago",
    action: "Approve",
    actionTone: "success",
  },
]
