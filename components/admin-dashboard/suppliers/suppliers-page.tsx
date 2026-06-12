import { SuppliersSection } from "./suppliers-section"
import { SuppliersStatCards } from "./suppliers-stat-cards"
import { SuppliersTable } from "./suppliers-table"
import { Button } from "@/components/ui/button"
import {
  SUPPLIER_ALERTS,
  SUPPLIER_COLUMNS,
  SUPPLIER_KPIS,
  SUPPLIERS,
} from "@/services/admin-dashboard/suppliers/suppliers-data"

export function SuppliersPage() {
  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Supplier Management</h1>
          <p className="text-[#9CA3AF]">Review and manage supplier applications.</p>
        </div>
        <Button type="button">Save</Button>
      </div>

      <SuppliersStatCards items={SUPPLIER_KPIS} />

      <SuppliersSection items={SUPPLIER_ALERTS} />

      <SuppliersTable rows={SUPPLIERS} columns={SUPPLIER_COLUMNS} />
    </div>
  )
}
