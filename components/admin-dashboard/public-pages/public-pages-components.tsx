import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { PublicPageRendererProps } from "@/types/admin-dashboard/public-pages/public-pages-components"

export function PublicPageRenderer({ page }: PublicPageRendererProps) {
  return (
    <div className="space-y-8">
      <section>
        <h1 className="text-3xl font-bold text-white">{page.title}</h1>
        <p className="mt-2 max-w-3xl text-[#9CA3AF]">{page.description}</p>
      </section>

      <Card className="rounded-lg border-[#2A2A2A] bg-[#1A1A1A] p-0">
        <CardHeader>
          <CardTitle className="text-white">{page.title} Details</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="list-disc space-y-2 pl-5 text-[#9CA3AF]">
            {page.details.map((detail) => (
              <li key={detail}>{detail}</li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}
