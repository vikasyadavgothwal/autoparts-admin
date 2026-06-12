"use client"

import { useState } from "react"
import { LimitedInput } from "@/components/ui/limited-input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { PublicPageRendererProps } from "@/types/admin-dashboard/public-pages/public-pages-components"
import type { PublicPageDefinition } from "@/types/admin-dashboard/public-pages/public-pages-data"

export function PublicPageRenderer({ page }: PublicPageRendererProps) {
  return (
    <div className="space-y-8">
      <section>
        <h1 className="text-3xl font-bold text-white">{page.title}</h1>
        <p className="mt-2 max-w-3xl text-[#9CA3AF]">{page.description}</p>
      </section>

      {page.slug === "search" && <SearchPanel />}

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

function SearchPanel() {
  const [query, setQuery] = useState("")

  return (
    <Card className="rounded-lg border-[#2A2A2A] bg-[#1A1A1A] p-0">
      <CardHeader>
        <CardTitle className="text-white">Search</CardTitle>
      </CardHeader>
      <CardContent>
        <LimitedInput
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          maxLength={120}
          placeholder="Type your search..."
          className="rounded-lg border-[#2A2A2A] bg-[#0A0A0A]"
        />
      </CardContent>
    </Card>
  )
}
