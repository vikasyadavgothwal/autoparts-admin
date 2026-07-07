"use client"

import * as React from "react"
import { CircleDollarSign, Clock, Search, ShoppingCart, Truck } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"

export type LiveOrder = {
  id: string
  publicId: string
  source: "rfq" | "direct"
  totalAmount: number
  status: "pending" | "confirmed" | "processing" | "shipped" | "delivered" | "cancelled"
  createdAt: string
  buyer: { id: string; companyName: string | null; firstName: string | null; lastName: string | null; email: string | null; activeRole: string }
  supplier: { id: string; companyName: string | null; firstName: string | null; lastName: string | null; email: string | null }
  items: Array<{ id: string; partName: string; partNumber: string | null; quantity: number; unitPrice: number | null; lineTotal: number | null }>
  rfq: {
    publicId: string
    projectName: string
    deliveryRequirement: string
    paymentTerms: string
    vehicleVin: string | null
    vehicleYear: number | null
    vehicleMake: string | null
    vehicleModel: string | null
    vehicleTrim: string | null
  } | null
}

export type OrderPagination = { page: number; pageSize: number; total: number; totalPages: number }
export type OrderSummary = { totalOrders: number; totalAmount: number; byStatus: Record<string, number> }

const money = (amount: number) => `AED ${amount.toLocaleString("en-AE", { minimumFractionDigits: 2 })}`
const name = (person: { companyName: string | null; firstName: string | null; lastName: string | null; email: string | null }) => person.companyName || [person.firstName, person.lastName].filter(Boolean).join(" ") || person.email || "-"
const statusStyle = (status: LiveOrder["status"]) => status === "delivered"
  ? "border-green-500/30 bg-green-500/10 text-green-500"
  : status === "shipped" ? "border-blue-500/30 bg-blue-500/10 text-blue-500"
  : status === "cancelled" ? "border-red-500/30 bg-red-500/10 text-red-500"
  : "border-yellow-500/30 bg-yellow-500/10 text-yellow-500"

export function LiveOrdersPage({ initialOrders, initialPagination, initialSummary }: {
  initialOrders: LiveOrder[]
  initialPagination: OrderPagination
  initialSummary: OrderSummary
}) {
  const [orders, setOrders] = React.useState(initialOrders)
  const [pagination, setPagination] = React.useState(initialPagination)
  const [summary, setSummary] = React.useState(initialSummary)
  const [search, setSearch] = React.useState("")
  const [selected, setSelected] = React.useState<LiveOrder | null>(null)
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState("")

  const load = async (page: number, query = search) => {
    setLoading(true)
    setError("")
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: "10", search: query.trim() })
      const response = await fetch(`/api/v1/admin/orders?${params}`, { credentials: "include", cache: "no-store" })
      const payload = await response.json() as { ok: boolean; orders?: LiveOrder[]; pagination?: OrderPagination; summary?: OrderSummary; message?: string }
      if (!response.ok || !payload.ok || !payload.orders || !payload.pagination || !payload.summary) throw new Error(payload.message || "Unable to load orders")
      setOrders(payload.orders)
      setPagination(payload.pagination)
      setSummary(payload.summary)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to load orders")
    } finally {
      setLoading(false)
    }
  }

  const stats = [
    { title: "Total Orders", value: summary.totalOrders, icon: ShoppingCart, color: "text-[#DC2626]" },
    { title: "Pending / Processing", value: (summary.byStatus.pending ?? 0) + (summary.byStatus.confirmed ?? 0) + (summary.byStatus.processing ?? 0), icon: Clock, color: "text-yellow-500" },
    { title: "Shipped", value: summary.byStatus.shipped ?? 0, icon: Truck, color: "text-blue-500" },
    { title: "Order Value", value: money(summary.totalAmount), icon: CircleDollarSign, color: "text-green-500" },
  ]

  return <div className="space-y-8">
    <div><h1 className="mb-2 text-3xl font-bold text-white">Order Management</h1><p className="text-[#9CA3AF]">Monitor RFQ and direct orders across the platform.</p></div>
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">{stats.map(({ title, value, icon: Icon, color }) => <Card key={title} className="border-[#2A2A2A] bg-[#1A1A1A] p-0"><CardContent className="p-6"><div className="mb-2 flex items-center gap-3 text-sm text-[#9CA3AF]"><Icon className={`h-5 w-5 ${color}`} />{title}</div><div className="text-3xl font-bold text-white">{value}</div></CardContent></Card>)}</div>
    <form className="flex max-w-2xl gap-2" onSubmit={(event) => { event.preventDefault(); void load(1) }}><div className="relative flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9CA3AF]" /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search order ID, RFQ, buyer, supplier, or part..." className="border-[#2A2A2A] bg-[#1A1A1A] pl-9 text-white" /></div><Button type="submit" disabled={loading}>Search</Button>{search ? <Button type="button" variant="outline" onClick={() => { setSearch(""); void load(1, "") }}>Clear</Button> : null}</form>
    {error ? <p className="text-sm text-red-400">{error}</p> : null}
    <Card className="overflow-hidden border-[#2A2A2A] bg-[#1A1A1A] p-0"><div className="overflow-x-auto"><table className="w-full min-w-[1150px] text-sm"><thead className="bg-[#0A0A0A] text-[#9CA3AF]"><tr><th className="p-4 text-left">Order ID</th><th className="p-4 text-left">Buyer</th><th className="p-4 text-left">Supplier</th><th className="p-4 text-left">Source</th><th className="p-4 text-left">Parts</th><th className="p-4 text-left">Amount</th><th className="p-4 text-left">Date</th><th className="p-4 text-left">Status</th><th className="p-4 text-left">Actions</th></tr></thead><tbody>{orders.map((order) => <tr key={order.id} className="border-t border-[#2A2A2A] text-white hover:bg-[#242424]"><td className="p-4 font-semibold text-[#DC2626]">{order.publicId}</td><td className="p-4"><p>{name(order.buyer)}</p><p className="text-xs text-[#9CA3AF]">{order.buyer.activeRole}</p></td><td className="p-4">{name(order.supplier)}</td><td className="p-4">{order.source === "rfq" ? order.rfq?.publicId || "RFQ" : "Direct"}</td><td className="p-4">{order.items[0]?.partName || "-"}{order.items.length > 1 ? ` +${order.items.length - 1}` : ""}</td><td className="p-4 font-semibold">{money(order.totalAmount)}</td><td className="p-4 text-[#9CA3AF]">{new Date(order.createdAt).toLocaleDateString("en-AE")}</td><td className="p-4"><Badge variant="outline" className={`capitalize ${statusStyle(order.status)}`}>{order.status}</Badge></td><td className="p-4"><Button className="bg-[#2A2A2A] text-white hover:bg-[#DC2626]" onClick={() => setSelected(order)}>View</Button></td></tr>)}</tbody></table></div>{!orders.length && !loading ? <p className="p-8 text-center text-[#9CA3AF]">No orders found.</p> : null}</Card>
    <div className="flex flex-col gap-3 text-sm text-[#9CA3AF] sm:flex-row sm:items-center sm:justify-between"><p>Showing {orders.length ? (pagination.page - 1) * pagination.pageSize + 1 : 0}-{Math.min(pagination.page * pagination.pageSize, pagination.total)} of {pagination.total}</p><div className="flex items-center gap-2"><Button variant="outline" size="sm" disabled={loading || pagination.page <= 1} onClick={() => void load(pagination.page - 1)}>Previous</Button><span>Page {pagination.page} of {pagination.totalPages}</span><Button variant="outline" size="sm" disabled={loading || pagination.page >= pagination.totalPages} onClick={() => void load(pagination.page + 1)}>Next</Button></div></div>
    <Dialog open={Boolean(selected)} onOpenChange={(open) => !open && setSelected(null)}><DialogContent className="max-h-[92vh] overflow-y-auto border-[#2A2A2A] bg-[#151515] text-white sm:max-w-4xl"><DialogHeader><DialogTitle>{selected?.publicId}</DialogTitle><DialogDescription>{selected?.source === "rfq" ? `${selected.rfq?.publicId}: ${selected.rfq?.projectName}` : "Direct supplier-part order"}</DialogDescription></DialogHeader>{selected ? <div className="space-y-5"><div className="grid gap-3 rounded-lg border border-[#2A2A2A] bg-[#1A1A1A] p-4 text-sm md:grid-cols-3"><p><span className="text-[#9CA3AF]">Buyer:</span> {name(selected.buyer)}</p><p><span className="text-[#9CA3AF]">Supplier:</span> {name(selected.supplier)}</p><p><span className="text-[#9CA3AF]">Total:</span> {money(selected.totalAmount)}</p><p><span className="text-[#9CA3AF]">Status:</span> <span className="capitalize">{selected.status}</span></p><p><span className="text-[#9CA3AF]">Created:</span> {new Date(selected.createdAt).toLocaleString("en-AE")}</p>{selected.rfq ? <><p><span className="text-[#9CA3AF]">Delivery:</span> {selected.rfq.deliveryRequirement}</p><p><span className="text-[#9CA3AF]">Payment:</span> {selected.rfq.paymentTerms}</p><p><span className="text-[#9CA3AF]">Vehicle:</span> {[selected.rfq.vehicleYear, selected.rfq.vehicleMake, selected.rfq.vehicleModel, selected.rfq.vehicleTrim].filter(Boolean).join(" ") || "-"}</p><p><span className="text-[#9CA3AF]">VIN:</span> {selected.rfq.vehicleVin || "-"}</p></> : null}</div><div><h3 className="mb-2 font-semibold">Order items</h3>{selected.items.map((item) => <div key={item.id} className="grid gap-2 border-t border-[#2A2A2A] py-3 text-sm sm:grid-cols-4"><p>{item.partName}</p><p className="text-[#9CA3AF]">{item.partNumber || "-"}</p><p>Qty {item.quantity}</p><p className="text-right">{item.lineTotal === null ? "Included in quote" : money(item.lineTotal)}</p></div>)}</div></div> : null}</DialogContent></Dialog>
  </div>
}
