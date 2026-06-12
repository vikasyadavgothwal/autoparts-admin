import type {
  ForBusinessBannerConfig,
  ForBusinessBusinessSolutionsConfig,
  ForBusinessCtaConfig,
  ForBusinessFleetManagerConfig,
  ForBusinessPageConfig,
  ForBusinessPricingConfig,
  ForBusinessTabConfig,
  ForBusinessTabKey,
} from "@/types/admin-dashboard/public-pages/for-business-tabs-data"
import type { PublicPageSeoConfig } from "@/types/admin-dashboard/public-pages/seo"

export type SaveSectionStatus = Record<keyof ForBusinessPageConfig, string>
export type ForBusinessPageProps = {
  initialConfig: ForBusinessPageConfig
  initialSeo: PublicPageSeoConfig
}

export type BannerField = keyof ForBusinessBannerConfig
export type BusinessSolutionsSectionField = keyof Omit<ForBusinessBusinessSolutionsConfig, "cards">
export type CardField = keyof ForBusinessBusinessSolutionsConfig["cards"][number]
export type PricingSectionField = keyof Omit<ForBusinessPricingConfig, "plans">
export type PricingPlanField = keyof Omit<
  ForBusinessPricingConfig["plans"][number],
  "keyPoints" | "mostPopular"
>
export type CtaField = keyof ForBusinessCtaConfig
export type FleetField = keyof Omit<ForBusinessFleetManagerConfig, "keyPoints" | "cards">

export type ForBusinessActions = {
  onBannerChange: (field: BannerField, value: string) => void
  onBusinessSolutionCardChange: (
    index: number,
    field: CardField,
    value: string,
  ) => void
  onBusinessSolutionsTextChange: (
    field: BusinessSolutionsSectionField,
    value: string,
  ) => void
  onPricingSectionChange: (field: PricingSectionField, value: string) => void
  onPricingPlanChange: (
    index: number,
    field: PricingPlanField,
    value: string,
  ) => void
  onPricingPlanPointChange: (
    planIndex: number,
    pointIndex: number,
    value: string,
  ) => void
  onPricingPlanMostPopularChange: (
    planIndex: number,
    isMostPopular: boolean,
  ) => void
  onPricingPlanPointAdd: (planIndex: number) => void
  onPricingPlanPointRemove: (planIndex: number, pointIndex: number) => void
  onFleetChange: (field: FleetField, value: string) => void
  onFleetPointChange: (index: number, value: string) => void
  onFleetPointAdd: () => void
  onFleetPointRemove: (index: number) => void
  onFleetCardChange: (
    index: number,
    field: keyof ForBusinessFleetManagerConfig["cards"][number],
    value: string,
  ) => void
  onCtaChange: (field: CtaField, value: string) => void
}

export type { ForBusinessTabConfig, ForBusinessTabKey }
