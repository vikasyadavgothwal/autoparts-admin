import { Clock, DollarSign, Package, TrendingUp } from "lucide-react"
import type {
  DeliveryPerformanceItem,
  OrderAlert,
  OrderDistributionItem,
  OrderRecord,
  OrdersFilterOption,
  OrdersKpi,
  OrdersTableColumn,
} from "@/types/admin-dashboard/orders/orders-types"

export const ORDER_STATUS_FILTER_OPTIONS: readonly OrdersFilterOption[] = [
  { value: "all", label: "All Status" },
  { value: "processing", label: "Processing" },
  { value: "shipped", label: "Shipped" },
  { value: "delivered", label: "Delivered" },
  { value: "cancelled", label: "Cancelled" },
]

export const ORDER_BUYER_TYPE_FILTER_OPTIONS: readonly OrdersFilterOption[] = [
  { value: "all", label: "All Buyer Types" },
  { value: "individual", label: "Individual" },
  { value: "fleet", label: "Fleet" },
  { value: "garage", label: "Garage" },
]

export const ORDERS_KPIS: readonly OrdersKpi[] = [
  {
    id: "total-orders",
    title: "Total Orders",
    value: "5",
    icon: Package,
    iconTone: "primary",
  },
  {
    id: "delivered",
    title: "Delivered",
    value: "2",
    icon: TrendingUp,
    iconTone: "success",
  },
  {
    id: "revenue",
    title: "Total Revenue",
    value: "$20.9K",
    icon: DollarSign,
    iconTone: "info",
  },
  {
    id: "aov",
    title: "Avg Order Value",
    value: "$5236",
    icon: Clock,
    iconTone: "warning",
  },
]

export const ORDER_TABLE_COLUMNS: readonly OrdersTableColumn[] = [
  { key: "id", label: "Order ID", className: "w-[11%]" },
  { key: "buyer", label: "Buyer", className: "w-[18%]" },
  { key: "supplier", label: "Supplier", className: "w-[15%]" },
  { key: "part", label: "Part Name", className: "w-[16%]" },
  { key: "amount", label: "Amount", className: "w-[10%]" },
  { key: "orderDate", label: "Order Date", className: "w-[10%]" },
  { key: "deliveryDate", label: "Delivery", className: "w-[10%]" },
  { key: "status", label: "Status", className: "w-[10%]" },
  { key: "actions", label: "", className: "w-[10%]" },
]

export const ORDERS: readonly OrderRecord[] = [
  {
    id: "ORD-5678",
    buyer: "City Transit Co.",
    buyerType: "Fleet",
    supplier: "Premium Auto Parts",
    part: "Brake Pads Set",
    quantity: 50,
    amount: "$12,450",
    orderDate: "2024-01-22",
    deliveryDate: "2024-01-25",
    status: "Delivered",
  },
  {
    id: "ORD-5677",
    buyer: "John Doe",
    buyerType: "Individual",
    supplier: "QuickShip Parts",
    part: "Oil Filter",
    quantity: 2,
    amount: "$48",
    orderDate: "2024-01-21",
    deliveryDate: "2024-01-24",
    status: "Shipped",
  },
  {
    id: "ORD-5676",
    buyer: "AutoFix Garage",
    buyerType: "Garage",
    supplier: "Global Auto Supply",
    part: "Air Filter",
    quantity: 10,
    amount: "$245",
    orderDate: "2024-01-20",
    deliveryDate: "2024-01-23",
    status: "Processing",
  },
  {
    id: "ORD-5675",
    buyer: "Logistics Express",
    buyerType: "Fleet",
    supplier: "Premium Auto Parts",
    part: "Spark Plugs",
    quantity: 200,
    amount: "$8,200",
    orderDate: "2024-01-19",
    deliveryDate: "2024-01-22",
    status: "Delivered",
  },
  {
    id: "ORD-5674",
    buyer: "Jane Smith",
    buyerType: "Individual",
    supplier: "Budget Parts Direct",
    part: "Wiper Blades",
    quantity: 1,
    amount: "$32",
    orderDate: "2024-01-18",
    deliveryDate: "2024-01-21",
    status: "Cancelled",
  },
]

export const ORDER_DISTRIBUTION: readonly OrderDistributionItem[] = [
  { label: "Fleet Orders", value: "45%" },
  { label: "Individual Orders", value: "35%" },
  { label: "Garage Orders", value: "20%" },
]

export const ORDER_DELIVERY_PERFORMANCE: readonly DeliveryPerformanceItem[] = [
  { label: "On-Time Delivery", value: "94%", tone: "success" },
  { label: "Avg Delivery Time", value: "2.3 days", tone: "neutral" },
  { label: "Cancellation Rate", value: "3.2%", tone: "warning" },
]

export const ORDER_ALERTS: readonly OrderAlert[] = [
  { message: "3 orders delayed", tone: "warning" },
  { message: "2 disputes pending", tone: "danger" },
  { message: "5 refund requests", tone: "info" },
]
