"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function GarageBookingFeeSettings() {
  const [percentage, setPercentage] = useState("10");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void fetch("/api/v1/admin/platform-settings", { cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json() as { ok: boolean; garageBookingAdvancePercentage?: number; message?: string };
        if (!response.ok || !payload.ok) throw new Error(payload.message || "Unable to load setting");
        setPercentage(String(payload.garageBookingAdvancePercentage ?? 10));
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
        body: JSON.stringify({ garageBookingAdvancePercentage: Number(percentage) }),
      });
      const payload = await response.json() as { ok: boolean; garageBookingAdvancePercentage?: number; message?: string };
      if (!response.ok || !payload.ok) throw new Error(payload.message || "Unable to save setting");
      setPercentage(String(payload.garageBookingAdvancePercentage));
      toast.success("Garage booking advance percentage saved");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to save setting");
    } finally { setSaving(false); }
  };

  return (
    <Card className="rounded-lg border border-[#2A2A2A] bg-[#1A1A1A] shadow-none">
      <CardHeader><CardTitle className="text-white">Garage Booking Platform Advance</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-[#9CA3AF]">Percentage collected from the customer before a garage service booking. This platform amount is not shown in Garage Dashboard.</p>
        <div className="max-w-sm space-y-2">
          <Label htmlFor="garage-advance-percentage">Advance percentage</Label>
          <div className="flex gap-2">
            <Input id="garage-advance-percentage" type="number" min="0" max="100" step="1" value={percentage} disabled={loading || saving} onChange={(event) => setPercentage(event.target.value)} className="border-[#2A2A2A] bg-[#0A0A0A]" />
            <Button disabled={loading || saving} onClick={() => void save()} className="bg-[#DC2626] text-white hover:bg-[#B91C1C]">{saving ? "Saving..." : "Save"}</Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
