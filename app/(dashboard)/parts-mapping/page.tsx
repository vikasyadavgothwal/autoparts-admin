import { PartsMappingPage } from "@/components/admin-dashboard/parts-mapping/parts-mapping-page"
import { listSupplierParts } from "@/services/parts-mapping/parts-mapping-service"

export default async function PartsMappingRoutePage() {
  const parts = await listSupplierParts({ limit: 250 })

  return <PartsMappingPage initialParts={parts} />
}
