import {
  RfqsLivePage,
  type AdminRfq,
} from "@/components/admin-dashboard/rfqs/rfqs-live-page"
import { listAdminRfqs } from "@/services/fleet/fleet-service"

const toClientRfqs = (rfqs: AdminRfq[]): AdminRfq[] =>
  rfqs.map((rfq) => ({
    ...rfq,
    responseDeadline: new Date(rfq.responseDeadline).toISOString(),
    createdAt: new Date(rfq.createdAt).toISOString(),
    bids: rfq.bids.map((bid) => ({
      ...bid,
      validUntil: bid.validUntil ? new Date(bid.validUntil).toISOString() : null,
      createdAt: new Date(bid.createdAt).toISOString(),
    })),
    order: rfq.order
      ? {
          ...rfq.order,
          createdAt: new Date(rfq.order.createdAt).toISOString(),
        }
      : null,
  }))

export default async function AdminRfqsPage() {
  const { rfqs } = await listAdminRfqs()
  const serialized = toClientRfqs(rfqs as unknown as AdminRfq[])
  return <RfqsLivePage initialRfqs={serialized} />
}
