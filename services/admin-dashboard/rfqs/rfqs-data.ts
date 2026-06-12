
import {
  Clock,
  DollarSign,
  FileText,
  Users,
} from "lucide-react"
import type {
  PartCategory,
  RfqRecord,
  RfqStat,
  RfqStatus,
  TrendMetric,
} from "@/types/admin-dashboard/rfqs/rfqs-data"

export const RFQ_STATUS_OPTIONS = ["Active", "Awarded", "Closed", "Expired"] as const

export const RFQ_FLEET_OPTIONS = [
  "City Transit Co.",
  "Logistics Express",
  "Delivery Solutions",
] as const

export const RFQ_COLUMNS = [
  "RFQ ID",
  "Fleet",
  "Part Name",
  "Est. Value",
  "Bids",
  "Best Bid",
  "Created",
  "Deadline",
  "Status",
  "",
] as const

export const RFQS: readonly RfqRecord[] = [
  {
    id: "RFQ-1847",
    fleet: "City Transit Co.",
    part: "Brake Pads Set",
    quantity: 50,
    estimatedValue: "$12,500",
    bids: 12,
    bestBid: "$245/unit",
    created: "2024-01-20",
    deadline: "2024-01-27",
    status: "Active",
  },
  {
    id: "RFQ-1846",
    fleet: "Logistics Express",
    part: "Engine Oil Filter",
    quantity: 100,
    estimatedValue: "$3,200",
    bids: 8,
    bestBid: "$31/unit",
    created: "2024-01-19",
    deadline: "2024-01-26",
    status: "Active",
  },
  {
    id: "RFQ-1845",
    fleet: "Delivery Solutions",
    part: "Air Filter",
    quantity: 75,
    estimatedValue: "$4,875",
    bids: 15,
    bestBid: "$63/unit",
    created: "2024-01-18",
    deadline: "2024-01-25",
    status: "Awarded",
  },
  {
    id: "RFQ-1844",
    fleet: "Metro Cabs",
    part: "Spark Plugs",
    quantity: 200,
    estimatedValue: "$8,400",
    bids: 10,
    bestBid: "$41/unit",
    created: "2024-01-17",
    deadline: "2024-01-24",
    status: "Active",
  },
  {
    id: "RFQ-1843",
    fleet: "City Transit Co.",
    part: "Wiper Blades",
    quantity: 120,
    estimatedValue: "$3,600",
    bids: 6,
    bestBid: "$29/unit",
    created: "2024-01-16",
    deadline: "2024-01-23",
    status: "Closed",
  },
]

export const RFQ_STATS: readonly RfqStat[] = [
  {
    title: "Total RFQs",
    value: "5",
    icon: FileText,
    color: "text-[#DC2626]",
  },
  {
    title: "Active RFQs",
    value: "3",
    icon: Clock,
    color: "text-blue-500",
  },
  {
    title: "Total Bids",
    value: "51",
    icon: Users,
    color: "text-green-500",
  },
  {
    title: "Total Value",
    value: "$32.6K",
    icon: DollarSign,
    color: "text-yellow-500",
  },
]

export const RFQ_TRENDS: readonly TrendMetric[] = [
  { label: "Avg Bids per RFQ", value: "10.2" },
  { label: "Avg RFQ Value", value: "$6515" },
  { label: "Award Rate", value: "68%", valueClass: "text-green-500" },
]

export const RFQ_TOP_CATEGORIES: readonly PartCategory[] = [
  { label: "Brake Components", value: "24%" },
  { label: "Engine Parts", value: "19%" },
  { label: "Filters", value: "15%" },
  { label: "Electrical", value: "12%" },
]

export const RFQ_STATUS_CLASS: Record<RfqStatus, string> = {
  Active: "border-blue-500/20 bg-blue-500/10 text-blue-500",
  Awarded: "border-green-500/20 bg-green-500/10 text-green-500",
  Closed: "border-gray-500/20 bg-gray-500/10 text-gray-400",
  Expired: "border-red-500/20 bg-red-500/10 text-red-500",
}
