"use client"

import { useActionState, useEffect } from "react"
import { Database, ScanLine, Search, ShieldCheck } from "lucide-react"
import { toast } from "sonner"

import { PageHeading } from "@/components/admin-dashboard/shared/page-heading"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { decodeAdminVinAction } from "@/actions/vin-decoder/vin-decoder"
import type {
  AdminVinDecodeState,
  AdminVinDecodedVehicle,
} from "@/types/vin-decoder/vin-decoder"

const initialState: AdminVinDecodeState = {
  ok: true,
  result: {
    vin: "JTDBR32E720123456",
    source: "local_db",
    title: "Toyota Corolla · 2021 GCC",
    market: "GCC",
    year: 2021,
    make: "Toyota",
    model: "Corolla",
    platform: "E210",
    engine: "1ZR-FE",
    engineCapacity: "1.8L",
    transmission: "CVT",
    trim: "LE",
    confidence: 98.4,
  },
}

const engineLine = (vehicle: AdminVinDecodedVehicle) => {
  if (vehicle.engine && vehicle.engineCapacity) {
    return `${vehicle.engine} · ${vehicle.engineCapacity}`
  }
  return vehicle.engine ?? vehicle.engineCapacity ?? "Not available"
}

const detailRows = (vehicle: AdminVinDecodedVehicle) => [
  ["Platform", vehicle.platform ?? "Not available"],
  ["Engine", engineLine(vehicle)],
  ["Transmission", vehicle.transmission ?? "Not available"],
  ["Trim", vehicle.trim ?? "Not available"],
  ["AI Confidence", `${vehicle.confidence.toFixed(1)}%`],
]
const RequiredMark = () => <span aria-hidden="true" className="text-dashboard-danger"> *</span>

export function VinDecoderPage() {
  const [state, formAction, isPending] = useActionState(
    decodeAdminVinAction,
    initialState,
  )
  const result = state.result

  useEffect(() => {
    if (state.message) toast.error(state.message)
  }, [state.message])

  return (
    <div className="space-y-6 pb-24">
      <PageHeading
        title="VIN Decoder"
        subtitle="Decode 17-character VINs for vehicle identity, cached local lookup, and 17VIN fallback."
      />

      <div className="grid gap-6 xl:grid-cols-[1fr_420px]">
        <Card className="border border-dashboard-panel-border bg-dashboard-panel-bg">
          <CardHeader className="border-b border-dashboard-panel-border">
            <div className="flex items-start gap-4">
              <div className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-dashboard-accent/10 text-dashboard-accent ring-1 ring-dashboard-accent/20">
                <ScanLine className="size-6" />
              </div>
              <div>
                <p className="text-lg font-semibold text-dashboard-text">
                  Decode pipeline
                </p>
                <p className="mt-1 max-w-2xl text-sm text-dashboard-muted">
                  Local DB is checked first. If no saved decode exists, the server calls 17VIN and stores the result for the next lookup.
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6 p-6">
            <form action={formAction} className="space-y-4">
              <div className="space-y-2">
                <Label
                  htmlFor="vin"
                  className="text-xs font-semibold uppercase text-dashboard-muted"
                >
                  VIN Input<RequiredMark />
                </Label>
                <Input
                  id="vin"
                  name="vin"
                  required
                  minLength={17}
                  maxLength={17}
                  pattern="[A-HJ-NPR-Za-hj-npr-z0-9]{17}"
                  placeholder="Enter 17-character VIN"
                  defaultValue=""
                  onInput={(event) => {
                    event.currentTarget.value = event.currentTarget.value
                      .replace(/[IOQioq\W_]/g, "")
                      .toUpperCase()
                      .slice(0, 17)
                  }}
                  className="h-12 border-dashboard-panel-border bg-dashboard-page-bg px-4 font-mono text-[15px] font-semibold uppercase tracking-wider text-dashboard-text placeholder:text-brand-placeholder"
                />
              </div>

              <Button type="submit" size="lg" disabled={isPending}>
                <Search className="size-4" />
                {isPending ? "Decoding..." : "Run Decode Pipeline"}
              </Button>
            </form>

            {state.message ? (
              <div className="rounded-lg border border-dashboard-danger/30 bg-dashboard-danger/10 p-3 text-sm text-dashboard-danger">
                {state.message}
              </div>
            ) : null}

            <div className="grid gap-3 text-sm text-dashboard-muted sm:grid-cols-3">
              <div className="rounded-lg border border-dashboard-panel-border bg-dashboard-page-bg p-4">
                <Database className="mb-3 size-5 text-dashboard-accent" />
                <p className="font-medium text-dashboard-text">Local DB</p>
                <p className="mt-1 text-xs">VIN cache and saved vehicles.</p>
              </div>
              <div className="rounded-lg border border-dashboard-panel-border bg-dashboard-page-bg p-4">
                <Search className="mb-3 size-5 text-dashboard-accent" />
                <p className="font-medium text-dashboard-text">17VIN</p>
                <p className="mt-1 text-xs">Provider lookup when local data is absent.</p>
              </div>
              <div className="rounded-lg border border-dashboard-panel-border bg-dashboard-page-bg p-4">
                <ShieldCheck className="mb-3 size-5 text-dashboard-accent" />
                <p className="font-medium text-dashboard-text">Cached</p>
                <p className="mt-1 text-xs">Provider result is saved locally.</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-dashboard-panel-border bg-dashboard-panel-bg">
          <CardHeader className="border-b border-dashboard-panel-border">
            <div className="text-xs font-semibold uppercase text-dashboard-warning">
              Decoded Result
            </div>
            {result ? (
              <div className="mt-2 text-2xl font-bold text-dashboard-text">
                {result.title}
              </div>
            ) : null}
          </CardHeader>
          <CardContent className="p-6">
            {result ? (
              <div className="space-y-5">
                <div className="rounded-lg border border-dashboard-panel-border bg-dashboard-page-bg p-4">
                  <p className="text-xs uppercase text-dashboard-muted">VIN</p>
                  <p className="mt-1 break-all font-mono text-sm font-semibold text-dashboard-text">
                    {result.vin}
                  </p>
                </div>

                <ul className="space-y-3 text-sm">
                  {detailRows(result).map(([label, value]) => (
                    <li
                      key={label}
                      className="flex items-start justify-between gap-4 border-b border-dashboard-panel-border pb-3 last:border-0 last:pb-0"
                    >
                      <span className="text-dashboard-muted">{label}:</span>
                      <span className="text-right font-medium text-dashboard-text">
                        {value}
                      </span>
                    </li>
                  ))}
                </ul>

                <div className="rounded-lg bg-dashboard-accent/10 px-3 py-2 text-xs font-medium text-dashboard-accent">
                  Source: {result.source === "local_db" ? "Local DB" : "17VIN"}
                </div>
              </div>
            ) : (
              <div className="rounded-lg border border-dashboard-panel-border bg-dashboard-page-bg p-6 text-sm text-dashboard-muted">
                Run a VIN decode to show vehicle details.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
