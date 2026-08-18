"use client"

import { useState, useTransition } from "react"
import { MoreHorizontal } from "lucide-react"
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { StatusTone } from "@/types/admin-dashboard/shared/status-badge"
import type { SectionTableColumn } from "@/types/admin-dashboard/shared/section-table"
import type { UsersTableProps } from "@/types/admin-dashboard/users/users-table"
import type { UserRecord } from "@/types/admin-dashboard/users/users-types"

const USER_STATUS_TONES: Record<UserRecord["status"], StatusTone> = {
  Active: "success",
  Suspended: "danger",
}

const detailRows = (user: UserRecord) => [
  ["User ID", user.id],
  ["Name", user.name],
  ["Email", user.email],
  ["Mobile", user.phone],
  ["Company", user.companyName],
  ["Roles", user.role],
  ["Address", user.address],
  ["City", user.city],
  ["State", user.state],
  ["Postal code", user.postalCode],
  ["Country", user.country],
  ["Orders", String(user.orders)],
  ["RFQs", String(user.rfqs)],
  ["Joined", user.joined],
  ["Last login", user.lastLogin],
  ["Email verified", user.emailVerified ? "Yes" : "No"],
  ["Account status", user.status],
] as const

export function UsersTable({ rows, columns }: UsersTableProps) {
  const router = useRouter()
  const [viewingUser, setViewingUser] = useState<UserRecord | null>(null)
  const [statusTarget, setStatusTarget] = useState<UserRecord | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<UserRecord | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleStatusChange() {
    if (!statusTarget) return
    const isActive = statusTarget.status !== "Active"
    setError(null)

    startTransition(async () => {
      const response = await fetch(
        `/api/v1/admin/users/${statusTarget.internalId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isActive }),
        },
      )
      const payload = (await response.json().catch(() => null)) as
        | { message?: string }
        | null

      if (!response.ok) {
        const message = payload?.message ?? "Unable to update user"
        setError(message)
        toast.error(message)
        return
      }

      toast.success(
        `${statusTarget.id} ${isActive ? "activated" : "suspended"}.`,
      )
      setStatusTarget(null)
      router.refresh()
    })
  }

  function handleDeleteUser() {
    if (!deleteTarget) return
    setError(null)

    startTransition(async () => {
      const response = await fetch(
        `/api/v1/admin/users/${deleteTarget.internalId}`,
        { method: "DELETE" },
      )
      const payload = (await response.json().catch(() => null)) as
        | { message?: string; firebaseDeleted?: boolean }
        | null

      if (!response.ok) {
        const message = payload?.message ?? "Unable to delete user"
        setError(message)
        toast.error(message)
        return
      }

      toast.success(
        payload?.firebaseDeleted === false
          ? `${deleteTarget.id} deleted from database. Firebase deletion needs manual follow-up.`
          : `${deleteTarget.id} deleted.`,
      )
      setDeleteTarget(null)
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
              No user accounts found.
            </td>
          </tr>
        ) : null}

        {rows.map((user) => (
          <tr key={user.internalId} className="dashboard-table-row">
            <td className="dashboard-table-cell">
              <span className="font-medium text-dashboard-accent">{user.id}</span>
            </td>
            <td className="dashboard-table-cell text-dashboard-muted">
              {user.name}
            </td>
            <td className="dashboard-table-cell text-dashboard-muted">
              {user.email}
            </td>
            <td className="dashboard-table-cell">
              <span className="inline-flex max-w-48 whitespace-normal rounded-md bg-dashboard-accent/10 px-2 py-1 text-xs font-medium text-dashboard-accent">
                {user.role}
              </span>
            </td>
            <td className="dashboard-table-cell text-dashboard-muted">
              {user.orders}
            </td>
            <td className="dashboard-table-cell text-dashboard-muted">
              {user.rfqs}
            </td>
            <td className="dashboard-table-cell text-dashboard-muted">
              {user.joined}
            </td>
            <td className="dashboard-table-cell">
              <StatusBadge
                label={user.status}
                tone={USER_STATUS_TONES[user.status]}
              />
            </td>
            <td className="dashboard-table-cell">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    aria-label={`Actions for ${user.name}`}
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-44">
                  <DropdownMenuLabel>Actions</DropdownMenuLabel>
                  <DropdownMenuItem onSelect={() => setViewingUser(user)}>
                    View details
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    disabled={isPending}
                    onSelect={() => setStatusTarget(user)}
                  >
                    {user.status === "Active" ? "Suspend user" : "Activate user"}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    disabled={isPending}
                    className="text-dashboard-danger focus:text-dashboard-danger"
                    onSelect={() => setDeleteTarget(user)}
                  >
                    Delete user
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </td>
          </tr>
        ))}
      </SectionTable>

      <Dialog
        open={Boolean(viewingUser)}
        onOpenChange={(open) => {
          if (!open) setViewingUser(null)
        }}
      >
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{viewingUser?.name}</DialogTitle>
            <DialogDescription>
              {viewingUser?.id} account information
            </DialogDescription>
          </DialogHeader>

          {viewingUser ? (
            <div className="max-h-[65vh] overflow-y-auto border-y border-dashboard-panel-border">
              <dl className="grid sm:grid-cols-2">
                {detailRows(viewingUser).map(([label, value]) => (
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
            <Button type="button" onClick={() => setViewingUser(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(statusTarget)}
        onOpenChange={(open) => {
          if (!open && !isPending) {
            setStatusTarget(null)
            setError(null)
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {statusTarget?.status === "Active"
                ? "Suspend user?"
                : "Activate user?"}
            </DialogTitle>
            <DialogDescription>
              {statusTarget?.status === "Active"
                ? `${statusTarget.name} will no longer be able to use the platform. Approved supplier products from this account will also be hidden.`
                : `${statusTarget?.name ?? "This user"} will regain access to the platform.`}
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
              onClick={() => setStatusTarget(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant={statusTarget?.status === "Active" ? "destructive" : "default"}
              disabled={isPending}
              onClick={handleStatusChange}
            >
              {isPending
                ? "Saving..."
                : statusTarget?.status === "Active"
                  ? "Suspend"
                  : "Activate"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open && !isPending) {
            setDeleteTarget(null)
            setError(null)
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete user permanently?</DialogTitle>
            <DialogDescription>
              This deletes {deleteTarget?.name ?? "this account"} from Admin,
              Firebase Auth, and all connected platform data including role
              profiles, supplier products, orders, RFQs, quotes, vehicles,
              bookings, settings, sessions, notifications, and business account
              data.
            </DialogDescription>
          </DialogHeader>

          {deleteTarget ? (
            <div className="rounded-md border border-dashboard-danger/30 bg-dashboard-danger/10 p-3 text-sm text-dashboard-text">
              <p className="font-medium text-dashboard-danger">
                {deleteTarget.id} · {deleteTarget.role}
              </p>
              <p className="mt-1 text-dashboard-muted">
                This action cannot be undone.
              </p>
            </div>
          ) : null}

          {error ? (
            <p className="text-sm font-medium text-dashboard-danger">{error}</p>
          ) : null}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={isPending}
              onClick={() => setDeleteTarget(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={isPending}
              onClick={handleDeleteUser}
            >
              {isPending ? "Deleting..." : "Delete permanently"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
