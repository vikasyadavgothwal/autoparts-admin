import {
  getServicesPageContent,
  getPublicPageSeoContent,
} from "@/actions/admin-dashboard/public-pages/public-content"
import { ProfessionalPageForm } from "@/components/admin-dashboard/public-pages/professional-page-form"
import { DEFAULT_PUBLIC_PAGE_SEO_CONFIG } from "@/services/admin-dashboard/public-pages/seo"
import type { PublicPageSectionContent } from "@/types/admin-dashboard/public-pages/public-page-content"

const DEFAULT_SERVICES_CONTENT: PublicPageSectionContent = {
  heading: "",
  subheading: "",
}

export default async function DashboardServicesPage() {
  const [pageContent, pageSeo] = await Promise.all([
    getServicesPageContent(),
    getPublicPageSeoContent("services"),
  ])

  return (
    <ProfessionalPageForm
      pageTitle="Services Page"
      pageDescription="Manage services, support policies, and response templates."
      headingPlaceholder="Fleet Services Hub"
      subheadingPlaceholder="Define support, maintenance, and dispatch channels with transparent service outcomes."
      statusText="Services"
      initialValues={pageContent.ok ? pageContent.data : DEFAULT_SERVICES_CONTENT}
      initialSeo={pageSeo.ok ? pageSeo.data : DEFAULT_PUBLIC_PAGE_SEO_CONFIG}
      saveSlug="services"
    />
  )
}
 
