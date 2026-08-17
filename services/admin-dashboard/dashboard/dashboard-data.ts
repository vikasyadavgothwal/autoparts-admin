
import {
  Bot,
  Building2,
  Car,
  DollarSign,
  FileText,
  GitBranch,
  Hash,
  Package,
  ShoppingCart,
  ShieldCheck,
  ScanLine,
  TrendingUp,
  Users,
  Wrench,
} from "lucide-react"
import { db } from "@/lib/database/prisma"
import {
  PartNumberType,
  SupplierApprovalStatus,
  SupplierPartMappingStatus,
  UserRole,
} from "@/lib/generated/prisma/client"
import type {
  DashboardStat,
  HealthMetric,
  OrderRecord,
  RFQRecord,
  SupplierRecord,
} from "@/types/admin-dashboard/dashboard/dashboard-data"

const startOfToday = () => {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), now.getDate())
}

const compactNumber = (value: number) => {
  const abs = Math.abs(value)
  const units = [
    { limit: 1_000_000_000, suffix: "b" },
    { limit: 1_000_000, suffix: "m" },
    { limit: 1_000, suffix: "k" },
  ]
  const unit = units.find((item) => abs >= item.limit)

  if (!unit) return value.toLocaleString("en-US")

  const compacted = value / unit.limit
  const digits = compacted < 10 && compacted % 1 !== 0 ? 1 : 0
  return `${compacted.toFixed(digits).replace(/\.0$/, "")}${unit.suffix}`
}

const pct = (value: number, total: number) =>
  total > 0 ? Math.min(100, Math.round((value / total) * 1000) / 10) : 0

export async function getFitmentIntelligenceDashboardData() {
  const today = startOfToday()
  const [
    totalVehicles,
    totalParts,
    vinDecodesToday,
    verifiedFitments,
    supplierCoverage,
    oeReferences,
    crossReferences,
    supplierParts,
    mappedSupplierParts,
    latestVin,
    topVehicle,
  ] = await Promise.all([
    db.vehicleLookup.count(),
    db.partMaster.count(),
    db.vinLookupCache.count({ where: { updatedAt: { gte: today } } }),
    db.masterFitment.count(),
    db.user.count({
      where: {
        OR: [{ roles: { has: UserRole.Supplier } }, { activeRole: UserRole.Supplier }],
        supplierApprovalStatus: SupplierApprovalStatus.Approved,
      },
    }),
    db.partNumberIndex.count({ where: { numberType: PartNumberType.oem } }),
    db.partNumberIndex.count({ where: { numberType: { not: PartNumberType.oem } } }),
    db.supplierPart.count(),
    db.supplierPart.count({ where: { mappingStatus: SupplierPartMappingStatus.mapped } }),
    db.vinLookupCache.findFirst({ orderBy: { updatedAt: "desc" } }),
    db.vehicleLookup.findFirst({ orderBy: [{ make: "asc" }, { model: "asc" }] }),
  ])

  const confidence = pct(mappedSupplierParts, supplierParts)
  const vehicleMake = latestVin?.make ?? topVehicle?.make ?? "Not available"
  const vehicleModel = latestVin?.model ?? topVehicle?.model ?? "Not available"

  return {
    kpis: [
      { title: "Total Vehicles", value: compactNumber(totalVehicles), note: "Vehicle database", icon: Car },
      { title: "Total Parts", value: compactNumber(totalParts), note: "Product masters", icon: Package },
      { title: "VIN Decodes Today", value: compactNumber(vinDecodesToday), note: "Live decode activity", icon: ScanLine },
      { title: "Verified Fitments", value: `${pct(mappedSupplierParts, supplierParts)}%`, note: "Mapped supplier inventory", icon: ShieldCheck },
      { title: "Supplier Coverage", value: compactNumber(supplierCoverage), note: "Approved suppliers", icon: Users },
      { title: "OE References", value: compactNumber(oeReferences), note: "OEM indexed numbers", icon: Hash },
      { title: "Cross References", value: compactNumber(crossReferences), note: "Interchange signals", icon: GitBranch },
      { title: "AI Confidence Score", value: `${confidence}%`, note: "Mapping confidence", icon: Bot },
    ],
    vin: {
      sample: latestVin?.vin ?? "JTDBR32E720123456",
      decoded: latestVin
        ? [latestVin.year, latestVin.make, latestVin.model].filter(Boolean).join(" ")
        : "Ready for live VIN decode",
    },
    vehicle: {
      make: vehicleMake,
      model: vehicleModel,
      engine: latestVin?.engine ?? latestVin?.engineCapacity ?? "Not available",
      fitments: compactNumber(verifiedFitments),
    },
  }
}

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
