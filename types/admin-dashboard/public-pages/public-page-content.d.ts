import type { HomePageConfig } from "@/types/admin-dashboard/public-pages/home-tabs-data"
import type { ForBusinessPageConfig } from "@/types/admin-dashboard/public-pages/for-business-tabs-data"

export type PublicWebsiteContentPage = "home" | "for-business"

export type ProfessionalSectionPage = "rfq" | "suppliers" | "services"

export type PublicWebsiteSectionPage =
  | PublicWebsiteContentPage
  | ProfessionalSectionPage

export type PublicPageContentSuccess<T> = {
  ok: true
  data: T
}

export type PublicPageContentError = {
  ok: false
  error: string
}

export type PublicPageContentResult<T> =
  | PublicPageContentSuccess<T>
  | PublicPageContentError

export type PublicPageSectionContent = {
  heading: string
  subheading: string
}

export type PublicPageSectionSaveInput = {
  slug: ProfessionalSectionPage
  content: PublicPageSectionContent
}

export type HomePageContentSuccess = PublicPageContentSuccess<HomePageConfig>
export type ForBusinessPageContentSuccess =
  | PublicPageContentSuccess<ForBusinessPageConfig>

export type HomePageSaveInput = {
  content: HomePageConfig
}

export type ForBusinessPageSaveInput = {
  content: ForBusinessPageConfig
}

export type PublicPageResponse<T> = PublicPageContentResult<T>
