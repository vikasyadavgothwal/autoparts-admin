
import {
  getRfqPageContent,
  getPublicPageSeoContent,
} from "@/actions/admin-dashboard/public-pages/public-content"
import { ProfessionalPageForm } from "@/components/admin-dashboard/public-pages/professional-page-form"
import { DEFAULT_PUBLIC_PAGE_SEO_CONFIG } from "@/services/admin-dashboard/public-pages/seo"
import type { PublicPageSectionContent } from "@/types/admin-dashboard/public-pages/public-page-content"

const DEFAULT_RFQ_CONTENT: PublicPageSectionContent = {
  heading: "",
  subheading: "",
}

export default async function RfqPageRoute() {
  const [pageContent, pageSeo] = await Promise.all([
    getRfqPageContent(),
    getPublicPageSeoContent("rfq"),
  ])

  return (
    <ProfessionalPageForm
      pageTitle="RFQ Page"
      pageDescription="Manage RFQ landing content and request workflow copy from one place."
      headingPlaceholder="RFQ Management Center"
      subheadingPlaceholder="Create, track, and prioritize procurement requests from your customer and partner network."
      statusText="RFQs"
      initialValues={pageContent.ok ? pageContent.data : DEFAULT_RFQ_CONTENT}
      initialSeo={pageSeo.ok ? pageSeo.data : DEFAULT_PUBLIC_PAGE_SEO_CONFIG}
      saveSlug="rfq"
    />
  )
}
