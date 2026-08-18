import Link from "next/link"

import { PartSearchCharts } from "@/components/admin-dashboard/part-searches/part-search-charts"
import { PartSearchFilters } from "@/components/admin-dashboard/part-searches/part-search-filters"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  getMarketplaceSearchAnalytics,
  type MarketplaceSearchTablePage,
} from "@/services/marketplace-searches/marketplace-searches-service"

type PartSearchesPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

const formatDate = (date: Date) =>
  new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date)

const getParam = (
  params: Record<string, string | string[] | undefined> | undefined,
  key: string,
) => {
  const value = params?.[key]

  return Array.isArray(value) ? value[0] ?? "" : value ?? ""
}

const getPageParam = (
  params: Record<string, string | string[] | undefined> | undefined,
) => {
  const page = Number.parseInt(getParam(params, "page"), 10)

  return Number.isFinite(page) && page > 0 ? page : 1
}

const buildPageHref = (
  currentParams: Record<string, string | string[] | undefined> | undefined,
  page: number,
) => {
  const params = new URLSearchParams()

  for (const [paramKey, value] of Object.entries(currentParams ?? {})) {
    const paramValue = Array.isArray(value) ? value[0] : value
    if (paramValue && paramKey !== "page") params.set(paramKey, paramValue)
  }

  params.set("page", String(page))
  return `/part-searches?${params.toString()}`
}

const PageButton = ({
  currentParams,
  disabled,
  label,
  page,
}: {
  currentParams: Record<string, string | string[] | undefined> | undefined
  disabled: boolean
  label: string
  page: number
}) =>
  disabled ? (
    <Button variant="outline" size="sm" disabled>
      {label}
    </Button>
  ) : (
    <Button asChild variant="outline" size="sm">
      <Link href={buildPageHref(currentParams, page)}>{label}</Link>
    </Button>
  )

const SearchDataTable = ({
  currentParams,
  table,
}: {
  currentParams: Record<string, string | string[] | undefined> | undefined
  table: MarketplaceSearchTablePage
}) => (
  <div className="space-y-4">
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Search query</TableHead>
          <TableHead>Type</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Normalized key</TableHead>
          <TableHead>Created</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {table.rows.length ? (
          table.rows.map((row) => (
            <TableRow key={row.id}>
              <TableCell className="max-w-[380px] whitespace-normal font-medium">
                {row.searchedNumber}
              </TableCell>
              <TableCell>{row.queryType}</TableCell>
              <TableCell>
                <Badge variant={row.isUnavailable ? "destructive" : "secondary"}>
                  {row.resultLabel}
                </Badge>
              </TableCell>
              <TableCell className="max-w-[260px] whitespace-normal text-muted-foreground">
                {row.normalizedNumber}
              </TableCell>
              <TableCell>{formatDate(row.createdAt)}</TableCell>
            </TableRow>
          ))
        ) : (
          <TableRow>
            <TableCell colSpan={5} className="h-28 text-center text-muted-foreground">
              No search data matches these filters.
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>

    <div className="flex flex-col gap-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
      <span>
        Page {table.page} of {table.pageCount} - {table.total} rows
      </span>
      <div className="flex gap-2">
        <PageButton
          currentParams={currentParams}
          disabled={table.page <= 1}
          label="Previous"
          page={table.page - 1}
        />
        <PageButton
          currentParams={currentParams}
          disabled={table.page >= table.pageCount}
          label="Next"
          page={table.page + 1}
        />
      </div>
    </div>
  </div>
)

export default async function PartSearchesPage({
  searchParams,
}: PartSearchesPageProps) {
  const params = await searchParams
  const analytics = await getMarketplaceSearchAnalytics({
    page: getPageParam(params),
    query: getParam(params, "q").slice(0, 120),
    queryType: getParam(params, "type"),
    status: getParam(params, "status"),
  })
  const unavailableRate = analytics.total
    ? Math.round((analytics.unavailable / analytics.total) * 100)
    : 0

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Part Searches</h1>
          <p className="text-sm text-muted-foreground">
            Search demand, availability gaps, VIN lookups, OEM terms, and part-name queries.
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader>
            <CardDescription>Total searches</CardDescription>
            <CardTitle className="text-3xl">{analytics.total}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Available</CardDescription>
            <CardTitle className="text-3xl">{analytics.available}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Not available</CardDescription>
            <CardTitle className="text-3xl">{analytics.unavailable}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Gap rate</CardDescription>
            <CardTitle className="text-3xl">{unavailableRate}%</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Search Performance</CardTitle>
          <CardDescription>Daily search volume, result status, and query type mix.</CardDescription>
        </CardHeader>
        <CardContent>
          <PartSearchCharts
            statusChart={analytics.statusChart}
            trendChart={analytics.trendChart}
            typeChart={analytics.typeChart}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Search Data</CardTitle>
          <CardDescription>Filter and review every logged search query.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <PartSearchFilters
            query={analytics.filters.query}
            queryType={analytics.filters.queryType}
            status={analytics.filters.status}
          />

          <SearchDataTable currentParams={params} table={analytics.table} />
        </CardContent>
      </Card>
    </div>
  )
}
