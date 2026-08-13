"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { CirclePlus, Clock3, Eye, LifeBuoy, MoreHorizontal, Search, Zap } from "lucide-react"

import { Badge } from "@/components/ui/badge"
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

type Account = { id: string; publicId: string; name: string; type: string; plan: { name: string; supportTier?: string } }
type AccountOption = { id: string; publicId: string; name: string; type: string; planName: string; owner: { name: string; email: string | null; phone: string | null } }
type Person = { id: string; name: string; email: string | null } | null
type AddOnRequest = {
  id: string
  label: string
  featureKey: string
  note?: string | null
  status: string
  requestedBy: Person
  businessAccount: Account
  validFrom?: string | null
  validUntil?: string | null
  renewalAt?: string | null
  createdAt: string
}
type SupportTicket = { id: string; subject: string; message: string; status: string; priority: string; category?: string | null; createdBy: Person; businessAccount: Account; createdAt: string }
type PageData<T> = { items: T[]; total: number; page: number; pageSize: number; totalPages: number }
type Queue = "tickets" | "add-ons"
type SelectedItem = { kind: Queue; item: SupportTicket | AddOnRequest }
type AddOnValidityForm = { validFrom: string; validUntil: string; renewalAt: string }
type PendingAction =
  | { type: "status"; kind: Queue; item: SupportTicket | AddOnRequest; status: string; validity?: AddOnValidityForm }
  | { type: "delete"; kind: "tickets"; item: SupportTicket }

const ticketStatuses = ["Open", "InProgress", "Resolved", "Closed"]
const addOnStatuses = ["Requested", "Approved", "Enabled", "Rejected"]
const accountTypes = ["Garage", "Fleet", "Supplier"]
const addOnPresets = [
  { key: "api.standard", label: "API access" },
  { key: "api.enterprise", label: "Enterprise API access" },
  { key: "integrations.manage", label: "Integrations" },
  { key: "reports.usage", label: "Usage reports" },
  { key: "reports.activity", label: "Activity reports" },
  { key: "support.priority", label: "Priority support" },
  { key: "staff.manage", label: "Staff users" },
  { key: "roles.manage", label: "Custom roles" },
  { key: "marketplace.featured-vendor", label: "Featured vendor placement" },
  { key: "marketplace.search-boost", label: "Marketplace search boost" },
  { key: "custom", label: "Custom / capacity key" },
]
const initialManualAddOnForm = {
  businessAccountId: "",
  customFeatureKey: "",
  preset: "api.standard",
  status: "Approved",
  validFrom: "",
  validUntil: "",
}
const statusLabel = (status: string) => status === "InProgress" ? "In Progress" : status
const statusClass = (status: string) => {
  if (status === "Enabled" || status === "Resolved") return "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
  if (status === "Closed") return "border-slate-500/30 bg-slate-500/10 text-slate-300"
  if (status === "Open") return "border-blue-500/30 bg-blue-500/10 text-blue-300"
  if (status === "Rejected") return "border-red-500/30 bg-red-500/10 text-red-300"
  return "border-amber-500/30 bg-amber-500/10 text-amber-200"
}
const priorityClass = (priority: string) => {
  if (priority === "Urgent") return "border-red-500/30 bg-red-500/10 text-red-300"
  if (priority === "Priority") return "border-amber-500/30 bg-amber-500/10 text-amber-200"
  return "border-slate-500/30 bg-slate-500/10 text-slate-300"
}
const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  timeZone: "UTC",
  year: "numeric",
})
const dateTimeFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  month: "short",
  timeZone: "UTC",
  year: "numeric",
})
const formatDateTime = (value: string) => dateTimeFormatter.format(new Date(value))
const formatOptionalDate = (value?: string | null) => value ? dateFormatter.format(new Date(value)) : "Not set"
const dateInputValue = (value?: string | null) => value ? value.slice(0, 10) : ""
const renewalDateFromExpiry = (value: string) => value
const hoursSince = (value: string) => Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 36e5))
const ageLabel = (value: string) => {
  const hours = hoursSince(value)
  if (hours < 1) return "Just now"
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}
const ticketCode = (id: string) => `AUTO-${(id.replace(/[^a-z0-9]/gi, "").slice(-8) || id.slice(-8)).toUpperCase()}`

export function BusinessWorkflowsManager({
  queue,
  addOns,
  tickets,
  counts,
  filters,
}: {
  queue: Queue
  addOns: PageData<AddOnRequest>
  tickets: PageData<SupportTicket>
  counts: { pendingAddOns: number; requestedAddOns?: number; activeTickets: number; newTickets?: number }
  filters: { query: string; status: string; accountType: string }
}) {
  const router = useRouter()
  const [query, setQuery] = useState(filters.query)
  const [status, setStatus] = useState(filters.status || "all")
  const [accountType, setAccountType] = useState(filters.accountType || "all")
  const [selected, setSelected] = useState<SelectedItem | null>(null)
  const [nextStatus, setNextStatus] = useState("")
  const [addOnValidity, setAddOnValidity] = useState<AddOnValidityForm>({ validFrom: "", validUntil: "", renewalAt: "" })
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null)
  const [saving, setSaving] = useState(false)
  const [manualAddOnOpen, setManualAddOnOpen] = useState(false)
  const [manualAddOnForm, setManualAddOnForm] = useState(initialManualAddOnForm)
  const [accountSearch, setAccountSearch] = useState("")
  const [accountOptions, setAccountOptions] = useState<AccountOption[]>([])
  const [selectedAccount, setSelectedAccount] = useState<AccountOption | null>(null)
  const [accountSearchLoading, setAccountSearchLoading] = useState(false)
  const pageData = queue === "tickets" ? tickets : addOns
  const statuses = queue === "tickets" ? ticketStatuses : addOnStatuses
  const manualFeatureKey = manualAddOnForm.preset === "custom"
    ? manualAddOnForm.customFeatureKey.trim()
    : manualAddOnForm.preset

  useEffect(() => {
    if (!manualAddOnOpen) return
    const controller = new AbortController()
    const timeout = window.setTimeout(async () => {
      setAccountSearchLoading(true)
      try {
        const params = new URLSearchParams({ limit: "12" })
        if (accountSearch.trim()) params.set("query", accountSearch.trim())
        const response = await fetch(`/api/v1/admin/business/accounts/search?${params.toString()}`, {
          cache: "no-store",
          signal: controller.signal,
        })
        const payload = (await response.json().catch(() => null)) as { accounts?: AccountOption[] } | null
        if (!controller.signal.aborted) setAccountOptions(payload?.accounts ?? [])
      } catch {
        if (!controller.signal.aborted) setAccountOptions([])
      } finally {
        if (!controller.signal.aborted) setAccountSearchLoading(false)
      }
    }, 250)
    return () => {
      controller.abort()
      window.clearTimeout(timeout)
    }
  }, [accountSearch, manualAddOnOpen])

  function navigate(next: { queue?: Queue; page?: number; query?: string; status?: string; accountType?: string }) {
    const params = new URLSearchParams()
    const nextQueue = next.queue ?? queue
    const nextQuery = next.query ?? query
    const nextStatusValue = next.status ?? status
    const nextAccountType = next.accountType ?? accountType
    params.set("queue", nextQueue)
    if (next.page && next.page > 1) params.set("page", String(next.page))
    if (nextQuery.trim()) params.set("query", nextQuery.trim())
    if (nextStatusValue !== "all") params.set("status", nextStatusValue)
    if (nextAccountType !== "all") params.set("accountType", nextAccountType)
    router.push(`/business-platform/add-ons-support?${params.toString()}`)
  }

  function openDetails(kind: Queue, item: SupportTicket | AddOnRequest) {
    setSelected({ kind, item })
    setNextStatus(item.status)
    if (kind === "add-ons") {
      const addOn = item as AddOnRequest
      setAddOnValidity({
        validFrom: dateInputValue(addOn.validFrom),
        validUntil: dateInputValue(addOn.validUntil),
        renewalAt: dateInputValue(addOn.renewalAt),
      })
    } else {
      setAddOnValidity({ validFrom: "", validUntil: "", renewalAt: "" })
    }
  }

  async function saveStatus(kind: Queue, item: SupportTicket | AddOnRequest, statusValue: string, validity?: AddOnValidityForm) {
    setSaving(true)
    const path = kind === "tickets" ? "support-tickets" : "add-ons"
    const response = await fetch(`/api/v1/admin/business/${path}/${encodeURIComponent(item.id)}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(kind === "add-ons" && validity ? { status: statusValue, ...validity } : { status: statusValue }),
    })
    const result = (await response.json().catch(() => null)) as { ok?: boolean; message?: string } | null
    setSaving(false)
    if (!response.ok || result?.ok === false) return toast.error(result?.message ?? "Unable to update status.")
    toast.success(`Status updated to ${statusLabel(statusValue)}.`)
    setSelected(null)
    router.refresh()
  }

  async function deleteTicket(item: SupportTicket) {
    setSaving(true)
    const response = await fetch(`/api/v1/admin/business/support-tickets/${encodeURIComponent(item.id)}`, { method: "DELETE" })
    setSaving(false)
    if (!response.ok) return toast.error("Unable to delete support ticket.")
    toast.success("Support ticket deleted.")
    setSelected(null)
    router.refresh()
  }

  async function createManualAddOn() {
    const businessAccountId = manualAddOnForm.businessAccountId.trim()
    if (!businessAccountId) return toast.error("Select a business account.")
    if (!manualFeatureKey) return toast.error("Select or enter an add-on key.")

    setSaving(true)
    try {
      const response = await fetch("/api/v1/admin/business/add-ons", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          businessAccountId,
          featureKey: manualFeatureKey,
          status: manualAddOnForm.status,
          validFrom: manualAddOnForm.validFrom,
          validUntil: manualAddOnForm.validUntil,
          renewalAt: renewalDateFromExpiry(manualAddOnForm.validUntil),
        }),
      })
      const result = (await response.json().catch(() => null)) as { ok?: boolean; message?: string } | null
      if (!response.ok || result?.ok === false) {
        toast.error(result?.message ?? "Unable to add business add-on.")
        return
      }
      toast.success("Add-on added successfully.")
      setManualAddOnOpen(false)
      setManualAddOnForm(initialManualAddOnForm)
      setAccountSearch("")
      setSelectedAccount(null)
      router.push(`/business-platform/add-ons-support?queue=add-ons&query=${encodeURIComponent(businessAccountId)}`)
      router.refresh()
    } catch {
      toast.error("Unable to add business add-on.")
    } finally {
      setSaving(false)
    }
  }

  const openManualAddOn = () => {
    setManualAddOnOpen(true)
    setAccountSearch("")
    setSelectedAccount(null)
    setManualAddOnForm((current) => ({ ...current, businessAccountId: "" }))
  }

  async function confirmAction() {
    if (!pendingAction) return
    const action = pendingAction
    setPendingAction(null)
    if (action.type === "delete") return deleteTicket(action.item)
    return saveStatus(action.kind, action.item, action.status, action.validity)
  }

  async function updateStatus() {
    if (!selected || !nextStatus) return
    setPendingAction({
      type: "status",
      kind: selected.kind,
      item: selected.item,
      status: nextStatus,
      validity: selected.kind === "add-ons" ? addOnValidity : undefined,
    })
  }

  const actions = (kind: Queue, item: SupportTicket | AddOnRequest) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Open actions">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => openDetails(kind, item)}>View details</DropdownMenuItem>
        <DropdownMenuSeparator />
        {(kind === "tickets" ? ticketStatuses : addOnStatuses)
          .filter((statusValue) => statusValue !== item.status)
          .map((statusValue) => (
            <DropdownMenuItem
              key={statusValue}
              onClick={() => setPendingAction({ type: "status", kind, item, status: statusValue })}
            >
              Mark as {statusLabel(statusValue)}
            </DropdownMenuItem>
          ))}
        {kind === "tickets" ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={() => setPendingAction({ type: "delete", kind: "tickets", item: item as SupportTicket })}
            >
              Delete ticket
            </DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  )

  const selectedAddOn = selected?.kind === "add-ons" ? selected.item as AddOnRequest : null
  const selectedTicket = selected?.kind === "tickets" ? selected.item as SupportTicket : null
  const addOnValidityChanged = selectedAddOn
    ? addOnValidity.validFrom !== dateInputValue(selectedAddOn.validFrom) ||
      addOnValidity.validUntil !== dateInputValue(selectedAddOn.validUntil) ||
      addOnValidity.renewalAt !== dateInputValue(selectedAddOn.renewalAt)
    : false
  const selectedHasChanges = Boolean(selected && (nextStatus !== selected.item.status || addOnValidityChanged))

  return (
    <section className="space-y-5 rounded-xl border border-[#2A2A2A] bg-[#101010] p-5 shadow-[0_24px_70px_rgba(0,0,0,0.28)]">
      <div className="flex flex-col gap-4 border-b border-[#2A2A2A] pb-5 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#DC2626]">Operations queue</p>
          <h1 className="mt-2 text-2xl font-semibold text-white">Add-ons & Support</h1>
          <p className="mt-1 text-sm text-[#9CA3AF]">Search, filter, review, and update business requests from one queue.</p>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-lg border border-[#DC2626]/30 bg-[#DC2626]/10 px-4 py-3">
            <p className="text-lg font-semibold text-white">{counts.newTickets ?? 0}</p>
            <p className="text-xs text-[#FCA5A5]">New tickets</p>
          </div>
          <div className="rounded-lg border border-[#2A2A2A] bg-[#050505] px-4 py-3">
            <p className="text-lg font-semibold text-white">{counts.activeTickets}</p>
            <p className="text-xs text-[#9CA3AF]">Active tickets</p>
          </div>
          <div className="rounded-lg border border-[#2A2A2A] bg-[#050505] px-4 py-3">
            <p className="text-lg font-semibold text-white">{counts.requestedAddOns ?? counts.pendingAddOns}</p>
            <p className="text-xs text-[#9CA3AF]">New add-ons</p>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <Button variant={queue === "tickets" ? "default" : "outline"} onClick={() => navigate({ queue: "tickets", page: 1, status: "all" })}>
            <LifeBuoy /> Support tickets
          </Button>
          <Button variant={queue === "add-ons" ? "default" : "outline"} onClick={() => navigate({ queue: "add-ons", page: 1, status: "all" })}>
            <CirclePlus /> Add-on requests
          </Button>
        </div>
        {queue === "add-ons" ? (
          <Button onClick={openManualAddOn}>
            <CirclePlus /> Add add-on
          </Button>
        ) : null}
      </div>

      <form
        className="grid gap-3 rounded-lg border border-[#2A2A2A] bg-[#080808] p-4 lg:grid-cols-[minmax(240px,1fr)_180px_180px_auto]"
        onSubmit={(event) => {
          event.preventDefault()
          navigate({ page: 1 })
        }}
      >
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-[#6B7280]" />
          <Input value={query} onChange={(event) => setQuery(event.target.value)} className="pl-9" placeholder="Search subject, message, business, ID or email" />
        </div>
        <Select value={accountType} onValueChange={setAccountType}>
          <SelectTrigger><SelectValue placeholder="Business type" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All business types</SelectItem>
            {accountTypes.map((type) => <SelectItem key={type} value={type}>{type}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {statuses.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button type="submit">Apply filters</Button>
      </form>

      <div className="overflow-hidden rounded-lg border border-[#2A2A2A]">
        <Table>
          <TableHeader className="bg-[#080808]">
            <TableRow>
              {queue === "tickets" ? (
                <>
                  <TableHead>Ticket ID</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </>
              ) : (
                <>
                  <TableHead>Request</TableHead>
                  <TableHead>Business</TableHead>
                  <TableHead>Plan / Type</TableHead>
                  <TableHead>Received</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Fast response</TableHead>
                </>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {queue === "tickets"
              ? tickets.items.map((ticket) => (
                <TableRow key={ticket.id} className={ticket.status === "Open" ? "bg-[#DC2626]/5" : ""}>
                  <TableCell>
                    <p className="font-mono text-sm font-semibold text-white">{ticketCode(ticket.id)}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      {ticket.status === "Open" ? <Badge className="bg-[#DC2626] text-white hover:bg-[#DC2626]">New</Badge> : null}
                      <Badge variant="outline" className={statusClass(ticket.status)}>{statusLabel(ticket.status)}</Badge>
                    </div>
                  </TableCell>
                  <TableCell>
                    <p className="font-medium text-white">{ticket.createdBy?.name ?? ticket.businessAccount.name}</p>
                    <p className="text-xs text-[#9CA3AF]">{ticket.businessAccount.name}</p>
                  </TableCell>
                  <TableCell><p className="font-medium text-white">{ticket.businessAccount.plan.name}</p><p className="text-xs text-[#9CA3AF]">{ticket.businessAccount.type}</p></TableCell>
                  <TableCell><Badge variant="outline" className={priorityClass(ticket.priority)}>{ticket.priority}</Badge></TableCell>
                  <TableCell><p className="font-medium text-white">{formatDateTime(ticket.createdAt)}</p><p className="flex items-center gap-1 text-xs text-[#9CA3AF]"><Clock3 className="h-3 w-3" />{ageLabel(ticket.createdAt)}</p></TableCell>
                  <TableCell className="text-right">
                    <Button type="button" size="sm" variant="outline" className="gap-2" onClick={() => openDetails("tickets", ticket)}>
                      <Eye className="h-4 w-4" />
                      View
                    </Button>
                  </TableCell>
                </TableRow>
              ))
              : addOns.items.map((item) => (
                <TableRow key={item.id} className={item.status === "Requested" ? "bg-[#DC2626]/5" : ""}>
                  <TableCell>
                    {item.status === "Requested" ? <Badge className="mb-2 bg-[#DC2626] text-white hover:bg-[#DC2626]">New</Badge> : null}
                    <p className="font-medium text-white">{item.label}</p>
                    <p className="max-w-xs truncate text-xs text-[#9CA3AF]">{item.featureKey}</p>
                    <p className="text-xs text-[#6B7280]">Expires: {formatOptionalDate(item.validUntil)} · Renewal: {formatOptionalDate(item.renewalAt)}</p>
                  </TableCell>
                  <TableCell><p>{item.businessAccount.name}</p><p className="text-xs text-[#9CA3AF]">{item.businessAccount.publicId}</p></TableCell>
                  <TableCell><p>{item.businessAccount.plan.name}</p><p className="text-xs text-[#9CA3AF]">{item.businessAccount.type}</p></TableCell>
                  <TableCell><p className="font-medium text-white">{formatDateTime(item.createdAt)}</p><p className="flex items-center gap-1 text-xs text-[#9CA3AF]"><Clock3 className="h-3 w-3" />{ageLabel(item.createdAt)}</p></TableCell>
                  <TableCell><Badge variant="outline" className={statusClass(item.status)}>{statusLabel(item.status)}</Badge></TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      {item.status === "Requested" ? (
                        <Button
                          size="sm"
                          onClick={() => setPendingAction({ type: "status", kind: "add-ons", item, status: "Approved" })}
                        >
                          Approve
                        </Button>
                      ) : null}
                      {actions("add-ons", item)}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            {!pageData.items.length ? (
              <TableRow>
                <TableCell colSpan={6} className="h-28 text-center text-[#9CA3AF]">No requests match these filters.</TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </div>

      <div className="flex flex-col gap-3 text-sm text-[#9CA3AF] sm:flex-row sm:items-center sm:justify-between">
        <p>Showing {pageData.total ? (pageData.page - 1) * pageData.pageSize + 1 : 0}-{Math.min(pageData.page * pageData.pageSize, pageData.total)} of {pageData.total}</p>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" disabled={pageData.page <= 1} onClick={() => navigate({ page: pageData.page - 1 })}>Previous</Button>
          <span>Page {pageData.page} of {pageData.totalPages}</span>
          <Button variant="outline" size="sm" disabled={pageData.page >= pageData.totalPages} onClick={() => navigate({ page: pageData.page + 1 })}>Next</Button>
        </div>
      </div>

      <Dialog open={manualAddOnOpen} onOpenChange={setManualAddOnOpen}>
        <DialogContent
          className="max-h-[85vh] overflow-y-auto overflow-x-hidden"
          style={{ width: "min(94vw, 900px)", maxWidth: "min(94vw, 900px)" }}
        >
          <DialogHeader>
            <DialogTitle>Add business add-on</DialogTitle>
            <DialogDescription>
              Manually create or approve an add-on for a business account. Use the public ID from Users & Plans, such as a Garage/Fleet/Supplier business ID.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-5">
            <div className="space-y-3">
              <p className="text-sm font-medium">Business account</p>
              <Input
                value={accountSearch}
                onChange={(event) => {
                  setAccountSearch(event.target.value)
                  setSelectedAccount(null)
                  setManualAddOnForm((current) => ({ ...current, businessAccountId: "" }))
                }}
                placeholder="Search by business name, owner, email, phone, or public ID"
              />
              {selectedAccount ? (
                <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3">
                  <p className="text-sm font-medium text-emerald-100">{selectedAccount.name}</p>
                  <p className="mt-1 text-xs text-emerald-200/80">
                    {selectedAccount.publicId} · {selectedAccount.type} · {selectedAccount.planName}
                  </p>
                  <p className="mt-1 break-all text-xs text-emerald-200/70">
                    Owner: {selectedAccount.owner.name || selectedAccount.owner.email || "Unknown"}
                    {selectedAccount.owner.email ? ` · ${selectedAccount.owner.email}` : ""}
                  </p>
                </div>
              ) : null}
              <div className="max-h-56 overflow-y-auto rounded-lg border border-border bg-background">
                {accountSearchLoading ? (
                  <p className="p-3 text-sm text-muted-foreground">Searching business accounts...</p>
                ) : accountOptions.length ? (
                  accountOptions.map((account) => (
                    <button
                      key={account.id}
                      type="button"
                      onClick={() => {
                        setSelectedAccount(account)
                        setAccountSearch(`${account.name} (${account.publicId})`)
                        setManualAddOnForm((current) => ({ ...current, businessAccountId: account.publicId }))
                      }}
                      className="block w-full border-b border-border/70 p-3 text-left last:border-b-0 hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"
                    >
                      <span className="block text-sm font-medium">{account.name}</span>
                      <span className="mt-1 block text-xs text-muted-foreground">
                        {account.publicId} · {account.type} · {account.planName}
                      </span>
                      <span className="mt-1 block break-all text-xs text-muted-foreground">
                        {account.owner.name || "Owner"}{account.owner.email ? ` · ${account.owner.email}` : ""}
                      </span>
                    </button>
                  ))
                ) : (
                  <p className="p-3 text-sm text-muted-foreground">No matching business accounts found.</p>
                )}
              </div>
            </div>
            <div className="grid gap-5 md:grid-cols-2">
              <div className="space-y-2">
                <p className="text-sm font-medium">Add-on</p>
                <Select
                  value={manualAddOnForm.preset}
                  onValueChange={(value) => setManualAddOnForm((current) => ({ ...current, preset: value }))}
                >
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {addOnPresets.map((preset) => <SelectItem key={preset.key} value={preset.key}>{preset.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium">Status</p>
                <Select
                  value={manualAddOnForm.status}
                  onValueChange={(value) => setManualAddOnForm((current) => ({ ...current, status: value }))}
                >
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {addOnStatuses.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-5 md:grid-cols-2">
              <div className="space-y-2">
                <p className="text-sm font-medium">Valid from</p>
                <Input
                  type="date"
                  value={manualAddOnForm.validFrom}
                  onChange={(event) => setManualAddOnForm((current) => ({ ...current, validFrom: event.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium">Expires on</p>
                <Input
                  type="date"
                  value={manualAddOnForm.validUntil}
                  onChange={(event) => setManualAddOnForm((current) => ({ ...current, validUntil: event.target.value }))}
                />
              </div>
            </div>
            <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm text-muted-foreground">
              Renewal date is calculated automatically from the expiry date
              {manualAddOnForm.validUntil ? `: ${formatOptionalDate(renewalDateFromExpiry(manualAddOnForm.validUntil))}` : "."}
            </div>
            {manualAddOnForm.preset === "custom" ? (
              <div className="space-y-2">
                <p className="text-sm font-medium">Custom feature key</p>
                <Input
                  value={manualAddOnForm.customFeatureKey}
                  onChange={(event) => setManualAddOnForm((current) => ({ ...current, customFeatureKey: event.target.value }))}
                  placeholder="Example: limit.services.8, limit.products.100, api.standard"
                />
                <p className="text-xs text-muted-foreground">Capacity keys use `limit.metric.target`, for example `limit.services.8`.</p>
              </div>
            ) : null}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setManualAddOnOpen(false)}>Cancel</Button>
            <Button disabled={saving} onClick={() => void createManualAddOn()}>{saving ? "Adding..." : "Add add-on"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(selected)} onOpenChange={(open) => { if (!open) setSelected(null) }}>
        <DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto overflow-x-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <DialogHeader>
            <DialogTitle>{selected?.kind === "tickets" ? "Support ticket details" : (selected?.item as AddOnRequest | undefined)?.label}</DialogTitle>
            <DialogDescription>Review the complete request and update its workflow status.</DialogDescription>
          </DialogHeader>
          {selectedTicket ? (
            <div className="grid gap-5">
              <div className="rounded-lg border border-border bg-muted/30 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Subject</p>
                <p className="mt-2 break-words text-base font-semibold text-foreground">{selectedTicket.subject}</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg border border-border bg-background p-4">
                  <p className="text-xs text-muted-foreground">Ticket ID</p>
                  <p className="mt-1 break-all font-mono text-sm font-semibold">{ticketCode(selectedTicket.id)}</p>
                </div>
                <div className="rounded-lg border border-border bg-background p-4">
                  <p className="text-xs text-muted-foreground">Name</p>
                  <p className="mt-1 break-words font-medium">{selectedTicket.createdBy?.name ?? "Unknown"}</p>
                  <p className="mt-1 break-all text-xs text-muted-foreground">{selectedTicket.createdBy?.email ?? "Email not provided"}</p>
                </div>
                <div className="rounded-lg border border-border bg-background p-4">
                  <p className="text-xs text-muted-foreground">Business</p>
                  <p className="mt-1 break-words font-medium">{selectedTicket.businessAccount.name}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{selectedTicket.businessAccount.publicId}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{selectedTicket.businessAccount.type}</p>
                </div>
                <div className="rounded-lg border border-border bg-background p-4">
                  <p className="text-xs text-muted-foreground">Plan</p>
                  <p className="mt-1 break-words font-medium">{selectedTicket.businessAccount.plan.name}</p>
                </div>
                <div className="rounded-lg border border-border bg-background p-4">
                  <p className="text-xs text-muted-foreground">Priority</p>
                  <Badge variant="outline" className={`mt-2 ${priorityClass(selectedTicket.priority)}`}>
                    <Zap className="mr-1 h-3 w-3" />
                    {selectedTicket.priority}
                  </Badge>
                </div>
                <div className="rounded-lg border border-border bg-background p-4">
                  <p className="text-xs text-muted-foreground">Status</p>
                  <Badge className={`mt-2 ${selectedTicket.status === "Open" ? "bg-[#DC2626] text-white hover:bg-[#DC2626]" : statusClass(selectedTicket.status)}`}>
                    {selectedTicket.status === "Open" ? "New request" : statusLabel(selectedTicket.status)}
                  </Badge>
                </div>
                <div className="rounded-lg border border-border bg-background p-4">
                  <p className="text-xs text-muted-foreground">Category</p>
                  <p className="mt-1 break-words font-medium">{selectedTicket.category || "Not selected"}</p>
                </div>
                <div className="rounded-lg border border-border bg-background p-4">
                  <p className="text-xs text-muted-foreground">Received</p>
                  <p className="mt-1 font-medium">{formatDateTime(selectedTicket.createdAt)}</p>
                  <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground"><Clock3 className="h-3 w-3" />{ageLabel(selectedTicket.createdAt)}</p>
                </div>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Message</p>
                <p className="mt-2 max-h-80 overflow-y-auto whitespace-pre-wrap break-words rounded-lg border border-border bg-background p-4 text-sm leading-6">
                  {selectedTicket.message}
                </p>
              </div>
              <div className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-end">
                <div className="flex-1 space-y-2">
                  <p className="text-sm font-medium">Update status</p>
                  <Select value={nextStatus} onValueChange={setNextStatus}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{ticketStatuses.map((item) => <SelectItem key={item} value={item}>{statusLabel(item)}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <Button disabled={saving || !selectedHasChanges} onClick={updateStatus}>{saving ? "Saving..." : "Update status"}</Button>
                <Button variant="destructive" disabled={saving} onClick={() => setPendingAction({ type: "delete", kind: "tickets", item: selectedTicket })}>Delete ticket</Button>
              </div>
            </div>
          ) : selectedAddOn ? (
            <div className="grid gap-5">
              <div className="grid gap-3 rounded-lg border border-border bg-muted/30 p-4 sm:grid-cols-2">
                <div>
                  <p className="text-xs text-muted-foreground">Business</p>
                  <p className="break-words font-medium">{selectedAddOn.businessAccount.name}</p>
                  <p className="break-words text-xs text-muted-foreground">{selectedAddOn.businessAccount.publicId}</p>
                  <p className="text-xs text-muted-foreground">{selectedAddOn.businessAccount.type}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Plan</p>
                  <p className="font-medium">{selectedAddOn.businessAccount.plan.name}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Submitted by</p>
                  <p className="break-words font-medium">{selectedAddOn.requestedBy?.name ?? "Unknown"}</p>
                  <p className="break-all text-xs text-muted-foreground">{selectedAddOn.requestedBy?.email ?? "Email not provided"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Created</p>
                  <p className="font-medium">{formatDateTime(selectedAddOn.createdAt)}</p>
                  <p className="text-xs text-muted-foreground">{ageLabel(selectedAddOn.createdAt)}</p>
                </div>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Request note</p>
                <p className="mt-2 max-h-80 overflow-y-auto whitespace-pre-wrap break-words rounded-lg border border-border bg-background p-4 text-sm leading-6">
                  {selectedAddOn.note || "No note provided."}
                </p>
              </div>
              <div className="grid gap-3 rounded-lg border border-border bg-muted/20 p-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <p className="text-sm font-medium">Valid from</p>
                  <Input
                    type="date"
                    value={addOnValidity.validFrom}
                    onChange={(event) => setAddOnValidity((current) => ({ ...current, validFrom: event.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-medium">Expires on</p>
                  <Input
                    type="date"
                    value={addOnValidity.validUntil}
                    onChange={(event) => setAddOnValidity((current) => ({ ...current, validUntil: event.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-medium">Renewal date</p>
                  <Input
                    type="date"
                    value={addOnValidity.renewalAt}
                    onChange={(event) => setAddOnValidity((current) => ({ ...current, renewalAt: event.target.value }))}
                  />
                </div>
              </div>
              <div className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-end">
                <div className="flex-1 space-y-2">
                  <p className="text-sm font-medium">Update status</p>
                  <Select value={nextStatus} onValueChange={setNextStatus}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{addOnStatuses.map((item) => <SelectItem key={item} value={item}>{statusLabel(item)}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <Button disabled={saving || !selectedHasChanges} onClick={updateStatus}>{saving ? "Saving..." : "Update status"}</Button>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(pendingAction)} onOpenChange={(open) => { if (!open) setPendingAction(null) }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{pendingAction?.type === "delete" ? "Delete support ticket?" : "Confirm status change"}</DialogTitle>
            <DialogDescription>
              {pendingAction?.type === "delete"
                ? "This permanently deletes the ticket and cannot be undone."
                : pendingAction?.type === "status" && pendingAction.status === pendingAction.item.status
                  ? "Save the updated add-on validity dates for this request?"
                  : `Change this request from ${statusLabel(pendingAction?.item.status ?? "current status")} to ${pendingAction?.type === "status" ? statusLabel(pendingAction.status) : ""}?`}
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setPendingAction(null)}>Cancel</Button>
            <Button variant={pendingAction?.type === "delete" ? "destructive" : "default"} disabled={saving} onClick={() => void confirmAction()}>
              {pendingAction?.type === "delete" ? "Delete ticket" : "Confirm change"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  )
}
