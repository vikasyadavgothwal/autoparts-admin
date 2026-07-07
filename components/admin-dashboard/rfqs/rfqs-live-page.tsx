"use client"

import * as React from "react"
import { Clock, FileText, ShoppingCart, Users } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"

type Contact = {
  id: string
  companyName: string | null
  firstName: string | null
  lastName: string | null
  email: string | null
}

export type AdminRfq = {
  id: string
  publicId: string
  source: "fleet" | "user"
  status: "open" | "closed" | "cancelled"
  projectName: string
  description: string | null
  responseDeadline: string
  deliveryRequirement: string
  paymentTerms: string
  companyName: string
  contactName: string
  email: string
  phone: string
  vehicleVin: string | null
  vehicleYear: number | null
  vehicleMake: string | null
  vehicleModel: string | null
  vehicleTrim: string | null
  attachmentUrl: string | null
  attachmentName: string | null
  attachmentMimeType: string | null
  attachmentSize: number | null
  createdAt: string
  requester: Contact | null
  parts: Array<{
    id: string
    partName: string
    partNumber: string | null
    quantity: number
    targetPrice: number | null
    notes: string | null
  }>
  bids: Array<{
    id: string
    totalAmount: number
    deliveryDays: number
    validUntil: string | null
    notes: string | null
    status: "submitted" | "accepted" | "rejected" | "withdrawn"
    createdAt: string
    supplier: Contact
  }>
  order: {
    publicId: string
    bidId: string
    totalAmount: number
    status: string
    createdAt: string
  } | null
}

const money = (amount: number) => `AED ${amount.toLocaleString("en-AE", { minimumFractionDigits: 2 })}`
const personName = (contact: Contact) => contact.companyName || [contact.firstName, contact.lastName].filter(Boolean).join(" ") || contact.email || "Supplier"

export function RfqsLivePage({ initialRfqs }: { initialRfqs: AdminRfq[] }) {
  const [search, setSearch] = React.useState("")
  const [selected, setSelected] = React.useState<AdminRfq | null>(null)
  const filtered = initialRfqs.filter((rfq) => {
    const query = search.trim().toLowerCase()
    return !query || [rfq.publicId, rfq.projectName, rfq.companyName, rfq.contactName].some((value) => value.toLowerCase().includes(query))
  })
  const totalBids = initialRfqs.reduce((sum, rfq) => sum + rfq.bids.length, 0)
  const cards = [
    { label: "Total RFQs", value: initialRfqs.length, icon: FileText, color: "text-[#DC2626]" },
    { label: "Open RFQs", value: initialRfqs.filter((rfq) => rfq.status === "open").length, icon: Clock, color: "text-blue-500" },
    { label: "Supplier Bids", value: totalBids, icon: Users, color: "text-green-500" },
    { label: "Orders Created", value: initialRfqs.filter((rfq) => rfq.order).length, icon: ShoppingCart, color: "text-yellow-500" },
  ]

  return <div className="space-y-8">
    <div><h1 className="mb-2 text-3xl font-bold text-white">RFQ Management</h1><p className="text-[#9CA3AF]">Monitor every buyer request, supplier bid, and awarded order.</p></div>
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">{cards.map(({ label, value, icon: Icon, color }) => <Card key={label} className="border-[#2A2A2A] bg-[#1A1A1A] p-0"><CardContent className="p-6"><div className="mb-2 flex items-center gap-3 text-sm text-[#9CA3AF]"><Icon className={`h-5 w-5 ${color}`} />{label}</div><div className="text-3xl font-bold text-white">{value}</div></CardContent></Card>)}</div>
    <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by RFQ ID, project, company, or contact..." className="max-w-xl border-[#2A2A2A] bg-[#1A1A1A] text-white placeholder:text-[#9CA3AF]" />
    <Card className="overflow-hidden border-[#2A2A2A] bg-[#1A1A1A] p-0">
      <div className="overflow-x-auto"><table className="w-full min-w-[1050px] text-sm"><thead className="bg-[#0A0A0A] text-[#9CA3AF]"><tr><th className="p-4 text-left">RFQ ID</th><th className="p-4 text-left">Buyer</th><th className="p-4 text-left">Project</th><th className="p-4 text-left">Parts</th><th className="p-4 text-left">Bids</th><th className="p-4 text-left">Best Bid</th><th className="p-4 text-left">Deadline</th><th className="p-4 text-left">Status</th><th className="p-4 text-left">Actions</th></tr></thead>
      <tbody>{filtered.map((rfq) => {
        const best = rfq.bids.filter((bid) => bid.status === "submitted" || bid.status === "accepted").sort((a, b) => a.totalAmount - b.totalAmount)[0]
        return <tr key={rfq.id} className="border-t border-[#2A2A2A] text-white hover:bg-[#242424]"><td className="p-4 font-semibold text-[#DC2626]">{rfq.publicId}</td><td className="p-4"><p>{rfq.companyName}</p><p className="text-xs capitalize text-[#9CA3AF]">{rfq.source}</p></td><td className="p-4">{rfq.projectName}</td><td className="p-4">{rfq.parts.length}</td><td className="p-4">{rfq.bids.length}</td><td className="p-4 text-green-500">{best ? money(best.totalAmount) : "-"}</td><td className="p-4 text-[#9CA3AF]">{new Date(rfq.responseDeadline).toLocaleDateString("en-AE")}</td><td className="p-4"><Badge variant="outline" className={rfq.order ? "border-green-500/30 bg-green-500/10 text-green-500" : rfq.status === "open" ? "border-blue-500/30 bg-blue-500/10 text-blue-500" : "border-gray-500/30 text-gray-400"}>{rfq.order ? "Awarded" : rfq.status}</Badge></td><td className="p-4"><Button className="bg-[#2A2A2A] text-white hover:bg-[#DC2626]" onClick={() => setSelected(rfq)}>View</Button></td></tr>
      })}</tbody></table></div>
    </Card>
    <Dialog open={Boolean(selected)} onOpenChange={(open) => !open && setSelected(null)}>
      <DialogContent className="max-h-[92vh] overflow-y-auto border-[#2A2A2A] bg-[#151515] text-white sm:max-w-5xl">
        <DialogHeader><DialogTitle className="text-xl">{selected?.publicId}: {selected?.projectName}</DialogTitle><DialogDescription>Complete RFQ, vehicle, line-item, and bid information.</DialogDescription></DialogHeader>
        {selected ? <div className="space-y-6">
          <section className="grid gap-3 rounded-lg border border-[#2A2A2A] bg-[#1A1A1A] p-4 text-sm md:grid-cols-2 lg:grid-cols-3">
            <p><span className="text-[#9CA3AF]">Company:</span> {selected.companyName}</p><p><span className="text-[#9CA3AF]">Contact:</span> {selected.contactName}</p><p><span className="text-[#9CA3AF]">Source:</span> <span className="capitalize">{selected.source}</span></p><p><span className="text-[#9CA3AF]">Email:</span> {selected.email}</p><p><span className="text-[#9CA3AF]">Phone:</span> {selected.phone}</p><p><span className="text-[#9CA3AF]">Created:</span> {new Date(selected.createdAt).toLocaleString("en-AE")}</p><p><span className="text-[#9CA3AF]">Vehicle:</span> {[selected.vehicleYear, selected.vehicleMake, selected.vehicleModel, selected.vehicleTrim].filter(Boolean).join(" ") || "-"}</p><p><span className="text-[#9CA3AF]">VIN:</span> {selected.vehicleVin || "-"}</p><p><span className="text-[#9CA3AF]">Deadline:</span> {new Date(selected.responseDeadline).toLocaleString("en-AE")}</p><p><span className="text-[#9CA3AF]">Delivery:</span> {selected.deliveryRequirement}</p><p><span className="text-[#9CA3AF]">Payment:</span> {selected.paymentTerms}</p>{selected.attachmentUrl ? <p><span className="text-[#9CA3AF]">Attachment:</span> <a className="text-[#DC2626] underline" href={selected.attachmentUrl} target="_blank" rel="noreferrer">{selected.attachmentName || "Open file"}</a></p> : null}
          </section>
          {selected.description ? <section><h3 className="mb-2 font-semibold">Description</h3><p className="rounded-lg border border-[#2A2A2A] p-4 text-sm text-[#D1D5DB]">{selected.description}</p></section> : null}
          <section><h3 className="mb-3 font-semibold">Parts ({selected.parts.length})</h3><div className="overflow-x-auto rounded-lg border border-[#2A2A2A]"><table className="w-full min-w-[700px] text-sm"><thead className="bg-[#0A0A0A] text-[#9CA3AF]"><tr><th className="p-3 text-left">Part</th><th className="p-3 text-left">Part Number</th><th className="p-3 text-left">Quantity</th><th className="p-3 text-left">Target Price</th><th className="p-3 text-left">Notes</th></tr></thead><tbody>{selected.parts.map((part) => <tr key={part.id} className="border-t border-[#2A2A2A]"><td className="p-3">{part.partName}</td><td className="p-3">{part.partNumber || "-"}</td><td className="p-3">{part.quantity}</td><td className="p-3">{part.targetPrice === null ? "-" : money(part.targetPrice)}</td><td className="p-3 text-[#9CA3AF]">{part.notes || "-"}</td></tr>)}</tbody></table></div></section>
          <section><h3 className="mb-3 font-semibold">Supplier Bids ({selected.bids.length})</h3>{selected.bids.length ? <div className="space-y-3">{selected.bids.map((bid) => <div key={bid.id} className="grid gap-3 rounded-lg border border-[#2A2A2A] bg-[#1A1A1A] p-4 text-sm md:grid-cols-5"><div><p className="text-[#9CA3AF]">Supplier</p><p>{personName(bid.supplier)}</p></div><div><p className="text-[#9CA3AF]">Total</p><p className="font-semibold">{money(bid.totalAmount)}</p></div><div><p className="text-[#9CA3AF]">Delivery</p><p>{bid.deliveryDays} days</p></div><div><p className="text-[#9CA3AF]">Status</p><p className="capitalize">{bid.status}</p></div><div><p className="text-[#9CA3AF]">Notes</p><p>{bid.notes || "-"}</p></div></div>)}</div> : <p className="rounded-lg border border-[#2A2A2A] p-4 text-[#9CA3AF]">No bids received.</p>}</section>
          {selected.order ? <section className="rounded-lg border border-green-500/30 bg-green-500/10 p-4"><h3 className="font-semibold text-green-500">Order {selected.order.publicId}</h3><p className="mt-1 text-sm">Accepted total: {money(selected.order.totalAmount)} · Status: {selected.order.status}</p></section> : null}
        </div> : null}
      </DialogContent>
    </Dialog>
  </div>
}
