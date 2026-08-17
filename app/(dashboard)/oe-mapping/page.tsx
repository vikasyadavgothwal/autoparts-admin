import { OeMappingPage } from "@/components/admin-dashboard/marketplace-intelligence/marketplace-intelligence-pages"
import { getOeMappingData } from "@/services/admin-dashboard/marketplace-intelligence/marketplace-intelligence-service"

export const dynamic = "force-dynamic"

export default async function OeMappingRoutePage() {
  const data = await getOeMappingData()
  return <OeMappingPage data={data} />
}
