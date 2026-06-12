export type ForBusinessTabKey =
  | "banner"
  | "business-solutions"
  | "pricing"
  | "for-fleet-managers"
  | "cta"
  | "seo"

export type ForBusinessTabConfig = {
  key: ForBusinessTabKey
  label: string
}

export type ForBusinessCard = {
  heading: string
  subheading: string
}

export type ForBusinessPlan = {
  heading: string
  subheading: string
  price: string
  duration: string
  buttonText: string
  mostPopular: boolean
  keyPoints: readonly string[]
}

export type ForBusinessFleetCard = {
  topHeading: string
  heading: string
  growthText: string
}

export type ForBusinessBannerConfig = {
  badgeText: string
  heading: string
  redHeading: string
  subheading: string
  primaryButtonText: string
  primaryButtonLink: string
  secondaryButtonText: string
  secondaryButtonLink: string
}

export type ForBusinessBusinessSolutionsConfig = {
  heading: string
  subheading: string
  cards: readonly ForBusinessCard[]
}

export type ForBusinessPricingConfig = {
  heading: string
  subheading: string
  plans: readonly ForBusinessPlan[]
}

export type ForBusinessFleetManagerConfig = {
  topHeading: string
  heading: string
  subheading: string
  keyPoints: readonly string[]
  buttonText: string
  buttonLink: string
  cards: readonly ForBusinessFleetCard[]
}

export type ForBusinessCtaConfig = {
  heading: string
  subheading: string
  primaryButtonText: string
  primaryButtonLink: string
  secondaryButtonText: string
  secondaryButtonLink: string
}

export type ForBusinessPageConfig = {
  banner: ForBusinessBannerConfig
  businessSolutions: ForBusinessBusinessSolutionsConfig
  pricing: ForBusinessPricingConfig
  forFleetManagers: ForBusinessFleetManagerConfig
  cta: ForBusinessCtaConfig
}

export type ForBusinessInputLimits = {
  badgeText: number
  heading: number
  redHeading: number
  subheading: number
  buttonText: number
  buttonLink: number
  cardHeading: number
  cardSubheading: number
  planHeading: number
  planSubheading: number
  planPrice: number
  planDuration: number
  planKeyPoint: number
  planButtonText: number
  topHeading: number
  growthText: number
  point: number
}
