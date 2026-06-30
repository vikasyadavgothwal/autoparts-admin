"use client"

import { useState, useTransition, type FormEvent } from "react"
import {
  CircleCheck,
  Eye,
  MoreHorizontal,
  RefreshCw,
  Search,
  Trash2,
  Wrench,
} from "lucide-react"
import { toast } from "sonner"

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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { SupplierPartRecord } from "@/types/parts-mapping/parts-mapping"
import type { SupplierPartMappingStatus } from "@/lib/generated/prisma/client"

type PartsMappingPageProps = {
  initialParts: SupplierPartRecord[]
}

const statusFilters: Array<{
  label: string
  value: SupplierPartMappingStatus | "all"
}> = [
  { label: "All", value: "all" },
  { label: "Pending Review", value: "pending_review" },
  { label: "Failed", value: "failed" },
  { label: "Mapped", value: "mapped" },
  { label: "Processing", value: "processing" },
]

const statusToneByValue: Record<
  SupplierPartMappingStatus,
  "success" | "warning" | "danger" | "info" | "neutral"
> = {
  uploaded: "neutral",
  processing: "info",
  mapped: "success",
  pending_review: "warning",
  failed: "danger",
}

const formatStatus = (status: string) =>
  status
    .split("_")
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ")

export function PartsMappingPage({ initialParts }: PartsMappingPageProps) {
  const [parts, setParts] = useState(initialParts)
  const [query, setQuery] = useState("")
  const [statusFilter, setStatusFilter] =
    useState<SupplierPartMappingStatus | "all">("all")
  const [manualPartUidById, setManualPartUidById] = useState<Record<string, string>>({})
  const [partToMap, setPartToMap] = useState<SupplierPartRecord | null>(null)
  const [partToReview, setPartToReview] = useState<SupplierPartRecord | null>(null)
  const [retainedImageKeys, setRetainedImageKeys] = useState<string[]>([])
  const [partToDelete, setPartToDelete] = useState<SupplierPartRecord | null>(null)
  const [isPending, startTransition] = useTransition()

  const filteredParts = parts.filter((part) => {
    const matchesStatus =
      statusFilter === "all" || part.mappingStatus === statusFilter
    const normalizedQuery = query.trim().toLowerCase()

    if (!matchesStatus) {
      return false
    }

    if (!normalizedQuery) {
      return true
    }

    return [
      part.originalPartName,
      part.vendorSku ?? "",
      part.originalBrand ?? "",
      part.originalMpn ?? "",
      part.originalOemNumber ?? "",
      part.supplierName ?? "",
      part.partUid ?? "",
      part.mappingError ?? "",
    ]
      .join(" ")
      .toLowerCase()
      .includes(normalizedQuery)
  })

  const updatePartInState = (updatedPart: SupplierPartRecord) => {
    setParts((current) =>
      current.map((part) => (part.id === updatedPart.id ? updatedPart : part)),
    )
  }

  const retryMapping = (partId: string) => {
    startTransition(async () => {
      const response = await fetch(`/api/admin/parts/${partId}/retry-mapping`, {
        method: "POST",
      })
      const payload = await response.json()

      if (!response.ok || !payload.ok) {
        toast.error(payload.message ?? "Unable to retry mapping")
        return
      }

      updatePartInState(payload.part)
      toast.success("Mapping retried")
    })
  }

  const approveProduct = (partId: string) => {
    startTransition(async () => {
      const response = await fetch(`/api/admin/parts/${partId}/approve`, {
        method: "POST",
      })
      const payload = await response.json()

      if (!response.ok || !payload.ok) {
        toast.error(payload.message ?? "Unable to approve product")
        return
      }

      updatePartInState(payload.part)
      setPartToReview(null)
      toast.success("First-vendor product approved")
    })
  }

  const openProductReview = (part: SupplierPartRecord) => {
    setPartToReview(part)
    setRetainedImageKeys(part.part?.imageKeys ?? [])
  }

  const saveProductContent = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!partToReview?.part) {
      return
    }

    const formData = new FormData(event.currentTarget)
    const newFiles = formData
      .getAll("images")
      .filter((value): value is File => value instanceof File && value.size > 0)
    const originalPart = partToReview.part

    if (retainedImageKeys.length + newFiles.length === 0) {
      toast.error("Keep or upload at least one product image")
      return
    }
    if (retainedImageKeys.length + newFiles.length > 8) {
      toast.error("A product can have a maximum of 8 images")
      return
    }

    startTransition(async () => {
      try {
        let uploadedImages: Array<{ key: string; url: string }> = []
        if (newFiles.length > 0) {
          const uploadData = new FormData()
          newFiles.forEach((file) => uploadData.append("images", file))
          const uploadResponse = await fetch("/api/admin/parts/images", {
            method: "POST",
            body: uploadData,
          })
          const uploadPayload = await uploadResponse.json()
          if (!uploadResponse.ok || !uploadPayload.ok) {
            throw new Error(uploadPayload.message ?? "Unable to upload images")
          }
          uploadedImages = uploadPayload.images
        }

        const retainedImages = retainedImageKeys.map((key) => {
          const index = originalPart.imageKeys.indexOf(key)
          return { key, url: originalPart.imageUrls[index] }
        })
        const images = [...retainedImages, ...uploadedImages]
        const response = await fetch(
          `/api/admin/parts/${partToReview.id}/content`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              partName: String(formData.get("partName") ?? ""),
              category: String(formData.get("category") ?? ""),
              badgeText: String(formData.get("badgeText") ?? ""),
              heading: String(formData.get("heading") ?? ""),
              description: String(formData.get("description") ?? ""),
              keyFeatures: String(formData.get("keyFeatures") ?? "")
                .split("\n")
                .map((value) => value.trim())
                .filter(Boolean),
              imageKeys: images.map((image) => image.key),
              imageUrls: images.map((image) => image.url),
            }),
          },
        )
        const payload = await response.json()
        if (!response.ok || !payload.ok) {
          throw new Error(payload.message ?? "Unable to update product content")
        }

        updatePartInState(payload.part)
        setPartToReview(payload.part)
        setRetainedImageKeys(payload.part.part?.imageKeys ?? [])
        toast.success("Product content updated")
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Unable to update product",
        )
      }
    })
  }

  const manualMap = (
    part: SupplierPartRecord,
    mode: "existing" | "create" = "existing",
  ) => {
    const partUid = manualPartUidById[part.id]?.trim()

    if (mode === "existing" && !partUid) {
      toast.error("Enter an existing part UID or create a new master part")
      return
    }

    startTransition(async () => {
      const response = await fetch(`/api/admin/parts/${part.id}/manual-map`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          mode === "existing"
            ? { partUid }
            : {
                partName: part.originalPartName,
                partNumber: part.originalMpn ?? part.originalOemNumber,
                brandName: part.originalBrand,
                category: part.category,
              },
        ),
      })
      const payload = await response.json()

      if (!response.ok || !payload.ok) {
        toast.error(payload.message ?? "Unable to map part")
        return
      }

      updatePartInState(payload.part)
      setPartToMap(null)
      toast.success(
        mode === "existing"
          ? "Part mapped manually"
          : "New master part created and mapped",
      )
    })
  }

  const deletePart = () => {
    if (!partToDelete) {
      return
    }

    const partId = partToDelete.id

    startTransition(async () => {
      const response = await fetch(`/api/admin/parts/${partId}`, {
        method: "DELETE",
      })
      const payload = await response.json()

      if (!response.ok || !payload.ok) {
        toast.error(payload.message ?? "Unable to delete supplier part")
        return
      }

      setParts((current) => current.filter((part) => part.id !== partId))
      setManualPartUidById((current) => {
        const next = { ...current }
        delete next[partId]
        return next
      })
      setPartToDelete(null)
      toast.success("Supplier part deleted")
    })
  }

  return (
    <div className="space-y-6">
      <PageHeading
        title="Supplier Parts Mapping"
        subtitle="Review supplier uploads, retry failed mapping, and manually link parts to the master catalog."
      />

      <Card className="border border-dashboard-panel-border">
        <CardHeader className="gap-4 border-b border-dashboard-panel-border lg:flex lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-2">
            {statusFilters.map((filter) => (
              <Button
                key={filter.value}
                size="sm"
                variant={statusFilter === filter.value ? "default" : "outline"}
                onClick={() => setStatusFilter(filter.value)}
              >
                {filter.label}
              </Button>
            ))}
          </div>
          <div className="relative w-full lg:max-w-sm">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-dashboard-muted" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search supplier part, OEM, MPN"
              className="h-9 pl-9"
            />
          </div>
        </CardHeader>

        <CardContent className="px-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="px-4">Supplier Part</TableHead>
                <TableHead>Supplier</TableHead>
                <TableHead>OEM / MPN</TableHead>
                <TableHead>Price / Stock</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Mapped UID</TableHead>
                <TableHead className="px-4 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredParts.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="h-32 text-center text-dashboard-muted"
                  >
                    No supplier parts match this view.
                  </TableCell>
                </TableRow>
              ) : (
                filteredParts.map((part) => (
                  <TableRow key={part.id}>
                    <TableCell className="px-4">
                      <div className="space-y-1">
                        <p className="font-medium text-foreground">
                          {part.originalPartName}
                        </p>
                        <p className="text-xs text-dashboard-muted">
                          {part.originalBrand ?? "No brand"} ·{" "}
                          {part.category ?? "No category"}
                        </p>
                        {part.mappingError ? (
                          <p className="max-w-xs truncate text-xs text-dashboard-danger">
                            {part.mappingError}
                          </p>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell>{part.supplierName ?? part.supplierId}</TableCell>
                    <TableCell>
                      <div className="space-y-1 text-sm">
                        <p>OEM: {part.originalOemNumber ?? "-"}</p>
                        <p>MPN: {part.originalMpn ?? "-"}</p>
                        <p>SKU: {part.vendorSku ?? "-"}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      {part.currency ?? "AED"} {part.price.toFixed(2)} · {part.stock}
                    </TableCell>
                    <TableCell>
                      <StatusBadge
                        label={formatStatus(part.mappingStatus)}
                        tone={statusToneByValue[part.mappingStatus]}
                      />
                    </TableCell>
                    <TableCell>
                      <span className="text-xs text-dashboard-muted">
                        {part.partUid ?? "-"}
                      </span>
                    </TableCell>
                    <TableCell className="px-4 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            size="icon-sm"
                            variant="ghost"
                            disabled={isPending}
                            aria-label={`Actions for ${part.originalPartName}`}
                          >
                            <MoreHorizontal />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56">
                          <DropdownMenuLabel>Mapping actions</DropdownMenuLabel>
                          {part.part ? (
                            <DropdownMenuItem
                              onSelect={() => openProductReview(part)}
                            >
                              <Eye />
                              {part.mappingStatus === "pending_review" &&
                              part.mappingError?.startsWith("First-vendor")
                                ? "Review submitted product"
                                : "View or edit product"}
                            </DropdownMenuItem>
                          ) : null}
                          <DropdownMenuItem
                            onSelect={() => retryMapping(part.id)}
                          >
                            <RefreshCw />
                            Retry automatic mapping
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onSelect={() => setPartToMap(part)}
                          >
                            <Wrench />
                            Map to existing UID
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            variant="destructive"
                            onSelect={() => setPartToDelete(part)}
                          >
                            <Trash2 />
                            Delete supplier part
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog
        open={partToReview !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPartToReview(null)
          }
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Supplier product details</DialogTitle>
            <DialogDescription>
              Verify the submitted catalog content before publishing this part.
            </DialogDescription>
          </DialogHeader>

          {partToReview ? (
            <div className="space-y-5">
              <div className="grid gap-3 rounded-lg border p-4 text-sm sm:grid-cols-2">
                <p><strong>Product:</strong> {partToReview.originalPartName}</p>
                <p><strong>Brand:</strong> {partToReview.originalBrand ?? "-"}</p>
                <p><strong>Category:</strong> {partToReview.category ?? "-"}</p>
                <p><strong>OEM:</strong> {partToReview.originalOemNumber ?? "-"}</p>
                <p><strong>MPN:</strong> {partToReview.originalMpn ?? "-"}</p>
                <p><strong>Vendor SKU:</strong> {partToReview.vendorSku ?? "-"}</p>
                <p><strong>HS code:</strong> {partToReview.hsCode ?? "-"}</p>
                <p><strong>Offer:</strong> AED {partToReview.price.toFixed(2)} · {partToReview.stock}</p>
              </div>

              <div className="grid gap-3 rounded-lg border p-4 text-sm sm:grid-cols-2">
                <p>
                  <strong>OEM supersessions:</strong>{" "}
                  {partToReview.oemSupersessionNumbers.join(", ") || "-"}
                </p>
                <p>
                  <strong>Competitor:</strong>{" "}
                  {[partToReview.competitorBrandName, partToReview.competitorPartNumber]
                    .filter(Boolean)
                    .join(" · ") || "-"}
                </p>
              </div>

              <div
                className={
                  partToReview.part?.source.startsWith("17vin")
                    ? "rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-700"
                    : "rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-800"
                }
              >
                {partToReview.part?.source.startsWith("17vin")
                  ? "17VIN verified this OEM/MPN and brand combination."
                  : "No verified match was found in 17VIN. Research the OEM, MPN, brand, fitment, and submitted content independently before approving."}
              </div>

              {[...partToReview.supplierImageUrls, ...(partToReview.part?.imageKeys.length ? [] : (partToReview.part?.imageUrls ?? []))].length > 0 ? (
                <div className="space-y-2">
                  <p className="text-sm font-medium">Catalog images</p>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {[...partToReview.supplierImageUrls, ...(partToReview.part?.imageKeys.length ? [] : (partToReview.part?.imageUrls ?? []))].map((imageUrl) => (
                      <div
                        key={imageUrl}
                        role="img"
                        aria-label={partToReview.originalPartName}
                        className="aspect-square rounded-lg border bg-cover bg-center"
                        style={{ backgroundImage: `url(${imageUrl})` }}
                      />
                    ))}
                  </div>
                </div>
              ) : null}

              <form
                key={partToReview.id}
                className="space-y-5"
                onSubmit={saveProductContent}
              >
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {partToReview.part?.imageKeys
                    .filter((key) => retainedImageKeys.includes(key))
                    .map((key) => (
                      <div key={key} className="space-y-2">
                        <div
                          role="img"
                          aria-label={partToReview.originalPartName}
                          className="aspect-square w-full rounded-lg border bg-cover bg-center"
                          style={{
                            backgroundImage: `url(/api/admin/parts/product-image?key=${encodeURIComponent(key)})`,
                          }}
                        />
                        <Button
                          type="button"
                          size="sm"
                          variant="destructive"
                          className="w-full"
                          onClick={() =>
                            setRetainedImageKeys((current) =>
                              current.filter((imageKey) => imageKey !== key),
                            )
                          }
                        >
                          Remove
                        </Button>
                      </div>
                    ))}
                </div>

                <div className="space-y-2">
                  <label htmlFor="admin-product-images" className="text-sm font-medium">
                    Add replacement images
                  </label>
                  <Input
                    id="admin-product-images"
                    name="images"
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    multiple
                  />
                  <p className="text-xs text-muted-foreground">
                    Keep at least one image. Maximum 8 images total, 5 MB each.
                  </p>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2 sm:col-span-2">
                    <label htmlFor="admin-part-name" className="text-sm font-medium">Product name</label>
                    <Input id="admin-part-name" name="partName" defaultValue={partToReview.part?.partName ?? ""} required />
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="admin-category" className="text-sm font-medium">Category</label>
                    <Input id="admin-category" name="category" defaultValue={partToReview.part?.category ?? ""} required />
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="admin-badge" className="text-sm font-medium">Badge text</label>
                    <Input id="admin-badge" name="badgeText" defaultValue={partToReview.part?.badgeText ?? ""} required />
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <label htmlFor="admin-heading" className="text-sm font-medium">Heading</label>
                    <Input id="admin-heading" name="heading" defaultValue={partToReview.part?.heading ?? ""} required />
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <label htmlFor="admin-description" className="text-sm font-medium">Description</label>
                    <textarea
                      id="admin-description"
                      name="description"
                      className="min-h-24 w-full rounded-lg border bg-transparent px-3 py-2 text-sm"
                      defaultValue={partToReview.part?.description ?? ""}
                      required
                    />
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <label htmlFor="admin-features" className="text-sm font-medium">Key features, one per line</label>
                    <textarea
                      id="admin-features"
                      name="keyFeatures"
                      className="min-h-28 w-full rounded-lg border bg-transparent px-3 py-2 text-sm"
                      defaultValue={partToReview.part?.keyFeatures.join("\n") ?? ""}
                      required
                    />
                  </div>
                </div>

                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setPartToReview(null)}
                    disabled={isPending}
                  >
                    Close
                  </Button>
                  <Button type="submit" variant="outline" disabled={isPending}>
                    {isPending ? "Saving..." : "Save changes"}
                  </Button>
                  {partToReview.mappingStatus === "pending_review" &&
                  partToReview.mappingError?.startsWith("First-vendor") ? (
                    <Button
                      type="button"
                      onClick={() => approveProduct(partToReview.id)}
                      disabled={isPending}
                    >
                      <CircleCheck />
                      {isPending ? "Approving..." : "Approve product"}
                    </Button>
                  ) : null}
                </DialogFooter>
              </form>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog
        open={partToMap !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPartToMap(null)
          }
        }}
      >
        <DialogContent showCloseButton={!isPending}>
          <DialogHeader>
            <DialogTitle>Map to existing part UID</DialogTitle>
            <DialogDescription>
              Link {partToMap?.originalPartName ?? "this supplier part"} to an
              existing master part.
            </DialogDescription>
          </DialogHeader>
          <Input
            value={partToMap ? (manualPartUidById[partToMap.id] ?? "") : ""}
            onChange={(event) => {
              if (!partToMap) {
                return
              }
              setManualPartUidById((current) => ({
                ...current,
                [partToMap.id]: event.target.value,
              }))
            }}
            placeholder="Existing part UID"
            autoFocus
          />
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setPartToMap(null)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => partToMap && manualMap(partToMap, "existing")}
              disabled={isPending}
            >
              {isPending ? "Mapping..." : "Map part"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={partToDelete !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPartToDelete(null)
          }
        }}
      >
        <DialogContent showCloseButton={!isPending}>
          <DialogHeader>
            <DialogTitle>Delete supplier part?</DialogTitle>
            <DialogDescription>
              This will permanently remove {partToDelete?.originalPartName ?? "this part"}
              {partToDelete?.supplierName
                ? ` from ${partToDelete.supplierName}`
                : ""}
              . Its master data and fitments will also be removed when no other
              supplier uses them.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setPartToDelete(null)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={deletePart}
              disabled={isPending}
            >
              {isPending ? "Deleting..." : "Delete part"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
