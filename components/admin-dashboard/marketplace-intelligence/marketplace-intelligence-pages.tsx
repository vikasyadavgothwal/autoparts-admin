"use client"

import type { ReactNode } from "react"
import Link from "next/link"
import {
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

import { PageHeading } from "@/components/admin-dashboard/shared/page-heading"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

const tooltipStyle = {
  backgroundColor: "#1A1A1A",
  border: "1px solid #2A2A2A",
  borderRadius: "8px",
  color: "#fff",
}

const vehicleRows = [
  { id: "toyota-corolla", make: "Toyota", model: "Corolla", platform: "E210", years: "2019-2025", coverage: 96 },
  { id: "nissan-patrol", make: "Nissan", model: "Patrol", platform: "Y62", years: "2010-2025", coverage: 91 },
  { id: "bmw-3-series", make: "BMW", model: "3 Series", platform: "G20", years: "2018-2025", coverage: 88 },
  { id: "mercedes-c-class", make: "Mercedes", model: "C-Class", platform: "W206", years: "2021-2025", coverage: 84 },
  { id: "honda-accord", make: "Honda", model: "Accord", platform: "CV", years: "2018-2024", coverage: 79 },
  { id: "hyundai-tucson", make: "Hyundai", model: "Tucson", platform: "NX4", years: "2020-2025", coverage: 76 },
]

type VehicleDatabaseData = {
  metrics: {
    vehicleTotal: number
    vinDecodesToday: number
    cachedVinTotal: number
    fitmentTotal: number
  }
  vehicleRows: typeof vehicleRows
  pagination?: {
    page: number
    pageSize: number
    total: number
    totalPages: number
    search: string
  }
}

type FitmentRulesData = {
  metrics: {
    fitmentTotal: number
    mappedParts: number
    pendingReview: number
    failedMappings: number
    confidence: number
  }
  ruleCards: {
    title: string
    value: number
    detail: string
  }[]
  recentFitments: {
    vehicle: string
    engine: string
    range: string
    source: string
  }[]
}

type MappingData = {
  metrics: Record<string, number>
  rows: {
    number: string
    product: string
    refs: number
    status: string
  }[]
}

type SupplierValidationData = {
  cards: {
    label: string
    value: number
    trend: string
    tone: "success" | "gold" | "red"
    suffix?: string
  }[]
}

type InventoryMappingData = {
  metrics: {
    totalParts: number
    inventoryCoverage: number
    supplierCoverage: number
    needsMapping: number
  }
  coverageRows: {
    make: string
    coverage: number
    missingModels: number
    missingParts: number
  }[]
}

type MarketplaceAnalyticsData = {
  metrics: {
    supplierTotal: number
    inventoryCoverage: number
    mappedParts: number
    needsReview: number
  }
  supplierGrowth: {
    month: string
    suppliers: number
    total: number
  }[]
  healthRows: {
    name: string
    value: number
    color: string
  }[]
}

const formatCompactAmount = (value: number, divisor: number, suffix: string) => {
  const compacted = value / divisor
  const digits = compacted < 10 && compacted % 1 !== 0 ? 1 : 0
  return `${compacted.toFixed(digits).replace(/\.0$/, "")}${suffix}`
}

const formatNumber = (value: number) => {
  const absolute = Math.abs(value)

  if (absolute >= 1_000_000_000) return formatCompactAmount(value, 1_000_000_000, "b")
  if (absolute >= 1_000_000) return formatCompactAmount(value, 1_000_000, "m")
  if (absolute >= 1_000) return formatCompactAmount(value, 1_000, "k")

  return value.toLocaleString()
}

const formatMetricValue = (value: string) => {
  const match = value.trim().match(/^(\d[\d,]*(?:\.\d+)?)([kKmMbB])?$/)
  if (!match) return value

  const amount = Number(match[1].replace(/,/g, ""))
  const suffix = match[2]?.toLowerCase()
  const multiplier = suffix === "b" ? 1_000_000_000 : suffix === "m" ? 1_000_000 : suffix === "k" ? 1_000 : 1

  return formatNumber(amount * multiplier)
}

function IntelligencePageShell({
  title,
  subtitle,
  metrics,
  children,
}: {
  title: string
  subtitle: string
  metrics: { label: string; value: string; detail: string }[]
  children: ReactNode
}) {
  return (
    <div className="space-y-6 pb-24">
      <PageHeading title={title} subtitle={subtitle} />
      {metrics.length ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {metrics.map((item) => (
            <div
              key={item.label}
              className="rounded-lg border border-dashboard-panel-border bg-dashboard-panel-bg p-5"
            >
              <p className="text-sm text-dashboard-muted">{item.label}</p>
              <p className="mt-1 text-2xl font-semibold text-dashboard-text">{formatMetricValue(item.value)}</p>
              <p className="mt-1 text-xs text-dashboard-muted">{item.detail}</p>
            </div>
          ))}
        </div>
      ) : null}
      {children}
    </div>
  )
}

export function VehicleDatabasePage({ data }: { data?: VehicleDatabaseData }) {
  const rows = data ? data.vehicleRows : vehicleRows
  const metrics = data?.metrics
  const pagination = data?.pagination ?? {
    page: 1,
    pageSize: rows.length,
    total: rows.length,
    totalPages: 1,
    search: "",
  }
  const startRow = pagination.total ? (pagination.page - 1) * pagination.pageSize + 1 : 0
  const endRow = Math.min(pagination.total, pagination.page * pagination.pageSize)
  const pageHref = (page: number) => {
    const params = new URLSearchParams()
    if (pagination.search) params.set("q", pagination.search)
    if (page > 1) params.set("page", String(page))
    const query = params.toString()

    return query ? `/vehicle-database?${query}` : "/vehicle-database"
  }

  return (
    <IntelligencePageShell
      title="Vehicle Database"
      subtitle="Authoritative make, model, platform, year, engine, and trim intelligence for the UAE aftermarket."
      metrics={[
        { label: "Total Vehicles", value: String(metrics?.vehicleTotal ?? 0), detail: "Make to trim records" },
        { label: "Decoded VIN History", value: String(metrics?.cachedVinTotal ?? 0), detail: "VINs decoded and saved" },
        { label: "Vehicle-Part Matches", value: String(metrics?.fitmentTotal ?? 0), detail: "Parts linked to cars" },
        { label: "VIN Decodes Today", value: String(metrics?.vinDecodesToday ?? 0), detail: "Admin and marketplace lookups" },
      ]}
    >
      <Card className="border-dashboard-panel-border bg-dashboard-panel-bg shadow-none">
        <CardContent className="flex flex-col gap-4 p-4 md:flex-row md:items-end md:justify-between">
          <form action="/vehicle-database" className="flex w-full flex-col gap-2 md:max-w-xl">
            <label htmlFor="vehicle-search" className="text-sm font-medium text-dashboard-text">
              Search vehicles
            </label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                id="vehicle-search"
                name="q"
                type="search"
                maxLength={80}
                defaultValue={pagination.search}
                placeholder="Search make, model, or platform"
                className="min-h-11 flex-1 rounded-lg border border-dashboard-panel-border bg-dashboard-page-bg px-4 text-sm text-dashboard-text outline-none placeholder:text-dashboard-muted focus:border-dashboard-danger"
              />
              <button
                type="submit"
                className="min-h-11 rounded-lg bg-dashboard-danger px-5 text-sm font-semibold text-white hover:bg-dashboard-danger/90"
              >
                Search
              </button>
              {pagination.search ? (
                <Link
                  href="/vehicle-database"
                  className="flex min-h-11 items-center justify-center rounded-lg border border-dashboard-panel-border px-4 text-sm font-semibold text-dashboard-text hover:bg-dashboard-page-bg"
                >
                  Clear
                </Link>
              ) : null}
            </div>
          </form>
          <div className="text-sm text-dashboard-muted">
            Showing {formatNumber(startRow)}-{formatNumber(endRow)} of {formatNumber(pagination.total)}
          </div>
        </CardContent>
      </Card>

      <Card className="overflow-hidden border-dashboard-panel-border bg-dashboard-panel-bg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="px-5 py-3">Make</TableHead>
              <TableHead className="px-5 py-3">Model</TableHead>
              <TableHead className="px-5 py-3">Platform</TableHead>
              <TableHead className="px-5 py-3">Years</TableHead>
              <TableHead className="px-5 py-3">Coverage</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length ? rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="px-5 py-3 font-semibold text-dashboard-text">{row.make}</TableCell>
                <TableCell className="px-5 py-3 text-dashboard-muted">{row.model || "Multiple"}</TableCell>
                <TableCell className="px-5 py-3 text-dashboard-muted">{row.platform || "Mapped"}</TableCell>
                <TableCell className="px-5 py-3 text-dashboard-muted">{row.years || "1998-2025"}</TableCell>
                <TableCell className="px-5 py-3 font-semibold text-dashboard-accent">{row.coverage}%</TableCell>
              </TableRow>
            )) : (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center text-dashboard-muted">
                  No vehicle records found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        <div className="flex flex-col gap-3 border-t border-dashboard-panel-border p-4 md:flex-row md:items-center md:justify-between">
          <div className="text-sm text-dashboard-muted">
            Page {formatNumber(pagination.page)} of {formatNumber(pagination.totalPages)}
          </div>
          <div className="flex gap-2">
            {pagination.page > 1 ? (
              <Link
                href={pageHref(pagination.page - 1)}
                className="rounded-lg border border-dashboard-panel-border px-4 py-2 text-sm font-semibold text-dashboard-text hover:bg-dashboard-page-bg"
              >
                Previous
              </Link>
            ) : (
              <span className="rounded-lg border border-dashboard-panel-border px-4 py-2 text-sm font-semibold text-dashboard-muted opacity-50">
                Previous
              </span>
            )}
            {pagination.page < pagination.totalPages ? (
              <Link
                href={pageHref(pagination.page + 1)}
                className="rounded-lg border border-dashboard-panel-border px-4 py-2 text-sm font-semibold text-dashboard-text hover:bg-dashboard-page-bg"
              >
                Next
              </Link>
            ) : (
              <span className="rounded-lg border border-dashboard-panel-border px-4 py-2 text-sm font-semibold text-dashboard-muted opacity-50">
                Next
              </span>
            )}
          </div>
        </div>
      </Card>
    </IntelligencePageShell>
  )
}

export function FitmentRulesPage({ data }: { data?: FitmentRulesData }) {
  const metrics = data?.metrics
  const rules = data?.ruleCards ?? []

  return (
    <IntelligencePageShell
      title="Fitment Rules"
      subtitle="Govern how vehicles map to OE numbers, aftermarket references, and validated compatibility outcomes."
      metrics={[
        { label: "Verified Fitments", value: formatNumber(metrics?.fitmentTotal ?? 0), detail: "Master fitment rows" },
        { label: "Mapped Parts", value: formatNumber(metrics?.mappedParts ?? 0), detail: "Approved supplier mappings" },
        { label: "Confidence", value: `${metrics?.confidence ?? 0}%`, detail: "Mapped vs review/failed" },
        { label: "Needs Review", value: formatNumber(metrics?.pendingReview ?? 0), detail: "Manual review queue" },
      ]}
    >
      <div className="grid gap-4 md:grid-cols-3">
        {rules.length ? rules.map((rule, index) => (
          <Card key={rule.title} className="border-dashboard-panel-border bg-dashboard-panel-bg">
            <CardHeader>
              <p className="text-xs font-semibold uppercase text-dashboard-accent">Rule Set 0{index + 1}</p>
              <CardTitle className="text-dashboard-text">{rule.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-dashboard-muted">{rule.detail}</p>
            </CardContent>
          </Card>
        )) : (
          <Card className="border-dashboard-panel-border bg-dashboard-panel-bg md:col-span-3">
            <CardContent className="p-6 text-sm text-dashboard-muted">
            No fitment rule data yet.
            </CardContent>
          </Card>
        )}
      </div>
    </IntelligencePageShell>
  )
}
export function OeMappingPage({ data }: { data?: MappingData }) {
  const metrics = data?.metrics
  const rows = data?.rows ?? []

  return (
    <IntelligencePageShell
      title="OE Mapping"
      subtitle="Connect OEM part numbers to aftermarket alternatives with verified interchange intelligence."
      metrics={[
        { label: "OE References", value: formatNumber(metrics?.oeReferences ?? 0), detail: "Known OEM numbers" },
        { label: "Mapped Products", value: formatNumber(metrics?.mappedProducts ?? 0), detail: "Linked product masters" },
        { label: "Verified", value: `${metrics?.verifiedPercent ?? 0}%`, detail: "Mapped supplier parts" },
        { label: "Pending Review", value: formatNumber(metrics?.pendingReview ?? 0), detail: "Mappings requiring admin" },
      ]}
    >
      <Card className="border-dashboard-panel-border bg-dashboard-panel-bg">
        <CardContent className="p-6">
          {rows.length ? (
            <div className="grid gap-3 md:grid-cols-2">
              {rows.map((row) => (
                <div
                  key={`${row.number}-${row.product}`}
                  className="rounded-lg border border-dashboard-panel-border bg-dashboard-page-bg px-4 py-3"
                >
                  <div className="font-mono text-sm font-bold text-dashboard-accent">{row.number}</div>
                  <div className="mt-1 text-sm font-medium text-dashboard-text">{row.product}</div>
                  <div className="mt-1 text-xs text-dashboard-muted">
                    {formatNumber(row.refs)} cross references · {row.status}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-8 text-center text-sm text-dashboard-muted">No OE mapping data yet.</div>
          )}
        </CardContent>
      </Card>
    </IntelligencePageShell>
  )
}

export function CrossReferencesPage({ data }: { data?: MappingData }) {
  const metrics = data?.metrics
  const confidence = metrics?.confidence ?? 0

  return (
    <IntelligencePageShell
      title="Cross References"
      subtitle="Approved interchange links between OE and aftermarket brands trusted by the DALEEL engine."
      metrics={[
        { label: "Cross References", value: formatNumber(metrics?.crossReferences ?? 0), detail: "Active interchange links" },
        { label: "Confidence Score", value: `${confidence}%`, detail: "Validation score" },
        { label: "Alternative Parts", value: formatNumber(metrics?.alternativeParts ?? 0), detail: "Supplier alternatives" },
        { label: "Rejected Links", value: formatNumber(metrics?.rejectedLinks ?? 0), detail: "Blocked references" },
      ]}
    >
      <GaugeCard
        score={confidence}
        title="Reference Confidence"
        description={`${formatNumber(metrics?.crossReferences ?? 0)} active cross references with continuous AI validation.`}
      />
    </IntelligencePageShell>
  )
}

const formatValidationValue = (card: SupplierValidationData["cards"][number]) =>
  `${formatNumber(card.value)}${card.suffix ?? ""}`

const validationToneClass = (tone: SupplierValidationData["cards"][number]["tone"]) => {
  if (tone === "success") return "text-dashboard-success"
  if (tone === "red") return "text-dashboard-danger"
  return "text-dashboard-warning"
}

export function SupplierValidationPage({ data }: { data?: SupplierValidationData }) {
  const cards = data?.cards ?? []

  return (
    <IntelligencePageShell
      title="Supplier Validation"
      subtitle="Review catalog uploads, approve quality partners, and protect marketplace fitment integrity."
      metrics={[]}
    >
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {cards.length ? cards.map((card) => (
          <div
            key={card.label}
            className="rounded-lg border border-dashboard-panel-border bg-dashboard-panel-bg p-5"
          >
            <div className="text-sm text-dashboard-muted">{card.label}</div>
            <div className="mt-1 text-[34px] font-bold leading-tight text-dashboard-text">
              {formatValidationValue(card)}
            </div>
            <div className={`mt-2 text-xs font-semibold ${validationToneClass(card.tone)}`}>
              {card.trend}
            </div>
          </div>
        )) : (
          <Card className="border-dashboard-panel-border bg-dashboard-panel-bg md:col-span-2 xl:col-span-3">
            <CardContent className="p-6 text-sm text-dashboard-muted">
              No supplier validation data yet.
            </CardContent>
          </Card>
        )}
      </div>
    </IntelligencePageShell>
  )
}

export function InventoryMappingPage({ data }: { data?: InventoryMappingData }) {
  const rows = data?.coverageRows ?? []
  const filterGroups = [
    "All Makes",
    "All Models",
    "All Years",
    "All Engines",
    "All Categories",
    "All Suppliers",
    "GCC / International",
    "All Status",
  ]

  return (
    <IntelligencePageShell
      title="Inventory Mapping"
      subtitle="Align supplier stock positions to verified fitment identities for confident buyer discovery."
      metrics={[]}
    >
      <Card className="border-dashboard-panel-border bg-dashboard-panel-bg shadow-none">
        <CardContent className="flex flex-wrap items-center gap-3 p-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-dashboard-muted">Filters</div>
          {filterGroups.map((filter) => (
            <div
              key={filter}
              className="rounded-lg border border-dashboard-panel-border bg-dashboard-page-bg px-4 py-2 text-sm text-dashboard-text"
            >
              {filter}
            </div>
          ))}
          <div className="ml-auto text-sm text-dashboard-muted">Clear</div>
        </CardContent>
      </Card>
      <Card className="border-dashboard-panel-border bg-dashboard-panel-bg">
        <CardContent className="p-6">
          {rows.length ? (
            <div className="grid min-h-[180px] grid-cols-2 items-end gap-3 md:grid-cols-4 xl:grid-cols-8">
              {rows.map((row) => (
                <div key={row.make} className="flex min-w-0 flex-col items-center gap-2">
                  <div className="text-sm font-semibold text-dashboard-text">{row.coverage}%</div>
                  <div className="flex h-28 w-full items-end overflow-hidden rounded-t-lg bg-dashboard-page-bg">
                    <div
                      className="w-full rounded-t-lg bg-dashboard-accent"
                      style={{ height: `${Math.max(row.coverage, 6)}%` }}
                    />
                  </div>
                  <div className="max-w-full truncate text-xs text-dashboard-muted">{row.make}</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-8 text-center text-sm text-dashboard-muted">No inventory mapping data yet.</div>
          )}
        </CardContent>
      </Card>
    </IntelligencePageShell>
  )
}

export function MarketplaceAnalyticsPage({ data }: { data?: MarketplaceAnalyticsData }) {
  const metrics = data?.metrics
  const supplierGrowth = data?.supplierGrowth ?? []
  const health = data?.healthRows ?? []

  return (
    <IntelligencePageShell
      title="Analytics"
      subtitle="Marketplace health, coverage growth, and conversion intelligence across the UAE ecosystem."
      metrics={[
        { label: "Supplier Growth", value: formatNumber(metrics?.supplierTotal ?? 0), detail: "New suppliers in 6 months" },
        { label: "Marketplace Health", value: `${metrics?.inventoryCoverage ?? 0}%`, detail: "Mapped inventory coverage" },
        { label: "Mapped Parts", value: formatNumber(metrics?.mappedParts ?? 0), detail: "Supplier stock mapped" },
        { label: "Needs Review", value: formatNumber(metrics?.needsReview ?? 0), detail: "Validation backlog" },
      ]}
    >
      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="border-dashboard-panel-border bg-dashboard-panel-bg shadow-none">
          <CardHeader><CardTitle className="text-dashboard-text">Supplier Growth</CardTitle></CardHeader>
          <CardContent>
            {supplierGrowth.length ? (
              <div className="h-[320px] min-w-0">
                <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                  <LineChart data={supplierGrowth}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#2A2A2A" />
                    <XAxis dataKey="month" stroke="#9CA3AF" />
                    <YAxis stroke="#9CA3AF" />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Line dataKey="suppliers" name="New suppliers" stroke="#DC2626" strokeWidth={3} />
                    <Line dataKey="total" name="Running total" stroke="#10B981" strokeWidth={3} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="flex h-[320px] items-center justify-center rounded-lg border border-dashboard-panel-border bg-dashboard-page-bg text-sm text-dashboard-muted">
                No supplier growth data yet.
              </div>
            )}
          </CardContent>
        </Card>
        <Card className="border-dashboard-panel-border bg-dashboard-panel-bg shadow-none">
          <CardHeader><CardTitle className="text-dashboard-text">Marketplace Health</CardTitle></CardHeader>
          <CardContent>
            {health.some((item) => item.value > 0) ? (
              <>
                <div className="h-[260px] min-w-0">
                  <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                    <PieChart>
                      <Pie data={health} dataKey="value" nameKey="name" innerRadius={60} outerRadius={95}>
                        {health.map((item) => <Cell key={item.name} fill={item.color} />)}
                      </Pie>
                      <Tooltip contentStyle={tooltipStyle} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="grid gap-2">
                  {health.map((item) => (
                    <div key={item.name} className="flex items-center justify-between text-sm">
                      <span className="text-dashboard-muted">{item.name}</span>
                      <span className="font-medium text-dashboard-text">{item.value}%</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="flex h-[320px] items-center justify-center rounded-lg border border-dashboard-panel-border bg-dashboard-page-bg text-sm text-dashboard-muted">
                No marketplace health data yet.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </IntelligencePageShell>
  )
}

export function AiIntelligencePage({ data }: { data?: MarketplaceAnalyticsData }) {
  const metrics = data?.metrics
  const score = metrics?.inventoryCoverage ?? 0

  return (
    <IntelligencePageShell
      title="AI Intelligence"
      subtitle="AI validation confidence across fitment, OE, cross-reference, and supplier inventory signals."
      metrics={[
        { label: "AI Confidence", value: `${score}%`, detail: "Marketplace validation score" },
        { label: "Mapped Parts", value: formatNumber(metrics?.mappedParts ?? 0), detail: "Supplier stock mapped" },
        { label: "Needs Review", value: formatNumber(metrics?.needsReview ?? 0), detail: "Manual validation backlog" },
        { label: "Supplier Signals", value: formatNumber(metrics?.supplierTotal ?? 0), detail: "Approved supplier pool" },
      ]}
    >
      <GaugeCard
        score={score}
        title="AI Validation Confidence"
        description="Combined mapping health from supplier inventory, fitment coverage, and review backlog."
      />
    </IntelligencePageShell>
  )
}

function GaugeCard({
  score,
  title,
  description,
}: {
  score: number
  title: string
  description?: string
}) {
  return (
    <Card className="border-dashboard-panel-border bg-dashboard-panel-bg shadow-none">
      <CardHeader><CardTitle className="text-dashboard-text">{title}</CardTitle></CardHeader>
      <CardContent>
        <div className="flex h-[240px] items-center justify-center">
          <div className="flex size-40 items-center justify-center rounded-full border-[14px] border-dashboard-accent bg-dashboard-page-bg">
            <div className="text-center">
              <p className="text-3xl font-bold text-dashboard-text">{score}%</p>
              <p className="mt-1 text-xs text-dashboard-muted">AI verified</p>
            </div>
          </div>
        </div>
        {description ? (
          <p className="mt-4 text-center text-sm text-dashboard-muted">{description}</p>
        ) : null}
      </CardContent>
    </Card>
  )
}
