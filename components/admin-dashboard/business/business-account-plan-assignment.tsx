"use client"

import { useMemo, useState, useTransition } from "react"
import { BadgeCheck, Eye, KeyRound, MoreHorizontal, RefreshCw, Search, ShieldCheck } from "lucide-react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

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

type BusinessPlan = {
  id: string
  code: string
  accountType: string
  name: string
  isActive: boolean
  price?: { amount: number; currency: string }
  limits: {
    savedSearches: number | null
    wishlist: number | null
    integrations: number | null
    services: number | null
    appointments: number | null
  }
  reports: { dashboard: boolean; usage: boolean; activity: boolean }
  support: { priority: boolean }
  marketplace: { featuredVendor: boolean; searchBoostLevel: number }
  apiAccessLevel: string
  approvalWorkflowEnabled: boolean
  customRolesEnabled: boolean
  enabledFeatures: string[]
  enabledMenus: string[]
}

type BusinessAddOn = {
  id: string
  label: string
  featureKey: string
  status: string
  note?: string | null
  validFrom?: string | null
  validUntil?: string | null
  renewalAt?: string | null
  createdAt: string
}

type BusinessPermission = {
  id: string
  code: string
  name: string
  description?: string | null
  menuKey?: string | null
  featureKey?: string | null
  actionKey?: string | null
  isSystem: boolean
}

type BusinessRole = {
  id: string
  name: string
  description?: string | null
  permissionIds: string[]
  isOwnerRole: boolean
}

type BusinessSession = {
  id: string
  deviceName: string | null
  deviceMacAddress: string | null
  deviceIdentifier: string | null
  userAgent: string | null
  ipHash: string | null
  createdAt: string
  lastUsedAt: string | null
  expiresAt: string
  revokedAt: string | null
}

type BusinessPerson = {
  id?: string
  publicId?: string
  name: string
  email: string | null
  phone?: string | null
  sessions?: BusinessSession[]
}

type BusinessMember = {
  id: string
  userId?: string
  roleIds?: string[]
  status?: string
  joinedAt?: string | null
  createdAt?: string
  user: BusinessPerson
}

type BusinessAccount = {
  id: string
  publicId: string
  type: string
  name: string
  isActive: boolean
  plan: BusinessPlan
  owner: BusinessPerson
  members: BusinessMember[]
  roles: BusinessRole[]
  permissions: BusinessPermission[]
  activeAddOns: BusinessAddOn[]
}

const featureLabels: Record<string, string> = {
  "api.standard": "API access",
  "api.enterprise": "Enterprise API access",
  "approval-workflows.manage": "Approval workflows",
  "business.saved-searches.create": "Saved searches",
  "business.wishlist.create": "Wishlist",
  "dashboard.access": "Dashboard access",
  "fleet.orders.create": "Fleet orders",
  "fleet.rfqs.create": "Fleet RFQs",
  "fleet.vehicles.manage": "Fleet vehicles",
  "garage.bookings.manage": "Garage bookings",
  "garage.schedule.manage": "Garage schedule",
  "garage.services.manage": "Garage services",
  "integrations.manage": "Integrations",
  "marketplace.featured-vendor": "Featured vendor",
  "marketplace.search-boost": "Search boost",
  "permissions.manage": "Permissions",
  "reports.activity": "Activity reports",
  "reports.dashboard": "Dashboard reports",
  "reports.usage": "Usage reports",
  "roles.manage": "Custom roles",
  "staff.manage": "Staff users",
  "supplier.inventory.manage": "Supplier inventory",
  "supplier.orders.manage": "Supplier orders",
  "supplier.rfqs.quote": "Supplier RFQs",
  "support.priority": "Priority support",
}

const limitMetricLabels: Record<string, string> = {
  appointments: "Appointments",
  brands: "Brands",
  categories: "Categories",
  integrations: "Integrations",
  orders: "Orders",
  products: "Products",
  rfqs: "RFQs",
  roles: "Roles",
  savedSearches: "Saved searches",
  services: "Services",
  staff: "Staff users",
  vehicles: "Vehicles",
  wishlist: "Wishlist",
}

const limitMetricFeatures: Record<string, string[]> = {
  appointments: ["garage.bookings.manage", "garage.schedule.manage"],
  integrations: ["integrations.manage"],
  orders: ["fleet.orders.create"],
  products: ["supplier.inventory.manage"],
  rfqs: ["fleet.rfqs.create", "supplier.rfqs.quote"],
  roles: ["roles.manage"],
  savedSearches: ["business.saved-searches.create"],
  services: ["garage.services.manage"],
  staff: ["staff.manage"],
  vehicles: ["fleet.vehicles.manage"],
  wishlist: ["business.wishlist.create"],
}

const parseLimitAddOn = (key: string) => {
  const [prefix, metric, target] = key.split(".")
  return prefix === "limit" && metric && target ? { metric, target } : null
}

const featureLabel = (key: string) => {
  const limitAddOn = parseLimitAddOn(key)
  if (limitAddOn) return `${limitMetricLabels[limitAddOn.metric] ?? limitAddOn.metric} limit: ${limitAddOn.target}`
  return featureLabels[key] ?? key
}

const statusBadgeClass = (status: string) => {
  if (status === "Approved" || status === "Enabled") return "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
  if (status === "Rejected") return "border-red-500/30 bg-red-500/10 text-red-300"
  return "border-blue-500/30 bg-blue-500/10 text-blue-300"
}
const dateFormatter = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", timeZone: "UTC", year: "numeric" })
const dateTimeFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  month: "short",
  timeZone: "UTC",
  year: "numeric",
})
const formatDate = (value?: string | null) => {
  if (!value) return "Not set"
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? "Not set" : dateFormatter.format(date)
}
const formatDateTime = (value?: string | null) => {
  if (!value) return "Not set"
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? "Not set" : dateTimeFormatter.format(date)
}

const displayValue = (value?: string | null, fallback = "Not captured") =>
  value?.trim() ? value : fallback

const browserLabel = (userAgent?: string | null) => {
  if (!userAgent) return "Not captured"
  if (userAgent.includes("Edg/")) return "Microsoft Edge"
  if (userAgent.includes("Firefox/")) return "Firefox"
  if (userAgent.includes("Chrome/") || userAgent.includes("CriOS/")) return "Chrome"
  if (userAgent.includes("Safari/")) return "Safari"
  return "Unknown browser"
}

const sessionStatus = (session: BusinessSession) => {
  if (session.revokedAt) return "Revoked"
  if (new Date(session.expiresAt).getTime() <= Date.now()) return "Expired"
  return "Active"
}

const sessionStatusClass = (status: string) => {
  if (status === "Active") return "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
  if (status === "Revoked") return "border-red-500/30 bg-red-500/10 text-red-300"
  return "border-amber-500/30 bg-amber-500/10 text-amber-300"
}

const sessionGroupsForAccount = (account: BusinessAccount) => [
  {
    key: `owner-${account.owner.id ?? account.id}`,
    label: "Owner",
    name: account.owner.name || account.owner.email || "Owner",
    email: account.owner.email,
    phone: account.owner.phone,
    sessions: account.owner.sessions ?? [],
  },
  ...account.members.map((member, index) => ({
    key: member.id,
    label: `Member ${index + 1}`,
    name: member.user.name || member.user.email || member.userId || "Member",
    email: member.user.email,
    phone: member.user.phone,
    sessions: member.user.sessions ?? [],
  })),
]

const effectiveFeaturesForAccount = (account: BusinessAccount) =>
  Array.from((() => {
    const features = new Set(account.plan.enabledFeatures)
    if (account.plan.reports.dashboard) features.add("reports.dashboard")
    if (account.plan.reports.usage) features.add("reports.usage")
    if (account.plan.reports.activity) features.add("reports.activity")
    if (account.plan.support.priority) features.add("support.priority")
    if (account.plan.limits.savedSearches === null || account.plan.limits.savedSearches > 0) features.add("business.saved-searches.create")
    if (account.plan.limits.wishlist === null || account.plan.limits.wishlist > 0) features.add("business.wishlist.create")
    if (account.plan.limits.integrations === null || account.plan.limits.integrations > 0) features.add("integrations.manage")
    if (account.plan.limits.services === null || account.plan.limits.services > 0) features.add("garage.services.manage")
    if (account.plan.limits.appointments === null || account.plan.limits.appointments > 0) {
      features.add("garage.bookings.manage")
      features.add("garage.schedule.manage")
    }
    if (account.plan.apiAccessLevel === "standard" || account.plan.apiAccessLevel === "enterprise") features.add("api.standard")
    if (account.plan.apiAccessLevel === "enterprise") features.add("api.enterprise")
    if (account.plan.approvalWorkflowEnabled) features.add("approval-workflows.manage")
    if (account.plan.customRolesEnabled) {
      features.add("roles.manage")
      features.add("permissions.manage")
    }
    if (account.plan.marketplace.featuredVendor) features.add("marketplace.featured-vendor")
    if (account.plan.marketplace.searchBoostLevel > 0) features.add("marketplace.search-boost")
    account.activeAddOns.forEach((addOn) => {
      features.add(addOn.featureKey)
      const limitAddOn = parseLimitAddOn(addOn.featureKey)
      if (limitAddOn) {
        limitMetricFeatures[limitAddOn.metric]?.forEach((feature) => features.add(feature))
      }
    })
    return features
  })()).sort()

export function BusinessAccountPlanAssignment({
  accounts,
  plans,
}: {
  accounts: BusinessAccount[]
  plans: BusinessPlan[]
}) {
  const router = useRouter()
  const [selectedPlanByAccount, setSelectedPlanByAccount] = useState<Record<string, string>>({})
  const [detailAccount, setDetailAccount] = useState<BusinessAccount | null>(null)
  const [assignAccount, setAssignAccount] = useState<BusinessAccount | null>(null)
  const [addOnAccount, setAddOnAccount] = useState<BusinessAccount | null>(null)
  const [permissionAccount, setPermissionAccount] = useState<BusinessAccount | null>(null)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [query, setQuery] = useState("")
  const [typeFilter, setTypeFilter] = useState("all")
  const [planFilter, setPlanFilter] = useState("all")
  const [page, setPage] = useState(1)
  const [isPending, startTransition] = useTransition()
  const pageSize = 8
  const activePlansByType = useMemo(() => {
    return plans.reduce<Record<string, BusinessPlan[]>>((groups, plan) => {
      if (!plan.isActive) return groups
      groups[plan.accountType] = [...(groups[plan.accountType] ?? []), plan]
      return groups
    }, {})
  }, [plans])
  const accountTypes = useMemo(() => Array.from(new Set(accounts.map((account) => account.type))).sort(), [accounts])
  const planNames = useMemo(() => Array.from(new Set(accounts.map((account) => account.plan.name))).sort(), [accounts])
  const filteredAccounts = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    return accounts.filter((account) => {
      const addOnText = account.activeAddOns.map((addOn) => `${addOn.label} ${addOn.featureKey}`).join(" ")
      const matchesQuery =
        !normalizedQuery ||
        account.name.toLowerCase().includes(normalizedQuery) ||
        account.publicId.toLowerCase().includes(normalizedQuery) ||
        account.owner.name.toLowerCase().includes(normalizedQuery) ||
        (account.owner.email ?? "").toLowerCase().includes(normalizedQuery) ||
        account.plan.name.toLowerCase().includes(normalizedQuery) ||
        addOnText.toLowerCase().includes(normalizedQuery)
      const matchesType = typeFilter === "all" || account.type === typeFilter
      const matchesPlan = planFilter === "all" || account.plan.name === planFilter
      return matchesQuery && matchesType && matchesPlan
    })
  }, [accounts, planFilter, query, typeFilter])
  const totalPages = Math.max(1, Math.ceil(filteredAccounts.length / pageSize))
  const currentPage = Math.min(page, totalPages)
  const visibleAccounts = filteredAccounts.slice((currentPage - 1) * pageSize, currentPage * pageSize)
  const selectedPlanId = assignAccount ? selectedPlanByAccount[assignAccount.id] ?? assignAccount.plan.id : ""
  const selectedPlanChanged = Boolean(assignAccount && selectedPlanId !== assignAccount.plan.id)
  const permissionFeatures = permissionAccount ? effectiveFeaturesForAccount(permissionAccount) : []
  const detailSessionGroups = detailAccount ? sessionGroupsForAccount(detailAccount) : []

  const openAssignPlan = (account: BusinessAccount) => {
    setSelectedPlanByAccount((current) => ({ ...current, [account.id]: current[account.id] ?? account.plan.id }))
    setAssignAccount(account)
  }

  const openAddOnQueue = (account: BusinessAccount) => {
    const params = new URLSearchParams({ queue: "add-ons", query: account.publicId })
    router.push(`/business-platform/add-ons-support?${params.toString()}`)
  }

  const assignPlan = (account: BusinessAccount) => {
    const planId = selectedPlanByAccount[account.id] ?? account.plan.id
    if (!planId || planId === account.plan.id) {
      toast.error("Select a different plan first.")
      return
    }
    setSavingId(account.id)
    startTransition(async () => {
      const response = await fetch(`/api/v1/admin/business/accounts/${encodeURIComponent(account.id)}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ planId }),
      })
      const result = (await response.json().catch(() => null)) as { ok?: boolean; message?: string } | null
      setSavingId(null)
      if (response.ok && result?.ok) {
        toast.success("Plan assigned successfully.")
        setAssignAccount(null)
        router.refresh()
      } else {
        toast.error(result?.message ?? "Unable to assign plan.")
      }
    })
  }

  return (
    <section className="space-y-5 rounded-xl border border-[#2A2A2A] bg-[#101010] p-5 shadow-[0_24px_70px_rgba(0,0,0,0.28)]">
      <div className="flex flex-col gap-4 border-b border-[#2A2A2A] pb-5 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#DC2626]">Admin plan assignment</p>
          <h2 className="mt-2 text-xl font-semibold text-white">Users & Plans</h2>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-[#9CA3AF]">
            Admin can review each business profile&apos;s plan, active add-on permissions, and configured role permissions from one table.
          </p>
        </div>
        <div className="rounded-lg border border-[#2A2A2A] bg-[#050505] px-4 py-3 text-right">
          <p className="text-lg font-semibold text-white">{accounts.length}</p>
          <p className="text-xs text-[#9CA3AF]">Business profiles</p>
        </div>
      </div>

      <div className="grid gap-3 rounded-lg border border-[#2A2A2A] bg-[#050505] p-4 lg:grid-cols-[1fr_180px_220px]">
        <label className="relative space-y-1 text-xs font-medium text-[#9CA3AF]">
          Search users
          <Search className="pointer-events-none absolute bottom-3 left-3 h-4 w-4 text-[#6B7280]" />
          <Input
            value={query}
            onChange={(event) => {
              setQuery(event.target.value)
              setPage(1)
            }}
            placeholder="Search name, owner, email, plan, ID, add-on..."
            className="bg-[#050505] pl-9"
          />
        </label>
        <div className="space-y-1 text-xs font-medium text-[#9CA3AF]">
          <p>Filter by type</p>
          <Select
            value={typeFilter}
            onValueChange={(value) => {
              setTypeFilter(value)
              setPage(1)
            }}
          >
            <SelectTrigger className="h-10 w-full border-[#2A2A2A] bg-[#050505] text-[#D1D5DB]">
              <SelectValue placeholder="Business type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              {accountTypes.map((type) => <SelectItem key={type} value={type}>{type}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1 text-xs font-medium text-[#9CA3AF]">
          <p>Filter by plan</p>
          <Select
            value={planFilter}
            onValueChange={(value) => {
              setPlanFilter(value)
              setPage(1)
            }}
          >
            <SelectTrigger className="h-10 w-full border-[#2A2A2A] bg-[#050505] text-[#D1D5DB]">
              <SelectValue placeholder="Plan" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All plans</SelectItem>
              {planNames.map((plan) => <SelectItem key={plan} value={plan}>{plan}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-[#2A2A2A]">
        <Table>
          <TableHeader className="bg-[#080808]">
            <TableRow>
              <TableHead>Business user</TableHead>
              <TableHead>Plan / Type</TableHead>
              <TableHead>Active add-ons</TableHead>
              <TableHead>Permissions</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visibleAccounts.map((account) => {
              const addOnPreview = account.activeAddOns.slice(0, 2)
              return (
                <TableRow key={account.id}>
                  <TableCell className="min-w-[280px] whitespace-normal">
                    <p className="font-medium text-white">{account.name}</p>
                    <p className="mt-1 text-xs text-[#9CA3AF]">{account.publicId} · Owner: {account.owner.name || account.owner.email || "Unknown"}</p>
                    {account.owner.email ? <p className="mt-1 break-all text-xs text-[#6B7280]">{account.owner.email}</p> : null}
                  </TableCell>
                  <TableCell className="whitespace-normal">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline" className="border-emerald-500/20 bg-emerald-500/10 text-emerald-200">{account.plan.name}</Badge>
                      <Badge variant="outline" className="border-[#3A3A3A] bg-[#050505] text-[#E5E7EB]">
                        <ShieldCheck className="h-3.5 w-3.5 text-[#DC2626]" />
                        {account.type}
                      </Badge>
                    </div>
                    <p className="mt-2 text-xs text-[#9CA3AF]">Staff {account.members.length}</p>
                  </TableCell>
                  <TableCell className="min-w-[220px] whitespace-normal">
                    {addOnPreview.length ? (
                      <div className="flex flex-wrap gap-1.5">
                        {addOnPreview.map((addOn) => (
                          <Badge key={addOn.id} variant="outline" className={statusBadgeClass(addOn.status)}>
                            {addOn.label}
                          </Badge>
                        ))}
                        {account.activeAddOns.length > addOnPreview.length ? (
                          <Badge variant="outline" className="border-[#3A3A3A] text-[#9CA3AF]">+{account.activeAddOns.length - addOnPreview.length}</Badge>
                        ) : null}
                      </div>
                    ) : (
                      <span className="text-xs text-[#6B7280]">No active add-ons</span>
                    )}
                  </TableCell>
                  <TableCell className="whitespace-normal">
                    <p className="text-sm text-white">{account.roles.length} roles · {account.permissions.length} permissions</p>
                    <p className="mt-1 text-xs text-[#9CA3AF]">{effectiveFeaturesForAccount(account).length} feature permissions · {account.plan.enabledMenus.length} menus</p>
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" aria-label={`Open actions for ${account.name}`}>
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="min-w-48">
                        <DropdownMenuItem onClick={() => setDetailAccount(account)}>
                          <Eye className="h-4 w-4" />
                          View details
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => openAssignPlan(account)}>
                          <RefreshCw className="h-4 w-4" />
                          Assign plan
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setAddOnAccount(account)}>
                          <KeyRound className="h-4 w-4" />
                          View add-ons
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => openAddOnQueue(account)}>
                          <BadgeCheck className="h-4 w-4" />
                          Manage add-on requests
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => setPermissionAccount(account)}>
                          <ShieldCheck className="h-4 w-4" />
                          View permissions
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              )
            })}
            {!visibleAccounts.length ? (
              <TableRow>
                <TableCell colSpan={5} className="h-28 text-center text-[#9CA3AF]">
                  No business users found for this search/filter.
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </div>

      <div className="flex flex-col gap-3 border-t border-[#2A2A2A] pt-4 text-sm text-[#9CA3AF] sm:flex-row sm:items-center sm:justify-between">
        <p>
          Showing {filteredAccounts.length ? (currentPage - 1) * pageSize + 1 : 0}-{Math.min(currentPage * pageSize, filteredAccounts.length)} of {filteredAccounts.length} users
        </p>
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" size="sm" disabled={currentPage <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>Previous</Button>
          <span>Page {currentPage} of {totalPages}</span>
          <Button type="button" variant="outline" size="sm" disabled={currentPage >= totalPages} onClick={() => setPage((value) => Math.min(totalPages, value + 1))}>Next</Button>
        </div>
      </div>

      <Dialog open={Boolean(detailAccount)} onOpenChange={(open) => { if (!open) setDetailAccount(null) }}>
        <DialogContent
          className="max-h-[85vh] overflow-y-auto overflow-x-hidden"
          style={{ width: "min(96vw, 1180px)", maxWidth: "min(96vw, 1180px)" }}
        >
          <DialogHeader>
            <DialogTitle>User and device details</DialogTitle>
            <DialogDescription>
              Login sessions tracked for this business account owner and staff members.
            </DialogDescription>
          </DialogHeader>
          {detailAccount ? (
            <div className="space-y-5">
              <div className="grid gap-3 rounded-lg border border-border bg-muted/30 p-4 sm:grid-cols-4">
                <div>
                  <p className="text-xs text-muted-foreground">Business</p>
                  <p className="break-words font-medium">{detailAccount.name}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Public ID</p>
                  <p className="break-all font-medium">{detailAccount.publicId}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Type</p>
                  <p className="font-medium">{detailAccount.type}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Plan</p>
                  <p className="font-medium">{detailAccount.plan.name}</p>
                </div>
              </div>

              <section className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium">Tracked login sessions</p>
                  <Badge variant="outline" className="border-[#3A3A3A] text-[#D1D5DB]">
                    {detailSessionGroups.reduce((total, group) => total + group.sessions.length, 0)} sessions
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  Browser apps cannot expose the real client MAC address. MAC is shown only when a native or managed client sends it.
                </p>
                <div className="space-y-3">
                  {detailSessionGroups.map((group) => (
                    <div key={group.key} className="rounded-lg border border-border bg-background p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium">{group.label}: {group.name}</p>
                          <p className="mt-1 break-all text-xs text-muted-foreground">
                            {[group.email, group.phone].filter(Boolean).join(" · ") || "No contact details"}
                          </p>
                        </div>
                        <Badge variant="outline" className="border-[#3A3A3A] text-[#D1D5DB]">{group.sessions.length} sessions</Badge>
                      </div>

                      {group.sessions.length ? (
                        <div className="mt-3 space-y-3">
                          {group.sessions.map((session) => {
                            const status = sessionStatus(session)
                            return (
                              <div key={session.id} className="rounded-md border border-border bg-muted/20 p-3">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <p className="font-medium">{displayValue(session.deviceName, browserLabel(session.userAgent))}</p>
                                  <Badge variant="outline" className={sessionStatusClass(status)}>{status}</Badge>
                                </div>
                                <dl className="mt-3 grid gap-3 text-xs sm:grid-cols-2">
                                  <div>
                                    <dt className="text-muted-foreground">Browser</dt>
                                    <dd className="mt-1 font-medium">{browserLabel(session.userAgent)}</dd>
                                  </div>
                                  <div>
                                    <dt className="text-muted-foreground">Device ID</dt>
                                    <dd className="mt-1 break-all font-medium">{displayValue(session.deviceIdentifier)}</dd>
                                  </div>
                                  <div>
                                    <dt className="text-muted-foreground">MAC address</dt>
                                    <dd className="mt-1 break-all font-medium">{displayValue(session.deviceMacAddress, "Unavailable from browser")}</dd>
                                  </div>
                                  <div>
                                    <dt className="text-muted-foreground">IP hash</dt>
                                    <dd className="mt-1 break-all font-medium">{displayValue(session.ipHash)}</dd>
                                  </div>
                                  <div>
                                    <dt className="text-muted-foreground">Last used</dt>
                                    <dd className="mt-1 font-medium">{formatDateTime(session.lastUsedAt)}</dd>
                                  </div>
                                  <div>
                                    <dt className="text-muted-foreground">Expires</dt>
                                    <dd className="mt-1 font-medium">{formatDateTime(session.expiresAt)}</dd>
                                  </div>
                                </dl>
                                <p className="mt-3 break-all text-xs text-muted-foreground">
                                  User agent: {displayValue(session.userAgent)}
                                </p>
                              </div>
                            )
                          })}
                        </div>
                      ) : (
                        <p className="mt-3 rounded-md border border-border bg-muted/20 p-3 text-sm text-muted-foreground">
                          No sessions have been tracked for this person yet.
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            </div>
          ) : null}
          <DialogFooter>
            <Button onClick={() => setDetailAccount(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(assignAccount)} onOpenChange={(open) => { if (!open) setAssignAccount(null) }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Assign plan</DialogTitle>
            <DialogDescription>
              Change the assigned plan for {assignAccount?.name}. Downgrade limits are still validated by the backend.
            </DialogDescription>
          </DialogHeader>
          {assignAccount ? (
            <div className="space-y-4">
              <div className="rounded-lg border border-border bg-muted/30 p-4">
                <p className="text-sm font-medium">{assignAccount.name}</p>
                <p className="mt-1 text-xs text-muted-foreground">{assignAccount.publicId} · Current plan: {assignAccount.plan.name}</p>
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium">New plan</p>
                <Select
                  value={selectedPlanId}
                  onValueChange={(value) => setSelectedPlanByAccount((current) => ({ ...current, [assignAccount.id]: value }))}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select plan" />
                  </SelectTrigger>
                  <SelectContent>
                    {(activePlansByType[assignAccount.type] ?? []).map((plan) => (
                      <SelectItem key={plan.id} value={plan.id}>{plan.name} ({plan.code})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignAccount(null)}>Cancel</Button>
            <Button disabled={!assignAccount || isPending || savingId === assignAccount.id || !selectedPlanChanged} onClick={() => assignAccount && assignPlan(assignAccount)}>
              {assignAccount && savingId === assignAccount.id ? "Assigning..." : "Assign plan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(addOnAccount)} onOpenChange={(open) => { if (!open) setAddOnAccount(null) }}>
        <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add-on permissions</DialogTitle>
            <DialogDescription>
              Active approved/enabled add-ons currently extending this business account beyond its base plan.
            </DialogDescription>
          </DialogHeader>
          {addOnAccount ? (
            <div className="space-y-4">
              <div className="rounded-lg border border-border bg-muted/30 p-4">
                <p className="font-medium">{addOnAccount.name}</p>
                <p className="mt-1 text-xs text-muted-foreground">{addOnAccount.publicId} · {addOnAccount.type} · {addOnAccount.plan.name}</p>
              </div>
              {addOnAccount.activeAddOns.length ? (
                <div className="grid gap-3">
                  {addOnAccount.activeAddOns.map((addOn) => (
                    <div key={addOn.id} className="rounded-lg border border-border bg-background p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="font-medium">{addOn.label}</p>
                        <Badge variant="outline" className={statusBadgeClass(addOn.status)}>{addOn.status}</Badge>
                      </div>
                      <p className="mt-1 break-all text-xs text-muted-foreground">{addOn.featureKey}</p>
                      <dl className="mt-3 grid gap-3 text-xs sm:grid-cols-3">
                        <div><dt className="text-muted-foreground">Valid from</dt><dd className="mt-1 font-medium">{formatDate(addOn.validFrom)}</dd></div>
                        <div><dt className="text-muted-foreground">Expires</dt><dd className="mt-1 font-medium">{formatDate(addOn.validUntil)}</dd></div>
                        <div><dt className="text-muted-foreground">Renewal</dt><dd className="mt-1 font-medium">{formatDate(addOn.renewalAt)}</dd></div>
                      </dl>
                      {addOn.note ? <p className="mt-3 whitespace-pre-wrap break-words text-sm text-muted-foreground">{addOn.note}</p> : null}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="rounded-lg border border-border bg-background p-4 text-sm text-muted-foreground">No active add-ons are enabled for this account.</p>
              )}
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOnAccount(null)}>Close</Button>
            <Button onClick={() => addOnAccount && openAddOnQueue(addOnAccount)}>Open add-on queue</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(permissionAccount)} onOpenChange={(open) => { if (!open) setPermissionAccount(null) }}>
        <DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Plan and role permissions</DialogTitle>
            <DialogDescription>
              Review what this business account can access from its plan, active add-ons, menus, roles, and configured permissions.
            </DialogDescription>
          </DialogHeader>
          {permissionAccount ? (
            <div className="space-y-5">
              <div className="grid gap-3 rounded-lg border border-border bg-muted/30 p-4 sm:grid-cols-3">
                <div>
                  <p className="text-xs text-muted-foreground">Business</p>
                  <p className="break-words font-medium">{permissionAccount.name}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Plan</p>
                  <p className="font-medium">{permissionAccount.plan.name}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Active add-ons</p>
                  <p className="font-medium">{permissionAccount.activeAddOns.length}</p>
                </div>
              </div>

              <section className="space-y-2">
                <p className="text-sm font-medium">Effective feature permissions</p>
                <div className="flex max-h-40 flex-wrap gap-2 overflow-y-auto rounded-lg border border-border bg-background p-3">
                  {permissionFeatures.length ? permissionFeatures.map((feature) => (
                    <Badge key={feature} variant="outline" className="border-[#3A3A3A] text-[#D1D5DB]">{featureLabel(feature)}</Badge>
                  )) : <span className="text-sm text-muted-foreground">No feature permissions configured.</span>}
                </div>
              </section>

              <section className="space-y-2">
                <p className="text-sm font-medium">Dashboard menus</p>
                <div className="flex max-h-32 flex-wrap gap-2 overflow-y-auto rounded-lg border border-border bg-background p-3">
                  {permissionAccount.plan.enabledMenus.length ? permissionAccount.plan.enabledMenus.map((menu) => (
                    <Badge key={menu} variant="outline" className="border-[#3A3A3A] text-[#D1D5DB]">{menu}</Badge>
                  )) : <span className="text-sm text-muted-foreground">No dashboard menus configured.</span>}
                </div>
              </section>

              <section className="grid gap-3 lg:grid-cols-2">
                <div className="space-y-2">
                  <p className="text-sm font-medium">Roles</p>
                  <div className="max-h-56 space-y-2 overflow-y-auto rounded-lg border border-border bg-background p-3">
                    {permissionAccount.roles.length ? permissionAccount.roles.map((role) => (
                      <div key={role.id} className="rounded-md border border-border p-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium">{role.name}</p>
                          {role.isOwnerRole ? <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-300">Owner</Badge> : null}
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">{role.permissionIds.length} assigned permissions</p>
                      </div>
                    )) : <p className="text-sm text-muted-foreground">No roles configured.</p>}
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-medium">Permission library</p>
                  <div className="max-h-56 space-y-2 overflow-y-auto rounded-lg border border-border bg-background p-3">
                    {permissionAccount.permissions.length ? permissionAccount.permissions.map((permission) => (
                      <div key={permission.id} className="rounded-md border border-border p-3">
                        <p className="font-medium">{permission.name}</p>
                        <p className="mt-1 break-all text-xs text-muted-foreground">{permission.code}</p>
                        {[permission.menuKey, permission.featureKey, permission.actionKey].filter(Boolean).length ? (
                          <p className="mt-1 text-xs text-muted-foreground">
                            {[permission.menuKey, permission.featureKey, permission.actionKey].filter(Boolean).join(" · ")}
                          </p>
                        ) : null}
                      </div>
                    )) : <p className="text-sm text-muted-foreground">No permissions configured.</p>}
                  </div>
                </div>
              </section>
            </div>
          ) : null}
          <DialogFooter>
            <Button onClick={() => setPermissionAccount(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  )
}
