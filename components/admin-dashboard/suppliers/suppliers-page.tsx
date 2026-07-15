import { SuppliersSection } from "./suppliers-section"
import { SuppliersStatCards } from "./suppliers-stat-cards"
import { SuppliersTable } from "./suppliers-table"
import { PageHeading } from "@/components/admin-dashboard/shared/page-heading"
import { SUPPLIER_COLUMNS } from "@/services/admin-dashboard/suppliers/suppliers-data"
import {
  buildSupplierAlerts,
  buildSupplierKpis,
  listAdminSuppliers,
} from "@/services/admin-dashboard/suppliers/supplier-management-service"

export async function SuppliersPage() {
  const suppliers = await listAdminSuppliers()

  return (
    <div className="space-y-8">
      <PageHeading
        title="Supplier Management"
        subtitle="Review supplier accounts and control marketplace approval."
      />

      <SuppliersStatCards items={buildSupplierKpis(suppliers)} />

      <SuppliersSection items={buildSupplierAlerts(suppliers)} />

      <SuppliersTable rows={suppliers} columns={SUPPLIER_COLUMNS} />
    </div>
  )
}
