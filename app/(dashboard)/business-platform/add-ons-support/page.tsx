import { BusinessWorkflowsManager } from "@/components/admin-dashboard/business/business-workflows-manager"
import {
  getAdminBusinessWorkflowCounts,
  listAdminBusinessAddOnRequestsPage,
  listAdminBusinessSupportTicketsPage,
} from "@/services/business/business-platform-service"

export const dynamic = "force-dynamic"

type SearchParams = Promise<Record<string, string | string[] | undefined>>
const value = (input: string | string[] | undefined) => typeof input === "string" ? input : ""

export default async function AdminBusinessPlatformWorkflowsPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams
  const queue = value(params.queue) === "add-ons" ? "add-ons" : "tickets"
  const page = Math.max(1, Number.parseInt(value(params.page), 10) || 1)
  const filters = {
    query: value(params.query),
    status: value(params.status),
    accountType: value(params.accountType),
  }
  const [counts, addOns, tickets] = await Promise.all([
    getAdminBusinessWorkflowCounts(),
    queue === "add-ons"
      ? listAdminBusinessAddOnRequestsPage({ ...filters, page, pageSize: 20 })
      : Promise.resolve({ items: [], total: 0, page: 1, pageSize: 20, totalPages: 1 }),
    queue === "tickets"
      ? listAdminBusinessSupportTicketsPage({ ...filters, page, pageSize: 20 })
      : Promise.resolve({ items: [], total: 0, page: 1, pageSize: 20, totalPages: 1 }),
  ])

  return <BusinessWorkflowsManager queue={queue} counts={counts} addOns={addOns} tickets={tickets} filters={filters} />
}
