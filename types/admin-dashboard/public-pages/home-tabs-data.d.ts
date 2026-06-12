export type HomeTabKey =
  | "banner"
  | "search"
  | "why-choose-us"
  | "category"
  | "featured-parts"
  | "process"
  | "enterprise-solutions"
  | "cta"
  | "seo"

export type HomeTabConfig = {
  key: HomeTabKey
  label: string
}

export type TextPair = {
  heading: string
  subheading: string
}

export type HomeBannerConfig = {
  backgroundImage: string
  backgroundImageKey: string
  badgeText: string
  heading: string
  subheading: string
  keyPoints: readonly string[]
}

export type HomeWhyChooseUsConfig = {
  heading: string
  subheading: string
  pairs: readonly TextPair[]
}

export type HomeCategoryConfig = {
  heading: string
  subheading: string
  bottomHeading: string
}

export type HomeFeaturedPartsConfig = {
  heading: string
  subheading: string
  buttonText: string
  buttonSlug: string
}

export type HomeProcessStep = TextPair

export type HomeEnterpriseCard = TextPair & {
  buttonText: string
  buttonLink: string
}

export type HomeEnterpriseConfig = {
  heading: string
  cards: readonly HomeEnterpriseCard[]
}

export type HomeCTAConfig = {
  heading: string
  subheading: string
  primaryButtonText: string
  primaryButtonLink: string
  secondaryButtonText: string
  secondaryButtonLink: string
}

export type HomePageConfig = {
  banner: HomeBannerConfig
  search: TextPair
  whyChooseUs: HomeWhyChooseUsConfig
  category: HomeCategoryConfig
  featuredParts: HomeFeaturedPartsConfig
  process: {
    steps: readonly HomeProcessStep[]
  }
  enterpriseSolutions: HomeEnterpriseConfig
  cta: HomeCTAConfig
}
