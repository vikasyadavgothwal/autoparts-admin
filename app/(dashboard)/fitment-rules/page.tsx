import { FitmentRulesPage } from "@/components/admin-dashboard/marketplace-intelligence/marketplace-intelligence-pages"
import { getFitmentRulesData } from "@/services/admin-dashboard/marketplace-intelligence/marketplace-intelligence-service"

export const dynamic = "force-dynamic"

export default async function FitmentRulesRoutePage() {
  const data = await getFitmentRulesData()
  return <FitmentRulesPage data={data} />
}
