import {
  QueriesPage,
} from "@/components/admin-dashboard/queries/queries-page"
import { listAdminBusinessQueries } from "@/actions/business-queries/business-queries"
import type {
  BusinessQueryPagination,
  BusinessQueryRecord,
  BusinessQuerySummary,
} from "@/types/business-queries/business-queries"

export const dynamic = "force-dynamic"

export default async function AdminQueriesPage() {
  const result = await listAdminBusinessQueries({ page: 1, pageSize: 500 })
  const queries = JSON.parse(JSON.stringify(result.queries)) as BusinessQueryRecord[]
  return (
    <QueriesPage
      initialQueries={queries}
      initialPagination={result.pagination as BusinessQueryPagination}
      initialSummary={result.summary as BusinessQuerySummary}
    />
  )
}
