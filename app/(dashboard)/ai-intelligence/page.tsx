import { AiIntelligencePage } from "@/components/admin-dashboard/marketplace-intelligence/marketplace-intelligence-pages"
import { getMarketplaceAnalyticsData } from "@/services/admin-dashboard/marketplace-intelligence/marketplace-intelligence-service"

export const dynamic = "force-dynamic"

export default async function AiIntelligenceRoutePage() {
  const data = await getMarketplaceAnalyticsData()

  return <AiIntelligencePage data={data} />
}
