"use client"

import * as React from "react"
import { Eye, FileQuestion, Inbox, MoreHorizontal, Search, Trash2 } from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type {
  BusinessQueryListResult,
  BusinessQueryPagination,
  BusinessQueryRecord,
  BusinessQuerySummary,
} from "@/types/business-queries/business-queries"

type QueriesPageProps = {
  initialQueries: BusinessQueryRecord[]
  initialPagination: BusinessQueryPagination
  initialSummary: BusinessQuerySummary
}

const TYPE_OPTIONS = [
  { value: "all", label: "All query types" },
  { value: "BookDemo", label: "Book a demo" },
  { value: "ScheduleDemo", label: "Schedule a demo" },
  { value: "Contact", label: "Contact" },
  { value: "Sales", label: "Sales" },
  { value: "FleetDemo", label: "Fleet demo" },
  { value: "General", label: "General" },
] as const

const STATUS_OPTIONS = [
  { value: "all", label: "All statuses" },
  { value: "New", label: "New" },
  { value: "Reviewed", label: "Reviewed" },
  { value: "Archived", label: "Archived" },
] as const

const PAGE_SIZE_OPTIONS = ["50", "100", "250", "500", "1000"] as const

const typeLabel = (type: string) =>
  TYPE_OPTIONS.find((item) => item.value === type)?.label ?? type

const dateLabel = (value: string) =>
  new Date(value).toLocaleString("en-AE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })

const wrapTextClass = "min-w-0 break-words [overflow-wrap:anywhere]"

function DetailField({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <p className={wrapTextClass}>
      <span className="text-[#9CA3AF]">{label}:</span> {value || "-"}
    </p>
  )
}

async function fetchQueries(params: {
  page: number
  pageSize: number
  search: string
  type: string
  status: string
}) {
  const searchParams = new URLSearchParams({
    page: String(params.page),
    pageSize: String(params.pageSize),
  })

  if (params.search.trim()) searchParams.set("search", params.search.trim())
  if (params.type !== "all") searchParams.set("type", params.type)
  if (params.status !== "all") searchParams.set("status", params.status)

  const response = await fetch(`/api/v1/admin/queries?${searchParams}`, {
    cache: "no-store",
    credentials: "include",
  })
  const payload = (await response.json()) as
    | ({ ok: true } & BusinessQueryListResult)
    | { ok: false; message?: string }

  if (!response.ok || payload.ok !== true) {
    throw new Error(
      "message" in payload && payload.message
        ? payload.message
        : "Unable to load queries",
    )
  }

  return payload
}

async function markQueryReviewed(id: string) {
  const response = await fetch(`/api/v1/admin/queries/${encodeURIComponent(id)}`, {
    method: "PATCH",
    cache: "no-store",
    credentials: "include",
  })
  const payload = (await response.json().catch(() => null)) as
    | { ok?: boolean; query?: BusinessQueryRecord; message?: string }
    | null

  if (!response.ok || !payload?.ok || !payload.query) {
    throw new Error(payload?.message || "Unable to update query")
  }

  return payload.query
}

export function QueriesPage({
  initialQueries,
  initialPagination,
  initialSummary,
}: QueriesPageProps) {
  const [queries, setQueries] = React.useState(initialQueries)
  const [pagination, setPagination] = React.useState(initialPagination)
  const [summary, setSummary] = React.useState(initialSummary)
  const [search, setSearch] = React.useState("")
  const [type, setType] = React.useState("all")
  const [status, setStatus] = React.useState("all")
  const [pageSize, setPageSize] = React.useState(String(initialPagination.pageSize))
  const [selected, setSelected] = React.useState<BusinessQueryRecord | null>(null)
  const [deletingQuery, setDeletingQuery] = React.useState<BusinessQueryRecord | null>(null)
  const [loading, setLoading] = React.useState(false)
  const [deleting, setDeleting] = React.useState(false)
  const [error, setError] = React.useState("")

  const load = React.useCallback(
    async (nextPage: number, overrides: Partial<{ search: string; type: string; status: string; pageSize: string }> = {}) => {
      setLoading(true)
      setError("")
      try {
        const payload = await fetchQueries({
          page: nextPage,
          pageSize: Number.parseInt(overrides.pageSize ?? pageSize, 10),
          search: overrides.search ?? search,
          type: overrides.type ?? type,
          status: overrides.status ?? status,
        })
        setQueries(payload.queries)
        setPagination(payload.pagination)
        setSummary(payload.summary)
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Unable to load queries")
      } finally {
        setLoading(false)
      }
    },
    [pageSize, search, status, type],
  )

  const handleTypeChange = (value: string) => {
    setType(value)
    void load(1, { type: value })
  }

  const handleStatusChange = (value: string) => {
    setStatus(value)
    void load(1, { status: value })
  }

  const handlePageSizeChange = (value: string) => {
    setPageSize(value)
    void load(1, { pageSize: value })
  }

  const handleViewQuery = async (query: BusinessQueryRecord) => {
    setSelected(query)
    if (query.status !== "New") return

    try {
      const reviewedQuery = await markQueryReviewed(query.id)
      setSelected((current) => current?.id === reviewedQuery.id ? reviewedQuery : current)
      setQueries((current) =>
        current.map((item) => item.id === reviewedQuery.id ? reviewedQuery : item),
      )
      setSummary((current) => ({
        ...current,
        newCount: Math.max(0, current.newCount - 1),
        reviewedCount: current.reviewedCount + 1,
      }))
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : "Unable to mark query as reviewed")
    }
  }

  const handleDelete = async () => {
    if (!deletingQuery) return

    setDeleting(true)
    setError("")
    try {
      const response = await fetch(`/api/v1/admin/queries/${deletingQuery.id}`, {
        method: "DELETE",
        cache: "no-store",
        credentials: "include",
      })
      const payload = (await response.json().catch(() => null)) as
        | { ok?: boolean; message?: string }
        | null

      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.message || "Unable to delete query")
      }

      toast.success(`${deletingQuery.publicId} deleted`)
      setDeletingQuery(null)
      if (selected?.id === deletingQuery.id) setSelected(null)
      const nextPage =
        queries.length === 1 && pagination.page > 1
          ? pagination.page - 1
          : pagination.page
      await load(nextPage)
    } catch (caught) {
      const message =
        caught instanceof Error ? caught.message : "Unable to delete query"
      setError(message)
      toast.error(message)
    } finally {
      setDeleting(false)
    }
  }

  const stats = [
    { title: "Total Queries", value: summary.total, icon: Inbox, color: "text-[#DC2626]" },
    { title: "New", value: summary.newCount, icon: FileQuestion, color: "text-green-400" },
    {
      title: "Demo Requests",
      value:
        (summary.byType.BookDemo ?? 0) +
        (summary.byType.ScheduleDemo ?? 0) +
        (summary.byType.FleetDemo ?? 0),
      icon: FileQuestion,
      color: "text-blue-400",
    },
    { title: "Sales / Contact", value: (summary.byType.Sales ?? 0) + (summary.byType.Contact ?? 0), icon: FileQuestion, color: "text-yellow-400" },
  ]

  return (
    <div className="space-y-8">
      <div>
        <h1 className="mb-2 text-3xl font-bold text-white">Queries</h1>
        <p className="text-[#9CA3AF]">
          Review demo, sales, contact, and fleet requests submitted from the business page.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
        {stats.map(({ title, value, icon: Icon, color }) => (
          <Card key={title} className="border-[#2A2A2A] bg-[#1A1A1A] p-0">
            <CardContent className="p-6">
              <div className="mb-2 flex items-center gap-3 text-sm text-[#9CA3AF]">
                <Icon className={`h-5 w-5 ${color}`} />
                {title}
              </div>
              <div className="text-3xl font-bold text-white">{value.toLocaleString("en-AE")}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-3 lg:grid-cols-[minmax(260px,1fr)_180px_170px_150px]">
        <form
          className="flex gap-2"
          onSubmit={(event) => {
            event.preventDefault()
            void load(1)
          }}
        >
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9CA3AF]" />
            <Input
              value={search}
              maxLength={120}
              onChange={(event) => setSearch(event.target.value.slice(0, 120))}
              placeholder="Search name, email, phone, company, source..."
              className="h-10 border-[#2A2A2A] bg-[#1A1A1A] pl-9 text-white"
            />
          </div>
          <Button type="submit" disabled={loading}>
            Search
          </Button>
        </form>

        <Select value={type} onValueChange={handleTypeChange}>
          <SelectTrigger className="h-10 w-full border-[#2A2A2A] bg-[#1A1A1A] text-white">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TYPE_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={status} onValueChange={handleStatusChange}>
          <SelectTrigger className="h-10 w-full border-[#2A2A2A] bg-[#1A1A1A] text-white">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={pageSize} onValueChange={handlePageSizeChange}>
          <SelectTrigger className="h-10 w-full border-[#2A2A2A] bg-[#1A1A1A] text-white">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PAGE_SIZE_OPTIONS.map((option) => (
              <SelectItem key={option} value={option}>
                {option} per page
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {search || type !== "all" || status !== "all" ? (
        <Button
          type="button"
          variant="outline"
          className="border-[#2A2A2A] text-white"
          onClick={() => {
            setSearch("")
            setType("all")
            setStatus("all")
            void load(1, { search: "", type: "all", status: "all" })
          }}
        >
          Clear filters
        </Button>
      ) : null}

      {error ? <p className="text-sm text-red-400">{error}</p> : null}

      <Card className="overflow-hidden border-[#2A2A2A] bg-[#1A1A1A] p-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1040px] text-sm">
            <thead className="bg-[#0A0A0A] text-[#9CA3AF]">
              <tr>
                <th className="p-4 text-left">Query ID</th>
                <th className="p-4 text-left">Type</th>
                <th className="p-4 text-left">Name</th>
                <th className="p-4 text-left">Company</th>
                <th className="p-4 text-left">Contact</th>
                <th className="p-4 text-left">Source</th>
                <th className="p-4 text-left">Date</th>
                <th className="p-4 text-left">Action</th>
              </tr>
            </thead>
            <tbody>
              {queries.map((query) => (
                <tr key={query.id} className="border-t border-[#2A2A2A] text-white hover:bg-[#242424]">
                  <td className="p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-[#DC2626]">{query.publicId}</span>
                      {query.status === "New" ? (
                        <Badge className="bg-green-500/15 text-green-300 hover:bg-green-500/15">
                          New
                        </Badge>
                      ) : null}
                    </div>
                  </td>
                  <td className="p-4">{typeLabel(query.type)}</td>
                  <td className="max-w-[180px] p-4 whitespace-normal break-words [overflow-wrap:anywhere]">{query.name}</td>
                  <td className="max-w-[220px] p-4 whitespace-normal break-words [overflow-wrap:anywhere]">{query.company}</td>
                  <td className="max-w-[240px] p-4 whitespace-normal break-words [overflow-wrap:anywhere]">
                    <p className="break-words [overflow-wrap:anywhere]">{query.email}</p>
                    {query.phone ? <p className="text-xs text-[#9CA3AF]">{query.phone}</p> : null}
                  </td>
                  <td className="max-w-[180px] p-4 whitespace-normal break-words text-[#9CA3AF] [overflow-wrap:anywhere]">{query.source}</td>
                  <td className="p-4 text-[#9CA3AF]">{dateLabel(query.createdAt)}</td>
                  <td className="p-4">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          type="button"
                          size="icon"
                          variant="outline"
                          disabled={deleting}
                          className="border-[#2A2A2A] bg-[#1A1A1A] text-white hover:bg-[#2A2A2A]"
                          aria-label={`Actions for ${query.publicId}`}
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-36">
                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                        <DropdownMenuItem onSelect={() => void handleViewQuery(query)}>
                          <Eye className="h-4 w-4" />
                          View
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          variant="destructive"
                          onSelect={() => setDeletingQuery(query)}
                        >
                          <Trash2 className="h-4 w-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!queries.length && !loading ? (
          <p className="p-8 text-center text-[#9CA3AF]">No queries found.</p>
        ) : null}
      </Card>

      <div className="flex flex-col gap-3 text-sm text-[#9CA3AF] sm:flex-row sm:items-center sm:justify-between">
        <p>
          Showing {queries.length ? (pagination.page - 1) * pagination.pageSize + 1 : 0}
          -{Math.min(pagination.page * pagination.pageSize, pagination.total)} of{" "}
          {pagination.total.toLocaleString("en-AE")}
        </p>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={loading || pagination.page <= 1}
            onClick={() => void load(pagination.page - 1)}
          >
            Previous
          </Button>
          <span>
            Page {pagination.page} of {pagination.totalPages}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={loading || pagination.page >= pagination.totalPages}
            onClick={() => void load(pagination.page + 1)}
          >
            Next
          </Button>
        </div>
      </div>

      <Dialog open={Boolean(selected)} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-h-[92vh] max-w-[calc(100vw-2rem)] overflow-y-auto overflow-x-hidden border-[#2A2A2A] bg-[#151515] text-white sm:max-w-3xl">
          <DialogHeader className="min-w-0">
            <DialogTitle className={wrapTextClass}>{selected?.publicId}</DialogTitle>
            <DialogDescription className={wrapTextClass}>
              {selected ? `${typeLabel(selected.type)} from ${selected.company}` : ""}
            </DialogDescription>
          </DialogHeader>
          {selected ? (
            <div className="space-y-5">
              <div className="grid min-w-0 gap-3 rounded-lg border border-[#2A2A2A] bg-[#1A1A1A] p-4 text-sm md:grid-cols-2">
                <DetailField label="Name" value={selected.name} />
                <DetailField label="Company" value={selected.company} />
                <DetailField label="Email" value={selected.email} />
                <DetailField label="Phone" value={selected.phone || "-"} />
                <DetailField label="Source" value={selected.source} />
                <DetailField label="Status" value={selected.status} />
                <DetailField label="Page" value={selected.pagePath || "-"} />
                <DetailField label="Created" value={dateLabel(selected.createdAt)} />
              </div>
              <div className="min-w-0 rounded-lg border border-[#2A2A2A] bg-[#1A1A1A] p-4">
                <h3 className="mb-2 text-sm font-semibold text-white">Message</h3>
                <p className="whitespace-pre-wrap break-words text-sm leading-6 text-[#D1D5DB] [overflow-wrap:anywhere]">
                  {selected.message || "No message provided."}
                </p>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(deletingQuery)}
        onOpenChange={(open) => {
          if (!open && !deleting) {
            setDeletingQuery(null)
            setError("")
          }
        }}
      >
        <DialogContent className="border-[#2A2A2A] bg-[#151515] text-white">
          <DialogHeader>
            <DialogTitle>Delete query?</DialogTitle>
            <DialogDescription>
              This will permanently delete {deletingQuery?.publicId ?? "this query"} from the admin query list.
            </DialogDescription>
          </DialogHeader>

          {error ? <p className="text-sm text-red-400">{error}</p> : null}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={deleting}
              onClick={() => {
                setDeletingQuery(null)
                setError("")
              }}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={deleting}
              onClick={handleDelete}
            >
              {deleting ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
