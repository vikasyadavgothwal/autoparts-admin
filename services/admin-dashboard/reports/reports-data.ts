import {
  Download,
  TrendingUp,
} from "lucide-react"
import {
  Bar,
  Cell,
  LineChart,
  PieChart,
  YAxis,
} from "recharts"
import type {
  DistributionEntry,
  GrowthPoint,
  MiniCard,
  Metric,
  ReportAction,
  RevenueCategory,
} from "@/types/admin-dashboard/reports/reports-data"

export const REPORT_METRICS: readonly Metric[] = [
  {
    title: "Total Revenue (6mo)",
    value: "$439K",
    icon: Download,
    iconClass: "text-green-500",
    note: "10.3%",
    subNote: "vs last month",
  },
  {
    title: "Total Users",
    value: "2,650",
    icon: TrendingUp,
    iconClass: "text-[#DC2626]",
    subText: "Across all user types",
  },
  {
    title: "Total Orders",
    value: "3484",
    icon: Bar,
    iconClass: "text-blue-500",
    subText: "Last 6 months",
  },
  {
    title: "Avg Order Value",
    value: "$126",
    icon: YAxis,
    iconClass: "text-yellow-500",
    subText: "+12% increase",
    subClass: "text-green-500",
  },
] as const

export const REPORT_GROWTH_DATA: readonly GrowthPoint[] = [
  { month: "Jan", users: 1250, orders: 340, revenue: 45600 },
  { month: "Feb", users: 1480, orders: 425, revenue: 58900 },
  { month: "Mar", users: 1720, orders: 512, revenue: 67320 },
  { month: "Apr", users: 2050, orders: 628, revenue: 78430 },
  { month: "May", users: 2380, orders: 745, revenue: 89540 },
  { month: "Jun", users: 2650, orders: 834, revenue: 98740 },
]

export const REPORT_USER_DISTRIBUTION: readonly DistributionEntry[] = [
  { name: "Individual Buyers", value: 45, color: "#DC2626" },
  { name: "Fleet Managers", value: 25, color: "#3B82F6" },
  { name: "Garages", value: 18, color: "#10B981" },
  { name: "Suppliers", value: 12, color: "#F59E0B" },
] as const

export const REPORT_REVENUE_CATEGORY: readonly RevenueCategory[] = [
  { name: "Parts Sales", revenue: 245000 },
  { name: "RFQ Commissions", revenue: 89200 },
  { name: "Service Bookings", revenue: 67800 },
  { name: "Subscriptions", revenue: 34500 },
] as const

export const REPORT_MINI_CARDS: readonly MiniCard[] = [
  {
    icon: LineChart,
    iconClass: "text-blue-500",
    title: "User Engagement",
    rows: [
      ["Active Users (30d)", "2,145"],
      ["Daily Active", "847"],
      ["Retention Rate", "78%", "text-green-500"],
    ],
  },
  {
    icon: PieChart,
    iconClass: "text-green-500",
    title: "Service Network",
    rows: [
      ["Active Garages", "47"],
      ["Active Suppliers", "156"],
      ["Avg Response Time", "2.3 hrs"],
    ],
  },
  {
    icon: Cell,
    iconClass: "text-yellow-500",
    title: "RFQ Performance",
    rows: [
      ["Active RFQs", "89"],
      ["Avg Bids per RFQ", "8.3"],
      ["Award Rate", "72%", "text-green-500"],
    ],
  },
] as const

export const REPORT_ACTIONS: readonly ReportAction[] = [
  {
    title: "Financial Summary",
    description: "Complete breakdown of revenue, commissions, and payouts",
  },
  {
    title: "User Analytics",
    description: "Detailed insights on user behavior and engagement patterns",
  },
  {
    title: "Platform Performance",
    description: "System health, uptime metrics, and technical KPIs",
  },
] as const
