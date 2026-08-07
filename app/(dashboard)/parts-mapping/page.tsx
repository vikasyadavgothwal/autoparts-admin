import { PartsMappingPage } from "@/components/admin-dashboard/parts-mapping/parts-mapping-page"
import { listMappedCatalogPartsPage } from "@/services/parts-mapping"

export const dynamic = "force-dynamic"

export default async function PartsMappingRoutePage() {
  const result = await listMappedCatalogPartsPage({ page: 1, pageSize: 10 })

  return <PartsMappingPage initialParts={result.parts} initialPagination={result.pagination} />
}
