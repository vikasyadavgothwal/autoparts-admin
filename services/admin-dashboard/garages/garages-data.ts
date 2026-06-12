import { Star, TrendingUp, Users, Wrench } from "lucide-react"
import type {
  GarageActivity,
  GarageKpi,
  GarageRecord,
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

export const GARAGES: readonly GarageRecord[] = [
  {
    id: "GAR-001",
    name: "AutoFix Garage",
    owner: "John Smith",
    location: "Los Angeles, CA",
    rating: "4.8",
    bookings: 234,
    revenue: "$45,680",
    joinDate: "2023-03-15",
    status: "Active",
    verified: true,
  },
  {
    id: "GAR-002",
    name: "QuickServe Auto",
    owner: "Maria Garcia",
    location: "San Diego, CA",
    rating: "4.6",
    bookings: 189,
    revenue: "$38,920",
    joinDate: "2023-05-22",
    status: "Active",
    verified: true,
  },
  {
    id: "GAR-003",
    name: "Pro Mechanics Plus",
    owner: "David Chen",
    location: "San Francisco, CA",
    rating: "4.9",
    bookings: 312,
    revenue: "$58,340",
    joinDate: "2023-01-10",
    status: "Active",
    verified: true,
  },
  {
    id: "GAR-004",
    name: "Budget Auto Repair",
    owner: "Robert Johnson",
    location: "Sacramento, CA",
    rating: "4.2",
    bookings: 145,
    revenue: "$28,450",
    joinDate: "2023-08-05",
    status: "Active",
    verified: false,
  },
  {
    id: "GAR-005",
    name: "Elite Car Care",
    owner: "Sarah Williams",
    location: "Oakland, CA",
    rating: "4.7",
    bookings: 201,
    revenue: "$42,180",
    joinDate: "2023-06-18",
    status: "Pending",
    verified: false,
  },
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
