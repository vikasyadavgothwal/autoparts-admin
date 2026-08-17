import { InventoryMappingPage } from "@/components/admin-dashboard/marketplace-intelligence/marketplace-intelligence-pages"
import { getInventoryMappingData } from "@/services/admin-dashboard/marketplace-intelligence/marketplace-intelligence-service"

export const dynamic = "force-dynamic"

export default async function InventoryMappingRoutePage() {
  const data = await getInventoryMappingData()
  return <InventoryMappingPage data={data} />
}
