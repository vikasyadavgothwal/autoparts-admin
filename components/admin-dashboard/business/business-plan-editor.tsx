"use client"

import { useMemo, useState, useTransition } from "react"
import { Copy, Eye, Save } from "lucide-react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
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
  enabledFeatures: string[]
  enabledMenus: string[]
  isActive: boolean
  businessAccountCount: number
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
  Basic: "Password login, staff permissions, and standard backup.",
  Standard: "MFA, permissions, backups, and basic audit logs.",
  Premium: "MFA, SSO-ready controls, advanced permissions, detailed audit logs, and enhanced backup/recovery.",
}

const reportCopy: Record<ReportLevel, string> = {
  dashboard: "Dashboard reports",
  standard: "Dashboard, usage, and activity reports",
  premium: "Advanced dashboard, usage, activity, and deeper analytics",
}

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

const money = (plan: BusinessPlan) =>
  plan.code === "Free" ? "Basic" : plan.price.billingPeriod === "custom" ? "Custom" : `${plan.price.currency} ${(plan.price.amount / 100).toLocaleString("en-US")}`

export function BusinessPlanEditor({ plans }: { plans: BusinessPlan[] }) {
  const router = useRouter()
  const [savingId, setSavingId] = useState<string | null>(null)
  const [selectedAccount, setSelectedAccount] = useState<AccountType>("Fleet")
  const [selectedPlanCode, setSelectedPlanCode] = useState<PlanCode>("Free")
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

  const savePlan = (plan: BusinessPlan, formData: FormData) => {
    if (plan.businessAccountCount > 0 && !window.confirm(`${plan.name} has ${plan.businessAccountCount} active subscriber${plan.businessAccountCount === 1 ? "" : "s"}. Publish changes to this plan?`)) return

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

    const payload: Record<string, string | number | boolean | null> = {
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
      emailNotifications: true,
      whatsappNotifications: supportTier !== "Basic",
      customRolesEnabled: securityTier !== "Basic",
      approvalWorkflowEnabled: securityTier === "Premium",
      apiAccessLevel: plan.code === "Enterprise" ? "enterprise" : plan.code === "Pro" ? "standard" : "none",
      isActive: true,
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
                  <label className="space-y-1 text-xs font-medium text-[#9CA3AF]">Plan name<Input name="name" defaultValue={plan.name} className="bg-[#050505]" /></label>
                  <label className="space-y-1 text-xs font-medium text-[#9CA3AF]">Short description<Input name="description" defaultValue={plan.description ?? ""} className="bg-[#050505]" /></label>
                </div>
              </section>

              <section className="rounded-lg border border-[#2A2A2A] bg-[#050505] p-3">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#9CA3AF]">Usage limits</p>
                <div className="grid grid-cols-2 gap-3">
                  {planLimitFields[plan.accountType].map((key) => (
                    <label key={key} className="space-y-1 text-xs font-medium text-[#9CA3AF]">
                      {fieldLabels[key]}
                      <Input name={key} inputMode="numeric" defaultValue={plan.limits[limitValueKeys[key]] ?? ""} placeholder="Unlimited" className="bg-[#050505]" />
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
                  <label className="space-y-1 text-xs font-medium text-[#9CA3AF]">Monthly price<Input name="price" inputMode="decimal" defaultValue={plan.price.amount / 100} className="bg-[#050505]" /></label>
                  <label className="space-y-1 text-xs font-medium text-[#9CA3AF]">Annual autopay rate<Input name="yearlyPrice" inputMode="decimal" defaultValue={plan.price.yearlyAmount / 100} className="bg-[#050505]" /></label>
                  <label className="space-y-1 text-xs font-medium text-[#9CA3AF]">Currency<Input name="priceCurrency" defaultValue={plan.price.currency} className="bg-[#050505]" /></label>
                  <label className="space-y-1 text-xs font-medium text-[#9CA3AF]">Billing interval<Input name="billingPeriod" defaultValue={plan.price.billingPeriod} className="bg-[#050505]" /></label>
                  <label className="space-y-1 text-xs font-medium text-[#9CA3AF]">Monthly billing days<Input name="monthlyBillingDays" inputMode="numeric" defaultValue={plan.price.monthlyBillingDays} className="bg-[#050505]" /></label>
                  <div className="space-y-1 text-xs font-medium text-[#9CA3AF]">Accounts<p className="flex h-9 items-center rounded-md border border-[#2A2A2A] px-2.5 text-sm text-white">{plan.businessAccountCount}</p></div>
                </div>
              </section>
            )}

            <div className="mt-4 grid gap-4 xl:grid-cols-3">
              <section className="rounded-lg border border-[#2A2A2A] bg-[#050505] p-3">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#9CA3AF]">Reports</p>
                <select name="reportLevel" defaultValue={reportLevel} className="h-9 w-full rounded-md border border-[#2A2A2A] bg-[#050505] px-2.5 text-sm text-[#D1D5DB] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#DC2626]">
                  <option value="dashboard">Dashboard</option>
                  <option value="standard">Standard</option>
                  <option value="premium">Premium</option>
                </select>
                <p className="mt-2 text-xs leading-5 text-[#9CA3AF]">{reportCopy[reportLevel]}</p>
              </section>

              <section className="rounded-lg border border-[#2A2A2A] bg-[#050505] p-3">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#9CA3AF]">Support</p>
                <select name="supportTier" defaultValue={supportTier} className="h-9 w-full rounded-md border border-[#2A2A2A] bg-[#050505] px-2.5 text-sm text-[#D1D5DB] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#DC2626]">
                  <option value="Basic">Basic</option>
                  <option value="Standard">Standard</option>
                  <option value="Premium">Premium</option>
                </select>
                <p className="mt-2 text-xs leading-5 text-[#9CA3AF]">{supportCopy[supportTier]}</p>
              </section>

              <section className="rounded-lg border border-[#2A2A2A] bg-[#050505] p-3">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#9CA3AF]">Login security</p>
                <div className="grid gap-2">
                  <select name="securityTier" defaultValue={securityTier} className="h-9 w-full rounded-md border border-[#2A2A2A] bg-[#050505] px-2.5 text-sm text-[#D1D5DB] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#DC2626]">
                    <option value="Basic">Basic</option>
                    <option value="Standard">Standard</option>
                    <option value="Premium">Premium</option>
                  </select>
                  <select name="loginSecurityMode" defaultValue={loginSecurityMode} className="h-9 w-full rounded-md border border-[#2A2A2A] bg-[#050505] px-2.5 text-sm text-[#D1D5DB] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#DC2626]">
                    <option value="password">Password only</option>
                    <option value="otp">Password + email OTP</option>
                  </select>
                </div>
                <p className="mt-2 text-xs leading-5 text-[#9CA3AF]">{securityCopy[securityTier]}</p>
              </section>
            </div>

            <div className="mt-4 rounded-lg border border-dashed border-[#374151] p-3 text-xs text-[#9CA3AF]">
              <div className="mb-2 flex items-center gap-2 font-semibold text-white"><Eye className="h-4 w-4" /> Preview</div>
              <p>{plan.name} appears for {plan.accountType} accounts at {money(plan)}.</p>
              <p className="mt-1">{reportCopy[reportLevel]} / {supportTier} support / {securityTier} security.</p>
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
    </div>
  )
}
