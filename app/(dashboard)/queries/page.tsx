import { QueriesPage } from "@/components/admin-dashboard/queries/queries-page"
import { listAdminBusinessQueries } from "@/actions/business-queries/business-queries"
import type {
  BusinessQueryPagination,
  BusinessQueryRecord,
  BusinessQuerySummary,
} from "@/types/business-queries/business-queries"

export const dynamic = "force-dynamic"

const toClientQueries = (
  queries: BusinessQueryRecord[],
): BusinessQueryRecord[] =>
  queries.map((query) => ({
    ...query,
    createdAt: new Date(query.createdAt).toISOString(),
    updatedAt: new Date(query.updatedAt).toISOString(),
  }))

export default async function AdminQueriesPage() {
  const result = await listAdminBusinessQueries({ page: 1, pageSize: 500 })
  const queries = toClientQueries(result.queries as BusinessQueryRecord[])
  return (
    <QueriesPage
      initialQueries={queries}
      initialPagination={result.pagination as BusinessQueryPagination}
      initialSummary={result.summary as BusinessQuerySummary}
    />
  )
}
