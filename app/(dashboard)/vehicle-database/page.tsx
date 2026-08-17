import { VehicleDatabasePage } from "@/components/admin-dashboard/marketplace-intelligence/marketplace-intelligence-pages"
import { getVehicleDatabaseData } from "@/services/admin-dashboard/marketplace-intelligence/marketplace-intelligence-service"

export const dynamic = "force-dynamic"

type VehicleDatabaseRoutePageProps = {
  searchParams: Promise<{ q?: string | string[]; page?: string | string[] }>
}

const firstParam = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value

export default async function VehicleDatabaseRoutePage({
  searchParams,
}: VehicleDatabaseRoutePageProps) {
  const params = await searchParams
  const page = Number(firstParam(params.page) ?? "1")
  const search = firstParam(params.q) ?? ""
  const data = await getVehicleDatabaseData({ page, search })

  return <VehicleDatabasePage data={data} />
}
