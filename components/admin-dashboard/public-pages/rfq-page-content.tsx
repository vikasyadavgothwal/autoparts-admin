import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

const RFQ_DETAIL_ITEMS = [
  "Show active and completed RFQ requests.",
  "Track request statuses and escalation states.",
  "Highlight pending response times.",
  "Keep RFQ lifecycle actions grouped in one management view.",
]

export function RfqPageContent() {
  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">RFQs</h1>
          <p className="text-[#9CA3AF]">RFQ landing content for public page management.</p>
        </div>
        <Button type="button">Publish</Button>
      </div>

      <Card className="rounded-lg border-[#2A2A2A] bg-[#1A1A1A] p-0">
        <CardHeader>
          <CardTitle className="text-white">RFQ Details</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="list-disc space-y-2 pl-5 text-[#9CA3AF]">
            {RFQ_DETAIL_ITEMS.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}
