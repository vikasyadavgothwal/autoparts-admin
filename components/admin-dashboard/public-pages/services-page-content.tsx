import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

const SERVICES_ITEMS = [
  "Publish service categories and availability windows.",
  "Define service tiers and response commitments.",
  "Attach support contact options to each service.",
  "Track inbound service requests and handoff states.",
]

export function ServicesPageContent() {
  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Services</h1>
          <p className="text-[#9CA3AF]">
            Configure service listings, workflows, and operational details.
          </p>
        </div>
        <Button type="button">Save</Button>
      </div>

      <Card className="rounded-lg border-[#2A2A2A] bg-[#1A1A1A] p-0">
        <CardHeader>
          <CardTitle className="text-white">Services Details</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="list-disc space-y-2 pl-5 text-[#9CA3AF]">
            {SERVICES_ITEMS.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}

