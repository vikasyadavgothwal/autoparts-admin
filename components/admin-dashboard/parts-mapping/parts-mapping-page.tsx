"use client"

import { useState } from "react"
import { Eye, Search } from "lucide-react"

import { PageHeading } from "@/components/admin-dashboard/shared/page-heading"
import { StatusBadge } from "@/components/admin-dashboard/shared/status-badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { MappedCatalogPartRecord } from "@/types/parts-mapping/parts-mapping"

type PartsMappingPageProps = {
  initialParts: MappedCatalogPartRecord[]
  initialPagination: PartsPagination
}

type PartsPagination = {
  page: number
  pageSize: number
  total: number
  totalPages: number
}

const displayList = (values: string[]) => values.join(", ") || "-"

const getImageUrl = (part: MappedCatalogPartRecord) => {
  const imageKey = part.imageKeys[0]
  if (imageKey) {
    return `/api/v1/admin/parts/product-image?key=${encodeURIComponent(imageKey)}`
  }

  return part.imageUrls[0] ?? null
}

export function PartsMappingPage({
  initialParts,
  initialPagination,
}: PartsMappingPageProps) {
  const [parts, setParts] = useState(initialParts)
  const [pagination, setPagination] = useState(initialPagination)
  const [query, setQuery] = useState("")
  const [partToView, setPartToView] = useState<MappedCatalogPartRecord | null>(null)
  const [loadError, setLoadError] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  const loadParts = async (page: number, search: string = query) => {
    setIsLoading(true)
    setLoadError("")
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: "10",
        q: search.trim(),
      })
      const response = await fetch(`/api/v1/admin/parts/pending-review?${params}`, {
        cache: "no-store",
      })
      const payload = await response.json() as {
        ok: boolean
        parts?: MappedCatalogPartRecord[]
        pagination?: PartsPagination
        message?: string
      }
      if (!response.ok || !payload.ok || !payload.parts || !payload.pagination) {
        throw new Error(payload.message ?? "Unable to load mapped OEM parts")
      }
      setParts(payload.parts)
      setPagination(payload.pagination)
    } catch (error) {
      setLoadError(
        error instanceof Error ? error.message : "Unable to load mapped OEM parts",
      )
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeading
        title="Mapped OEM Parts"
        subtitle="View unique mapped master parts by OEM number. Supplier duplicate rows are grouped under the mapped catalog part."
      />

      <Card className="border border-dashboard-panel-border">
        <CardHeader className="gap-4 border-b border-dashboard-panel-border lg:flex lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-medium text-foreground">Master catalog view</p>
            <p className="text-xs text-dashboard-muted">One row per mapped catalog part.</p>
          </div>
          <form
            className="flex w-full gap-2 lg:max-w-md"
            onSubmit={(event) => {
              event.preventDefault()
              void loadParts(1)
            }}
          >
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-dashboard-muted" />
              <Input
                value={query}
                maxLength={120}
                onChange={(event) => setQuery(event.target.value.slice(0, 120))}
                placeholder="Search OEM or part name"
                className="h-9 pl-9"
              />
            </div>
            <Button type="submit" size="sm" disabled={isLoading}>Search</Button>
            {query ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  setQuery("")
                  void loadParts(1, "")
                }}
              >
                Clear
              </Button>
            ) : null}
          </form>
        </CardHeader>

        <CardContent className="px-0">
          {loadError ? (
            <p className="mx-4 mb-3 rounded-md border border-dashboard-danger/30 bg-dashboard-danger/10 p-3 text-sm text-dashboard-danger">
              {loadError}
            </p>
          ) : null}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="px-4">OEM No</TableHead>
                <TableHead>Part Name</TableHead>
                <TableHead>Brand / Category</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="px-4 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {parts.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="h-32 text-center text-dashboard-muted"
                  >
                    No mapped OEM parts match this view.
                  </TableCell>
                </TableRow>
              ) : (
                parts.map((part) => (
                  <TableRow key={part.partUid}>
                    <TableCell className="px-4">
                      <div className="max-w-xs text-sm font-medium text-foreground">
                        {displayList(part.oemNumbers)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <p className="font-medium text-foreground">
                          {part.partName ?? part.heading ?? "Mapped part"}
                        </p>
                        {part.partNumber ? (
                          <p className="text-xs text-dashboard-muted">
                            Part no: {part.partNumber}
                          </p>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1 text-sm">
                        <p>{part.brandName ?? "No brand"}</p>
                        <p className="text-xs text-dashboard-muted">
                          {part.category ?? "No category"}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <StatusBadge label="Mapped" tone="success" />
                    </TableCell>
                    <TableCell className="px-4 text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setPartToView(part)}
                      >
                        <Eye />
                        View
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          <div className="flex flex-col gap-3 border-t border-dashboard-panel-border px-4 py-4 text-sm text-dashboard-muted sm:flex-row sm:items-center sm:justify-between">
            <p>
              Showing {parts.length ? (pagination.page - 1) * pagination.pageSize + 1 : 0}-
              {Math.min(pagination.page * pagination.pageSize, pagination.total)} of {pagination.total} parts
            </p>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={isLoading || pagination.page <= 1}
                onClick={() => void loadParts(pagination.page - 1)}
              >
                Previous
              </Button>
              <span>Page {pagination.page} of {pagination.totalPages}</span>
              <Button
                size="sm"
                variant="outline"
                disabled={isLoading || pagination.page >= pagination.totalPages}
                onClick={() => void loadParts(pagination.page + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog
        open={partToView !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPartToView(null)
          }
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Mapped part details</DialogTitle>
            <DialogDescription>
              View-only master catalog details for this mapped OEM part.
            </DialogDescription>
          </DialogHeader>

          {partToView ? (
            <div className="space-y-5">
              {getImageUrl(partToView) ? (
                <div
                  role="img"
                  aria-label={partToView.partName ?? "Mapped part image"}
                  className="aspect-video rounded-lg border bg-cover bg-center"
                  style={{ backgroundImage: `url(${getImageUrl(partToView)})` }}
                />
              ) : null}

              <div className="grid gap-3 rounded-lg border p-4 text-sm sm:grid-cols-2">
                <p><strong>Name:</strong> {partToView.partName ?? "-"}</p>
                <p><strong>Heading:</strong> {partToView.heading ?? "-"}</p>
                <p><strong>OEM:</strong> {displayList(partToView.oemNumbers)}</p>
                <p><strong>Brand:</strong> {partToView.brandName ?? "-"}</p>
                <p><strong>Category:</strong> {partToView.category ?? "-"}</p>
                <p><strong>Status:</strong> Mapped</p>
                <p><strong>Supplier records:</strong> {partToView.supplierPartCount}</p>
                <p><strong>Source:</strong> {partToView.source}</p>
              </div>

              {partToView.description ? (
                <div className="rounded-lg border p-4 text-sm">
                  <p className="mb-2 font-medium">Description</p>
                  <p className="text-dashboard-muted">{partToView.description}</p>
                </div>
              ) : null}

              {partToView.keyFeatures.length ? (
                <div className="rounded-lg border p-4 text-sm">
                  <p className="mb-2 font-medium">Key features</p>
                  <ul className="list-disc space-y-1 pl-5 text-dashboard-muted">
                    {partToView.keyFeatures.map((feature) => (
                      <li key={feature}>{feature}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          ) : null}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setPartToView(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
