import { CrossReferencesPage } from "@/components/admin-dashboard/marketplace-intelligence/marketplace-intelligence-pages"
import { getCrossReferencesData } from "@/services/admin-dashboard/marketplace-intelligence/marketplace-intelligence-service"

export const dynamic = "force-dynamic"

export default async function CrossReferencesRoutePage() {
  const data = await getCrossReferencesData()
  return <CrossReferencesPage data={data} />
}
