import type {
  HomePageConfig,
  HomeTabKey as HomeTabKeyData,
} from "@/types/admin-dashboard/public-pages/home-tabs-data"
import type { PublicPageSeoConfig } from "@/types/admin-dashboard/public-pages/seo"

export type HomeTabKey = HomeTabKeyData
export type HomePageSectionKey = keyof HomePageConfig
export type HomePageContentProps = {
  initialConfig: HomePageConfig
  initialSeo: PublicPageSeoConfig
}

export type {
  BannerField,
  CtaField,
  EnterpriseCardField,
  HeadingPairField,
  SearchField,
} from "@/types/admin-dashboard/public-pages/home-tabs-components"

export type SaveSectionStatus = Record<keyof HomePageConfig, string>
