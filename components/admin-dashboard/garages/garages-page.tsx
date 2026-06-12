import { Button } from "@/components/ui/button"
import { PageHeading } from "@/components/admin-dashboard/shared/page-heading"
import {
  GARAGE_ACTIVITIES,
  GARAGE_FILTERS,
  GARAGE_KPIS,
  GARAGE_LOCATIONS,
  GARAGE_TABLE_COLUMNS,
  GARAGES,
  GARAGE_VERIFICATION,
} from "@/services/admin-dashboard/garages/garages-data"
import { GaragesActivity } from "./garages-section"
import { GaragesFilters } from "./garages-filters"
import { GaragesStatCards } from "./garages-stat-cards"
import { GaragesTable } from "./garages-table"

export function GaragesPage() {
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

      <GaragesStatCards items={GARAGE_KPIS} />

      <GaragesFilters
        statusOptions={GARAGE_FILTERS}
        locationOptions={GARAGE_LOCATIONS}
        verificationOptions={GARAGE_VERIFICATION}
      />

      <GaragesTable rows={GARAGES} columns={GARAGE_TABLE_COLUMNS} />

      <GaragesActivity items={GARAGE_ACTIVITIES} />
    </div>
  )
}
