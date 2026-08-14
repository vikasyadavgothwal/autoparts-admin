"use client"

import { useMemo, useState, useTransition } from "react"
import type { FormEvent } from "react"
import { MapPin, MoreHorizontal, Star } from "lucide-react"
import { useRouter } from "next/navigation"

import { Button } from "@/components/ui/button"
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
import { StatusBadge } from "@/components/admin-dashboard/shared/status-badge"
import { SectionTable } from "@/components/admin-dashboard/shared/section-table"
import type { StatusTone } from "@/types/admin-dashboard/shared/status-badge"
import type { SectionTableColumn } from "@/types/admin-dashboard/shared/section-table"
import type { GaragesTableProps } from "@/types/admin-dashboard/garages/garages-table"
import type {
  AdminGarageBookingRecord,
  GarageRecord,
  GarageStatus,
} from "@/types/admin-dashboard/garages/garages-types"

const GARAGE_STATUS_TONES: Record<string, StatusTone> = {
  Active: "success",
  Pending: "warning",
  Suspended: "danger",
}

export function GaragesTable({ rows, columns }: GaragesTableProps) {
  const router = useRouter()
  const [editingGarage, setEditingGarage] = useState<GarageRecord | null>(null)
  const [reviewGarage, setReviewGarage] = useState<GarageRecord | null>(null)
  const [bookingGarage, setBookingGarage] = useState<GarageRecord | null>(null)
  const [overrideBooking, setOverrideBooking] =
    useState<AdminGarageBookingRecord | null>(null)
  const [deletingGarage, setDeletingGarage] = useState<GarageRecord | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const editDefaults = useMemo(
    () => ({
      name: editingGarage?.name ?? "",
      owner: editingGarage?.owner ?? "",
      email: editingGarage?.email ?? "",
      phone: editingGarage?.phone ?? "",
      address: editingGarage?.address ?? "",
      city: editingGarage?.city ?? "",
      state: editingGarage?.state ?? "",
      country: editingGarage?.country ?? "",
      pincode: editingGarage?.pincode ?? "",
      status: editingGarage?.status ?? "Active",
    }),
    [editingGarage],
  )

  function handleEditSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!editingGarage) return

    const formData = new FormData(event.currentTarget)
    const body = Object.fromEntries(formData.entries())
    setError(null)

    startTransition(async () => {
      const response = await fetch(`/api/v1/admin/garages/${editingGarage.internalId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as
          | { message?: string }
          | null
        setError(payload?.message ?? "Unable to update garage")
        return
      }

      setEditingGarage(null)
      router.refresh()
    })
  }

  function handleDelete() {
    if (!deletingGarage) return
    setError(null)

    startTransition(async () => {
      const response = await fetch(`/api/v1/admin/garages/${deletingGarage.internalId}`, {
        method: "DELETE",
      })

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as
          | { message?: string }
          | null
        setError(payload?.message ?? "Unable to delete garage")
        return
      }

      setDeletingGarage(null)
      router.refresh()
    })
  }

  function handleOverrideSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!overrideBooking) return

    const formData = new FormData(event.currentTarget)
    const body = Object.fromEntries(formData.entries())
    setError(null)

    startTransition(async () => {
      const response = await fetch(
        `/api/v1/admin/garage-bookings/${overrideBooking.id}/complete-override`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      )

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as
          | { message?: string }
          | null
        setError(payload?.message ?? "Unable to complete booking")
        return
      }

      setOverrideBooking(null)
      setBookingGarage(null)
      router.refresh()
    })
  }

  const statusLabel = (status: AdminGarageBookingRecord["status"]) =>
    status === "pending_slot_selection"
      ? "Awaiting Slot"
      : status.charAt(0).toUpperCase() + status.slice(1)

  return (
    <>
      <SectionTable columns={columns as readonly SectionTableColumn[]}>
        {rows.length === 0 ? (
          <tr className="dashboard-table-row">
            <td
              className="dashboard-table-cell text-center text-dashboard-muted"
              colSpan={columns.length}
            >
              No garages found.
            </td>
          </tr>
        ) : null}

        {rows.map((garage) => (
          <tr
            key={garage.id}
            className="dashboard-table-row"
          >
            <td className="dashboard-table-cell">
              <span className="font-medium text-dashboard-accent">{garage.id}</span>
            </td>
            <td className="dashboard-table-cell">
              <div>
                <div className="flex items-center gap-2 font-medium text-dashboard-text">
                  {garage.name}
                  {garage.verified ? (
                    <span className="text-dashboard-info">✓</span>
                  ) : null}
                </div>
                <div className="text-sm text-dashboard-muted">
                  {garage.owner}
                </div>
              </div>
            </td>
            <td className="dashboard-table-cell">
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-dashboard-muted" />
                <span className="text-dashboard-text">{garage.location}</span>
              </div>
            </td>
            <td className="dashboard-table-cell">
              <div className="flex items-center gap-2">
                <Star className="h-4 w-4 fill-dashboard-warning text-dashboard-warning" />
                <span className="font-medium text-dashboard-text">
                  {garage.rating}
                </span>
                {typeof garage.reviewsCount === "number" ? (
                  <span className="text-xs text-dashboard-muted">
                    ({garage.reviewsCount})
                  </span>
                ) : null}
              </div>
            </td>
            <td className="dashboard-table-cell text-dashboard-muted">
              {garage.bookings}
            </td>
            <td className="dashboard-table-cell">
              <span className="font-medium text-dashboard-text">
                {garage.revenue}
              </span>
            </td>
            <td className="dashboard-table-cell text-dashboard-muted">
              {garage.joinDate}
            </td>
            <td className="dashboard-table-cell">
              <StatusBadge
                label={garage.status}
                tone={GARAGE_STATUS_TONES[garage.status] ?? "warning"}
              />
            </td>
            <td className="dashboard-table-cell">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    size="icon-sm"
                    variant="outline"
                    disabled={isPending}
                    className="border-dashboard-panel-border"
                    aria-label={`Actions for ${garage.name}`}
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-36">
                  <DropdownMenuLabel>Actions</DropdownMenuLabel>
                  <DropdownMenuItem onSelect={() => setBookingGarage(garage)}>
                    View bookings
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => setReviewGarage(garage)}>
                    View reviews
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => setEditingGarage(garage)}>
                    Edit
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    variant="destructive"
                    onSelect={() => setDeletingGarage(garage)}
                  >
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </td>
          </tr>
        ))}
      </SectionTable>

      <Dialog
        open={Boolean(bookingGarage)}
        onOpenChange={(open) => {
          if (!open) {
            setBookingGarage(null)
            setError(null)
          }
        }}
      >
        <DialogContent className="sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>Active bookings</DialogTitle>
            <DialogDescription>
              {bookingGarage?.name} · {bookingGarage?.activeBookings?.length ?? 0} active
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-[60vh] space-y-3 overflow-y-auto pr-1">
            {bookingGarage?.activeBookings?.length ? (
              bookingGarage.activeBookings.map((booking) => {
                const canOverride = Boolean(
                  booking.customerId &&
                    booking.status === "confirmed" &&
                    booking.bookingDate &&
                    booking.bookingTime,
                )

                return (
                  <div
                    key={booking.id}
                    className="rounded-lg border border-dashboard-panel-border p-4"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <div className="font-medium text-dashboard-text">
                          {booking.publicId} · {booking.serviceName}
                        </div>
                        <div className="mt-1 text-sm text-dashboard-muted">
                          {booking.customerName} · {booking.customerEmail || booking.customerPhone}
                        </div>
                        <div className="mt-1 text-sm text-dashboard-muted">
                          {booking.bookingDate ?? "No date"} · {booking.bookingTime ?? "No time"} ·{" "}
                          {statusLabel(booking.status)}
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        disabled={!canOverride || isPending}
                        onClick={() => {
                          setError(null)
                          setOverrideBooking(booking)
                        }}
                      >
                        Admin complete
                      </Button>
                    </div>
                    {!canOverride ? (
                      <p className="mt-3 text-xs text-dashboard-muted">
                        Override is available only for confirmed customer-created bookings
                        with a scheduled date and time.
                      </p>
                    ) : null}
                  </div>
                )
              })
            ) : (
              <p className="text-sm text-dashboard-muted">
                No active bookings for this garage.
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(overrideBooking)}
        onOpenChange={(open) => {
          if (!open) {
            setOverrideBooking(null)
            setError(null)
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Complete booking by Admin review?</DialogTitle>
            <DialogDescription>
              This bypasses customer OTP only after dispute/evidence review.
            </DialogDescription>
          </DialogHeader>

          <form className="grid gap-4" onSubmit={handleOverrideSubmit}>
            <div className="rounded-lg border border-dashboard-panel-border p-3 text-sm">
              <div className="font-medium text-dashboard-text">
                {overrideBooking?.publicId} · {overrideBooking?.serviceName}
              </div>
              <div className="mt-1 text-dashboard-muted">
                {overrideBooking?.customerName}
              </div>
            </div>

            <label className="grid gap-1 text-sm font-medium">
              Override reason
              <textarea
                name="reason"
                minLength={20}
                maxLength={500}
                required
                className="min-h-24 rounded-lg border border-input bg-transparent px-3 py-2 text-sm"
                placeholder="Explain why the customer OTP cannot be obtained."
              />
            </label>

            <label className="grid gap-1 text-sm font-medium">
              Evidence reviewed
              <textarea
                name="evidence"
                minLength={20}
                maxLength={1200}
                required
                className="min-h-28 rounded-lg border border-input bg-transparent px-3 py-2 text-sm"
                placeholder="Summarize proof, support ticket, photos, invoice, call notes, or other evidence."
              />
            </label>

            {error ? (
              <p className="text-sm font-medium text-dashboard-danger">{error}</p>
            ) : null}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                disabled={isPending}
                onClick={() => setOverrideBooking(null)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                Complete booking
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(reviewGarage)}
        onOpenChange={(open) => {
          if (!open) setReviewGarage(null)
        }}
      >
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Garage reviews</DialogTitle>
            <DialogDescription>
              {reviewGarage?.name} · {reviewGarage?.reviewsCount ?? 0} reviews
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-[60vh] space-y-3 overflow-y-auto pr-1">
            {reviewGarage?.reviews?.length ? (
              reviewGarage.reviews.map((review) => (
                <div
                  key={review.id}
                  className="rounded-lg border border-dashboard-panel-border p-4"
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div className="font-medium text-dashboard-text">
                        {review.customerName}
                      </div>
                      <div className="text-sm text-dashboard-muted">
                        {review.serviceName}
                      </div>
                    </div>
                    <div className="text-sm font-semibold text-dashboard-warning">
                      {review.rating}/5
                    </div>
                  </div>
                  <p className="mt-3 text-sm text-dashboard-muted">
                    {review.comment}
                  </p>
                  {review.garageReply ? (
                    <p className="mt-3 rounded-md bg-dashboard-page-bg p-3 text-sm text-dashboard-muted">
                      <span className="font-medium text-dashboard-text">
                        Reply:
                      </span>{" "}
                      {review.garageReply}
                    </p>
                  ) : null}
                </div>
              ))
            ) : (
              <p className="text-sm text-dashboard-muted">
                No reviews for this garage yet.
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(editingGarage)}
        onOpenChange={(open) => {
          if (!open) {
            setEditingGarage(null)
            setError(null)
          }
        }}
      >
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit garage</DialogTitle>
            <DialogDescription>
              Update the garage account and profile information.
            </DialogDescription>
          </DialogHeader>

          <form className="grid gap-4" onSubmit={handleEditSubmit}>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="grid gap-1 text-sm font-medium">
                Garage name
                <Input name="name" defaultValue={editDefaults.name} required />
              </label>
              <label className="grid gap-1 text-sm font-medium">
                Owner
                <Input name="owner" defaultValue={editDefaults.owner} required />
              </label>
              <label className="grid gap-1 text-sm font-medium">
                Email
                <Input
                  name="email"
                  type="email"
                  defaultValue={editDefaults.email}
                />
              </label>
              <label className="grid gap-1 text-sm font-medium">
                Mobile
                <Input name="phone" defaultValue={editDefaults.phone} />
              </label>
              <label className="grid gap-1 text-sm font-medium sm:col-span-2">
                Address
                <Input name="address" defaultValue={editDefaults.address} />
              </label>
              <label className="grid gap-1 text-sm font-medium">
                City
                <Input name="city" defaultValue={editDefaults.city} />
              </label>
              <label className="grid gap-1 text-sm font-medium">
                State
                <Input name="state" defaultValue={editDefaults.state} />
              </label>
              <label className="grid gap-1 text-sm font-medium">
                Country
                <Input name="country" defaultValue={editDefaults.country} />
              </label>
              <label className="grid gap-1 text-sm font-medium">
                Pincode
                <Input name="pincode" defaultValue={editDefaults.pincode} />
              </label>
              <label className="grid gap-1 text-sm font-medium">
                Status
                <select
                  name="status"
                  defaultValue={editDefaults.status}
                  className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm"
                >
                  {(["Active", "Pending", "Suspended"] as GarageStatus[]).map(
                    (status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ),
                  )}
                </select>
              </label>
            </div>

            {error ? (
              <p className="text-sm font-medium text-dashboard-danger">{error}</p>
            ) : null}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditingGarage(null)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                Save changes
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(deletingGarage)}
        onOpenChange={(open) => {
          if (!open) {
            setDeletingGarage(null)
            setError(null)
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete garage?</DialogTitle>
            <DialogDescription>
              This will remove {deletingGarage?.name ?? "this garage"} and its
              connected garage profile, services, and bookings.
            </DialogDescription>
          </DialogHeader>

          {error ? (
            <p className="text-sm font-medium text-dashboard-danger">{error}</p>
          ) : null}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeletingGarage(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={isPending}
              onClick={handleDelete}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
