import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { GarageBookingFeeSettings } from "@/components/settings/garage-booking-fee-settings"

export default function SettingsPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="mb-2 text-3xl font-bold text-white">Workspace Settings</h1>
      </div>

      <Card className="rounded-lg border border-[#2A2A2A] bg-[#1A1A1A] shadow-none">
        <CardHeader>
          <CardTitle className="text-white">Organization Profile</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-6 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="company-name">Company Name</Label>
            <Input
              id="company-name"
              defaultValue="ABC Fleet"
              className="border-[#2A2A2A] bg-[#0A0A0A]"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="ops-email">Operations Email</Label>
            <Input
              id="ops-email"
              type="email"
              defaultValue="ops@autopartspro.com"
              className="border-[#2A2A2A] bg-[#0A0A0A]"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="currency">Preferred Currency</Label>
            <Input
              id="currency"
              defaultValue="AED"
              className="border-[#2A2A2A] bg-[#0A0A0A]"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="timezone">Timezone</Label>
            <Input
              id="timezone"
              defaultValue="America/Chicago"
              className="border-[#2A2A2A] bg-[#0A0A0A]"
            />
          </div>

          <div className="md:col-span-2">
            <Button className="bg-[#DC2626] text-white hover:bg-[#B91C1C]">
              Save Settings
            </Button>
          </div>
        </CardContent>
      </Card>
      <GarageBookingFeeSettings />
    </div>
  )
}
