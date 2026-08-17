import { BusinessWorkflowsManager } from "@/components/admin-dashboard/business/business-workflows-manager"
import { getAdminBusinessWorkflowCounts } from "@/services/business/business-platform-service"

export const dynamic = "force-dynamic"

const emptyPage = { items: [], total: 0, page: 1, pageSize: 20, totalPages: 1 }

export default async function AdminBusinessPlatformAddOnPricingPage() {
  const counts = await getAdminBusinessWorkflowCounts()

  return (
    <BusinessWorkflowsManager
      view="pricing"
      queue="add-ons"
      counts={counts}
      addOns={emptyPage}
      tickets={emptyPage}
      filters={{ query: "", status: "", accountType: "" }}
    />
  )
}
