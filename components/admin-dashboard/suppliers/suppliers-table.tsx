"use client"

import { useState, useTransition } from "react"
import { Check, CircleX, Eye } from "lucide-react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { StatusBadge } from "@/components/admin-dashboard/shared/status-badge"
import { SectionTable } from "@/components/admin-dashboard/shared/section-table"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import type { StatusTone } from "@/types/admin-dashboard/shared/status-badge"
import type { SectionTableColumn } from "@/types/admin-dashboard/shared/section-table"
import type { SupplierTableProps } from "@/types/admin-dashboard/suppliers/suppliers-table"
import type {
  SupplierRecord,
  SupplierStatus,
} from "@/types/admin-dashboard/suppliers/suppliers-types"

const SUPPLIER_STATUS_TONES: Record<SupplierStatus, StatusTone> = {
  Approved: "success",
  Pending: "warning",
  Rejected: "danger",
}

type ReviewTarget = {
  supplier: SupplierRecord
  status: Exclude<SupplierStatus, "Pending">
}

const detailRows = (supplier: SupplierRecord) => [
  ["Supplier ID", supplier.id],
  ["Account ID", supplier.accountId],
  ["Business name", supplier.name],
  ["Contact person", supplier.contactName],
  ["Email", supplier.email],
  ["Mobile", supplier.phone],
  ["Address", supplier.address],
  ["City", supplier.city],
  ["State", supplier.state],
  ["Postal code", supplier.postalCode],
  ["Country", supplier.country],
  ["Products uploaded", String(supplier.products)],
  ["Joined", supplier.joined],
  ["Last login", supplier.lastLogin],
  ["Email verified", supplier.emailVerified ? "Yes" : "No"],
  ["Account status", supplier.accountActive ? "Active" : "Suspended"],
  ["Reviewed by", supplier.reviewedBy],
  ["Reviewed on", supplier.reviewedAt],
] as const

export function SuppliersTable({ rows, columns }: SupplierTableProps) {
  const router = useRouter()
  const [viewingSupplier, setViewingSupplier] = useState<SupplierRecord | null>(
    null,
  )
  const [reviewTarget, setReviewTarget] = useState<ReviewTarget | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleReview() {
    if (!reviewTarget) return
    setError(null)

    startTransition(async () => {
      const response = await fetch(
        `/api/v1/admin/suppliers/${reviewTarget.supplier.internalId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: reviewTarget.status }),
        },
      )
      const payload = (await response.json().catch(() => null)) as
        | { message?: string }
        | null

      if (!response.ok) {
        const message = payload?.message ?? "Unable to update supplier"
        setError(message)
        toast.error(message)
        return
      }

      toast.success(
        reviewTarget.status === "Approved"
          ? `${reviewTarget.supplier.id} approved. Its products can now appear in the marketplace.`
          : `${reviewTarget.supplier.id} rejected. Its products are hidden from the marketplace.`,
      )
      setReviewTarget(null)
      router.refresh()
    })
  }

  return (
    <>
      <SectionTable columns={columns as readonly SectionTableColumn[]}>
        {rows.length === 0 ? (
          <tr className="dashboard-table-row">
            <td
              className="dashboard-table-cell text-center text-dashboard-muted"
              colSpan={columns.length}
            >
              No supplier accounts found.
            </td>
          </tr>
        ) : null}

        {rows.map((supplier) => (
          <tr key={supplier.internalId} className="dashboard-table-row">
            <td className="dashboard-table-cell">
              <span className="font-medium text-dashboard-accent">
                {supplier.id}
              </span>
            </td>
            <td className="dashboard-table-cell text-dashboard-text">
              <div className="font-medium">{supplier.name}</div>
              <div className="text-xs text-dashboard-muted">
                {supplier.contactName}
              </div>
            </td>
            <td className="dashboard-table-cell text-dashboard-muted">
              {supplier.email}
            </td>
            <td className="dashboard-table-cell text-dashboard-muted">
              {supplier.phone}
            </td>
            <td className="dashboard-table-cell text-dashboard-muted">
              {supplier.products}
            </td>
            <td className="dashboard-table-cell text-dashboard-muted">
              {supplier.rating}
            </td>
            <td className="dashboard-table-cell text-dashboard-muted">
              {supplier.joined}
            </td>
            <td className="dashboard-table-cell">
              <StatusBadge
                label={supplier.status}
                tone={SUPPLIER_STATUS_TONES[supplier.status]}
              />
            </td>
            <td className="dashboard-table-cell">
              <div className="flex items-center gap-2">
                <Button
                  size="icon-sm"
                  variant="outline"
                  title="View supplier"
                  aria-label={`View ${supplier.name}`}
                  onClick={() => setViewingSupplier(supplier)}
                >
                  <Eye className="h-4 w-4" />
                </Button>
                {supplier.status !== "Approved" ? (
                  <Button
                    size="icon-sm"
                    variant="outline"
                    title="Approve supplier"
                    aria-label={`Approve ${supplier.name}`}
                    disabled={isPending}
                    className="border-dashboard-success/30 hover:bg-dashboard-success/10 hover:text-dashboard-success"
                    onClick={() =>
                      setReviewTarget({ supplier, status: "Approved" })
                    }
                  >
                    <Check className="h-4 w-4" />
                  </Button>
                ) : null}
                {supplier.status !== "Rejected" ? (
                  <Button
                    size="icon-sm"
                    variant="outline"
                    title="Reject supplier"
                    aria-label={`Reject ${supplier.name}`}
                    disabled={isPending}
                    className="border-dashboard-danger/30 hover:bg-dashboard-danger/10 hover:text-dashboard-danger"
                    onClick={() =>
                      setReviewTarget({ supplier, status: "Rejected" })
                    }
                  >
                    <CircleX className="h-4 w-4" />
                  </Button>
                ) : null}
              </div>
            </td>
          </tr>
        ))}
      </SectionTable>

      <Dialog
        open={Boolean(viewingSupplier)}
        onOpenChange={(open) => {
          if (!open) setViewingSupplier(null)
        }}
      >
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{viewingSupplier?.name}</DialogTitle>
            <DialogDescription>
              {viewingSupplier?.id} supplier account information
            </DialogDescription>
          </DialogHeader>

          {viewingSupplier ? (
            <div className="max-h-[65vh] overflow-y-auto border-y border-dashboard-panel-border">
              <dl className="grid sm:grid-cols-2">
                {detailRows(viewingSupplier).map(([label, value]) => (
                  <div
                    key={label}
                    className="border-b border-dashboard-panel-border px-3 py-3 last:border-b-0 sm:odd:border-r"
                  >
                    <dt className="text-xs text-dashboard-muted">{label}</dt>
                    <dd className="mt-1 break-words text-sm font-medium text-dashboard-text">
                      {value}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          ) : null}

          <DialogFooter>
            <Button type="button" onClick={() => setViewingSupplier(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(reviewTarget)}
        onOpenChange={(open) => {
          if (!open && !isPending) {
            setReviewTarget(null)
            setError(null)
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {reviewTarget?.status === "Approved"
                ? "Approve supplier?"
                : "Reject supplier?"}
            </DialogTitle>
            <DialogDescription>
              {reviewTarget?.status === "Approved"
                ? `${reviewTarget.supplier.name}'s mapped products and offers will become visible on the main website.`
                : `${reviewTarget?.supplier.name ?? "This supplier"}'s products and offers will be removed from the main website.`}
            </DialogDescription>
          </DialogHeader>

          {error ? (
            <p className="text-sm font-medium text-dashboard-danger">{error}</p>
          ) : null}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={isPending}
              onClick={() => setReviewTarget(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant={reviewTarget?.status === "Rejected" ? "destructive" : "default"}
              disabled={isPending}
              onClick={handleReview}
            >
              {isPending ? "Saving..." : reviewTarget?.status}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
