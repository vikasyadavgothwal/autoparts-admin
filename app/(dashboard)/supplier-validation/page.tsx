import { SupplierValidationPage } from "@/components/admin-dashboard/marketplace-intelligence/marketplace-intelligence-pages"
import { getSupplierValidationData } from "@/services/admin-dashboard/marketplace-intelligence/marketplace-intelligence-service"

export const dynamic = "force-dynamic"

export default async function SupplierValidationRoutePage() {
  const data = await getSupplierValidationData()
  return <SupplierValidationPage data={data} />
}
