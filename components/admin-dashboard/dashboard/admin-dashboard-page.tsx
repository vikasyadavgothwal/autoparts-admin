import Link from "next/link"
import { ArrowRight, CheckCircle2 } from "lucide-react"

import { PageHeading } from "@/components/admin-dashboard/shared/page-heading"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { getFitmentIntelligenceDashboardData } from "@/services/admin-dashboard/dashboard/dashboard-data"
import { appRoutes } from "@/lib/routes"

const pipeline = [
  "VIN17",
  "Vehicle Identity",
  "Fitment Intelligence",
  "OE & Cross Refs",
  "Supplier Inventory",
  "AI Validation",
  "Marketplace Results",
]

export async function AdminDashboardPage() {
  const data = await getFitmentIntelligenceDashboardData()

  return (
    <div className="space-y-6">
      <PageHeading
        title="Fitment Intelligence"
        subtitle="VIN17 -> Vehicle -> Fitment -> OE -> Suppliers -> Marketplace"
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {data.kpis.map((item) => {
          const Icon = item.icon

          return (
            <Card key={item.title} className="border-dashboard-panel-border bg-dashboard-panel-bg shadow-none">
              <CardContent className="p-6">
                <div className="mb-5 flex items-start justify-between">
                  <div className="rounded-lg border border-dashboard-danger/20 bg-dashboard-danger/10 p-3">
                    <Icon className="h-5 w-5 text-dashboard-danger" />
                  </div>
                  <span className="rounded-full bg-dashboard-success/10 px-2.5 py-1 text-xs font-semibold text-dashboard-success">
                    Live
                  </span>
                </div>
                <div className="text-3xl font-bold text-dashboard-text">{item.value}</div>
                <div className="mt-2 text-sm text-dashboard-muted">{item.title}</div>
                <div className="mt-1 text-xs text-dashboard-muted">{item.note}</div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <Card className="border-dashboard-panel-border bg-dashboard-panel-bg shadow-none">
        <CardContent className="flex flex-wrap items-center gap-4 p-4">
          {pipeline.map((step, index) => (
            <div key={step} className="flex items-center gap-4">
              <span
                className={`rounded-full px-4 py-2 text-sm font-semibold ${
                  index === 0
                    ? "bg-dashboard-danger text-white"
                    : index === pipeline.length - 1
                      ? "bg-dashboard-warning/10 text-dashboard-warning"
                      : "bg-dashboard-page-bg text-dashboard-text"
                }`}
              >
                {step}
              </span>
              {index < pipeline.length - 1 ? (
                <ArrowRight className="h-4 w-4 text-dashboard-muted" />
              ) : null}
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="border-dashboard-panel-border bg-dashboard-panel-bg shadow-none">
          <CardContent className="p-6">
            <div className="mb-5 flex items-start justify-between">
              <div>
                <h2 className="text-xl font-bold text-dashboard-text">VIN Intelligence</h2>
                <p className="mt-1 text-sm text-dashboard-muted">
                  Decode any 17-character VIN into trusted vehicle identity
                </p>
              </div>
              <span className="rounded-full bg-dashboard-success/10 px-3 py-1 text-xs font-semibold text-dashboard-success">
                Live Decode
              </span>
            </div>
            <div className="rounded-lg border border-dashboard-panel-border bg-dashboard-page-bg p-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-dashboard-muted">
                Enter VIN
              </div>
              <div className="mt-3 flex flex-col gap-3 sm:flex-row">
                <div className="flex-1 rounded-lg border border-dashboard-panel-border bg-dashboard-panel-bg px-4 py-3 font-mono text-sm font-semibold text-dashboard-text">
                  {data.vin.sample}
                </div>
                <Button asChild className="bg-dashboard-danger hover:bg-dashboard-danger/90">
                  <Link href={appRoutes.vinDecoder}>Decode VIN</Link>
                </Button>
              </div>
              <div className="mt-4 flex items-center gap-2 text-sm text-dashboard-muted">
                <CheckCircle2 className="h-4 w-4 text-dashboard-success" />
                {data.vin.decoded}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-dashboard-panel-border bg-dashboard-panel-bg shadow-none">
          <CardContent className="p-6">
            <h2 className="text-xl font-bold text-dashboard-text">Vehicle Intelligence</h2>
            <p className="mt-1 text-sm text-dashboard-muted">
              Structured hierarchy from make to engine and mapped fitments
            </p>
            <div className="mt-5 space-y-4">
              {[
                ["Make", data.vehicle.make],
                ["Model", data.vehicle.model],
                ["Engine", data.vehicle.engine],
                ["Mapped Fitments", data.vehicle.fitments],
              ].map(([label, value], index) => (
                <div
                  key={label}
                  className="flex items-center gap-4 rounded-lg border border-dashboard-panel-border bg-dashboard-page-bg p-4"
                >
                  <span className="flex h-8 w-8 items-center justify-center rounded-md bg-dashboard-danger/10 text-sm font-bold text-dashboard-danger">
                    {index + 1}
                  </span>
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wide text-dashboard-muted">
                      {label}
                    </div>
                    <div className="text-sm font-semibold text-dashboard-text">{value}</div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
