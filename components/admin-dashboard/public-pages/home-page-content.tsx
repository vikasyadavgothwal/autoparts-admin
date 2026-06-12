import { HomeTabs } from "@/components/admin-dashboard/public-pages/home-tabs"
import type { HomePageContentProps } from "@/types/admin-dashboard/public-pages/home-tabs"

export function HomePageContent({
  initialConfig,
  initialSeo,
}: HomePageContentProps) {
  return <HomeTabs initialConfig={initialConfig} initialSeo={initialSeo} />
}
