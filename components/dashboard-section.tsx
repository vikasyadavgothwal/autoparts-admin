import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import type {
  DashboardSectionProps,
} from "@/types/dashboard-section"

export function DashboardSection({
  badge,
  title,
  description,
  stats,
  updates,
}: DashboardSectionProps) {
  return (
    <div className="space-y-6">
      <div>
        <Badge variant="outline" className="mb-3 border-[#DC2626]/30 text-[#FCA5A5]">
          {badge}
        </Badge>
        <h2 className="text-2xl font-bold tracking-tight">{title}</h2>
        <p className="text-muted-foreground">{description}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">{stat.label}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
              <p className="text-xs text-muted-foreground">{stat.note}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Operational Notes</CardTitle>
          <CardDescription>Live focus items for this section.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4 text-sm">
            {updates.map((update, index) => (
              <div
                key={update.title}
                className={index === updates.length - 1 ? "flex items-start justify-between gap-4" : "flex items-start justify-between gap-4 border-b pb-3"}
              >
                <span className="font-medium">{update.title}</span>
                <span className="max-w-xs text-right text-muted-foreground">
                  {update.detail}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
