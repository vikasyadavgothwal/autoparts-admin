import type { PublicPageSlug } from "@/types/admin-dashboard/public-pages/public-pages-data"
import type { PublicPageSeoConfig } from "@/types/admin-dashboard/public-pages/seo"

export type LegalDocSlug = Extract<
  PublicPageSlug,
  "privacy-policy" | "cookies-settings" | "terms-of-services"
>

export type LegalDocumentEditorProps = {
  slug: LegalDocSlug
  initialContent?: string
  initialSeo: PublicPageSeoConfig
}
