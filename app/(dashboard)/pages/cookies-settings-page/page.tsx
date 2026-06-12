import {
  getCookiesSettingsPageContent,
  getPublicPageSeoContent,
} from "@/actions/admin-dashboard/public-pages/public-content"
import { LEGAL_CONTENT_FALLBACK_TEXT } from "@/services/admin-dashboard/public-pages/legal-content-fallback"
import { LegalDocumentEditor } from "@/components/admin-dashboard/public-pages/legal-document-editor"
import { DEFAULT_PUBLIC_PAGE_SEO_CONFIG } from "@/services/admin-dashboard/public-pages/seo"

export const dynamic = "force-dynamic"

export default async function CookiesSettingsPageRoute() {
  const [pageContent, pageSeo] = await Promise.all([
    getCookiesSettingsPageContent(),
    getPublicPageSeoContent("cookies-settings"),
  ])
  const initialContent = pageContent.ok
    ? pageContent.data
    : LEGAL_CONTENT_FALLBACK_TEXT["cookies-settings"]

  return (
    <LegalDocumentEditor
      slug="cookies-settings"
      initialContent={initialContent}
      initialSeo={pageSeo.ok ? pageSeo.data : DEFAULT_PUBLIC_PAGE_SEO_CONFIG}
    />
  )
}
 
