import {
  getHomePageContent,
  getPublicPageSeoContent,
} from "@/actions/admin-dashboard/public-pages/public-content"
import { HomePageContent } from "@/components/admin-dashboard/public-pages/home-page-content"
import { HOME_PAGE_DEFAULT_CONFIG } from "@/services/admin-dashboard/public-pages/home-tabs-data"
import { DEFAULT_PUBLIC_PAGE_SEO_CONFIG } from "@/services/admin-dashboard/public-pages/seo"

export const dynamic = "force-dynamic"

export default async function HomePage() {
  const [pageContent, pageSeo] = await Promise.all([
    getHomePageContent(),
    getPublicPageSeoContent("home"),
  ])

  return (
    <HomePageContent
      initialConfig={pageContent.ok ? pageContent.data : HOME_PAGE_DEFAULT_CONFIG}
      initialSeo={pageSeo.ok ? pageSeo.data : DEFAULT_PUBLIC_PAGE_SEO_CONFIG}
    />
  )
}
 
