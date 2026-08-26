import { Button } from "@/components/ui/button"
import { PageHeading } from "@/components/admin-dashboard/shared/page-heading"
import {
  GARAGE_FILTERS,
  GARAGE_LOCATIONS,
  GARAGE_TABLE_COLUMNS,
  GARAGE_VERIFICATION,
} from "@/services/admin-dashboard/garages/garages-data"
import {
  buildGarageKpis,
  listAdminGarages,
} from "@/services/admin-dashboard/garages/garage-management-service"
import { GaragesFilters } from "./garages-filters"
import { GaragesStatCards } from "./garages-stat-cards"
import { GaragesTable } from "./garages-table"

export async function GaragesPage() {
  const garages = await listAdminGarages()
  const kpis = buildGarageKpis(garages)

  return (
    <div className="space-y-8">
      <PageHeading
        title="Garage Management"
        subtitle="Oversee all garages on the platform."
        action={
          <Button className="bg-dashboard-accent hover:bg-dashboard-accent-soft">
            Add New Garage
          </Button>
        }
      />

      <GaragesStatCards items={kpis} />

      <GaragesFilters
        statusOptions={GARAGE_FILTERS}
        locationOptions={GARAGE_LOCATIONS}
        verificationOptions={GARAGE_VERIFICATION}
      />

      <GaragesTable rows={garages} columns={GARAGE_TABLE_COLUMNS} />

    </div>
  )
}
