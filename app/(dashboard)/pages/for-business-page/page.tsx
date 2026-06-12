import {
  getForBusinessPageContent,
  getPublicPageSeoContent,
} from "@/actions/admin-dashboard/public-pages/public-content"
import { ForBusinessPage } from "@/components/admin-dashboard/public-pages/for-business-page"
import { FOR_BUSINESS_PAGE_DEFAULT_CONFIG } from "@/services/admin-dashboard/public-pages/for-business-tabs-data"
import { DEFAULT_PUBLIC_PAGE_SEO_CONFIG } from "@/services/admin-dashboard/public-pages/seo"

export const dynamic = "force-dynamic"

export default async function ForBusinessPageRoute() {
  const [pageContent, pageSeo] = await Promise.all([
    getForBusinessPageContent(),
    getPublicPageSeoContent("for-business"),
  ])

  return (
    <ForBusinessPage
      initialConfig={pageContent.ok ? pageContent.data : FOR_BUSINESS_PAGE_DEFAULT_CONFIG}
      initialSeo={pageSeo.ok ? pageSeo.data : DEFAULT_PUBLIC_PAGE_SEO_CONFIG}
    />
  )
}
