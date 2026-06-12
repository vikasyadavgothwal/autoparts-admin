import type { HomePageConfig } from "@/types/admin-dashboard/public-pages/home-tabs-data"
import type { ForBusinessPageConfig } from "@/types/admin-dashboard/public-pages/for-business-tabs-data"
import type { PublicPageSectionContent } from "@/types/admin-dashboard/public-pages/public-page-content"
import type { PublicPageSeoConfig } from "@/types/admin-dashboard/public-pages/seo"

export type PublicWebsiteContentBySlug = {
  home: HomePageConfig
  "for-business": ForBusinessPageConfig
  rfq: PublicPageSectionContent
  suppliers: PublicPageSectionContent
  services: PublicPageSectionContent
  "privacy-policy": string
  "terms-of-services": string
  "cookies-settings": string
}

export type PublicWebsiteContentSlug = keyof PublicWebsiteContentBySlug

export type PublicWebsiteContentSlugAlias =
  | "terms-condition"
  | "terms-conditions"
  | "terms-and-conditions"
  | "cookies-setting"
  | "cookie-settings"
  | "cookie-setting"

export type PublicWebsiteContentSlugInput =
  | PublicWebsiteContentSlug
  | PublicWebsiteContentSlugAlias

export type PublicWebsiteContentMap = {
  [K in PublicWebsiteContentSlug]: PublicWebsiteContentBySlug[K]
}

export type PublicWebsiteContentData = PublicWebsiteContentBySlug[PublicWebsiteContentSlug]

export type PublicWebsiteLegalSlug =
  | "privacy-policy"
  | "terms-of-services"
  | "cookies-settings"

export type PublicWebsiteContentSaveInput = {
  slug: PublicWebsiteLegalSlug
  content: string
}

export type PublicWebsiteContentError = {
  ok: false
  error: string
}

export type PublicWebsiteSingleContentSuccess<K extends PublicWebsiteContentSlug = PublicWebsiteContentSlug> = {
  ok: true
  slug: K
  data: PublicWebsiteContentBySlug[K]
  seo: PublicPageSeoConfig
}

export type PublicWebsiteAllContentSuccess = {
  ok: true
  data: PublicWebsiteContentMap
  fetchedAt: string
}

export type PublicWebsiteContentResponse<K extends PublicWebsiteContentSlug = PublicWebsiteContentSlug> =
  | PublicWebsiteContentError
  | PublicWebsiteSingleContentSuccess<K>
  | PublicWebsiteAllContentSuccess
