import { BusinessWorkflowsManager } from "@/components/admin-dashboard/business/business-workflows-manager"
import {
  getAdminBusinessWorkflowCounts,
  listAdminBusinessAddOnRequestsPage,
} from "@/services/business/business-platform-service"

export const dynamic = "force-dynamic"

type SearchParams = Promise<Record<string, string | string[] | undefined>>
const value = (input: string | string[] | undefined) => typeof input === "string" ? input : ""
const emptyPage = { items: [], total: 0, page: 1, pageSize: 20, totalPages: 1 }

export default async function AdminBusinessPlatformAddOnRequestsPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams
  const page = Math.max(1, Number.parseInt(value(params.page), 10) || 1)
  const filters = {
    query: value(params.query),
    status: value(params.status),
    accountType: value(params.accountType),
  }
  const [counts, addOns] = await Promise.all([
    getAdminBusinessWorkflowCounts(),
    listAdminBusinessAddOnRequestsPage({ ...filters, page, pageSize: 20 }),
  ])

  return <BusinessWorkflowsManager view="requests" queue="add-ons" requestMode="single" counts={counts} addOns={addOns} tickets={emptyPage} filters={filters} />
}
