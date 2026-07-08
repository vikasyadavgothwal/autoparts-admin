import { RfqsLivePage, type AdminRfq } from "@/components/admin-dashboard/rfqs/rfqs-live-page"
import { listAdminRfqs } from "@/services/fleet/fleet-service"

export default async function FleetRfqsPage() {
  const { rfqs } = await listAdminRfqs()
  const serialized = JSON.parse(JSON.stringify(rfqs)) as AdminRfq[]
  return <RfqsLivePage initialRfqs={serialized} />
}
