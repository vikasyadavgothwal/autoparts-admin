import { PartsMappingPage } from "@/components/admin-dashboard/parts-mapping/parts-mapping-page"
import { listSupplierPartsPage } from "@/services/parts-mapping/parts-mapping-service"

export default async function PartsMappingRoutePage() {
  const result = await listSupplierPartsPage({ page: 1, pageSize: 10 })

  return <PartsMappingPage initialParts={result.parts} initialPagination={result.pagination} />
}
