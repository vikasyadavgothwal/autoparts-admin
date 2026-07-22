import { PartsMappingPage } from "@/components/admin-dashboard/parts-mapping/parts-mapping-page"
import { listMappedCatalogPartsPage } from "@/services/parts-mapping"

export default async function PartsMappingRoutePage() {
  const result = await listMappedCatalogPartsPage({ page: 1, pageSize: 10 })

  return <PartsMappingPage initialParts={result.parts} initialPagination={result.pagination} />
}
