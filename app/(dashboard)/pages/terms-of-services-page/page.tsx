import {
  getTermsOfServicesPageContent,
  getPublicPageSeoContent,
} from "@/actions/admin-dashboard/public-pages/public-content"
import { LEGAL_CONTENT_FALLBACK_TEXT } from "@/services/admin-dashboard/public-pages/legal-content-fallback"
import { LegalDocumentEditor } from "@/components/admin-dashboard/public-pages/legal-document-editor"
import { DEFAULT_PUBLIC_PAGE_SEO_CONFIG } from "@/services/admin-dashboard/public-pages/seo"

export const dynamic = "force-dynamic"

export default async function TermsOfServicesPageRoute() {
  const [pageContent, pageSeo] = await Promise.all([
    getTermsOfServicesPageContent(),
    getPublicPageSeoContent("terms-of-services"),
  ])
  const initialContent = pageContent.ok
    ? pageContent.data
    : LEGAL_CONTENT_FALLBACK_TEXT["terms-of-services"]

  return (
    <LegalDocumentEditor
      slug="terms-of-services"
      initialContent={initialContent}
      initialSeo={pageSeo.ok ? pageSeo.data : DEFAULT_PUBLIC_PAGE_SEO_CONFIG}
    />
  )
}
 
