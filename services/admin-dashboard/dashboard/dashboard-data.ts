
import {
  Building2,
  DollarSign,
  FileText,
  ShoppingCart,
  TrendingUp,
  Users,
  Wrench,
} from "lucide-react"
import type {
  DashboardStat,
  HealthMetric,
  OrderRecord,
  RFQRecord,
  SupplierRecord,
} from "@/types/admin-dashboard/dashboard/dashboard-data"

export const DASHBOARD_MAIN_STATS: readonly DashboardStat[] = [
  {
    title: "GMV (Monthly)",
    value: "$248,920",
    note: "↑ 23% vs last month",
    icon: DollarSign,
  },
  {
    title: "Active Users",
    value: "2,847",
    note: "↑ 12% vs last month",
    icon: Users,
  },
  {
    title: "Active RFQs",
    value: "156",
    note: "342 total this month",
    icon: FileText,
  },
  {
    title: "Orders (Today)",
    value: "48",
    note: "↑ 8% vs yesterday",
    icon: ShoppingCart,
  },
]

export const DASHBOARD_SMALL_STATS: readonly DashboardStat[] = [
  {
    title: "Suppliers",
    value: "247",
    note: "2 pending approval",
    icon: Building2,
    red: true,
  },
  {
    title: "Garages",
    value: "89",
    note: "All active",
    icon: Wrench,
  },
  {
    title: "Conversion Rate",
    value: "68%",
    note: "↑ 5% this month",
    icon: TrendingUp,
    red: true,
  },
]

export const SUPPLIERS: readonly SupplierRecord[] = [
  {
    id: "SUP-101",
    business: "AutoParts Plus",
    email: "contact@autopartsplus.com",
    location: "Los Angeles, CA",
    submitted: "2 days ago",
  },
  {
    id: "SUP-102",
    business: "Premium Auto Supply",
    email: "info@premiumauto.com",
    location: "Chicago, IL",
    submitted: "1 day ago",
  },
]

export const RFQS: readonly RFQRecord[] = [
  {
    id: "RFQ-901",
    buyer: "John Doe",
    part: "Brake Pads",
    vehicle: "2019 Toyota Camry",
    quotes: "5 received",
    status: "Active",
  },
  {
    id: "RFQ-902",
    buyer: "ABC Logistics",
    part: "Multiple Parts",
    vehicle: "10 vehicles",
    quotes: "12 received",
    status: "Active",
  },
]

export const ORDERS: readonly OrderRecord[] = [
  {
    id: "ORD-901",
    buyer: "Jane Smith",
    supplier: "Acme Auto Parts",
    amount: "$245.99",
    status: "Completed",
    date: "Jan 20",
  },
  {
    id: "ORD-902",
    buyer: "Mike Johnson",
    supplier: "Premium Parts Co",
    amount: "$567.50",
    status: "In Transit",
    date: "Jan 21",
  },
]

export const SUPPLIER_TABLE_HEADERS = [
  "ID",
  "Business Name",
  "Email",
  "Location",
  "Submitted",
  "Status",
  "Actions",
] as const

export const RFQ_TABLE_HEADERS = [
  "RFQ ID",
  "Buyer",
  "Part",
  "Vehicle",
  "Quotes",
  "Status",
] as const

export const ORDER_TABLE_HEADERS = [
  "Order ID",
  "Buyer",
  "Supplier",
  "Amount",
  "Status",
  "Date",
] as const

export const SYSTEM_HEALTH_METRICS: readonly HealthMetric[] = [
  { title: "API Response Time", value: "124ms", note: "Excellent", red: true },
  { title: "Uptime (30d)", value: "99.98%", note: "Target: 99.9%", red: true },
  { title: "Active Sessions", value: "1,247", note: "Real-time users" },
  { title: "Error Rate", value: "0.02%", note: "Within threshold", red: true },
] as const
