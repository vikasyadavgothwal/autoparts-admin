import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

const SUPPLIER_ITEMS = [
  "Show active supplier highlights.",
  "Track supplier verification status and onboarding notes.",
  "Expose priority suppliers and partner updates.",
  "Capture supplier-level response SLAs.",
]

export function SuppliersPageContent() {
  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Suppliers</h1>
          <p className="text-[#9CA3AF]">
            Maintain supplier blocks, metadata, and publishing settings.
          </p>
        </div>
        <Button type="button">Publish</Button>
      </div>

      <Card className="rounded-lg border-[#2A2A2A] bg-[#1A1A1A] p-0">
        <CardHeader>
          <CardTitle className="text-white">Suppliers Details</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="list-disc space-y-2 pl-5 text-[#9CA3AF]">
            {SUPPLIER_ITEMS.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}
