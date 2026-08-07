"use client"

import { useMemo, useState, useTransition } from "react"
import { AlertCircle, CheckCircle2, Copy, Eye, Save } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

type BusinessPlan = {
  id: string
  code: string
  accountType: string
  name: string
  description: string | null
  price: { amount: number; yearlyAmount: number; currency: string; billingPeriod: string }
  limits: {
    staff: number | null
    roles: number | null
    permissions: number | null
    brands: number | null
    categories: number | null
    vehicles: number | null
    appointments: number | null
    products: number | null
    rfqs: number | null
    orders: number | null
    services: number | null
    savedSearches: number | null
    wishlist: number | null
    integrations: number | null
  }
  support: {
    help: boolean
    onboarding: boolean
    training: boolean
    accountAssistance: boolean
    priority: boolean
  }
  notifications: {
    email: boolean
    whatsapp: boolean
  }
  reports: {
    dashboard: boolean
    usage: boolean
    activity: boolean
  }
  marketplace: {
    featuredVendor: boolean
    searchBoostLevel: number
  }
  apiAccessLevel: string
  approvalWorkflowEnabled: boolean
  customRolesEnabled: boolean
  enabledFeatures: string[]
  enabledMenus: string[]
  isActive: boolean
  businessAccountCount: number
}

const accountOrder = ["Fleet", "Garage", "Supplier"] as const
const planOrder = ["Free", "Pro", "Enterprise"] as const

const fieldLabels = {
  staffLimit: "Staff",
  roleLimit: "Roles",
  permissionLimit: "Permissions",
  vehicleLimit: "Vehicles",
  appointmentLimit: "Appointments",
  productLimit: "Products",
  brandLimit: "Brands",
  categoryLimit: "Categories",
  rfqLimit: "RFQs",
  orderLimit: "Orders",
  serviceLimit: "Services",
  savedSearchLimit: "Saved searches",
  wishlistLimit: "Wishlist items",
  integrationLimit: "API integrations",
} as const

const limitValueKeys = {
  staffLimit: "staff",
  roleLimit: "roles",
  permissionLimit: "permissions",
  brandLimit: "brands",
  categoryLimit: "categories",
  vehicleLimit: "vehicles",
  appointmentLimit: "appointments",
  productLimit: "products",
  rfqLimit: "rfqs",
  orderLimit: "orders",
  serviceLimit: "services",
  savedSearchLimit: "savedSearches",
  wishlistLimit: "wishlist",
  integrationLimit: "integrations",
} as const

const toggleFields = {
  isActive: "Active",
  dashboardReports: "Dashboard reports",
  usageReports: "Usage reports",
  activityReports: "Activity reports",
  helpSupport: "Help support",
  onboarding: "Onboarding",
  training: "Training",
  accountAssistance: "Account assistance",
  prioritySupport: "Priority support",
  emailNotifications: "Email notifications",
  whatsappNotifications: "WhatsApp notifications",
} as const

const marketplaceFields = {
  featuredVendor: "Featured vendor placement",
  searchBoostLevel: "Search boost level",
} as const

const workflowFields = {
  approvalWorkflowEnabled: "Approval workflows",
  customRolesEnabled: "Custom roles",
} as const

const apiAccessOptions = ["none", "standard", "enterprise"] as const

const planTone: Record<string, string> = {
  Free: "border-[#2A2A2A] bg-[#0A0A0A]",
  Pro: "border-[#DC2626]/60 bg-[#140C0C]",
  Enterprise: "border-[#6B7280]/50 bg-[#151515]",
}

const readLimit = (formData: FormData, key: string) => {
  const raw = String(formData.get(key) ?? "").trim()
  if (!raw) return { ok: true as const, value: null }
  if (!/^\d+$/.test(raw)) {
    return { ok: false as const, message: `${fieldLabels[key as keyof typeof fieldLabels]} must be a whole number.` }
  }
  const value = Number(raw)
  if (value > 100000) {
    return { ok: false as const, message: `${fieldLabels[key as keyof typeof fieldLabels]} limit is too high.` }
  }
  return { ok: true as const, value }
}

const readPrice = (formData: FormData) => {
  const raw = String(formData.get("price") ?? "").trim()
  if (!raw) return { ok: false as const, message: "Price is required. Use 0 for free/custom plans." }
  if (!/^\d+(\.\d{1,2})?$/.test(raw)) {
    return { ok: false as const, message: "Price must be a valid amount with up to 2 decimals." }
  }
  const value = Number(raw)
  if (value > 1000000) {
    return { ok: false as const, message: "Price is too high." }
  }
  return { ok: true as const, value }
}

const readMoneyField = (formData: FormData, key: string, label: string) => {
  const raw = String(formData.get(key) ?? "").trim()
  if (!raw) return { ok: false as const, message: `${label} is required. Use 0 for free/custom plans.` }
  if (!/^\d+(\.\d{1,2})?$/.test(raw)) {
    return { ok: false as const, message: `${label} must be a valid amount with up to 2 decimals.` }
  }
  const value = Number(raw)
  if (value > 1000000) {
    return { ok: false as const, message: `${label} is too high.` }
  }
  return { ok: true as const, value }
}

const readCsv = (formData: FormData, key: string) =>
  String(formData.get(key) ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)

const money = (plan: BusinessPlan) =>
  plan.price.billingPeriod === "custom"
    ? "Custom"
    : `${plan.price.currency} ${(plan.price.amount / 100).toLocaleString("en-US")}`

export function BusinessPlanEditor({ plans }: { plans: BusinessPlan[] }) {
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [selectedAccount, setSelectedAccount] = useState<typeof accountOrder[number]>("Fleet")
  const [isPending, startTransition] = useTransition()
  const groupedPlans = useMemo(
    () =>
      accountOrder.map((accountType) => ({
        accountType,
        plans: plans
          .filter((plan) => plan.accountType === accountType)
          .sort((a, b) => planOrder.indexOf(a.code as typeof planOrder[number]) - planOrder.indexOf(b.code as typeof planOrder[number])),
      })),
    [plans],
  )

  const savePlan = (plan: BusinessPlan, formData: FormData) => {
    setMessage(null)
    if (
      plan.businessAccountCount > 0 &&
      !window.confirm(
        `${plan.name} has ${plan.businessAccountCount} active subscriber${plan.businessAccountCount === 1 ? "" : "s"}. Publish changes to this plan?`,
      )
    ) {
      return
    }
    const price = readPrice(formData)
    if (!price.ok) {
      setMessage({ type: "error", text: price.message })
      return
    }
    const yearlyPrice = readMoneyField(formData, "yearlyPrice", "Annual autopay monthly rate")
    if (!yearlyPrice.ok) {
      setMessage({ type: "error", text: yearlyPrice.message })
      return
    }

    const payload: Record<string, string | string[] | number | boolean | null> = {
      priceAmount: Math.round(price.value * 100),
      yearlyPriceAmount: Math.round(yearlyPrice.value * 100),
    }
    payload.name = String(formData.get("name") ?? "").trim()
    payload.description = String(formData.get("description") ?? "").trim()
    payload.priceCurrency = String(formData.get("priceCurrency") ?? "").trim()
    payload.billingPeriod = String(formData.get("billingPeriod") ?? "").trim()
    payload.enabledFeatures = readCsv(formData, "enabledFeatures")
    payload.enabledMenus = readCsv(formData, "enabledMenus")

    if (!payload.name) {
      setMessage({ type: "error", text: "Plan name is required." })
      return
    }
    if (!/^[A-Z]{2,4}$/.test(String(payload.priceCurrency))) {
      setMessage({ type: "error", text: "Currency must be 2 to 4 uppercase letters." })
      return
    }
    if (!payload.billingPeriod) {
      setMessage({ type: "error", text: "Billing interval is required." })
      return
    }

    for (const key of Object.keys(fieldLabels)) {
      const limit = readLimit(formData, key)
      if (!limit.ok) {
        setMessage({ type: "error", text: limit.message })
        return
      }
      payload[key] = limit.value
    }
    for (const key of Object.keys(toggleFields)) {
      payload[key] = formData.get(key) === "on"
    }
    payload.featuredVendor = formData.get("featuredVendor") === "on"
    payload.approvalWorkflowEnabled = formData.get("approvalWorkflowEnabled") === "on"
    payload.customRolesEnabled = formData.get("customRolesEnabled") === "on"

    const apiAccessLevel = String(formData.get("apiAccessLevel") ?? "").trim().toLowerCase()
    if (!apiAccessLevel) {
      setMessage({ type: "error", text: "API access level is required." })
      return
    }
    if (!apiAccessOptions.includes(apiAccessLevel as (typeof apiAccessOptions)[number])) {
      setMessage({ type: "error", text: "API access level must be none, standard, or enterprise." })
      return
    }
    payload.apiAccessLevel = apiAccessLevel

    setSavingId(plan.id)
    startTransition(async () => {
      const response = await fetch(`/api/v1/admin/business/plans/${plan.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      })
      const result = (await response.json().catch(() => null)) as
        | { ok?: boolean; message?: string }
        | null
      setSavingId(null)
      setMessage(
        response.ok && result?.ok
          ? { type: "success", text: "Plan updated successfully." }
          : { type: "error", text: result?.message ?? "Unable to update plan." },
      )
    })
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-3 md:grid-cols-3">
        {groupedPlans.map((group) => (
          <button
            key={group.accountType}
            type="button"
            onClick={() => setSelectedAccount(group.accountType)}
            className={`rounded-lg border p-4 text-left shadow-[0_12px_28px_rgba(0,0,0,0.16)] transition ${
              selectedAccount === group.accountType
                ? "border-[#DC2626] bg-[#180D0D] text-white"
                : "border-[#2A2A2A] bg-[#0A0A0A] text-[#9CA3AF] hover:border-[#DC2626]/40 hover:bg-[#111111]"
            }`}
          >
            <span className="text-xs font-semibold uppercase tracking-wide">
              Role
            </span>
            <div className="mt-2 flex items-end justify-between gap-3">
              <span className="text-xl font-semibold text-white">{group.accountType}</span>
              <span className="text-sm">{group.plans.length} plans</span>
            </div>
          </button>
        ))}
      </div>

      {message ? (
        <div
          className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm ${
            message.type === "success"
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
              : "border-red-500/30 bg-red-500/10 text-red-200"
          }`}
        >
          {message.type === "success" ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
          {message.text}
        </div>
      ) : null}

      <div className="space-y-6">
        {groupedPlans.filter((group) => group.accountType === selectedAccount).map((group) => (
          <section key={group.accountType} className="space-y-3">
            <div className="grid gap-4 xl:grid-cols-3">
              {group.plans.map((plan) => (
                <form
                  key={plan.id}
                  action={(formData) => savePlan(plan, formData)}
                  className={`rounded-lg border p-4 shadow-[0_18px_45px_rgba(0,0,0,0.22)] ${planTone[plan.code] ?? "border-[#2A2A2A] bg-[#111111]"}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-[#9CA3AF]">{plan.code}</p>
                      <h4 className="mt-1 text-lg font-semibold text-white">{plan.name}</h4>
                      <p className="mt-1 min-h-10 text-sm leading-5 text-[#9CA3AF]">{plan.description ?? "No description"}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-semibold text-white">{money(plan)}</p>
                      <p className="text-xs text-[#9CA3AF]">{plan.price.billingPeriod}</p>
                    </div>
                  </div>

                  <div className="mt-4 rounded-lg border border-[#2A2A2A] bg-[#050505] p-3">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#9CA3AF]">Basic information</p>
                    <div className="grid gap-3">
                      <label className="space-y-1 text-xs font-medium text-[#9CA3AF]">
                        Plan name
                        <Input name="name" defaultValue={plan.name} className="bg-[#050505]" />
                      </label>
                      <label className="space-y-1 text-xs font-medium text-[#9CA3AF]">
                        Short description
                        <Input name="description" defaultValue={plan.description ?? ""} className="bg-[#050505]" />
                      </label>
                    </div>
                  </div>

                  <div className="mt-4 rounded-lg border border-[#2A2A2A] bg-[#050505] p-3">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#9CA3AF]">Pricing</p>
                    <div className="grid grid-cols-2 gap-3">
                    <label className="space-y-1 text-xs font-medium text-[#9CA3AF]">
                      Monthly price
                      <Input name="price" inputMode="decimal" defaultValue={plan.price.amount / 100} className="bg-[#050505]" />
                    </label>
                    <label className="space-y-1 text-xs font-medium text-[#9CA3AF]">
                      Annual autopay rate
                      <Input name="yearlyPrice" inputMode="decimal" defaultValue={plan.price.yearlyAmount / 100} className="bg-[#050505]" />
                      <span className="block text-[11px] font-normal text-[#6B7280]">Discounted monthly rate, not full-year charge.</span>
                    </label>
                    <label className="space-y-1 text-xs font-medium text-[#9CA3AF]">
                      Currency
                      <Input name="priceCurrency" defaultValue={plan.price.currency} className="bg-[#050505]" />
                    </label>
                    <label className="space-y-1 text-xs font-medium text-[#9CA3AF]">
                      Billing interval
                      <Input name="billingPeriod" defaultValue={plan.price.billingPeriod} className="bg-[#050505]" />
                    </label>
                    <div className="space-y-1 text-xs font-medium text-[#9CA3AF]">
                      Accounts
                      <p className="flex h-8 items-center rounded-lg border border-[#2A2A2A] px-2.5 text-sm text-white">{plan.businessAccountCount}</p>
                    </div>
                    </div>
                  </div>

                  <div className="mt-4 rounded-lg border border-[#2A2A2A] bg-[#050505] p-3">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#9CA3AF]">Usage limits</p>
                    <div className="grid grid-cols-2 gap-3">
                      {Object.entries(fieldLabels).map(([key, label]) =>
                        key === "integrationLimit" ? null : (
                          <label key={key} className="space-y-1 text-xs font-medium text-[#9CA3AF]">
                            {label}
                            <Input
                              name={key}
                              inputMode="numeric"
                              defaultValue={plan.limits[limitValueKeys[key as keyof typeof limitValueKeys]] ?? ""}
                              placeholder="Unlimited"
                              className="bg-[#050505]"
                            />
                          </label>
                        ),
                      )}
                    </div>
                  </div>

                  <div className="mt-4 rounded-lg border border-[#2A2A2A] bg-[#050505] p-3">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#9CA3AF]">Marketplace visibility</p>
                    <div className="grid gap-2">
                      <label className="flex items-center justify-between gap-3 rounded-md border border-[#2A2A2A] px-3 py-2 text-xs text-[#D1D5DB]">
                        {marketplaceFields.featuredVendor}
                        <input
                          name="featuredVendor"
                          type="checkbox"
                          defaultChecked={plan.marketplace.featuredVendor}
                          className="h-4 w-4 accent-[#DC2626]"
                        />
                      </label>
                      <label className="space-y-1 text-xs font-medium text-[#9CA3AF]">
                        {marketplaceFields.searchBoostLevel}
                        <Input
                          name="searchBoostLevel"
                          inputMode="numeric"
                          defaultValue={plan.marketplace.searchBoostLevel}
                          placeholder="0"
                          className="bg-[#050505]"
                        />
                      </label>
                    </div>
                  </div>

                  <div className="mt-4 rounded-lg border border-[#2A2A2A] bg-[#050505] p-3">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#9CA3AF]">Integrations / API</p>
                    <div className="grid gap-3">
                      <label className="space-y-1 text-xs font-medium text-[#9CA3AF]">
                        Integration limit
                        <Input
                          name="integrationLimit"
                          inputMode="numeric"
                          defaultValue={plan.limits.integrations ?? ""}
                          placeholder="Unlimited"
                          className="bg-[#050505]"
                        />
                      </label>
                      <label className="space-y-1 text-xs font-medium text-[#9CA3AF]">
                        API access level
                        <select
                          name="apiAccessLevel"
                          defaultValue={plan.apiAccessLevel}
                          className="h-9 w-full rounded-md border border-[#2A2A2A] bg-[#050505] px-2.5 text-sm text-[#D1D5DB] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#DC2626]"
                        >
                          {apiAccessOptions.map((option) => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                  </div>

                  <div className="mt-4 rounded-lg border border-[#2A2A2A] bg-[#050505] p-3">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#9CA3AF]">Workflow</p>
                    <div className="grid gap-2">
                      <label className="flex items-center justify-between gap-3 rounded-md border border-[#2A2A2A] px-3 py-2 text-xs text-[#D1D5DB]">
                        {workflowFields.approvalWorkflowEnabled}
                        <input
                          name="approvalWorkflowEnabled"
                          type="checkbox"
                          defaultChecked={plan.approvalWorkflowEnabled}
                          className="h-4 w-4 accent-[#DC2626]"
                        />
                      </label>
                      <label className="flex items-center justify-between gap-3 rounded-md border border-[#2A2A2A] px-3 py-2 text-xs text-[#D1D5DB]">
                        {workflowFields.customRolesEnabled}
                        <input
                          name="customRolesEnabled"
                          type="checkbox"
                          defaultChecked={plan.customRolesEnabled}
                          className="h-4 w-4 accent-[#DC2626]"
                        />
                      </label>
                    </div>
                  </div>

                  <div className="mt-4 rounded-lg border border-[#2A2A2A] bg-[#050505] p-3">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#9CA3AF]">Support / security</p>
                    <div className="grid gap-2">
                      {Object.entries(toggleFields).map(([key, label]) => {
                        const checked =
                          key === "isActive" ? plan.isActive :
                          key === "dashboardReports" ? plan.reports.dashboard :
                          key === "usageReports" ? plan.reports.usage :
                          key === "activityReports" ? plan.reports.activity :
                          key === "helpSupport" ? plan.support.help :
                          key === "onboarding" ? plan.support.onboarding :
                          key === "training" ? plan.support.training :
                          key === "accountAssistance" ? plan.support.accountAssistance :
                          key === "prioritySupport" ? plan.support.priority :
                          key === "emailNotifications" ? plan.notifications.email :
                          plan.notifications.whatsapp
                        return (
                          <label key={key} className="flex items-center justify-between gap-3 rounded-md border border-[#2A2A2A] px-3 py-2 text-xs text-[#D1D5DB]">
                            {label}
                            <input name={key} type="checkbox" defaultChecked={checked} className="h-4 w-4 accent-[#DC2626]" />
                          </label>
                        )
                      })}
                    </div>
                    <label className="mt-3 block space-y-1 text-xs font-medium text-[#9CA3AF]">
                      Feature keys
                      <Input name="enabledFeatures" defaultValue={plan.enabledFeatures.join(", ")} className="bg-[#050505]" />
                    </label>
                    <label className="mt-3 block space-y-1 text-xs font-medium text-[#9CA3AF]">
                      Menu keys
                      <Input name="enabledMenus" defaultValue={plan.enabledMenus.join(", ")} className="bg-[#050505]" />
                    </label>
                  </div>

                  <div className="mt-4 rounded-lg border border-dashed border-[#374151] p-3 text-xs text-[#9CA3AF]">
                    <div className="mb-2 flex items-center gap-2 font-semibold text-white"><Eye className="h-4 w-4" /> Preview</div>
                    <p>{plan.name} appears for {plan.accountType} accounts at {money(plan)}.</p>
                    <p className="mt-1">{plan.enabledFeatures.slice(0, 3).join(", ") || "No feature keys set"}</p>
                  </div>

                  <div className="mt-4 grid gap-2 sm:grid-cols-2">
                    <Button type="button" variant="outline" className="gap-2 border-[#2A2A2A] bg-transparent text-white" disabled>
                      <Copy className="h-4 w-4" />
                      Duplicate
                    </Button>
                    <Button type="submit" className="gap-2" disabled={isPending || savingId === plan.id}>
                      <Save className="h-4 w-4" />
                      {savingId === plan.id ? "Publishing..." : "Publish"}
                    </Button>
                  </div>
                </form>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}
