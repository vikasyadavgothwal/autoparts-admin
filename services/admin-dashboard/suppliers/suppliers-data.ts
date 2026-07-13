import type {
  SupplierTableColumn,
} from "@/types/admin-dashboard/suppliers/suppliers-types"

export const SUPPLIER_COLUMNS: readonly SupplierTableColumn[] = [
  { key: "id", label: "ID", className: "w-[9%]" },
  { key: "name", label: "Supplier Name", className: "w-[16%]" },
  { key: "email", label: "Email", className: "w-[17%]" },
  { key: "phone", label: "Phone", className: "w-[12%]" },
  { key: "products", label: "Products", className: "w-[8%]" },
  { key: "rating", label: "Rating", className: "w-[7%]" },
  { key: "joined", label: "Joined", className: "w-[10%]" },
  { key: "status", label: "Status", className: "w-[10%]" },
  { key: "actions", label: "Actions", className: "w-[11%]" },
]
