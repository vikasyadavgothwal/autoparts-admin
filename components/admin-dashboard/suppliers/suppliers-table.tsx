"use client"

import { useState, useTransition } from "react"
import { Check, CircleX, Eye, Star } from "lucide-react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { StatusBadge } from "@/components/admin-dashboard/shared/status-badge"
import { SectionTable } from "@/components/admin-dashboard/shared/section-table"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
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
  SupplierDocumentView,
  SupplierRecord,
  SupplierStatus,
} from "@/types/admin-dashboard/suppliers/suppliers-types"

const SUPPLIER_STATUS_TONES: Record<SupplierStatus, StatusTone> = {
  Approved: "success",
  Pending: "warning",
  Rejected: "danger",
}
const RequiredMark = () => <span aria-hidden="true" className="text-dashboard-danger"> *</span>

type ReviewTarget = {
  supplier: SupplierRecord
  status: Exclude<SupplierStatus, "Pending">
}

type DetailRow = readonly [label: string, value: string | number | null]

type DetailSection = {
  title: string
  rows: DetailRow[]
}
type FeaturedCategory = {
  categoryId: string
  categoryName: string
  parentName?: string | null
}

const identityDocumentLabel = (supplier: SupplierRecord) =>
  supplier.supplierIdentityDocumentType === "passport"
    ? "Passport"
    : supplier.supplierIdentityDocumentType === "emirates_id"
      ? "Emirates ID"
      : "Not added"

const identityVerificationStatus = (supplier: SupplierRecord) =>
  supplier.supplierIdentityDocumentType === "passport"
    ? supplier.emiratesIdPassportUrl.exists &&
      supplier.passportAddressUrl.exists &&
      supplier.passportVisaFrontUrl.exists
      ? "Submitted"
      : "Pending"
    : supplier.emiratesIdPassportUrl.exists && supplier.emiratesIdBackUrl.exists
      ? "Submitted"
      : "Pending"

const detailSections = (supplier: SupplierRecord): DetailSection[] => [
  {
    title: "Account",
    rows: [
      ["Supplier ID", supplier.id],
      ["Account ID", supplier.accountId],
      ["Business name", supplier.name],
      ["Account holder", supplier.contactName],
      ["Email", supplier.email],
      ["Mobile", supplier.phone],
      ["Products uploaded", String(supplier.products)],
      ["Joined", supplier.joined],
      ["Last login", supplier.lastLogin],
      ["Email verified", supplier.emailVerified ? "Yes" : "No"],
      ["Account status", supplier.accountActive ? "Active" : "Suspended"],
      ["Featured supplier", supplier.featuredSupplier ? "Yes" : "No"],
    ],
  },
  {
    title: "Authorized Contact",
    rows: [
      ["Authorized person name", supplier.contactPerson],
      ["Designation", supplier.designation],
    ],
  },
  {
    title: "Verification Documents",
    rows: [
      ["Trade license number", supplier.tradeLicenseNumber],
      [
        "Trade license image",
        supplier.tradeLicenseImageUrl.exists ? "Submitted" : "Missing file",
      ],
      ["VAT TRN number", supplier.vatTrnNumber],
      [
        "VAT registration document",
        supplier.vatTrnImageUrl.exists ? "Submitted" : "Missing file",
      ],
      ["Bank Account IBAN", supplier.bankIban],
      [
        "Bank account proof",
        supplier.bankAccountProofUrl.exists ? "Submitted" : "Missing file",
      ],
    ],
  },
  {
    title: "Compliance Checklist",
    rows: [
      [
        "Trade Licence Verification",
        supplier.tradeLicenseNumber !== "Not added" &&
        supplier.tradeLicenseImageUrl.exists
          ? "Submitted"
          : "Pending",
      ],
      [
        "VAT Registration Verification",
        supplier.vatTrnNumber !== "Not added" && supplier.vatTrnImageUrl.exists
          ? "Submitted"
          : "Pending",
      ],
      ["Emirates ID / Passport Verification", identityVerificationStatus(supplier)],
      [
        "Bank Account (IBAN) Verification",
        supplier.bankIban !== "Not added" && supplier.bankAccountProofUrl.exists
          ? "Submitted"
          : "Pending",
      ],
      ["Contact Verification", supplier.emailVerified ? "Email verified" : "Pending"],
      [
        "Acceptance of Marketplace Agreement",
        supplier.marketplaceAgreementAcceptedAt ? "Accepted" : "Pending",
      ],
    ],
  },
  {
    title: "Address",
    rows: [
      ["Address", supplier.address],
      ["City", supplier.city],
      ["State", supplier.state],
      ["Postal code", supplier.postalCode],
      ["Country", supplier.country],
    ],
  },
  {
    title: "Admin Review",
    rows: [
      ["Compliance Review", supplier.status],
      ["Reviewed by", supplier.reviewedBy],
      ["Reviewed on", supplier.reviewedAt],
      ["Rejection reason", supplier.rejectionReason ?? "Not added"],
    ],
  },
]

const renderDetailValue = (value: string | number | null) => {
  const displayValue = value ?? "Not added"

  return displayValue
}

const DetailValue = ({
  value,
}: {
  value: string | number | null
}) => (
  <dd className="mt-1 min-w-0 break-words text-sm font-medium text-dashboard-text">
    {renderDetailValue(value)}
  </dd>
)

const DetailField = ({ label, value }: { label: string; value: string | number | null }) => (
  <div className="min-w-0 rounded-sm border border-dashboard-panel-border px-4 py-3">
    <dt className="text-xs text-dashboard-muted">{label}</dt>
    <DetailValue value={value} />
  </div>
)

const DocumentDetailField = ({
  label,
  value,
  supplierId,
  field,
}: {
  label: string
  value: SupplierDocumentView
  supplierId: string
  field:
    | "tradeLicenseImageUrl"
    | "vatTrnImageUrl"
    | "emiratesIdPassportUrl"
    | "emiratesIdBackUrl"
    | "passportAddressUrl"
    | "passportVisaFrontUrl"
    | "bankAccountProofUrl"
}) => (
  <div className="min-w-0 rounded-sm border border-dashboard-panel-border px-4 py-3">
    <dt className="text-xs text-dashboard-muted">{label}</dt>
    <dd className="mt-1 min-w-0 break-words text-sm font-medium text-dashboard-text">
      {value.url ? (
        <a
          href={`/api/v1/admin/suppliers/${supplierId}/documents?field=${field}`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center rounded-sm border border-dashboard-accent/30 px-3 py-1.5 text-dashboard-accent underline-offset-4 transition hover:bg-dashboard-accent/10 hover:underline"
        >
          View document
        </a>
      ) : (
        "Not added"
      )}
    </dd>
  </div>
)

const renderVerificationDocuments = (supplier: SupplierRecord) => (
  <div className="space-y-4 p-4">
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)]">
      <DetailField label="Trade license number" value={supplier.tradeLicenseNumber} />
      <DocumentDetailField
        label="Trade license image"
        value={supplier.tradeLicenseImageUrl}
        supplierId={supplier.internalId}
        field="tradeLicenseImageUrl"
      />
    </div>
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)]">
      <DetailField label="VAT TRN number" value={supplier.vatTrnNumber} />
      <DocumentDetailField
        label="VAT registration document"
        value={supplier.vatTrnImageUrl}
        supplierId={supplier.internalId}
        field="vatTrnImageUrl"
      />
    </div>
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)]">
      <DetailField label="Identity document type" value={identityDocumentLabel(supplier)} />
      <div className="grid gap-3 rounded-sm border border-dashboard-panel-border p-3">
        {supplier.supplierIdentityDocumentType === "passport" ? (
          <>
            <DocumentDetailField
              label="Passport photo page"
              value={supplier.emiratesIdPassportUrl}
              supplierId={supplier.internalId}
              field="emiratesIdPassportUrl"
            />
            <DocumentDetailField
              label="Passport address page"
              value={supplier.passportAddressUrl}
              supplierId={supplier.internalId}
              field="passportAddressUrl"
            />
            <DocumentDetailField
              label="Passport visa front"
              value={supplier.passportVisaFrontUrl}
              supplierId={supplier.internalId}
              field="passportVisaFrontUrl"
            />
          </>
        ) : (
          <>
            <DocumentDetailField
              label="Emirates ID front"
              value={supplier.emiratesIdPassportUrl}
              supplierId={supplier.internalId}
              field="emiratesIdPassportUrl"
            />
            <DocumentDetailField
              label="Emirates ID back"
              value={supplier.emiratesIdBackUrl}
              supplierId={supplier.internalId}
              field="emiratesIdBackUrl"
            />
          </>
        )}
      </div>
    </div>
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)]">
      <DetailField label="Bank Account IBAN" value={supplier.bankIban} />
      <DocumentDetailField
        label="Bank account proof"
        value={supplier.bankAccountProofUrl}
        supplierId={supplier.internalId}
        field="bankAccountProofUrl"
      />
    </div>
  </div>
)

export function SuppliersTable({ rows, columns }: SupplierTableProps) {
  const router = useRouter()
  const [viewingSupplier, setViewingSupplier] = useState<SupplierRecord | null>(
    null,
  )
  const [reviewTarget, setReviewTarget] = useState<ReviewTarget | null>(null)
  const [featuredTarget, setFeaturedTarget] = useState<SupplierRecord | null>(null)
  const [featuredCategories, setFeaturedCategories] = useState<FeaturedCategory[]>([])
  const [featuredCategoryIds, setFeaturedCategoryIds] = useState<string[]>([])
  const [featuredValidUntil, setFeaturedValidUntil] = useState("")
  const [rejectionReason, setRejectionReason] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  type NotificationResult = {
    sent: boolean
    skipped: boolean
    error: string | null
  }

  type ReviewPayload = {
    supplier?: SupplierRecord
    notification?: NotificationResult
    message?: string
  }

  function openReviewDialog(
    supplier: SupplierRecord,
    status: Exclude<SupplierStatus, "Pending">,
  ) {
    setError(null)
    setRejectionReason(status === "Rejected" ? supplier.rejectionReason ?? "" : "")
    setReviewTarget({ supplier, status })
  }

  function handleReview() {
    if (!reviewTarget) return
    setError(null)
    const normalizedReason = rejectionReason.trim()
    if (reviewTarget.status === "Rejected" && !normalizedReason) {
      const message = "Enter a rejection reason for the supplier"
      setError(message)
      toast.error(message)
      return
    }
    if (reviewTarget.status === "Rejected" && (normalizedReason.length < 10 || normalizedReason.length > 1000)) {
      const message = "Rejection reason must be 10 to 1000 characters."
      setError(message)
      toast.error(message)
      return
    }

    startTransition(async () => {
      const response = await fetch(
        `/api/v1/admin/suppliers/${reviewTarget.supplier.internalId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            status: reviewTarget.status,
            rejectionReason:
              reviewTarget.status === "Rejected" ? normalizedReason : undefined,
          }),
        },
      )
      const payload = (await response.json().catch(() => null)) as ReviewPayload | null

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

      if (
        payload?.notification &&
        !payload.notification.sent &&
        !payload.notification.skipped
      ) {
        toast.warning(
          payload.notification.error
            ? `Decision saved, but supplier notification email failed: ${payload.notification.error}`
            : "Decision saved, but supplier notification email failed.",
        )
      }

      setReviewTarget(null)
      setViewingSupplier(null)
      setRejectionReason("")
      router.refresh()
    })
  }

  function openFeaturedDialog(supplier: SupplierRecord) {
    setFeaturedTarget(supplier)
    setFeaturedCategories([])
    setFeaturedCategoryIds([])
    setFeaturedValidUntil("")
    startTransition(async () => {
      const response = await fetch(
        `/api/v1/admin/suppliers/${supplier.internalId}/featured-categories`,
        { cache: "no-store" },
      )
      const payload = (await response.json().catch(() => null)) as {
        categories?: FeaturedCategory[]
        selectedBySource?: Record<string, string[]>
        validUntilBySource?: Record<string, string | null>
        message?: string
      } | null
      if (!response.ok) {
        toast.error(payload?.message ?? "Unable to load featured categories")
        return
      }
      setFeaturedCategories(payload?.categories ?? [])
      setFeaturedCategoryIds(payload?.selectedBySource?.admin ?? [])
      setFeaturedValidUntil(payload?.validUntilBySource?.admin ?? "")
    })
  }

  function saveFeaturedCategories() {
    if (!featuredTarget) return
    startTransition(async () => {
      const response = await fetch(`/api/v1/admin/suppliers/${featuredTarget.internalId}/featured-categories`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ categoryIds: featuredCategoryIds, validUntil: featuredValidUntil || null }),
      })
      const payload = (await response.json().catch(() => null)) as { message?: string } | null
      if (!response.ok) {
        toast.error(payload?.message ?? "Unable to update featured categories")
        return
      }
      toast.success("Featured Vendor categories updated.")
      setFeaturedTarget(null)
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
                <Button
                  size="icon-sm"
                  variant="outline"
                  title={supplier.featuredSupplier ? "Remove featured badge" : "Give featured badge"}
                  aria-label={`${supplier.featuredSupplier ? "Remove featured badge from" : "Give featured badge to"} ${supplier.name}`}
                  disabled={isPending}
                  className={supplier.featuredSupplier ? "border-amber-400/50 text-amber-500 hover:bg-amber-400/10" : "border-dashboard-panel-border hover:bg-amber-400/10 hover:text-amber-500"}
                  onClick={() => openFeaturedDialog(supplier)}
                >
                  <Star className="h-4 w-4" fill={supplier.featuredSupplier ? "currentColor" : "none"} />
                </Button>
                {supplier.status !== "Approved" ? (
                  <Button
                    size="icon-sm"
                    variant="outline"
                    title="Approve supplier"
                    aria-label={`Approve ${supplier.name}`}
                    disabled={isPending}
                    className="border-dashboard-success/30 hover:bg-dashboard-success/10 hover:text-dashboard-success"
                    onClick={() => openReviewDialog(supplier, "Approved")}
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
                    onClick={() => openReviewDialog(supplier, "Rejected")}
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
        <DialogContent className="sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>{viewingSupplier?.name}</DialogTitle>
            <DialogDescription>
              {viewingSupplier?.id} supplier account information
            </DialogDescription>
          </DialogHeader>

          {viewingSupplier ? (
            <div className="max-h-[68vh] space-y-4 overflow-y-auto border-y border-dashboard-panel-border py-4">
              <div className="flex flex-wrap items-center gap-3 px-1">
                <StatusBadge
                  label={viewingSupplier.status}
                  tone={SUPPLIER_STATUS_TONES[viewingSupplier.status]}
                />
                <span className="text-sm text-dashboard-muted">
                  {viewingSupplier.id} / {viewingSupplier.accountId}
                </span>
              </div>
              {detailSections(viewingSupplier).map((section) => (
                <section
                  key={section.title}
                  className="rounded-sm border border-dashboard-panel-border"
                >
                  <header className="border-b border-dashboard-panel-border bg-dashboard-panel px-4 py-3">
                    <h3 className="text-sm font-semibold text-dashboard-text">
                      {section.title}
                    </h3>
                  </header>
                  {section.title === "Verification Documents" ? (
                    renderVerificationDocuments(viewingSupplier)
                  ) : (
                    <dl className="grid sm:grid-cols-2">
                      {section.rows.map(([label, value]) => (
                        <div
                          key={`${section.title}-${label}`}
                          className="min-w-0 border-b border-dashboard-panel-border px-4 py-3 last:border-b-0 sm:odd:border-r sm:[&:nth-last-child(-n+2)]:border-b-0"
                        >
                          <dt className="text-xs text-dashboard-muted">
                            {label}
                          </dt>
                          <DetailValue value={value} />
                        </div>
                      ))}
                    </dl>
                  )}
                </section>
                ))}
            </div>
          ) : null}

          <DialogFooter>
            {viewingSupplier && viewingSupplier.status !== "Approved" ? (
              <Button
                type="button"
                variant="outline"
                disabled={isPending}
                className="border-dashboard-success/30 hover:bg-dashboard-success/10 hover:text-dashboard-success"
                onClick={() => openReviewDialog(viewingSupplier, "Approved")}
              >
                <Check className="h-4 w-4" />
                Approve
              </Button>
            ) : null}
            {viewingSupplier && viewingSupplier.status !== "Rejected" ? (
              <Button
                type="button"
                variant="outline"
                disabled={isPending}
                className="border-dashboard-danger/30 hover:bg-dashboard-danger/10 hover:text-dashboard-danger"
                onClick={() => openReviewDialog(viewingSupplier, "Rejected")}
              >
                <CircleX className="h-4 w-4" />
                Reject
              </Button>
            ) : null}
            <Button type="button" onClick={() => setViewingSupplier(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(featuredTarget)}
        onOpenChange={(open) => {
          if (!open && !isPending) setFeaturedTarget(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Featured Vendor categories</DialogTitle>
            <DialogDescription>
              Select categories from {featuredTarget?.name ?? "this supplier"}&apos;s active mapped products.
            </DialogDescription>
          </DialogHeader>
          <label className="space-y-1 text-xs font-medium text-dashboard-muted">
            Valid until
            <Input
              type="date"
              value={featuredValidUntil}
              onChange={(event) => setFeaturedValidUntil(event.target.value)}
              className="border-dashboard-panel-border bg-dashboard-panel text-dashboard-text"
            />
          </label>
          <div className="max-h-[50vh] space-y-2 overflow-y-auto">
            {featuredCategories.length ? featuredCategories.map((category) => (
              <label key={category.categoryId} className="flex items-start gap-2 rounded-sm border border-dashboard-panel-border p-3 text-sm text-dashboard-text">
                <Checkbox
                  checked={featuredCategoryIds.includes(category.categoryId)}
                  onCheckedChange={(checked) => setFeaturedCategoryIds((current) =>
                    checked ? [...current, category.categoryId] : current.filter((id) => id !== category.categoryId),
                  )}
                />
                <span>
                  <span className="font-medium">{category.categoryName}</span>
                  {category.parentName ? <span className="block text-xs text-dashboard-muted">{category.parentName}</span> : null}
                </span>
              </label>
            )) : (
              <p className="rounded-sm border border-dashboard-panel-border p-4 text-sm text-dashboard-muted">
                No active mapped product categories found for this supplier.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" disabled={isPending} onClick={() => setFeaturedTarget(null)}>
              Cancel
            </Button>
            <Button type="button" disabled={isPending} onClick={saveFeaturedCategories}>
              {isPending ? "Saving..." : "Save categories"}
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

          {reviewTarget?.status === "Rejected" ? (
            <div className="space-y-2">
              <label
                htmlFor="supplier-rejection-reason"
                className="text-sm font-medium text-dashboard-text"
              >
                Rejection reason<RequiredMark />
              </label>
              <textarea
                id="supplier-rejection-reason"
                value={rejectionReason}
                onChange={(event) => setRejectionReason(event.target.value.slice(0, 1000))}
                rows={4}
                maxLength={1000}
                className="w-full rounded-sm border border-dashboard-panel-border bg-dashboard-panel px-3 py-2 text-sm text-dashboard-text outline-none ring-dashboard-accent/20 focus:ring-2"
                placeholder="Tell the supplier which document must be corrected."
              />
            </div>
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
