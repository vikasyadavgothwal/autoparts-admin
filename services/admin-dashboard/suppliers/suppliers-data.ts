import { Check, CircleX, Store } from "lucide-react"
import type {
  SupplierKpi,
  SupplierMetric,
  SupplierRecord,
  SupplierTableColumn,
} from "@/types/admin-dashboard/suppliers/suppliers-types"

export const SUPPLIER_KPIS: readonly SupplierKpi[] = [
  {
    id: "total",
    title: "Total Suppliers",
    value: "4",
    icon: Store,
    iconTone: "primary",
  },
  {
    id: "approved",
    title: "Approved",
    value: "2",
    icon: Check,
    iconTone: "success",
  },
  {
    id: "pending",
    title: "Pending Review",
    value: "1",
    icon: CircleX,
    iconTone: "warning",
  },
  {
    id: "products",
    title: "Total Products",
    value: "801",
    icon: Check,
    iconTone: "primary",
  },
]

export const SUPPLIER_ALERTS: readonly SupplierMetric[] = [
  {
    message: "1 supplier(s) awaiting review.",
  },
]

export const SUPPLIER_COLUMNS: readonly SupplierTableColumn[] = [
  { key: "id", label: "ID", className: "w-[8%]" },
  { key: "name", label: "Supplier Name", className: "w-[18%]" },
  { key: "email", label: "Email", className: "w-[18%]" },
  { key: "phone", label: "Phone", className: "w-[12%]" },
  { key: "products", label: "Products", className: "w-[10%]" },
  { key: "rating", label: "Rating", className: "w-[8%]" },
  { key: "joined", label: "Joined", className: "w-[10%]" },
  { key: "status", label: "Status", className: "w-[10%]" },
  { key: "actions", label: "Actions", className: "w-[6%]" },
]

export const SUPPLIERS: readonly SupplierRecord[] = [
  {
    id: "SUP-001",
    name: "Acme Auto Parts",
    email: "contact@acmeauto.com",
    phone: "(555) 123-4567",
    products: 234,
    rating: "4.8 ⭐",
    joined: "2023-06-15",
    status: "Approved",
  },
  {
    id: "SUP-002",
    name: "Premium Parts Co",
    email: "info@premiumparts.com",
    phone: "(555) 234-5678",
    products: 0,
    rating: "N/A",
    joined: "2024-01-20",
    status: "Pending",
  },
  {
    id: "SUP-003",
    name: "QuickParts Supply",
    email: "support@quickparts.com",
    phone: "(555) 345-6789",
    products: 567,
    rating: "4.6 ⭐",
    joined: "2023-08-22",
    status: "Approved",
  },
  {
    id: "SUP-004",
    name: "AutoZone Wholesale",
    email: "wholesale@autozone.com",
    phone: "(555) 456-7890",
    products: 0,
    rating: "N/A",
    joined: "2024-01-18",
    status: "Rejected",
  },
]
