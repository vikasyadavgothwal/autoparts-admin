import {
  Download,
  TrendingUp,
} from "lucide-react"
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  REPORT_ACTIONS,
  REPORT_GROWTH_DATA,
  REPORT_METRICS,
  REPORT_MINI_CARDS,
  REPORT_REVENUE_CATEGORY,
  REPORT_USER_DISTRIBUTION,
} from "@/services/admin-dashboard/reports/reports-data"
import type { MiniCardConfig } from "@/types/admin-dashboard/reports/reports-components"

const CHART_TOOLTIP_STYLE = {
  backgroundColor: "#1A1A1A",
  border: "1px solid #2A2A2A",
  borderRadius: "8px",
  color: "#fff",
}

export function ReportsHeader() {
  return (
    <div className="flex items-center justify-between">
      <div>
        <h1 className="mb-2 text-3xl font-bold text-white">
          Platform Analytics
        </h1>
        <p className="text-[#9CA3AF]">Comprehensive insights and performance metrics.</p>
      </div>

      <Button className="flex items-center gap-2 rounded-lg bg-[#DC2626] px-6 py-3 font-medium text-white hover:bg-[#B91C1C]">
        <Download className="h-5 w-5" />
        Export Report
      </Button>
    </div>
  )
}

export function ReportsMetricCards() {
  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-4">
      {REPORT_METRICS.map((item) => {
        const Icon = item.icon

        return (
          <Card
            key={item.title}
            className="rounded-lg border-[#2A2A2A] bg-[#1A1A1A] p-0"
          >
            <CardContent className="p-6">
              <div className="mb-2 flex items-center gap-3">
                <Icon className={`h-5 w-5 ${item.iconClass}`} />
                <div className="text-sm text-[#9CA3AF]">{item.title}</div>
              </div>

              <div className="text-3xl font-bold text-white">{item.value}</div>

              {item.note ? (
                <div className="mt-2 flex items-center gap-1 text-sm">
                  <TrendingUp className="h-4 w-4 text-green-500" />
                  <span className="text-green-500">{item.note}</span>
                  <span className="text-[#9CA3AF]">{item.subNote}</span>
                </div>
              ) : (
                <div
                  className={`mt-2 text-sm ${item.subClass ?? "text-[#9CA3AF]"}`}
                >
                  {item.subText}
                </div>
              )}
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}

export function GrowthOverviewCard() {
  return (
    <Card className="rounded-lg border-[#2A2A2A] bg-[#1A1A1A] p-0">
      <CardContent className="p-6">
        <div className="mb-6">
          <h3 className="mb-1 font-semibold text-white">Platform Growth Overview</h3>
          <p className="text-sm text-[#9CA3AF]">Users, orders, and revenue trends</p>
        </div>

          <div className="h-[350px] w-full min-w-0">
            <ResponsiveContainer width="100%" height={350} minWidth={0} minHeight={0}>
            <LineChart data={REPORT_GROWTH_DATA}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2A2A2A" />
              <XAxis dataKey="month" stroke="#9CA3AF" />
              <YAxis stroke="#9CA3AF" />
              <YAxis yAxisId="right" orientation="right" stroke="#9CA3AF" />
              <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
              <Legend />
              <Line dataKey="users" name="Users" stroke="#DC2626" strokeWidth={3} />
              <Line dataKey="orders" name="Orders" stroke="#3B82F6" strokeWidth={3} />
              <Line
                yAxisId="right"
                dataKey="revenue"
                name="Revenue ($)"
                stroke="#10B981"
                strokeWidth={3}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}

export function DistributionCharts() {
  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
      <Card className="rounded-lg border-[#2A2A2A] bg-[#1A1A1A] p-0">
        <CardContent className="p-6">
          <h3 className="mb-6 font-semibold text-white">User Type Distribution</h3>

          <div className="h-[300px] w-full min-w-0">
            <ResponsiveContainer width="100%" height={300} minWidth={0} minHeight={0}>
              <PieChart>
                <Pie
                  data={REPORT_USER_DISTRIBUTION}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  label={({ value }) => `${value}%`}
                >
                  {REPORT_USER_DISTRIBUTION.map((item) => (
                    <Cell key={item.name} fill={item.color} />
                  ))}
                </Pie>
                <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3">
            {REPORT_USER_DISTRIBUTION.map((item) => (
              <div key={item.name} className="flex items-center gap-2">
                <div
                  className="h-3 w-3 rounded"
                  style={{ backgroundColor: item.color }}
                />
                <span className="text-sm text-[#9CA3AF]">{item.name}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-lg border-[#2A2A2A] bg-[#1A1A1A] p-0">
        <CardContent className="p-6">
          <h3 className="mb-6 font-semibold text-white">Revenue by Category</h3>

            <div className="h-[300px] w-full min-w-0">
            <ResponsiveContainer width="100%" height={300} minWidth={0} minHeight={0}>
              <BarChart data={REPORT_REVENUE_CATEGORY} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#2A2A2A" />
                <XAxis type="number" stroke="#9CA3AF" />
                <YAxis dataKey="name" type="category" stroke="#9CA3AF" width={120} />
                <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
                <Bar dataKey="revenue" name="Revenue ($)" fill="#DC2626" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export function ReportMiniCards() {
  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
      {REPORT_MINI_CARDS.map((item) => (
        <MiniCard key={item.title} {...item} />
      ))}
    </div>
  )
}

export function ReportActionGrid() {
  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
      {REPORT_ACTIONS.map((item) => (
        <Button
          key={item.title}
          variant="outline"
          className="h-auto rounded-lg border-[#2A2A2A] bg-[#1A1A1A] p-6 text-left hover:border-[#DC2626] hover:bg-[#1A1A1A]"
        >
          <div>
            <h4 className="mb-2 font-semibold text-white">{item.title}</h4>
            <p className="mb-4 text-sm text-[#9CA3AF]">{item.description}</p>
            <div className="text-sm font-medium text-[#DC2626]">Generate Report →</div>
          </div>
        </Button>
      ))}
    </div>
  )
}

function MiniCard({ icon, iconClass, title, rows }: MiniCardConfig) {
  const Icon = icon

  return (
    <Card className="rounded-lg border-[#2A2A2A] bg-[#1A1A1A] p-0">
      <CardContent className="p-6">
        <div className="mb-4 flex items-center gap-3">
          <Icon className={`h-5 w-5 ${iconClass}`} />
          <h3 className="font-semibold text-white">{title}</h3>
        </div>

        <div className="space-y-3">
          {rows.map(([label, value, valueClass]) => (
            <div key={label} className="flex items-center justify-between">
              <span className="text-[#9CA3AF]">{label}</span>
              <span className={`font-medium ${valueClass ?? "text-white"}`}>{value}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
