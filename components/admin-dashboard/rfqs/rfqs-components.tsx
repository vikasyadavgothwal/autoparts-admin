import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  RFQ_STATUS_CLASS,
} from "@/services/admin-dashboard/rfqs/rfqs-data"
import { TrendingUp } from "lucide-react"
import type {
  RfqInfoCardsProps,
  RfqFilterBarProps,
  RfqPageHeaderProps,
  RfqsDarkSelectProps,
  RfqStatCardsProps,
  RfqTableProps,
  InfoCardProps,
  InfoRowProps,
} from "@/types/admin-dashboard/rfqs/rfqs-components"

export function RfqStatCards({ items }: RfqStatCardsProps) {
  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
      {items.map((item) => {
        const Icon = item.icon

        return (
          <Card
            key={item.title}
            className="rounded-lg border-[#2A2A2A] bg-[#1A1A1A] p-0"
          >
            <CardContent className="p-6">
              <div className="mb-2 flex items-center gap-3">
                <Icon className={`h-5 w-5 ${item.color}`} />
                <div className="text-sm text-[#9CA3AF]">{item.title}</div>
              </div>

              <div className="text-3xl font-bold text-white">{item.value}</div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}



export function RfqFilterBar({
  statusOptions,
  fleetOptions,
  searchPlaceholder = "Search RFQs...",
}: RfqFilterBarProps) {
  return (
    <div className="flex flex-col gap-4 md:flex-row md:flex-wrap">
      <RfqsDarkSelect placeholder="All Status" items={statusOptions} />
      <RfqsDarkSelect placeholder="All Fleets" items={fleetOptions} />

      <Input
        type="text"
        placeholder={searchPlaceholder}
        className="flex-1 rounded-lg border-[#2A2A2A] bg-[#1A1A1A] px-4 py-2 text-white placeholder:text-[#9CA3AF]"
      />
    </div>
  )
}

function RfqsDarkSelect({ placeholder, items }: RfqsDarkSelectProps) {
  return (
    <Select>
      <SelectTrigger className="w-full rounded-lg border-[#2A2A2A] bg-[#1A1A1A] px-4 py-2 text-white md:w-[220px]">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>

      <SelectContent className="border-[#2A2A2A] bg-[#1A1A1A] text-white">
        {items.map((item) => (
          <SelectItem
            key={item}
            value={item.toLowerCase().replaceAll(" ", "-")}
            className="focus:bg-[#2A2A2A] focus:text-white"
          >
            {item}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

export function RfqTable({ columns, rows }: RfqTableProps) {
  return (
    <section>
      <Card className="overflow-hidden rounded-lg border-[#2A2A2A] bg-[#1A1A1A] p-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1250px]">
            <thead>
              <tr className="border-[#2A2A2A] bg-[#0A0A0A] hover:bg-[#0A0A0A]">
                {columns.map((header) => (
                  <th
                    key={header}
                    className="px-6 py-4 text-left text-sm font-semibold text-[#9CA3AF]"
                  >
                    {header}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {rows.map((rfq) => (
                <tr
                  key={rfq.id}
                  className="cursor-pointer border-[#2A2A2A] transition-colors hover:bg-[#2A2A2A]"
                >
                  <td className="px-6 py-4 text-sm">
                    <span className="font-medium text-[#DC2626]">{rfq.id}</span>
                  </td>

                  <td className="px-6 py-4 text-sm">
                    <span className="font-medium text-white">{rfq.fleet}</span>
                  </td>

                  <td className="px-6 py-4 text-sm">
                    <div>
                      <div className="text-white">{rfq.part}</div>
                      <div className="text-sm text-[#9CA3AF]">Qty: {rfq.quantity}</div>
                    </div>
                  </td>

                  <td className="px-6 py-4 text-sm">
                    <span className="font-medium text-white">{rfq.estimatedValue}</span>
                  </td>

                  <td className="px-6 py-4 text-sm">
                    <span className="text-white">{rfq.bids}</span>
                  </td>

                  <td className="px-6 py-4 text-sm">
                    <span className="font-medium text-green-500">{rfq.bestBid}</span>
                  </td>

                  <td className="px-6 py-4 text-sm text-[#9CA3AF]">{rfq.created}</td>

                  <td className="px-6 py-4 text-sm text-[#9CA3AF]">{rfq.deadline}</td>

                  <td className="px-6 py-4 text-sm">
                    <Badge
                      variant="outline"
                      className={`rounded-full border px-3 py-1 text-xs font-medium ${RFQ_STATUS_CLASS[rfq.status]}`}
                    >
                      {rfq.status}
                    </Badge>
                  </td>

                  <td className="px-6 py-4 text-sm">
                    <Button className="h-auto rounded-lg bg-[#2A2A2A] px-4 py-1.5 text-sm text-white hover:bg-[#DC2626]">
                      View
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </section>
  )
}

export function RfqInfoCards({ trendItems, categories }: RfqInfoCardsProps) {
  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
      <InfoCard icon={TrendingUp} iconClass="text-green-500" title="RFQ Trends">
        {trendItems.map((trend) => (
          <InfoRow
            key={trend.label}
            label={trend.label}
            value={trend.value}
            valueClass={trend.valueClass}
          />
        ))}
      </InfoCard>

      <InfoCard title="Top Part Categories">
        {categories.map((category) => (
          <InfoRow
            key={category.label}
            label={category.label}
            value={category.value}
          />
        ))}
      </InfoCard>
    </div>
  )
}

function InfoCard({ icon: Icon, iconClass, title, children }: InfoCardProps) {
  return (
    <Card className="rounded-lg border-[#2A2A2A] bg-[#1A1A1A] p-0">
      <CardContent className="p-6">
        <div className="mb-4 flex items-center gap-3">
          {Icon ? <Icon className={`h-5 w-5 ${iconClass ?? ""}`} /> : null}
          <h3 className="font-semibold text-white">{title}</h3>
        </div>

        <div className="space-y-3">{children}</div>
      </CardContent>
    </Card>
  )
}

function InfoRow({ label, value, valueClass }: InfoRowProps) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[#9CA3AF]">{label}</span>
      <span className={`font-medium ${valueClass ?? "text-white"}`}>{value}</span>
    </div>
  )
}

export function RfqPageHeader({
  title,
  subtitle,
  action,
}: RfqPageHeaderProps) {
  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
      <div>
        <h1 className="mb-2 text-3xl font-bold text-white">{title}</h1>
        <p className="text-[#9CA3AF]">{subtitle}</p>
      </div>

      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  )
}
