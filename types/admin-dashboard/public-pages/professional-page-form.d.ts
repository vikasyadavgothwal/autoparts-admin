import type {
  PublicPageContentResult,
  ProfessionalSectionPage,
} from "@/types/admin-dashboard/public-pages/public-page-content"
import type { PublicPageSeoConfig } from "@/types/admin-dashboard/public-pages/seo"

export type ProfessionalPageContentValues = {
  heading: string
  subheading: string
}

export type ProfessionalPageFormProps = {
  pageTitle: string
  pageDescription: string
  headingPlaceholder: string
  subheadingPlaceholder: string
  statusText: string
  initialValues?: ProfessionalPageContentValues
  initialSeo: PublicPageSeoConfig
  saveSlug?: ProfessionalSectionPage
}
