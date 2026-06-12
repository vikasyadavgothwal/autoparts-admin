
import {
  getSuppliersPageContent,
  getPublicPageSeoContent,
} from "@/actions/admin-dashboard/public-pages/public-content"
import { ProfessionalPageForm } from "@/components/admin-dashboard/public-pages/professional-page-form"
import { DEFAULT_PUBLIC_PAGE_SEO_CONFIG } from "@/services/admin-dashboard/public-pages/seo"
import type { PublicPageSectionContent } from "@/types/admin-dashboard/public-pages/public-page-content"

const DEFAULT_SUPPLIERS_CONTENT: PublicPageSectionContent = {
  heading: "",
  subheading: "",
}

export default async function DashboardSuppliersPage() {
  const [pageContent, pageSeo] = await Promise.all([
    getSuppliersPageContent(),
    getPublicPageSeoContent("suppliers"),
  ])

  return (
    <ProfessionalPageForm
      pageTitle="Suppliers Page"
      pageDescription="Manage supplier profiles, onboarding content, and service visibility."
      headingPlaceholder="Fleet Services Hub"
      subheadingPlaceholder="Define support, maintenance, and dispatch channels with transparent service outcomes."
      statusText="Suppliers"
      initialValues={pageContent.ok ? pageContent.data : DEFAULT_SUPPLIERS_CONTENT}
      initialSeo={pageSeo.ok ? pageSeo.data : DEFAULT_PUBLIC_PAGE_SEO_CONFIG}
      saveSlug="suppliers"
    />
  )
}
