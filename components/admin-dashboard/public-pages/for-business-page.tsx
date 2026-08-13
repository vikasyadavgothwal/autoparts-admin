"use client"

import { useState, type ReactNode } from "react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { saveForBusinessPageContent } from "@/actions/admin-dashboard/public-pages/public-content"
import { SeoPanel } from "@/components/admin-dashboard/public-pages/seo-panel"
import type { ForBusinessFleetManagerConfig, ForBusinessPageConfig } from "@/types/admin-dashboard/public-pages/for-business-tabs-data"
import {
  FOR_BUSINESS_TABS,
} from "@/services/admin-dashboard/public-pages/for-business-tabs-data"
import {
  BannerPanel,
  BusinessSolutionsPanel,
  CTAPanel,
  FleetManagersPanel,
  PricingPanel,
} from "./for-business-components"
import type {
  BannerField,
  BusinessSolutionsSectionField,
  CardField,
  CtaField,
  FleetField,
  ForBusinessPageProps,
  ForBusinessActions,
  PricingPlanField,
  PricingSectionField,
  SaveSectionStatus,
  ForBusinessTabKey,
} from "@/types/admin-dashboard/public-pages/for-business-page"

const INITIAL_SAVE_STATUS: SaveSectionStatus = {
  banner: "",
  businessSolutions: "",
  pricing: "",
  forFleetManagers: "",
  cta: "",
}

const validatePricing = (config: ForBusinessPageConfig): string | null => {
  if (!config.pricing.heading.trim()) return "Pricing heading is required."
  if (!config.pricing.subheading.trim()) return "Pricing subheading is required."
  if (config.pricing.plans.length < 3) {
    return "Pricing must include three plans."
  }

  for (const plan of config.pricing.plans.slice(0, 3)) {
    if (!plan.heading.trim()) return "Every plan needs a heading."
    if (!plan.subheading.trim()) return `${plan.heading} needs a subheading.`
    if (!plan.price.trim()) return `${plan.heading} needs a price.`
    if (
      !/^custom$/i.test(plan.price.trim()) &&
      !/^[A-Z]{2,4}\s?\d+(\.\d{1,2})?$/i.test(plan.price.trim())
    ) {
      return `${plan.heading} price must look like AED 299 or Custom.`
    }
    if (!plan.duration.trim()) return `${plan.heading} needs a duration.`
    if (!plan.buttonText.trim()) return `${plan.heading} needs button text.`
    if (plan.keyPoints.some((point) => !point.trim())) {
      return `${plan.heading} has an empty key point.`
    }
  }

  return null
}

export function ForBusinessPage({
  initialConfig,
  initialSeo,
}: ForBusinessPageProps) {
  const [activeTab, setActiveTab] = useState<ForBusinessTabKey>(
    FOR_BUSINESS_TABS[0].key,
  )
  const [config, setConfig] = useState<ForBusinessPageConfig>(initialConfig)
  const [sectionSaveStatus, setSectionSaveStatus] =
    useState<SaveSectionStatus>(INITIAL_SAVE_STATUS)
  const [sectionSaving, setSectionSaving] = useState<
    Record<keyof ForBusinessPageConfig, boolean>
  >({
    banner: false,
    businessSolutions: false,
    pricing: false,
    forFleetManagers: false,
    cta: false,
  })

  const saveSection = async (section: keyof ForBusinessPageConfig) => {
    if (section === "pricing") {
      const validationError = validatePricing(config)
      if (validationError) {
        toast.error(validationError)
        setSectionSaveStatus((previous: SaveSectionStatus) => ({
          ...previous,
          pricing: validationError,
        }))
        return
      }
    }

    setSectionSaving((previous: Record<keyof ForBusinessPageConfig, boolean>) => ({
      ...previous,
      [section]: true,
    }))
    setSectionSaveStatus((previous: SaveSectionStatus) => ({
      ...previous,
      [section]: "Publishing...",
    }))

    try {
      const result = await saveForBusinessPageContent({ content: config })

      if (result.ok) {
        setConfig(result.data)
        setSectionSaveStatus((previous: SaveSectionStatus) => ({
          ...previous,
          [section]: `Saved at ${new Date().toLocaleTimeString()}`,
        }))
        toast.success(`For Business ${section} section updated.`)
        return
      }

      toast.error(result.error)
      setSectionSaveStatus((previous: SaveSectionStatus) => ({
        ...previous,
        [section]: result.error || "Failed to save section",
      }))
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to save section"
      toast.error(errorMessage)
      setSectionSaveStatus((previous: SaveSectionStatus) => ({
        ...previous,
        [section]: errorMessage,
      }))
    } finally {
      setSectionSaving((previous: Record<keyof ForBusinessPageConfig, boolean>) => ({
        ...previous,
        [section]: false,
      }))
    }
  }

  const updateBanner = (field: BannerField, value: string) => {
    setConfig((previous: ForBusinessPageConfig) => ({
      ...previous,
      banner: {
        ...previous.banner,
        [field]: value,
      },
    }))
  }

  const updateBusinessSolutionCard = (
    index: number,
    field: CardField,
    value: string
  ) => {
    setConfig((previous: ForBusinessPageConfig) => {
      const cards = [...previous.businessSolutions.cards]
      cards[index] = {
        ...cards[index],
        [field]: value,
      }

      return {
        ...previous,
        businessSolutions: {
          ...previous.businessSolutions,
          cards,
        },
      }
    })
  }

  const updateBusinessSolutionsText = (
    field: BusinessSolutionsSectionField,
    value: string
  ) => {
    setConfig((previous: ForBusinessPageConfig) => ({
      ...previous,
      businessSolutions: {
        ...previous.businessSolutions,
        [field]: value,
      },
    }))
  }

  const updatePricingSectionText = (
    field: PricingSectionField,
    value: string
  ) => {
    setConfig((previous: ForBusinessPageConfig) => ({
      ...previous,
      pricing: {
        ...previous.pricing,
        [field]: value,
      },
    }))
  }

  const updatePricingPlanField = (
    index: number,
    field: PricingPlanField,
    value: string
  ) => {
    setConfig((previous: ForBusinessPageConfig) => {
      const plans = [...previous.pricing.plans]
      plans[index] = {
        ...plans[index],
        [field]: value,
      }

      return {
        ...previous,
        pricing: {
          ...previous.pricing,
          plans,
        },
      }
    })
  }

  const updatePricingPlanPoint = (
    planIndex: number,
    pointIndex: number,
    value: string
  ) => {
    setConfig((previous: ForBusinessPageConfig) => {
      const plans = [...previous.pricing.plans]
      const points = [...plans[planIndex].keyPoints]
      points[pointIndex] = value
      plans[planIndex] = {
        ...plans[planIndex],
        keyPoints: points,
      }

      return {
        ...previous,
        pricing: {
          ...previous.pricing,
          plans,
        },
      }
    })
  }

  const addPricingPlanPoint = (planIndex: number) => {
    setConfig((previous: ForBusinessPageConfig) => {
      const plans = [...previous.pricing.plans]
      plans[planIndex] = {
        ...plans[planIndex],
        keyPoints: [...plans[planIndex].keyPoints, ""],
      }

      return {
        ...previous,
        pricing: {
          ...previous.pricing,
          plans,
        },
      }
    })
  }

  const removePricingPlanPoint = (planIndex: number, pointIndex: number) => {
    setConfig((previous: ForBusinessPageConfig) => {
      const plans = [...previous.pricing.plans]
      if (plans[planIndex].keyPoints.length <= 1) {
        return previous
      }

      const points = [...plans[planIndex].keyPoints]
      points.splice(pointIndex, 1)
      plans[planIndex] = {
        ...plans[planIndex],
        keyPoints: points,
      }

      return {
        ...previous,
        pricing: {
          ...previous.pricing,
          plans,
        },
      }
    })
  }

  const updatePricingPlanMostPopular = (
    planIndex: number,
    isMostPopular: boolean,
  ) => {
    setConfig((previous: ForBusinessPageConfig) => {
      const plans = [...previous.pricing.plans]
      plans[planIndex] = {
        ...plans[planIndex],
        mostPopular: isMostPopular,
      }

      return {
        ...previous,
        pricing: {
          ...previous.pricing,
          plans,
        },
      }
    })
  }

  const updateFleet = (field: FleetField, value: string) => {
    setConfig((previous: ForBusinessPageConfig) => ({
      ...previous,
      forFleetManagers: {
        ...previous.forFleetManagers,
        [field]: value,
      },
    }))
  }

  const updateFleetPoint = (index: number, value: string) => {
    setConfig((previous: ForBusinessPageConfig) => {
      const points = [...previous.forFleetManagers.keyPoints]
      points[index] = value

      return {
        ...previous,
        forFleetManagers: {
          ...previous.forFleetManagers,
          keyPoints: points,
        },
      }
    })
  }

  const addFleetPoint = () => {
    setConfig((previous: ForBusinessPageConfig) => ({
      ...previous,
      forFleetManagers: {
        ...previous.forFleetManagers,
        keyPoints: [...previous.forFleetManagers.keyPoints, ""],
      },
    }))
  }

  const removeFleetPoint = (index: number) => {
    setConfig((previous: ForBusinessPageConfig) => {
      if (previous.forFleetManagers.keyPoints.length <= 1) {
        return previous
      }

      const points = [...previous.forFleetManagers.keyPoints]
      points.splice(index, 1)

      return {
        ...previous,
        forFleetManagers: {
          ...previous.forFleetManagers,
          keyPoints: points,
        },
      }
    })
  }

  const updateFleetCard = (
    index: number,
    field: keyof ForBusinessFleetManagerConfig["cards"][number],
    value: string
  ) => {
    setConfig((previous: ForBusinessPageConfig) => {
      const cards = [...previous.forFleetManagers.cards]
      cards[index] = {
        ...cards[index],
        [field]: value,
      }

      return {
        ...previous,
        forFleetManagers: {
          ...previous.forFleetManagers,
          cards,
        },
      }
    })
  }

  const updateCta = (field: CtaField, value: string) => {
    setConfig((previous: ForBusinessPageConfig) => ({
      ...previous,
      cta: {
        ...previous.cta,
        [field]: value,
      },
    }))
  }

  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white">For Business</h1>
        <p className="mt-2 max-w-2xl text-sm text-[#9CA3AF]">
          Configure each For Business section and save content updates.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[250px_1fr]">
        <aside className="space-y-2 rounded-lg border border-[#2A2A2A] bg-[#0A0A0A] p-2">
          {FOR_BUSINESS_TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                "w-full rounded-md px-4 py-3 text-left font-medium transition",
                activeTab === tab.key
                  ? "bg-[#DC2626] text-white"
                  : "bg-transparent text-[#9CA3AF] hover:bg-[#1A1A1A] hover:text-white"
              )}
            >
              {tab.label}
            </button>
          ))}
        </aside>

        <section>
          {renderForBusinessContent(
            activeTab,
            config,
            sectionSaveStatus,
            sectionSaving,
            {
              onBannerChange: updateBanner,
              onBusinessSolutionCardChange: updateBusinessSolutionCard,
              onBusinessSolutionsTextChange: updateBusinessSolutionsText,
              onPricingSectionChange: updatePricingSectionText,
              onPricingPlanChange: updatePricingPlanField,
              onPricingPlanPointChange: updatePricingPlanPoint,
              onPricingPlanPointAdd: addPricingPlanPoint,
              onPricingPlanPointRemove: removePricingPlanPoint,
              onPricingPlanMostPopularChange: updatePricingPlanMostPopular,
              onFleetChange: updateFleet,
              onFleetPointChange: updateFleetPoint,
              onFleetPointAdd: addFleetPoint,
              onFleetPointRemove: removeFleetPoint,
              onFleetCardChange: updateFleetCard,
              onCtaChange: updateCta,
            },
            initialSeo,
            saveSection
          )}
        </section>
      </div>
    </section>
  )
}

function renderForBusinessContent(
  activeTab: ForBusinessTabKey,
  config: ForBusinessPageConfig,
  saveStatus: SaveSectionStatus,
  sectionSaving: Record<keyof ForBusinessPageConfig, boolean>,
  actions: ForBusinessActions,
  initialSeo: ForBusinessPageProps["initialSeo"],
  saveSection: (
    section: keyof ForBusinessPageConfig,
  ) => void | Promise<void>
): ReactNode {
  switch (activeTab) {
    case "banner":
          return (
        <BannerPanel
          config={config.banner}
          onChange={actions.onBannerChange}
          onSave={() => saveSection("banner")}
          isSaving={sectionSaving.banner}
          saveStatus={saveStatus.banner}
        />
      )
    case "business-solutions":
      return (
        <BusinessSolutionsPanel
          config={config.businessSolutions}
          onTextChange={actions.onBusinessSolutionsTextChange}
          onCardChange={actions.onBusinessSolutionCardChange}
          onSave={() => saveSection("businessSolutions")}
          isSaving={sectionSaving.businessSolutions}
          saveStatus={saveStatus.businessSolutions}
        />
      )
    case "pricing":
      return (
        <PricingPanel
          config={config.pricing}
          onSectionChange={actions.onPricingSectionChange}
          onPlanChange={actions.onPricingPlanChange}
          onPlanMostPopularChange={actions.onPricingPlanMostPopularChange}
          onPlanPointChange={actions.onPricingPlanPointChange}
          onAddPoint={actions.onPricingPlanPointAdd}
          onRemovePoint={actions.onPricingPlanPointRemove}
          onSave={() => saveSection("pricing")}
          isSaving={sectionSaving.pricing}
          saveStatus={saveStatus.pricing}
        />
      )
    case "for-fleet-managers":
      return (
        <FleetManagersPanel
          config={config.forFleetManagers}
          onTextChange={actions.onFleetChange}
          onPointChange={actions.onFleetPointChange}
          onPointAdd={actions.onFleetPointAdd}
          onPointRemove={actions.onFleetPointRemove}
          onCardChange={actions.onFleetCardChange}
          onSave={() => saveSection("forFleetManagers")}
          isSaving={sectionSaving.forFleetManagers}
          saveStatus={saveStatus.forFleetManagers}
        />
      )
    case "cta":
          return (
        <CTAPanel
          config={config.cta}
          onChange={actions.onCtaChange}
          onSave={() => saveSection("cta")}
          isSaving={sectionSaving.cta}
          saveStatus={saveStatus.cta}
        />
      )
    case "seo":
      return <SeoPanel slug="for-business" initialSeo={initialSeo} />
    default:
      return (
        <BannerPanel
          config={config.banner}
          onChange={actions.onBannerChange}
          onSave={() => saveSection("banner")}
          isSaving={sectionSaving.banner}
          saveStatus={saveStatus.banner}
        />
      )
  }
}

export { ForBusinessPage as default }
