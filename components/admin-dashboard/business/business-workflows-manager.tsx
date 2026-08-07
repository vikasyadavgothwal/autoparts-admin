"use client"

import { useState } from "react"
import { CheckCircle2, Clock3, LifeBuoy, Plug, XCircle } from "lucide-react"

type AddOnRequest = {
  id: string
  label: string
  status: string
  businessAccount: { name: string; type: string; plan: { name: string } }
}

type SupportTicket = {
  id: string
  subject: string
  status: string
  priority: string
  businessAccount: { name: string; type: string; plan: { name: string } }
}

export function BusinessWorkflowsManager({
  addOnRequests,
  supportTickets,
}: {
  addOnRequests: AddOnRequest[]
  supportTickets: SupportTicket[]
}) {
  const [message, setMessage] = useState<string | null>(null)
  const pendingAddOns = addOnRequests.filter((item) => item.status === "Requested" || item.status === "Approved").length
  const activeTickets = supportTickets.filter((ticket) => ticket.status === "Open" || ticket.status === "InProgress").length

  async function updateAddOn(id: string, status: string) {
    setMessage(null)
    const response = await fetch(`/api/v1/admin/business/add-ons/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status }),
    })
    setMessage(response.ok ? "Add-on request updated. Refresh to see latest status." : "Unable to update add-on request.")
  }

  async function updateTicket(id: string, status: string) {
    setMessage(null)
    const response = await fetch(`/api/v1/admin/business/support-tickets/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status }),
    })
    setMessage(response.ok ? "Support ticket updated. Refresh to see latest status." : "Unable to update support ticket.")
  }

  return (
    <section className="space-y-5 rounded-xl border border-[#2A2A2A] bg-[#101010] p-5 shadow-[0_24px_70px_rgba(0,0,0,0.28)]">
      <div className="flex flex-col gap-4 border-b border-[#2A2A2A] pb-5 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#DC2626]">Operations queue</p>
          <h2 className="mt-2 text-xl font-semibold text-white">Add-ons & Support</h2>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-[#9CA3AF]">Approve business add-ons and manage support tickets from plan-based dashboards.</p>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:flex">
          <div className="rounded-lg border border-[#2A2A2A] bg-[#050505] px-4 py-3">
            <p className="text-lg font-semibold text-white">{pendingAddOns}</p>
            <p className="text-xs text-[#9CA3AF]">Pending add-ons</p>
          </div>
          <div className="rounded-lg border border-[#2A2A2A] bg-[#050505] px-4 py-3">
            <p className="text-lg font-semibold text-white">{activeTickets}</p>
            <p className="text-xs text-[#9CA3AF]">Active tickets</p>
          </div>
        </div>
      </div>
      {message ? <p className="rounded-md border border-[#2A2A2A] bg-[#1A1A1A] px-3 py-2 text-sm text-[#E5E7EB]">{message}</p> : null}
      <div className="grid gap-4 xl:grid-cols-2">
        <div className="rounded-xl border border-[#2A2A2A] bg-[#0A0A0A] p-4">
          <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-[#D1D5DB]">
            <Plug className="h-4 w-4 text-[#DC2626]" />
            Add-on requests
          </h3>
          <div className="mt-4 grid gap-3">
            {addOnRequests.length ? addOnRequests.map((item) => (
              <div key={item.id} className="rounded-lg border border-[#2A2A2A] bg-[#141414] p-4 shadow-[0_10px_25px_rgba(0,0,0,0.18)]">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-medium text-white">{item.label}</p>
                    <p className="text-xs text-[#9CA3AF]">{item.businessAccount.name} · {item.businessAccount.type} · {item.businessAccount.plan.name}</p>
                  </div>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-[#3A3A3A] bg-[#050505] px-2.5 py-1 text-xs text-[#E5E7EB]">
                    {item.status === "Enabled" ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-300" /> : item.status === "Rejected" ? <XCircle className="h-3.5 w-3.5 text-red-300" /> : <Clock3 className="h-3.5 w-3.5 text-amber-300" />}
                    {item.status}
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {["Approved", "Enabled", "Rejected"].map((status) => (
                    <button key={status} type="button" onClick={() => updateAddOn(item.id, status)} className="rounded-md border border-[#3A3A3A] bg-[#050505] px-3 py-1.5 text-xs text-white transition hover:border-[#DC2626]/50 hover:bg-[#1F1111]">{status}</button>
                  ))}
                </div>
              </div>
            )) : <p className="text-sm text-[#9CA3AF]">No add-on requests.</p>}
          </div>
        </div>
        <div className="rounded-xl border border-[#2A2A2A] bg-[#0A0A0A] p-4">
          <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-[#D1D5DB]">
            <LifeBuoy className="h-4 w-4 text-[#DC2626]" />
            Support tickets
          </h3>
          <div className="mt-4 grid gap-3">
            {supportTickets.length ? supportTickets.map((ticket) => (
              <div key={ticket.id} className="rounded-lg border border-[#2A2A2A] bg-[#141414] p-4 shadow-[0_10px_25px_rgba(0,0,0,0.18)]">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-medium text-white">{ticket.subject}</p>
                    <p className="text-xs text-[#9CA3AF]">{ticket.businessAccount.name} · {ticket.priority} · {ticket.businessAccount.plan.name}</p>
                  </div>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-[#3A3A3A] bg-[#050505] px-2.5 py-1 text-xs text-[#E5E7EB]">
                    {ticket.status === "Resolved" || ticket.status === "Closed" ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-300" /> : <Clock3 className="h-3.5 w-3.5 text-amber-300" />}
                    {ticket.status}
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {["InProgress", "Resolved", "Closed"].map((status) => (
                    <button key={status} type="button" onClick={() => updateTicket(ticket.id, status)} className="rounded-md border border-[#3A3A3A] bg-[#050505] px-3 py-1.5 text-xs text-white transition hover:border-[#DC2626]/50 hover:bg-[#1F1111]">{status}</button>
                  ))}
                </div>
              </div>
            )) : <p className="text-sm text-[#9CA3AF]">No support tickets.</p>}
          </div>
        </div>
      </div>
    </section>
  )
}
