"use client"

import { useEffect, useMemo, useState, useTransition } from "react"
import { Copy, Eye, Save } from "lucide-react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"

type AccountType = "Fleet" | "Garage" | "Supplier"
type PlanCode = "Free" | "Pro" | "Enterprise"
type SecurityTier = "Basic" | "Standard" | "Premium"
type SupportTier = "Basic" | "Standard" | "Premium"
type LoginSecurityMode = "password" | "otp"
type ReportLevel = "dashboard" | "standard" | "premium"

type BusinessPlan = {
  id: string
  code: PlanCode
  accountType: AccountType
  name: string
  description: string | null
  price: { amount: number; yearlyAmount: number; currency: string; billingPeriod: string; monthlyBillingDays: number }
  securityTier?: SecurityTier
  supportTier?: SupportTier
  loginSecurityMode?: LoginSecurityMode
  reportLevel?: ReportLevel
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
    integrations: number | null
  }
  marketplace?: { featuredVendor: boolean; featuredVendorCategoryLimit: number | null; allowedCategoryIds: string[]; searchBoostLevel: number }
  notifications?: { email: boolean; mobile: boolean; whatsapp: boolean }
  enabledFeatures: string[]
  enabledMenus: string[]
  isActive: boolean
  businessAccountCount: number
}
type FeaturedCategoryOption = {
  categoryId: string
  categoryName: string
  parentName?: string | null
  productCount?: number
}

const accountOrder: AccountType[] = ["Fleet", "Garage", "Supplier"]
const planOrder: PlanCode[] = ["Free", "Pro", "Enterprise"]

const fieldLabels = {
  staffLimit: "Staff",
  roleLimit: "Roles",
  vehicleLimit: "Vehicles",
  appointmentLimit: "Appointments",
  productLimit: "Products",
  brandLimit: "Brands",
  categoryLimit: "Categories",
  rfqLimit: "RFQs",
  orderLimit: "Orders",
  serviceLimit: "Services",
} as const

const planLimitFields: Record<AccountType, Array<keyof typeof fieldLabels>> = {
  Fleet: ["staffLimit", "roleLimit", "vehicleLimit", "rfqLimit", "orderLimit"],
  Garage: ["staffLimit", "roleLimit", "serviceLimit", "appointmentLimit"],
  Supplier: ["staffLimit", "roleLimit", "productLimit", "brandLimit", "categoryLimit", "rfqLimit", "orderLimit"],
}

const limitValueKeys = {
  staffLimit: "staff",
  roleLimit: "roles",
  brandLimit: "brands",
  categoryLimit: "categories",
  vehicleLimit: "vehicles",
  appointmentLimit: "appointments",
  productLimit: "products",
  rfqLimit: "rfqs",
  orderLimit: "orders",
  serviceLimit: "services",
} as const

const planTone: Record<PlanCode, string> = {
  Free: "border-[#2A2A2A] bg-[#0A0A0A]",
  Pro: "border-[#DC2626]/60 bg-[#140C0C]",
  Enterprise: "border-[#6B7280]/50 bg-[#151515]",
}

const defaultSupplierSearchBoostLevel: Record<PlanCode, number> = {
  Free: 1,
  Pro: 1,
  Enterprise: 2,
}

const tierDefaults: Record<PlanCode, { securityTier: SecurityTier; supportTier: SupportTier; loginSecurityMode: LoginSecurityMode; reportLevel: ReportLevel }> = {
  Free: { securityTier: "Basic", supportTier: "Basic", loginSecurityMode: "password", reportLevel: "dashboard" },
  Pro: { securityTier: "Standard", supportTier: "Standard", loginSecurityMode: "otp", reportLevel: "standard" },
  Enterprise: { securityTier: "Premium", supportTier: "Premium", loginSecurityMode: "otp", reportLevel: "premium" },
}

const supportCopy: Record<SupportTier, string> = {
  Basic: "Help videos, FAQ, and standard support request.",
  Standard: "Help videos, FAQ, faster response, and basic account assistance.",
  Premium: "Priority support, faster response, account assistance, onboarding, and training.",
}

const securityCopy: Record<SecurityTier, string> = {
  Basic: "Password login.",
  Standard: "Password login with email OTP verification.",
  Premium: "Password login with email OTP, SSO-ready controls, audit logs, and enhanced backup/recovery.",
}

const loginSecurityCopy: Record<LoginSecurityMode, string> = {
  password: "Password only",
  otp: "Password + email OTP",
}

const reportCopy: Record<ReportLevel, string> = {
  dashboard: "Dashboard reports",
  standard: "Dashboard, usage, and activity reports",
  premium: "Advanced dashboard, usage, activity, and deeper analytics",
}
const invalidNumberKeys = new Set(["e", "E", "+", "-"])
const RequiredMark = () => <span aria-hidden="true" className="text-[#DC2626]"> *</span>
const categoryPageSize = 10

const readLimit = (formData: FormData, key: keyof typeof fieldLabels) => {
  const raw = String(formData.get(key) ?? "").trim()
  if (!raw) return { ok: true as const, value: null }
  if (!/^\d+$/.test(raw)) return { ok: false as const, message: `${fieldLabels[key]} must be a whole number.` }
  const value = Number(raw)
  if (value > 100000) return { ok: false as const, message: `${fieldLabels[key]} limit is too high.` }
  return { ok: true as const, value }
}

const readMoney = (formData: FormData, key: string, label: string) => {
  const raw = String(formData.get(key) ?? "").trim()
  if (!raw) return { ok: false as const, message: `${label} is required. Use 0 for free/custom plans.` }
  if (!/^\d+(\.\d{1,2})?$/.test(raw)) return { ok: false as const, message: `${label} must be a valid amount with up to 2 decimals.` }
  const value = Number(raw)
  if (value > 1000000) return { ok: false as const, message: `${label} is too high.` }
  return { ok: true as const, value }
}

const readOptionalWholeNumber = (formData: FormData, key: string, label: string, max = 100000) => {
  const raw = String(formData.get(key) ?? "").trim()
  if (!raw) return { ok: true as const, value: null }
  if (!/^\d+$/.test(raw)) return { ok: false as const, message: `${label} must be a whole number.` }
  const value = Number(raw)
  if (value > max) return { ok: false as const, message: `${label} is too high.` }
  return { ok: true as const, value }
}

const money = (plan: BusinessPlan) =>
  plan.code === "Free" ? "Basic" : plan.price.billingPeriod === "custom" ? "Custom" : `${plan.price.currency} ${(plan.price.amount / 100).toLocaleString("en-US")}`

export function BusinessPlanEditor({ plans }: { plans: BusinessPlan[] }) {
  const router = useRouter()
  const [savingId, setSavingId] = useState<string | null>(null)
  const [pendingPlanSave, setPendingPlanSave] = useState<{ plan: BusinessPlan; formData: FormData } | null>(null)
  const [selectedAccount, setSelectedAccount] = useState<AccountType>("Fleet")
  const [selectedPlanCode, setSelectedPlanCode] = useState<PlanCode>("Free")
  const [featuredCategoryOptions, setFeaturedCategoryOptions] = useState<FeaturedCategoryOption[]>([])
  const [categoryQuery, setCategoryQuery] = useState("")
  const [productCountFilter, setProductCountFilter] = useState("all")
  const [categoryPage, setCategoryPage] = useState(1)
  const [selectedCategoryIdsByPlan, setSelectedCategoryIdsByPlan] = useState<Record<string, string[]>>({})
  const [isPending, startTransition] = useTransition()
  const groupedPlans = useMemo(
    () =>
      accountOrder.map((accountType) => ({
        accountType,
        plans: plans
          .filter((plan) => plan.accountType === accountType)
          .sort((a, b) => planOrder.indexOf(a.code) - planOrder.indexOf(b.code)),
      })),
    [plans],
  )
  const selectedPlans = groupedPlans.find((group) => group.accountType === selectedAccount)?.plans ?? []
  const visiblePlans = selectedPlans.filter((plan) => plan.code === selectedPlanCode)

  useEffect(() => {
    void fetch("/api/v1/admin/business/add-on-prices", { cache: "no-store" })
      .then((response) => response.json())
      .then((payload: { featuredCategoryPrices?: FeaturedCategoryOption[] }) => setFeaturedCategoryOptions(payload.featuredCategoryPrices ?? []))
      .catch(() => setFeaturedCategoryOptions([]))
  }, [])

  const savePlan = (plan: BusinessPlan, formData: FormData) => {
    if (plan.businessAccountCount > 0) {
      setPendingPlanSave({ plan, formData })
      return
    }
    submitPlan(plan, formData)
  }

  const submitPlan = (plan: BusinessPlan, formData: FormData) => {
    const price = readMoney(formData, "price", "Monthly price")
    if (!price.ok) return toast.error(price.message)
    const yearlyPrice = readMoney(formData, "yearlyPrice", "Annual autopay monthly rate")
    if (!yearlyPrice.ok) return toast.error(yearlyPrice.message)

    const monthlyBillingDays = String(formData.get("monthlyBillingDays") ?? "").trim()
    if (!/^\d+$/.test(monthlyBillingDays) || Number(monthlyBillingDays) < 1 || Number(monthlyBillingDays) > 366) {
      toast.error("Monthly billing days must be between 1 and 366.")
      return
    }

    const securityTier = String(formData.get("securityTier") ?? tierDefaults[plan.code].securityTier) as SecurityTier
    const supportTier = String(formData.get("supportTier") ?? tierDefaults[plan.code].supportTier) as SupportTier
    const loginSecurityMode = String(formData.get("loginSecurityMode") ?? tierDefaults[plan.code].loginSecurityMode) as LoginSecurityMode
    const reportLevel = String(formData.get("reportLevel") ?? tierDefaults[plan.code].reportLevel) as ReportLevel

    const payload: Record<string, string | number | boolean | null | string[]> = {
      name: String(formData.get("name") ?? "").trim(),
      description: String(formData.get("description") ?? "").trim(),
      priceAmount: Math.round(price.value * 100),
      yearlyPriceAmount: Math.round(yearlyPrice.value * 100),
      priceCurrency: String(formData.get("priceCurrency") ?? "").trim(),
      billingPeriod: String(formData.get("billingPeriod") ?? "").trim(),
      monthlyBillingDays: Number(monthlyBillingDays),
      securityTier,
      supportTier,
      loginSecurityMode,
      reportLevel,
      dashboardReports: true,
      usageReports: reportLevel !== "dashboard",
      activityReports: reportLevel !== "dashboard",
      helpSupport: true,
      prioritySupport: supportTier !== "Basic",
      accountAssistance: supportTier !== "Basic",
      onboarding: supportTier === "Premium",
      training: supportTier === "Premium",
      emailNotifications: formData.get("emailNotifications") === "on",
      whatsappNotifications: formData.get("whatsappNotifications") === "on",
      customRolesEnabled: securityTier !== "Basic",
      approvalWorkflowEnabled: securityTier === "Premium",
      apiAccessLevel: plan.code === "Enterprise" ? "enterprise" : plan.code === "Pro" ? "standard" : "none",
      isActive: true,
    }
    if (plan.accountType === "Supplier") {
      const featuredCategoryLimit = readOptionalWholeNumber(formData, "featuredVendorCategoryLimit", "Featured category limit", 100000)
      if (!featuredCategoryLimit.ok) return toast.error(featuredCategoryLimit.message)
      const allowedFeaturedVendorCategoryIds = formData.getAll("allowedFeaturedVendorCategoryIds").filter((value): value is string => typeof value === "string")
      payload.featuredVendor = formData.get("featuredVendor") === "on"
      payload.featuredVendorCategoryLimit = payload.featuredVendor ? featuredCategoryLimit.value : null
      payload.allowedFeaturedVendorCategoryIds = payload.featuredVendor ? allowedFeaturedVendorCategoryIds : []
      payload.searchBoostLevel = formData.get("marketplaceSearchBoostEnabled") === "on"
        ? Math.max(plan.marketplace?.searchBoostLevel ?? 0, defaultSupplierSearchBoostLevel[plan.code])
        : 0
      if (payload.featuredVendor && !allowedFeaturedVendorCategoryIds.length) return toast.error("Select at least one allowed Featured Vendor category.")
    }

    if (!payload.name) return toast.error("Plan name is required.")
    if (!/^[A-Z]{2,4}$/.test(String(payload.priceCurrency))) return toast.error("Currency must be 2 to 4 uppercase letters.")
    if (!payload.billingPeriod) return toast.error("Billing interval is required.")

    for (const key of planLimitFields[plan.accountType]) {
      const limit = readLimit(formData, key)
      if (!limit.ok) return toast.error(limit.message)
      payload[key] = limit.value
    }

    setSavingId(plan.id)
    startTransition(async () => {
      const response = await fetch(`/api/v1/admin/business/plans/${plan.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      })
      const result = (await response.json().catch(() => null)) as { ok?: boolean; message?: string; plan?: BusinessPlan } | null
      setSavingId(null)
      if (response.ok && result?.ok) {
        setPendingPlanSave(null)
        toast.success("Plan updated successfully.")
        router.refresh()
      } else {
        toast.error(result?.message ?? "Unable to update plan.")
      }
    })
  }

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-[#2A2A2A] bg-[#080808] p-3 shadow-[0_18px_50px_rgba(0,0,0,0.22)]">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#DC2626]">Plan workspace</p>
            <h3 className="mt-1 text-lg font-semibold text-white">{selectedAccount} plans</h3>
          </div>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="inline-flex rounded-lg border border-[#2A2A2A] bg-[#050505] p-1">
              {groupedPlans.map((group) => (
                <button key={group.accountType} type="button" onClick={() => { setSelectedAccount(group.accountType); setSelectedPlanCode("Free") }} className={`rounded-md px-4 py-2 text-sm font-medium transition ${selectedAccount === group.accountType ? "bg-[#DC2626] text-white shadow-[0_10px_22px_rgba(220,38,38,0.25)]" : "text-[#9CA3AF] hover:bg-[#111111] hover:text-white"}`}>
                  {group.accountType}
                </button>
              ))}
            </div>
            <div className="inline-flex rounded-lg border border-[#2A2A2A] bg-[#050505] p-1">
              {selectedPlans.map((plan) => (
                <button key={plan.id} type="button" onClick={() => setSelectedPlanCode(plan.code)} className={`rounded-md px-4 py-2 text-sm font-medium transition ${selectedPlanCode === plan.code ? "bg-white text-[#0A0A0A]" : "text-[#9CA3AF] hover:bg-[#111111] hover:text-white"}`}>
                  {plan.code}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {visiblePlans.map((plan) => {
        const defaults = tierDefaults[plan.code]
        const securityTier = plan.securityTier ?? defaults.securityTier
        const supportTier = plan.supportTier ?? defaults.supportTier
        const loginSecurityMode = plan.loginSecurityMode ?? defaults.loginSecurityMode
        const reportLevel = plan.reportLevel ?? defaults.reportLevel
        return (
          <form key={plan.id} onSubmit={(event) => { event.preventDefault(); savePlan(plan, new FormData(event.currentTarget)) }} className={`rounded-lg border p-4 shadow-[0_18px_45px_rgba(0,0,0,0.22)] ${planTone[plan.code]}`}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-[#9CA3AF]">{plan.accountType} / {plan.code}</p>
                <h4 className="mt-1 text-lg font-semibold text-white">{plan.name}</h4>
                <p className="mt-1 min-h-10 text-sm leading-5 text-[#9CA3AF]">{plan.description ?? "No description"}</p>
              </div>
              {plan.code !== "Free" ? <div className="text-right"><p className="text-lg font-semibold text-white">{money(plan)}</p><p className="text-xs text-[#9CA3AF]">{plan.price.billingPeriod}</p></div> : null}
            </div>

            <div className="mt-4 grid gap-4 xl:grid-cols-2">
              <section className="rounded-lg border border-[#2A2A2A] bg-[#050505] p-3">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#9CA3AF]">Basic information</p>
                <div className="grid gap-3">
                  <label className="space-y-1 text-xs font-medium text-[#9CA3AF]">Plan name<RequiredMark /><Input name="name" defaultValue={plan.name} maxLength={80} className="bg-[#050505]" /></label>
                  <label className="space-y-1 text-xs font-medium text-[#9CA3AF]">Short description<Input name="description" defaultValue={plan.description ?? ""} maxLength={160} className="bg-[#050505]" /></label>
                </div>
              </section>

              <section className="rounded-lg border border-[#2A2A2A] bg-[#050505] p-3">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#9CA3AF]">Usage limits</p>
                <div className="grid grid-cols-2 gap-3">
                  {planLimitFields[plan.accountType].map((key) => (
                    <label key={key} className="space-y-1 text-xs font-medium text-[#9CA3AF]">
                      {fieldLabels[key]}
                      <Input name={key} type="number" min={0} max={100000} step={1} inputMode="numeric" defaultValue={plan.limits[limitValueKeys[key]] ?? ""} placeholder="Unlimited" onKeyDown={(event) => { if (invalidNumberKeys.has(event.key)) event.preventDefault() }} className="bg-[#050505]" />
                    </label>
                  ))}
                </div>
              </section>
            </div>

            {plan.code === "Free" ? (
              <>
                <input type="hidden" name="price" value={plan.price.amount / 100} />
                <input type="hidden" name="yearlyPrice" value={plan.price.yearlyAmount / 100} />
                <input type="hidden" name="priceCurrency" value={plan.price.currency} />
                <input type="hidden" name="billingPeriod" value={plan.price.billingPeriod} />
                <input type="hidden" name="monthlyBillingDays" value={plan.price.monthlyBillingDays} />
              </>
            ) : (
              <section className="mt-4 rounded-lg border border-[#2A2A2A] bg-[#050505] p-3">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#9CA3AF]">Pricing</p>
                <div className="grid gap-3 md:grid-cols-3">
                  <label className="space-y-1 text-xs font-medium text-[#9CA3AF]">Monthly price<RequiredMark /><Input name="price" type="number" min={0} max={1000000} step="0.01" inputMode="decimal" defaultValue={plan.price.amount / 100} onKeyDown={(event) => { if (invalidNumberKeys.has(event.key)) event.preventDefault() }} className="bg-[#050505]" /></label>
                  <label className="space-y-1 text-xs font-medium text-[#9CA3AF]">Annual autopay rate<RequiredMark /><Input name="yearlyPrice" type="number" min={0} max={1000000} step="0.01" inputMode="decimal" defaultValue={plan.price.yearlyAmount / 100} onKeyDown={(event) => { if (invalidNumberKeys.has(event.key)) event.preventDefault() }} className="bg-[#050505]" /></label>
                  <label className="space-y-1 text-xs font-medium text-[#9CA3AF]">Currency<RequiredMark /><Input name="priceCurrency" defaultValue={plan.price.currency} maxLength={4} className="bg-[#050505] uppercase" /></label>
                  <label className="space-y-1 text-xs font-medium text-[#9CA3AF]">Billing interval<RequiredMark /><Input name="billingPeriod" defaultValue={plan.price.billingPeriod} maxLength={30} className="bg-[#050505]" /></label>
                  <label className="space-y-1 text-xs font-medium text-[#9CA3AF]">Monthly billing days<RequiredMark /><Input name="monthlyBillingDays" type="number" min={1} max={366} step={1} inputMode="numeric" defaultValue={plan.price.monthlyBillingDays} onKeyDown={(event) => { if (invalidNumberKeys.has(event.key)) event.preventDefault() }} className="bg-[#050505]" /></label>
                  <div className="space-y-1 text-xs font-medium text-[#9CA3AF]">Accounts<p className="flex h-9 items-center rounded-md border border-[#2A2A2A] px-2.5 text-sm text-white">{plan.businessAccountCount}</p></div>
                </div>
              </section>
            )}

            <div className="mt-4 grid gap-4 xl:grid-cols-3">
              <section className="rounded-lg border border-[#2A2A2A] bg-[#050505] p-3">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#9CA3AF]">Reports<RequiredMark /></p>
                <select name="reportLevel" defaultValue={reportLevel} className="h-9 w-full rounded-md border border-[#2A2A2A] bg-[#050505] px-2.5 text-sm text-[#D1D5DB] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#DC2626]">
                  <option value="dashboard">Dashboard</option>
                  <option value="standard">Standard</option>
                  <option value="premium">Premium</option>
                </select>
                <p className="mt-2 text-xs leading-5 text-[#9CA3AF]">{reportCopy[reportLevel]}</p>
              </section>

              <section className="rounded-lg border border-[#2A2A2A] bg-[#050505] p-3">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#9CA3AF]">Support<RequiredMark /></p>
                <select name="supportTier" defaultValue={supportTier} className="h-9 w-full rounded-md border border-[#2A2A2A] bg-[#050505] px-2.5 text-sm text-[#D1D5DB] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#DC2626]">
                  <option value="Basic">Basic</option>
                  <option value="Standard">Standard</option>
                  <option value="Premium">Premium</option>
                </select>
                <p className="mt-2 text-xs leading-5 text-[#9CA3AF]">{supportCopy[supportTier]}</p>
              </section>

              <section className="rounded-lg border border-[#2A2A2A] bg-[#050505] p-3">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#9CA3AF]">Login security<RequiredMark /></p>
                <div className="grid gap-2">
                  <input type="hidden" name="securityTier" value={securityTier} />
                  <select name="loginSecurityMode" defaultValue={loginSecurityMode} className="h-9 w-full rounded-md border border-[#2A2A2A] bg-[#050505] px-2.5 text-sm text-[#D1D5DB] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#DC2626]">
                    <option value="password">{loginSecurityCopy.password}</option>
                    <option value="otp">{loginSecurityCopy.otp}</option>
                  </select>
                </div>
                <p className="mt-2 text-xs leading-5 text-[#9CA3AF]">{loginSecurityCopy[loginSecurityMode]}</p>
              </section>
            </div>

            <section className="mt-4 rounded-lg border border-[#2A2A2A] bg-[#050505] p-3">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-[#9CA3AF]">Notifications</p>
              <div className="grid gap-3 md:grid-cols-2">
                <label className="flex items-start gap-2 text-sm font-medium text-[#D1D5DB]">
                  <Checkbox name="emailNotifications" defaultChecked={plan.notifications?.email ?? true} />
                  <span>
                    Email
                    <span className="block text-xs font-normal text-[#9CA3AF]">Send plan-allowed operational emails.</span>
                  </span>
                </label>
                <label className="flex items-start gap-2 text-sm font-medium text-[#D1D5DB]">
                  <Checkbox name="whatsappNotifications" defaultChecked={plan.notifications?.whatsapp ?? supportTier !== "Basic"} />
                  <span>
                    WhatsApp
                    <span className="block text-xs font-normal text-[#9CA3AF]">Saved for plan control. Sending is not enabled yet.</span>
                  </span>
                </label>
              </div>
            </section>

            {plan.accountType === "Supplier" ? (
              <section className="mt-4 rounded-lg border border-[#2A2A2A] bg-[#050505] p-3">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-[#9CA3AF]">Marketplace</p>
                <div className="grid gap-3 md:grid-cols-[1fr_1fr_160px]">
                  <label className="flex items-center gap-2 text-sm font-medium text-[#D1D5DB]">
                    <Checkbox name="featuredVendor" defaultChecked={plan.marketplace?.featuredVendor === true} />
                    Featured Vendor included
                  </label>
                  <label className="flex items-center gap-2 text-sm font-medium text-[#D1D5DB]">
                    <Checkbox name="marketplaceSearchBoostEnabled" defaultChecked={(plan.marketplace?.searchBoostLevel ?? 0) > 0} />
                    Marketplace ranking boost
                  </label>
                  <label className="space-y-1 text-xs font-medium text-[#9CA3AF]">
                    Category limit
                    <Input
                      name="featuredVendorCategoryLimit"
                      type="number"
                      min={0}
                      max={100000}
                      step={1}
                      inputMode="numeric"
                      defaultValue={plan.marketplace?.featuredVendorCategoryLimit ?? ""}
                      placeholder="Unlimited"
                      onKeyDown={(event) => { if (invalidNumberKeys.has(event.key)) event.preventDefault() }}
                      className="bg-[#050505]"
                    />
                  </label>
                </div>
                <div className="mt-4 space-y-2">
                  {(() => {
                    const selectedIds = selectedCategoryIdsByPlan[plan.id] ?? plan.marketplace?.allowedCategoryIds ?? []
                    const filteredCategories = featuredCategoryOptions.filter((category) => {
                      const query = categoryQuery.trim().toLowerCase()
                      const productCount = category.productCount ?? 0
                      const matchesQuery = !query || `${category.categoryName} ${category.parentName ?? ""}`.toLowerCase().includes(query)
                      const matchesProductFilter =
                        productCountFilter === "all" ||
                        (productCountFilter === "has-products" && productCount > 0) ||
                        (productCountFilter === "no-products" && productCount === 0) ||
                        (productCountFilter === "5-plus" && productCount >= 5) ||
                        (productCountFilter === "10-plus" && productCount >= 10)
                      return matchesQuery && matchesProductFilter
                    })
                    const totalPages = Math.max(1, Math.ceil(filteredCategories.length / categoryPageSize))
                    const safePage = Math.min(categoryPage, totalPages)
                    const pageCategories = filteredCategories.slice((safePage - 1) * categoryPageSize, safePage * categoryPageSize)
                    const toggleCategory = (categoryId: string, checked: boolean) => {
                      setSelectedCategoryIdsByPlan((current) => {
                        const currentIds = current[plan.id] ?? plan.marketplace?.allowedCategoryIds ?? []
                        const nextIds = checked
                          ? Array.from(new Set([...currentIds, categoryId]))
                          : currentIds.filter((id) => id !== categoryId)
                        return { ...current, [plan.id]: nextIds }
                      })
                    }

                    return (
                      <>
                        {selectedIds.map((categoryId) => (
                          <input key={categoryId} type="hidden" name="allowedFeaturedVendorCategoryIds" value={categoryId} />
                        ))}
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                          <div>
                            <p className="text-xs font-medium text-[#9CA3AF]">Allowed plan categories</p>
                            <p className="mt-1 text-xs text-[#6B7280]">{selectedIds.length} selected</p>
                          </div>
                          <div className="grid gap-2 sm:grid-cols-[minmax(220px,1fr)_180px]">
                            <Input
                              value={categoryQuery}
                              maxLength={100}
                              onChange={(event) => {
                                setCategoryQuery(event.target.value.slice(0, 100))
                                setCategoryPage(1)
                              }}
                              placeholder="Search category or parent"
                              className="bg-[#050505]"
                            />
                            <select
                              value={productCountFilter}
                              onChange={(event) => {
                                setProductCountFilter(event.target.value)
                                setCategoryPage(1)
                              }}
                              className="h-9 rounded-md border border-[#2A2A2A] bg-[#050505] px-2.5 text-sm text-[#D1D5DB] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#DC2626]"
                            >
                              <option value="all">All product counts</option>
                              <option value="has-products">Has products</option>
                              <option value="no-products">No products</option>
                              <option value="5-plus">5+ products</option>
                              <option value="10-plus">10+ products</option>
                            </select>
                          </div>
                        </div>
                        <div className="overflow-hidden rounded-md border border-[#2A2A2A]">
                          <div className="grid grid-cols-[42px_minmax(180px,1fr)_minmax(140px,220px)_90px] border-b border-[#2A2A2A] bg-[#080808] px-3 py-2 text-xs font-semibold uppercase tracking-wide text-[#9CA3AF]">
                            <span />
                            <span>Category</span>
                            <span>Parent</span>
                            <span className="text-right">Products</span>
                          </div>
                          {pageCategories.length ? pageCategories.map((category) => (
                            <label key={category.categoryId} className="grid cursor-pointer grid-cols-[42px_minmax(180px,1fr)_minmax(140px,220px)_90px] items-center border-b border-[#2A2A2A] px-3 py-2 text-sm last:border-b-0">
                              <Checkbox
                                checked={selectedIds.includes(category.categoryId)}
                                onCheckedChange={(checked) => toggleCategory(category.categoryId, checked === true)}
                              />
                              <span className="font-medium text-[#D1D5DB]">{category.categoryName}</span>
                              <span className="text-xs text-[#9CA3AF]">{category.parentName ?? "Root category"}</span>
                              <span className="text-right text-xs text-[#9CA3AF]">{category.productCount ?? 0}</span>
                            </label>
                          )) : (
                            <p className="p-3 text-sm text-[#9CA3AF]">No categories match this search or filter.</p>
                          )}
                        </div>
                        <div className="flex flex-col gap-2 text-xs text-[#9CA3AF] sm:flex-row sm:items-center sm:justify-between">
                          <p>
                            Showing {filteredCategories.length ? (safePage - 1) * categoryPageSize + 1 : 0}
                            -{Math.min(safePage * categoryPageSize, filteredCategories.length)} of {filteredCategories.length}
                          </p>
                          <div className="flex items-center gap-2">
                            <Button type="button" variant="outline" size="sm" disabled={safePage <= 1} onClick={() => setCategoryPage((page) => Math.max(1, page - 1))}>Previous</Button>
                            <span>Page {safePage} of {totalPages}</span>
                            <Button type="button" variant="outline" size="sm" disabled={safePage >= totalPages} onClick={() => setCategoryPage((page) => Math.min(totalPages, page + 1))}>Next</Button>
                          </div>
                        </div>
                      </>
                    )
                  })()}
                </div>
              </section>
            ) : null}

            <div className="mt-4 rounded-lg border border-dashed border-[#374151] p-3 text-xs text-[#9CA3AF]">
              <div className="mb-2 flex items-center gap-2 font-semibold text-white"><Eye className="h-4 w-4" /> Preview</div>
              <p>{plan.name} appears for {plan.accountType} accounts at {money(plan)}.</p>
              <p className="mt-1">{reportCopy[reportLevel]} / {supportTier} support / {loginSecurityCopy[loginSecurityMode]}.</p>
            </div>

            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              <Button type="button" variant="outline" className="gap-2 border-[#2A2A2A] bg-transparent text-white" disabled><Copy className="h-4 w-4" /> Duplicate</Button>
              <Button type="button" className="gap-2" disabled={isPending || savingId === plan.id} onClick={(event) => { const form = event.currentTarget.form; if (form) savePlan(plan, new FormData(form)) }}>
                <Save className="h-4 w-4" />{savingId === plan.id ? "Publishing..." : "Publish"}
              </Button>
            </div>
          </form>
        )
      })}
      <Dialog open={Boolean(pendingPlanSave)} onOpenChange={(open) => { if (!open) setPendingPlanSave(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Publish plan changes</DialogTitle>
            <DialogDescription>
              {pendingPlanSave?.plan.name} has {pendingPlanSave?.plan.businessAccountCount} active subscriber{pendingPlanSave?.plan.businessAccountCount === 1 ? "" : "s"}. Publish changes to this plan?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={Boolean(savingId)}>Cancel</Button>
            </DialogClose>
            <Button
              type="button"
              disabled={Boolean(savingId)}
              onClick={() => {
                if (!pendingPlanSave) return
                submitPlan(pendingPlanSave.plan, pendingPlanSave.formData)
              }}
            >
              {savingId ? "Publishing..." : "Publish changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
