"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type AdvanceMode = "percentage" | "fixed";

export function GarageBookingFeeSettings() {
  const [mode, setMode] = useState<AdvanceMode>("percentage");
  const [value, setValue] = useState("10");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void fetch("/api/v1/admin/platform-settings", { cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json() as {
          ok: boolean;
          garageBookingAdvance?: { mode: AdvanceMode; value: number };
          garageBookingAdvancePercentage?: number;
          message?: string;
        };
        if (!response.ok || !payload.ok) throw new Error(payload.message || "Unable to load setting");
        setMode(payload.garageBookingAdvance?.mode ?? "percentage");
        setValue(String(payload.garageBookingAdvance?.value ?? payload.garageBookingAdvancePercentage ?? 10));
      })
      .catch((error) => toast.error(error instanceof Error ? error.message : "Unable to load setting"))
      .finally(() => setLoading(false));
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      const response = await fetch("/api/v1/admin/platform-settings", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          garageBookingAdvance: {
            mode,
            value: Number(value),
          },
        }),
      });
      const payload = await response.json() as {
        ok: boolean;
        garageBookingAdvance?: { mode: AdvanceMode; value: number };
        message?: string;
      };
      if (!response.ok || !payload.ok) throw new Error(payload.message || "Unable to save setting");
      setMode(payload.garageBookingAdvance?.mode ?? mode);
      setValue(String(payload.garageBookingAdvance?.value ?? value));
      toast.success("Garage booking advance saved");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to save setting");
    } finally { setSaving(false); }
  };

  return (
    <Card className="rounded-lg border border-[#2A2A2A] bg-[#1A1A1A] shadow-none">
      <CardHeader><CardTitle className="text-white">Garage Booking Advance</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-[#9CA3AF]">Amount collected from the customer before a garage service booking. Choose either a percentage of the service price or a fixed AED amount.</p>
        <div className="max-w-xl space-y-3">
          <Label htmlFor="garage-advance-value">Advance collection</Label>
          <div className="grid gap-2 sm:grid-cols-[160px_1fr_auto]">
            <select
              value={mode}
              disabled={loading || saving}
              onChange={(event) => setMode(event.target.value as AdvanceMode)}
              className="h-10 rounded-md border border-[#2A2A2A] bg-[#0A0A0A] px-3 py-2 text-sm text-white"
            >
              <option value="percentage">Percentage</option>
              <option value="fixed">Fixed amount</option>
            </select>
            <Input
              id="garage-advance-value"
              type="number"
              min="0"
              max={mode === "percentage" ? "100" : "100000"}
              step={mode === "percentage" ? "1" : "0.01"}
              value={value}
              disabled={loading || saving}
              onChange={(event) => setValue(event.target.value)}
              className="h-10 border-[#2A2A2A] bg-[#0A0A0A] px-3 py-2"
            />
            <Button disabled={loading || saving} onClick={() => void save()} className="h-10 bg-[#DC2626] px-4 py-2 text-white hover:bg-[#B91C1C]">{saving ? "Saving..." : "Save"}</Button>
          </div>
          <p className="text-xs text-[#9CA3AF]">
            {mode === "percentage" ? "Enter a whole number from 0 to 100." : "Enter the AED amount to collect before booking."}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
