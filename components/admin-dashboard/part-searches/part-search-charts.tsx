"use client"

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

import type {
  MarketplaceSearchChartRow,
  MarketplaceSearchTrendRow,
} from "@/services/marketplace-searches/marketplace-searches-service"

const COLORS = ["#dc2626", "#2563eb", "#16a34a", "#f59e0b", "#7c3aed"]

export function PartSearchCharts({
  statusChart,
  trendChart,
  typeChart,
}: {
  statusChart: MarketplaceSearchChartRow[]
  trendChart: MarketplaceSearchTrendRow[]
  typeChart: MarketplaceSearchChartRow[]
}) {
  return (
    <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
          <BarChart data={trendChart}>
            <CartesianGrid strokeDasharray="3 3" stroke="#2A2A2A" />
            <XAxis dataKey="date" tick={{ fill: "#9CA3AF", fontSize: 12 }} />
            <YAxis allowDecimals={false} tick={{ fill: "#9CA3AF", fontSize: 12 }} />
            <Tooltip
              cursor={{ fill: "rgba(220,38,38,0.08)" }}
              contentStyle={{
                background: "#151515",
                border: "1px solid #2A2A2A",
                borderRadius: 8,
                color: "#fff",
              }}
            />
            <Bar dataKey="searches" fill="#dc2626" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
        <div className="h-36">
          <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
            <PieChart>
              <Pie
                data={statusChart}
                dataKey="value"
                nameKey="name"
                innerRadius={34}
                outerRadius={58}
                paddingAngle={3}
              >
                {statusChart.map((entry, index) => (
                  <Cell key={entry.name} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  background: "#151515",
                  border: "1px solid #2A2A2A",
                  borderRadius: 8,
                  color: "#fff",
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="space-y-2">
          {typeChart.slice(0, 5).map((item, index) => (
            <div key={item.name} className="flex items-center justify-between gap-3 text-sm">
              <span className="flex min-w-0 items-center gap-2">
                <span
                  className="size-2 rounded-full"
                  style={{ backgroundColor: COLORS[index % COLORS.length] }}
                />
                <span className="truncate">{item.name}</span>
              </span>
              <span className="font-medium">{item.value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
