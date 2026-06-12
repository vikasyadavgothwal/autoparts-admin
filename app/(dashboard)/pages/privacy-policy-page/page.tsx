import {
  getPrivacyPolicyPageContent,
  getPublicPageSeoContent,
} from "@/actions/admin-dashboard/public-pages/public-content"
import { LEGAL_CONTENT_FALLBACK_TEXT } from "@/services/admin-dashboard/public-pages/legal-content-fallback"
import { LegalDocumentEditor } from "@/components/admin-dashboard/public-pages/legal-document-editor"
import { DEFAULT_PUBLIC_PAGE_SEO_CONFIG } from "@/services/admin-dashboard/public-pages/seo"

export const dynamic = "force-dynamic"

export default async function PrivacyPolicyPageRoute() {
  const [pageContent, pageSeo] = await Promise.all([
    getPrivacyPolicyPageContent(),
    getPublicPageSeoContent("privacy-policy"),
  ])
  const initialContent = pageContent.ok
    ? pageContent.data
    : LEGAL_CONTENT_FALLBACK_TEXT["privacy-policy"]

  return (
    <LegalDocumentEditor
      slug="privacy-policy"
      initialContent={initialContent}
      initialSeo={pageSeo.ok ? pageSeo.data : DEFAULT_PUBLIC_PAGE_SEO_CONFIG}
    />
  )
}
 
