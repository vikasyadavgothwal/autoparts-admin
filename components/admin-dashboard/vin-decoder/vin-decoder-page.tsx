"use client"

import { useActionState, useEffect } from "react"
import { Search } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { PageHeading } from "@/components/admin-dashboard/shared/page-heading"
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
        subtitle="Transform 17-character VINs into precise vehicle identity for GCC and international markets."
      />

      <Card className="border-dashboard-panel-border bg-dashboard-panel-bg">
        <CardContent className="p-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <div>
              <form action={formAction} className="space-y-4">
                <div className="space-y-2">
                  <Label
                    htmlFor="vin"
                    className="text-xs font-semibold uppercase tracking-wide text-dashboard-muted"
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
                    defaultValue="JTDBR32E720123456"
                    onInput={(event) => {
                      event.currentTarget.value = event.currentTarget.value
                        .replace(/[IOQioq\W_]/g, "")
                        .toUpperCase()
                        .slice(0, 17)
                    }}
                    className="h-12 rounded-lg border-dashboard-panel-border bg-dashboard-page-bg px-4 font-mono text-[15px] font-semibold uppercase tracking-wider text-dashboard-text outline-none placeholder:text-brand-placeholder focus:border-dashboard-accent/40 focus:ring-2 focus:ring-dashboard-accent/20"
                  />
                </div>

                <Button
                  type="submit"
                  size="lg"
                  disabled={isPending}
                  className="bg-dashboard-accent hover:bg-dashboard-accent-soft"
                >
                  <Search className="size-4" />
                  {isPending ? "Decoding..." : "Run Decode Pipeline"}
                </Button>
              </form>

              {state.message ? (
                <div className="mt-4 rounded-lg border border-dashboard-danger/30 bg-dashboard-danger/10 p-3 text-sm text-dashboard-danger">
                  {state.message}
                </div>
              ) : null}

              <div className="mt-6 space-y-2 text-sm text-dashboard-muted">
                <p>
                  Prototype flow: VIN Search - Vehicle Decoded - Compatibility
                  Engine - Matching Parts - Suppliers - Marketplace
                </p>
              </div>
            </div>

            <div className="rounded-lg border border-dashboard-panel-border bg-dashboard-page-bg p-5">
              <div className="text-xs font-semibold uppercase text-dashboard-accent">
                Decoded Result
              </div>
              {result ? (
                <div className="mt-2 text-2xl font-bold text-dashboard-text">
                  {result.title}
                </div>
              ) : null}
              {result ? (
                <>
                  <div className="mt-4 rounded-lg border border-dashboard-panel-border bg-dashboard-panel-bg p-4">
                    <p className="text-xs uppercase text-dashboard-muted">VIN</p>
                    <p className="mt-1 break-all font-mono text-sm font-semibold text-dashboard-text">
                      {result.vin}
                    </p>
                  </div>

                  <ul className="mt-4 space-y-2 text-sm text-dashboard-muted">
                    {detailRows(result).map(([label, value]) => (
                      <li key={label}>
                        {label}: {value}
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                <div className="mt-4 rounded-lg border border-dashboard-panel-border bg-dashboard-panel-bg p-6 text-sm text-dashboard-muted">
                  Run a VIN decode to show vehicle details.
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
