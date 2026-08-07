import type {
  HomeBannerConfig,
  HomeCTAConfig,
  HomeCategoryConfig,
  HomeEnterpriseCard,
  HomeEnterpriseConfig,
  HomeFeaturedPartsConfig,
  HomePageConfig,
  HomeProcessStep,
  HomeWhyChooseUsConfig,
  TextPair,
} from "@/types/admin-dashboard/public-pages/home-tabs-data"
import { HOME_PAGE_DEFAULT_CONFIG } from "@/services/admin-dashboard/public-pages/home-tabs-data"
import {
  FOR_BUSINESS_PAGE_DEFAULT_CONFIG,
} from "@/services/admin-dashboard/public-pages/for-business-tabs-data"
import type {
  ForBusinessBannerConfig,
  ForBusinessBusinessSolutionsConfig,
  ForBusinessCard,
  ForBusinessCtaConfig,
  ForBusinessFleetCard,
  ForBusinessFleetManagerConfig,
  ForBusinessPageConfig,
  ForBusinessPlan,
  ForBusinessPricingConfig,
} from "@/types/admin-dashboard/public-pages/for-business-tabs-data"

type JsonObject = Record<string, unknown>

const isObject = (value: unknown): value is JsonObject =>
  typeof value === "object" && value !== null && !Array.isArray(value)

const normalizeText = (value: unknown, fallback: string): string =>
  typeof value === "string" ? value : fallback

const normalizeBoolean = (value: unknown, fallback: boolean): boolean =>
  typeof value === "boolean" ? value : fallback

const normalizeTextList = (
  value: unknown,
  fallback: readonly string[],
): string[] => {
  const source = Array.isArray(value) ? value : []
  const count = Math.max(source.length, fallback.length)
  const normalized: string[] = []

  for (let index = 0; index < count; index += 1) {
    const sourceItem = source[index]
    normalized[index] =
      typeof sourceItem === "string" ? sourceItem : fallback[index] ?? ""
  }

  return normalized
}

const normalizeObject = <T extends JsonObject>(
  value: unknown,
  fallback: T,
): T => {
  const source = isObject(value) ? value : {}
  return {
    ...fallback,
    ...source,
  } as T
}

const normalizePairs = (
  value: unknown,
  fallback: readonly TextPair[],
): TextPair[] => {
  const source = Array.isArray(value) ? value : []
  const count = Math.max(source.length, fallback.length)
  const normalized: TextPair[] = []

  for (let index = 0; index < count; index += 1) {
    const currentSource = isObject(source[index]) ? (source[index] as JsonObject) : {}
    const currentFallback = fallback[index] ?? fallback[fallback.length - 1] ?? {
      heading: "",
      subheading: "",
    }

    normalized[index] = {
      heading: normalizeText(currentSource.heading, currentFallback.heading),
      subheading: normalizeText(
        currentSource.subheading,
        currentFallback.subheading,
      ),
    }
  }

  return normalized
}

const resolveHomeBannerConfig = (value: unknown): HomeBannerConfig => {
  const source = normalizeObject(value, HOME_PAGE_DEFAULT_CONFIG.banner)
  return {
    backgroundImage: normalizeText(
      source.backgroundImage,
      HOME_PAGE_DEFAULT_CONFIG.banner.backgroundImage,
    ),
    backgroundImageKey: normalizeText(
      source.backgroundImageKey,
      HOME_PAGE_DEFAULT_CONFIG.banner.backgroundImageKey,
    ),
    badgeText: normalizeText(source.badgeText, HOME_PAGE_DEFAULT_CONFIG.banner.badgeText),
    heading: normalizeText(source.heading, HOME_PAGE_DEFAULT_CONFIG.banner.heading),
    subheading: normalizeText(
      source.subheading,
      HOME_PAGE_DEFAULT_CONFIG.banner.subheading,
    ),
    keyPoints: normalizeTextList(source.keyPoints, HOME_PAGE_DEFAULT_CONFIG.banner.keyPoints),
  }
}

const resolveHomeSearchConfig = (value: unknown) => {
  const source = normalizeObject(value, HOME_PAGE_DEFAULT_CONFIG.search)
  return {
    heading: normalizeText(source.heading, HOME_PAGE_DEFAULT_CONFIG.search.heading),
    subheading: normalizeText(
      source.subheading,
      HOME_PAGE_DEFAULT_CONFIG.search.subheading,
    ),
  }
}

const resolveHomeWhyChooseUsConfig = (value: unknown): HomeWhyChooseUsConfig => {
  const source = normalizeObject(value, HOME_PAGE_DEFAULT_CONFIG.whyChooseUs)
  return {
    heading: normalizeText(
      source.heading,
      HOME_PAGE_DEFAULT_CONFIG.whyChooseUs.heading,
    ),
    subheading: normalizeText(
      source.subheading,
      HOME_PAGE_DEFAULT_CONFIG.whyChooseUs.subheading,
    ),
    pairs: normalizePairs(source.pairs, HOME_PAGE_DEFAULT_CONFIG.whyChooseUs.pairs),
  }
}

const resolveHomeCategoryConfig = (value: unknown): HomeCategoryConfig => {
  const source = normalizeObject(value, HOME_PAGE_DEFAULT_CONFIG.category)
  return {
    heading: normalizeText(source.heading, HOME_PAGE_DEFAULT_CONFIG.category.heading),
    subheading: normalizeText(
      source.subheading,
      HOME_PAGE_DEFAULT_CONFIG.category.subheading,
    ),
    bottomHeading: normalizeText(
      source.bottomHeading,
      HOME_PAGE_DEFAULT_CONFIG.category.bottomHeading,
    ),
  }
}

const resolveHomeFeaturedPartsConfig = (
  value: unknown,
): HomeFeaturedPartsConfig => {
  const source = normalizeObject(value, HOME_PAGE_DEFAULT_CONFIG.featuredParts)
  return {
    heading: normalizeText(source.heading, HOME_PAGE_DEFAULT_CONFIG.featuredParts.heading),
    subheading: normalizeText(
      source.subheading,
      HOME_PAGE_DEFAULT_CONFIG.featuredParts.subheading,
    ),
    buttonText: normalizeText(
      source.buttonText,
      HOME_PAGE_DEFAULT_CONFIG.featuredParts.buttonText,
    ),
    buttonSlug: normalizeText(
      source.buttonSlug,
      HOME_PAGE_DEFAULT_CONFIG.featuredParts.buttonSlug,
    ),
  }
}

const normalizeProcessSteps = (value: unknown): HomeProcessStep[] => {
  const stepsSource = isObject(value) ? (value as JsonObject).steps : []
  const source = Array.isArray(stepsSource) ? stepsSource : []
  const fallback = HOME_PAGE_DEFAULT_CONFIG.process.steps
  const count = Math.max(source.length, fallback.length)
  const normalized: HomeProcessStep[] = []
  for (let index = 0; index < count; index += 1) {
    const currentSource = isObject(source[index]) ? (source[index] as JsonObject) : {}
    const fallbackStep = fallback[index] ?? fallback[fallback.length - 1]
    normalized[index] = {
      heading: normalizeText(
        currentSource.heading,
        fallbackStep.heading,
      ),
      subheading: normalizeText(
        currentSource.subheading,
        fallbackStep.subheading,
      ),
    }
  }

  return normalized
}

const resolveHomeProcessConfig = (value: unknown) => ({
  steps: normalizeProcessSteps(value),
})

const resolveHomeEnterpriseSolutionsConfig = (
  value: unknown,
): HomeEnterpriseConfig => {
  const source = normalizeObject(value, HOME_PAGE_DEFAULT_CONFIG.enterpriseSolutions)
  const sourceCards = Array.isArray(source.cards) ? source.cards : []
  const fallbackCards = HOME_PAGE_DEFAULT_CONFIG.enterpriseSolutions.cards
  const count = Math.max(sourceCards.length, fallbackCards.length)
  const normalizedCards: HomeEnterpriseCard[] = []

  for (let index = 0; index < count; index += 1) {
    const cardSource = isObject(sourceCards[index])
      ? (sourceCards[index] as JsonObject)
      : {}
    const cardFallback = fallbackCards[index] ?? fallbackCards[fallbackCards.length - 1]

    normalizedCards[index] = {
      heading: normalizeText(cardSource.heading, cardFallback.heading),
      subheading: normalizeText(cardSource.subheading, cardFallback.subheading),
      buttonText: normalizeText(cardSource.buttonText, cardFallback.buttonText),
      buttonLink: normalizeText(cardSource.buttonLink, cardFallback.buttonLink),
    }
  }

  return {
    heading: normalizeText(
      source.heading,
      HOME_PAGE_DEFAULT_CONFIG.enterpriseSolutions.heading,
    ),
    cards: normalizedCards,
  }
}

const resolveHomeCtaConfig = (value: unknown): HomeCTAConfig => {
  const source = normalizeObject(value, HOME_PAGE_DEFAULT_CONFIG.cta)
  return {
    heading: normalizeText(source.heading, HOME_PAGE_DEFAULT_CONFIG.cta.heading),
    subheading: normalizeText(
      source.subheading,
      HOME_PAGE_DEFAULT_CONFIG.cta.subheading,
    ),
    primaryButtonText: normalizeText(
      source.primaryButtonText,
      HOME_PAGE_DEFAULT_CONFIG.cta.primaryButtonText,
    ),
    primaryButtonLink: normalizeText(
      source.primaryButtonLink,
      HOME_PAGE_DEFAULT_CONFIG.cta.primaryButtonLink,
    ),
    secondaryButtonText: normalizeText(
      source.secondaryButtonText,
      HOME_PAGE_DEFAULT_CONFIG.cta.secondaryButtonText,
    ),
    secondaryButtonLink: normalizeText(
      source.secondaryButtonLink,
      HOME_PAGE_DEFAULT_CONFIG.cta.secondaryButtonLink,
    ),
  }
}

const resolveForBusinessBannerConfig = (value: unknown): ForBusinessBannerConfig => {
  const source = normalizeObject(value, FOR_BUSINESS_PAGE_DEFAULT_CONFIG.banner)
  return {
    badgeText: normalizeText(
      source.badgeText,
      FOR_BUSINESS_PAGE_DEFAULT_CONFIG.banner.badgeText,
    ),
    heading: normalizeText(
      source.heading,
      FOR_BUSINESS_PAGE_DEFAULT_CONFIG.banner.heading,
    ),
    redHeading: normalizeText(
      source.redHeading,
      FOR_BUSINESS_PAGE_DEFAULT_CONFIG.banner.redHeading,
    ),
    subheading: normalizeText(
      source.subheading,
      FOR_BUSINESS_PAGE_DEFAULT_CONFIG.banner.subheading,
    ),
    primaryButtonText: normalizeText(
      source.primaryButtonText,
      FOR_BUSINESS_PAGE_DEFAULT_CONFIG.banner.primaryButtonText,
    ),
    primaryButtonLink: normalizeText(
      source.primaryButtonLink,
      FOR_BUSINESS_PAGE_DEFAULT_CONFIG.banner.primaryButtonLink,
    ),
    secondaryButtonText: normalizeText(
      source.secondaryButtonText,
      FOR_BUSINESS_PAGE_DEFAULT_CONFIG.banner.secondaryButtonText,
    ),
    secondaryButtonLink: normalizeText(
      source.secondaryButtonLink,
      FOR_BUSINESS_PAGE_DEFAULT_CONFIG.banner.secondaryButtonLink,
    ),
  }
}

const resolveForBusinessBusinessSolutions = (
  value: unknown,
): ForBusinessBusinessSolutionsConfig => {
  const source = normalizeObject(value, FOR_BUSINESS_PAGE_DEFAULT_CONFIG.businessSolutions)
  const sourceCards = Array.isArray(source.cards) ? source.cards : []
  const fallbackCards = FOR_BUSINESS_PAGE_DEFAULT_CONFIG.businessSolutions.cards
  const count = Math.max(sourceCards.length, fallbackCards.length)
  const normalizedCards: ForBusinessCard[] = []

  for (let index = 0; index < count; index += 1) {
    const cardSource = isObject(sourceCards[index])
      ? (sourceCards[index] as JsonObject)
      : {}
    const cardFallback = fallbackCards[index] ?? fallbackCards[fallbackCards.length - 1]

    normalizedCards[index] = {
      heading: normalizeText(cardSource.heading, cardFallback.heading),
      subheading: normalizeText(cardSource.subheading, cardFallback.subheading),
    }
  }

  return {
    heading: normalizeText(
      source.heading,
      FOR_BUSINESS_PAGE_DEFAULT_CONFIG.businessSolutions.heading,
    ),
    subheading: normalizeText(
      source.subheading,
      FOR_BUSINESS_PAGE_DEFAULT_CONFIG.businessSolutions.subheading,
    ),
    cards: normalizedCards,
  }
}

const resolveForBusinessPricing = (value: unknown): ForBusinessPricingConfig => {
  const source = normalizeObject(value, FOR_BUSINESS_PAGE_DEFAULT_CONFIG.pricing)
  const fallbackPlans = FOR_BUSINESS_PAGE_DEFAULT_CONFIG.pricing.plans
  const sourcePlans =
    Array.isArray(source.plans) && source.plans.length === fallbackPlans.length
      ? source.plans
      : fallbackPlans
  const count = 3
  const normalizedPlans: ForBusinessPlan[] = []

  for (let index = 0; index < count; index += 1) {
    const planSource = isObject(sourcePlans[index])
      ? (sourcePlans[index] as JsonObject)
      : {}
    const planFallback = fallbackPlans[index] ?? fallbackPlans[fallbackPlans.length - 1]

    normalizedPlans[index] = {
      heading: normalizeText(planSource.heading, planFallback.heading),
      subheading: normalizeText(planSource.subheading, planFallback.subheading),
      price: normalizeText(planSource.price, planFallback.price),
      duration: normalizeText(planSource.duration, planFallback.duration),
      buttonText: normalizeText(planSource.buttonText, planFallback.buttonText),
      mostPopular: normalizeBoolean(planSource.mostPopular, planFallback.mostPopular),
      keyPoints: normalizeTextList(planSource.keyPoints, planFallback.keyPoints),
    }
  }

  return {
    heading: normalizeText(source.heading, FOR_BUSINESS_PAGE_DEFAULT_CONFIG.pricing.heading),
    subheading: normalizeText(
      source.subheading,
      FOR_BUSINESS_PAGE_DEFAULT_CONFIG.pricing.subheading,
    ),
    plans: normalizedPlans,
  }
}

const resolveForBusinessFleetManagerConfig = (
  value: unknown,
): ForBusinessFleetManagerConfig => {
  const source = normalizeObject(value, FOR_BUSINESS_PAGE_DEFAULT_CONFIG.forFleetManagers)
  const sourceCards = Array.isArray(source.cards) ? source.cards : []
  const fallbackCards = FOR_BUSINESS_PAGE_DEFAULT_CONFIG.forFleetManagers.cards
  const count = Math.max(sourceCards.length, fallbackCards.length)
  const normalizedCards: ForBusinessFleetCard[] = []

  for (let index = 0; index < count; index += 1) {
    const cardSource = isObject(sourceCards[index])
      ? (sourceCards[index] as JsonObject)
      : {}
    const cardFallback = fallbackCards[index] ?? fallbackCards[fallbackCards.length - 1]

    normalizedCards[index] = {
      topHeading: normalizeText(cardSource.topHeading, cardFallback.topHeading),
      heading: normalizeText(cardSource.heading, cardFallback.heading),
      growthText: normalizeText(cardSource.growthText, cardFallback.growthText),
    }
  }

  return {
    topHeading: normalizeText(
      source.topHeading,
      FOR_BUSINESS_PAGE_DEFAULT_CONFIG.forFleetManagers.topHeading,
    ),
    heading: normalizeText(
      source.heading,
      FOR_BUSINESS_PAGE_DEFAULT_CONFIG.forFleetManagers.heading,
    ),
    subheading: normalizeText(
      source.subheading,
      FOR_BUSINESS_PAGE_DEFAULT_CONFIG.forFleetManagers.subheading,
    ),
    keyPoints: normalizeTextList(
      source.keyPoints,
      FOR_BUSINESS_PAGE_DEFAULT_CONFIG.forFleetManagers.keyPoints,
    ),
    buttonText: normalizeText(
      source.buttonText,
      FOR_BUSINESS_PAGE_DEFAULT_CONFIG.forFleetManagers.buttonText,
    ),
    buttonLink: normalizeText(
      source.buttonLink,
      FOR_BUSINESS_PAGE_DEFAULT_CONFIG.forFleetManagers.buttonLink,
    ),
    cards: normalizedCards,
  }
}

const resolveForBusinessCta = (value: unknown): ForBusinessCtaConfig => {
  const source = normalizeObject(value, FOR_BUSINESS_PAGE_DEFAULT_CONFIG.cta)
  return {
    heading: normalizeText(source.heading, FOR_BUSINESS_PAGE_DEFAULT_CONFIG.cta.heading),
    subheading: normalizeText(
      source.subheading,
      FOR_BUSINESS_PAGE_DEFAULT_CONFIG.cta.subheading,
    ),
    primaryButtonText: normalizeText(
      source.primaryButtonText,
      FOR_BUSINESS_PAGE_DEFAULT_CONFIG.cta.primaryButtonText,
    ),
    primaryButtonLink: normalizeText(
      source.primaryButtonLink,
      FOR_BUSINESS_PAGE_DEFAULT_CONFIG.cta.primaryButtonLink,
    ),
    secondaryButtonText: normalizeText(
      source.secondaryButtonText,
      FOR_BUSINESS_PAGE_DEFAULT_CONFIG.cta.secondaryButtonText,
    ),
    secondaryButtonLink: normalizeText(
      source.secondaryButtonLink,
      FOR_BUSINESS_PAGE_DEFAULT_CONFIG.cta.secondaryButtonLink,
    ),
  }
}

/**
 * Returns a validated home page config based on persisted DB content.
 */
export function resolveHomePageConfigFromDb(storedConfig: unknown): HomePageConfig {
  const source = isObject(storedConfig) ? storedConfig : {}

  return {
    banner: resolveHomeBannerConfig(source.banner),
    search: resolveHomeSearchConfig(source.search),
    whyChooseUs: resolveHomeWhyChooseUsConfig(source.whyChooseUs),
    category: resolveHomeCategoryConfig(source.category),
    featuredParts: resolveHomeFeaturedPartsConfig(source.featuredParts),
    process: resolveHomeProcessConfig(source.process),
    enterpriseSolutions: resolveHomeEnterpriseSolutionsConfig(
      source.enterpriseSolutions,
    ),
    cta: resolveHomeCtaConfig(source.cta),
  }
}

/**
 * Returns a validated for-business config based on persisted DB content.
 */
export function resolveForBusinessPageConfigFromDb(
  storedConfig: unknown,
): ForBusinessPageConfig {
  const source = isObject(storedConfig) ? storedConfig : {}

  return {
    banner: resolveForBusinessBannerConfig(source.banner),
    businessSolutions: resolveForBusinessBusinessSolutions(
      source.businessSolutions,
    ),
    pricing: resolveForBusinessPricing(source.pricing),
    forFleetManagers: resolveForBusinessFleetManagerConfig(
      source.forFleetManagers,
    ),
    cta: resolveForBusinessCta(source.cta),
  }
}
