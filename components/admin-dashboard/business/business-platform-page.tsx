import { BadgeCheck, Building2, CircleDollarSign, LifeBuoy, Plug, Smartphone, Users } from "lucide-react"

import {
  listBusinessAccounts,
  listAdminBusinessAddOnRequests,
  listAdminBusinessSupportTickets,
  listAdminBusinessSupportContent,
  listBusinessPlans,
} from "@/services/business/business-platform-service"
import { BusinessAccountPlanAssignment } from "./business-account-plan-assignment"
import { BusinessPlanEditor } from "./business-plan-editor"
import { BusinessSupportContentManager } from "./business-support-content-manager"

export async function BusinessPlatformPage({ section = "plans" }: { section?: "plans" | "users" | "support-content" } = {}) {
  const [plans, accounts, addOnRequests, supportTickets, supportContent] = await Promise.all([
    listBusinessPlans(),
    listBusinessAccounts(),
    listAdminBusinessAddOnRequests(),
    listAdminBusinessSupportTickets(),
    listAdminBusinessSupportContent(),
  ])
  const totalStaff = accounts.reduce(
    (sum, account) =>
      sum +
      account.members.filter((member) => member.userId !== account.owner.id).length,
    0,
  )
  const totalDevices = accounts.reduce(
    (sum, account) =>
      sum +
      account.owner.sessions.length +
      account.members.reduce((memberSum, member) => memberSum + member.user.sessions.length, 0),
    0,
  )
  const activePlans = plans.filter((plan) => plan.isActive).length
  const subscribers = plans.reduce((sum, plan) => sum + plan.businessAccountCount, 0)
  const paidAddOns = addOnRequests.filter((request) => request.status === "Enabled" || request.status === "Approved").length
  const openTickets = supportTickets.filter((ticket) => ticket.status === "Open" || ticket.status === "InProgress").length

  return (
    <div className="space-y-8">
      {section === "plans" ? (
        <>
          <section className="overflow-hidden rounded-xl border border-[#2A2A2A] bg-[#0A0A0A] shadow-[0_24px_80px_rgba(0,0,0,0.32)]">
            <div className="border-b border-[#2A2A2A] bg-[linear-gradient(135deg,#171717_0%,#0A0A0A_55%,#220B0B_100%)] px-5 py-6 lg:px-6">
              <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#DC2626]">Subscription control center</p>
                  <h1 className="mt-3 text-3xl font-semibold text-white lg:text-4xl">Plans and Support</h1>

                </div>
                <div className="grid grid-cols-2 gap-3 sm:flex">
                  {[
                    { label: "Active plans", value: activePlans },
                    { label: "Subscribers", value: subscribers },
                    { label: "Paid add-ons", value: paidAddOns },
                    { label: "Open tickets", value: openTickets },
                  ].map((item) => (
                    <div key={item.label} className="rounded-lg border border-white/10 bg-black/30 px-4 py-3 text-right">
                      <p className="text-xl font-semibold text-white">{item.value}</p>
                      <p className="mt-1 text-xs text-[#9CA3AF]">{item.label}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[
              { label: "Plans", value: plans.length, icon: BadgeCheck, detail: `${activePlans} active`, tone: "text-emerald-300 bg-emerald-500/10 border-emerald-500/20" },
              { label: "Business accounts", value: accounts.length, icon: Building2, detail: `${subscribers} subscribed`, tone: "text-[#DC2626] bg-[#DC2626]/10 border-[#DC2626]/20" },
              { label: "Staff users", value: totalStaff, icon: Users, detail: "Invited teams", tone: "text-sky-300 bg-sky-500/10 border-sky-500/20" },
              { label: "Tracked sessions", value: totalDevices, icon: Smartphone, detail: "Owner + staff", tone: "text-violet-300 bg-violet-500/10 border-violet-500/20" },
            ].map((item) => {
              const Icon = item.icon
              return (
                <div key={item.label} className="rounded-xl border border-[#2A2A2A] bg-[#111111] p-4 shadow-[0_18px_45px_rgba(0,0,0,0.24)]">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-[#9CA3AF]">{item.label}</p>
                    <span className={`rounded-lg border p-2 ${item.tone}`}>
                      <Icon className="h-4 w-4" />
                    </span>
                  </div>
                  <p className="mt-3 text-2xl font-semibold text-white">{item.value}</p>
                  <p className="mt-1 text-xs text-[#6B7280]">{item.detail}</p>
                </div>
              )
            })}
          </section>
        </>
      ) : null}

      {section === "plans" ? (
        <section className="space-y-5 rounded-xl border border-[#2A2A2A] bg-[#101010] p-5 shadow-[0_24px_70px_rgba(0,0,0,0.28)]">
          <div className="flex flex-col gap-4 border-b border-[#2A2A2A] pb-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-white">Plan Management</h2>
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              {[
                { label: "Pricing", icon: CircleDollarSign },
                { label: "Integrations", icon: Plug },
                { label: "Support", icon: LifeBuoy },
              ].map((item) => {
                const Icon = item.icon
                return (
                  <span key={item.label} className="inline-flex items-center gap-2 rounded-full border border-[#2A2A2A] bg-[#050505] px-3 py-2 text-[#D1D5DB]">
                    <Icon className="h-3.5 w-3.5 text-[#DC2626]" />
                    {item.label}
                  </span>
                )
              })}
            </div>
          </div>
          <BusinessPlanEditor plans={plans} />
        </section>
      ) : null}

      {section === "users" ? (
        <BusinessAccountPlanAssignment accounts={accounts} plans={plans} />
      ) : null}

      {section === "support-content" ? <BusinessSupportContentManager supportContent={supportContent} /> : null}
    </div>
  )
}
