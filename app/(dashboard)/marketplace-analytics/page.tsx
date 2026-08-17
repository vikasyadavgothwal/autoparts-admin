import { MarketplaceAnalyticsPage } from "@/components/admin-dashboard/marketplace-intelligence/marketplace-intelligence-pages"
import { getMarketplaceAnalyticsData } from "@/services/admin-dashboard/marketplace-intelligence/marketplace-intelligence-service"

export const dynamic = "force-dynamic"

export default async function MarketplaceAnalyticsRoutePage() {
  const data = await getMarketplaceAnalyticsData()
  return <MarketplaceAnalyticsPage data={data} />
}
