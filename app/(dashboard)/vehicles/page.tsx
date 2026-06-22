import { fetchVehicles } from "@/actions/admin-dashboard/vehicles/vehicles"
import { VehiclesPage } from "@/components/admin-dashboard/vehicles/vehicles-page"

type VehiclesPageSearchParams = Promise<{
  q?: string | string[]
  page?: string | string[]
}>

const getSingleParam = (value: string | string[] | undefined): string =>
  Array.isArray(value) ? value[0] ?? "" : value ?? ""

export default async function VehiclesRoutePage({
  searchParams,
}: {
  searchParams: VehiclesPageSearchParams
}) {
  const params = await searchParams
  const query = getSingleParam(params.q)
  const parsedPage = Number.parseInt(getSingleParam(params.page), 10)
  const result = await fetchVehicles({
    query,
    page: Number.isNaN(parsedPage) ? 1 : parsedPage,
  })

  return (
    <VehiclesPage
      key={`${result.query}-${result.pagination.page}`}
      result={result}
    />
  )
}
