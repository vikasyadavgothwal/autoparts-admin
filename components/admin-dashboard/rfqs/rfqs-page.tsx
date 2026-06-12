import { RfqFilterBar, RfqInfoCards, RfqPageHeader, RfqStatCards, RfqTable } from "./rfqs-components"
import { Button } from "@/components/ui/button"
import {
  RFQ_COLUMNS,
  RFQ_FLEET_OPTIONS,
  RFQ_STATS,
  RFQ_STATUS_OPTIONS,
  RFQ_TRENDS,
  RFQ_TOP_CATEGORIES,
  RFQS,
} from "@/services/admin-dashboard/rfqs/rfqs-data"

export function RfqsPage() {
  return (
    <div className="space-y-8">
      <RfqPageHeader
        title="RFQ Management"
        subtitle="Monitor all Request for Quote activity across the platform."
        action={<Button type="button">Save</Button>}
      />

      <RfqStatCards items={RFQ_STATS} />

      <RfqFilterBar statusOptions={RFQ_STATUS_OPTIONS} fleetOptions={RFQ_FLEET_OPTIONS} />

      <RfqTable columns={RFQ_COLUMNS} rows={RFQS} />

      <RfqInfoCards trendItems={RFQ_TRENDS} categories={RFQ_TOP_CATEGORIES} />
    </div>
  )
}
