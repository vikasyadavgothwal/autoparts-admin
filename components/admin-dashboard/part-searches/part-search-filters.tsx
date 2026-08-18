"use client"

import { type FormEvent, useState } from "react"
import { useRouter } from "next/navigation"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

const selectClassName =
  "h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus:border-ring focus:ring-3 focus:ring-ring/50"

export function PartSearchFilters({
  query,
  queryType,
  status,
}: {
  query: string
  queryType: string
  status: string
}) {
  const router = useRouter()
  const [nextQuery, setNextQuery] = useState(query)
  const [nextQueryType, setNextQueryType] = useState(queryType)
  const [nextStatus, setNextStatus] = useState(status)

  const applyFilters = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const params = new URLSearchParams()
    const trimmedQuery = nextQuery.trim()

    if (trimmedQuery) params.set("q", trimmedQuery)
    if (nextQueryType) params.set("type", nextQueryType)
    if (nextStatus) params.set("status", nextStatus)

    router.replace(params.toString() ? `/part-searches?${params}` : "/part-searches", {
      scroll: false,
    })
  }

  const clearFilters = () => {
    setNextQuery("")
    setNextQueryType("")
    setNextStatus("")
    router.replace("/part-searches", { scroll: false })
  }

  return (
    <form
      className="grid gap-3 md:grid-cols-[1fr_180px_180px_auto_auto]"
      onSubmit={applyFilters}
    >
      <Input
        value={nextQuery}
        onChange={(event) => setNextQuery(event.target.value.slice(0, 120))}
        maxLength={120}
        placeholder="Search VIN, OEM, part name, or normalized key"
      />
      <select
        className={selectClassName}
        value={nextQueryType}
        onChange={(event) => setNextQueryType(event.target.value)}
      >
        <option value="">All types</option>
        <option value="vin">VIN</option>
        <option value="part_number">Part number / OEM</option>
        <option value="part_name">Part name</option>
      </select>
      <select
        className={selectClassName}
        value={nextStatus}
        onChange={(event) => setNextStatus(event.target.value)}
      >
        <option value="">All statuses</option>
        <option value="available">Available</option>
        <option value="unavailable">Not available</option>
      </select>
      <Button type="submit">Apply</Button>
      <Button type="button" variant="outline" onClick={clearFilters}>
        Clear
      </Button>
    </form>
  )
}
