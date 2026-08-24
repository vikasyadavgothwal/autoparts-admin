"use client"

import { type ChangeEvent, type ReactNode, useEffect, useState } from "react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { optimizePublicImageUpload } from "@/lib/client-image-optimization"
import { uploadHomeBannerImage } from "@/actions/admin-dashboard/public-pages/home-banner-image"
import { saveHomePageContent } from "@/actions/admin-dashboard/public-pages/public-content"
import { SeoPanel } from "@/components/admin-dashboard/public-pages/seo-panel"
import {
  HOME_BANNER_IMAGE_ACCEPTED_TYPES,
  HOME_BANNER_IMAGE_MAX_BYTES,
  HOME_BANNER_IMAGE_MAX_SIZE_LABEL,
  HOME_TABS,
  MAX_PROCESS_STEPS,
} from "@/services/admin-dashboard/public-pages/home-tabs-data"
import type { HomePageConfig } from "@/types/admin-dashboard/public-pages/home-tabs-data"
import {
  BannerPanel,
  CategoryPanel,
  CTAPanel,
  EnterpriseSolutionsPanel,
  FeaturedPartsPanel,
  ProcessPanel,
  SearchPanel,
  WhyChooseUsPanel,
} from "./home-tabs-components"
import type {
  BannerField,
  CtaField,
  EnterpriseCardField,
  HeadingPairField,
  HomeTabKey,
  HomePageContentProps,
  HomePageSectionKey,
  SaveSectionStatus,
  SearchField,
} from "@/types/admin-dashboard/public-pages/home-tabs"
import type { HomeTabActions } from "@/types/admin-dashboard/public-pages/home-tabs-components"

const INITIAL_SAVE_STATUS: SaveSectionStatus = {
  banner: "",
  search: "",
  whyChooseUs: "",
  category: "",
  featuredParts: "",
  process: "",
  enterpriseSolutions: "",
  cta: "",
}

type HomeContentTabKey = Exclude<HomeTabKey, "seo">

const HOME_TAB_SECTION_MAP: Record<HomeContentTabKey, HomePageSectionKey> = {
  banner: "banner",
  search: "search",
  "why-choose-us": "whyChooseUs",
  category: "category",
  "featured-parts": "featuredParts",
  process: "process",
  "enterprise-solutions": "enterpriseSolutions",
  cta: "cta",
}

const isAcceptedBannerImageFile = (file: File): boolean =>
  HOME_BANNER_IMAGE_ACCEPTED_TYPES.includes(
    file.type as (typeof HOME_BANNER_IMAGE_ACCEPTED_TYPES)[number],
  )

const getBannerUploadErrorMessage = (
  error: unknown,
): string => {
  const fallback = "Failed to save section"

  if (error instanceof Error) {
    const message = error.message.toLowerCase()

    if (
      message.includes("body exceeded") ||
      message.includes("body size limit") ||
      message.includes("request entity too large") ||
      message.includes("payload too large") ||
      message.includes("413")
    ) {
      return `Image must be ${HOME_BANNER_IMAGE_MAX_SIZE_LABEL} or smaller.`
    }

    return error.message || fallback
  }

  if (typeof error === "string") {
    const message = error.toLowerCase()

    if (
      message.includes("body exceeded") ||
      message.includes("body size limit") ||
      message.includes("request entity too large") ||
      message.includes("payload too large") ||
      message.includes("413")
    ) {
      return `Image must be ${HOME_BANNER_IMAGE_MAX_SIZE_LABEL} or smaller.`
    }

    return error
  }

  return fallback
}

export function HomeTabs({ initialConfig, initialSeo }: HomePageContentProps) {
  const [activeTab, setActiveTab] = useState<HomeTabKey>(HOME_TABS[0].key)
  const [homeConfig, setHomeConfig] = useState<HomePageConfig>(initialConfig)
  const [pendingBannerImage, setPendingBannerImage] = useState<File | null>(null)
  const [sectionSaveStatus, setSectionSaveStatus] =
    useState<SaveSectionStatus>(INITIAL_SAVE_STATUS)
  const [sectionSaving, setSectionSaving] = useState<
    Record<keyof HomePageConfig, boolean>
  >({
    banner: false,
    search: false,
    whyChooseUs: false,
    category: false,
    featuredParts: false,
    process: false,
    enterpriseSolutions: false,
    cta: false,
  })

  useEffect(() => {
    const currentImage = homeConfig.banner.backgroundImage

    return () => {
      if (currentImage.startsWith("blob:")) {
        URL.revokeObjectURL(currentImage)
      }
    }
  }, [homeConfig.banner.backgroundImage])

  const saveSection = async (
    tabSection: HomeContentTabKey,
  ) => {
    const section = HOME_TAB_SECTION_MAP[tabSection]

    setSectionSaving((previous: Record<HomePageSectionKey, boolean>) => ({
      ...previous,
      [section]: true,
    }))
    setSectionSaveStatus((previous: SaveSectionStatus) => ({
      ...previous,
      [section]: "Publishing...",
    }))

    try {
      if (tabSection === "banner" && pendingBannerImage) {
        setSectionSaveStatus((previous: SaveSectionStatus) => ({
          ...previous,
          [section]: "Uploading image...",
        }))

        const formData = new FormData()
        formData.set("image", pendingBannerImage)
        formData.set("content", JSON.stringify(homeConfig))

        const result = await uploadHomeBannerImage(formData)

        if (result.ok) {
          setHomeConfig(result.data)
          setPendingBannerImage(null)
          setSectionSaveStatus((previous: SaveSectionStatus) => ({
            ...previous,
            [section]: `Saved at ${new Date().toLocaleTimeString()}`,
          }))
          toast.success(`Home page ${tabSection} section updated.`)
          return
        }

        const errorMessage = getBannerUploadErrorMessage(result.error)
        toast.error(errorMessage)
        setSectionSaveStatus((previous: SaveSectionStatus) => ({
          ...previous,
          [section]: errorMessage,
        }))
        return
      }

      const result = await saveHomePageContent({ content: homeConfig })

      if (result.ok) {
        setHomeConfig(result.data)
        setSectionSaveStatus((previous: SaveSectionStatus) => ({
          ...previous,
          [section]: `Saved at ${new Date().toLocaleTimeString()}`,
        }))
        toast.success(`Home page ${tabSection} section updated.`)
        return
      }

      toast.error(result.error)
      setSectionSaveStatus((previous: SaveSectionStatus) => ({
        ...previous,
        [section]: result.error || "Failed to save section",
      }))
    } catch (error) {
      const errorMessage = getBannerUploadErrorMessage(error)
      toast.error(errorMessage)
      setSectionSaveStatus((previous: SaveSectionStatus) => ({
        ...previous,
        [section]: errorMessage,
      }))
    } finally {
      setSectionSaving((previous: Record<HomePageSectionKey, boolean>) => ({
        ...previous,
        [section]: false,
      }))
    }
  }

  const updateBannerField = (field: BannerField, value: string) => {
    setHomeConfig((previous: HomePageConfig) => ({
      ...previous,
      banner: {
        ...previous.banner,
        [field]: value,
      },
    }))
  }

  const updateBannerPoint = (index: number, value: string) => {
    setHomeConfig((previous: HomePageConfig) => {
      const points = [...previous.banner.keyPoints]
      points[index] = value

      return {
        ...previous,
        banner: {
          ...previous.banner,
          keyPoints: points,
        },
      }
    })
  }

  const updateBannerImage: HomeTabActions["updateBannerImage"] = async (
    event: ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0]

    if (!file) {
      return
    }

    if (!isAcceptedBannerImageFile(file)) {
      toast.error("Upload a JPG, PNG, WebP, or GIF image.")
      event.target.value = ""
      return
    }

    if (file.size > HOME_BANNER_IMAGE_MAX_BYTES) {
      toast.error(`Image must be ${HOME_BANNER_IMAGE_MAX_SIZE_LABEL} or smaller.`)
      event.target.value = ""
      return
    }

    let uploadFile: File
    try {
      uploadFile = await optimizePublicImageUpload(file, {
        maxWidth: 1600,
        maxHeight: 1100,
        quality: 0.76,
      })
    } catch {
      uploadFile = file
    }

    if (uploadFile.size > HOME_BANNER_IMAGE_MAX_BYTES) {
      toast.error(`Image must be ${HOME_BANNER_IMAGE_MAX_SIZE_LABEL} or smaller.`)
      event.target.value = ""
      return
    }

    const objectUrl = URL.createObjectURL(uploadFile)

    setHomeConfig((previous: HomePageConfig) => ({
      ...previous,
      banner: {
        ...previous.banner,
        backgroundImage: objectUrl,
      },
    }))
    setSectionSaveStatus((previous: SaveSectionStatus) => ({
      ...previous,
      banner: "Image selected. Click Publish to upload.",
    }))

    setPendingBannerImage(uploadFile)
    event.target.value = ""
  }

  const updateSearchField = (field: SearchField, value: string) => {
    setHomeConfig((previous: HomePageConfig) => ({
      ...previous,
      search: {
        ...previous.search,
        [field]: value,
      },
    }))
  }

  const updateEnterpriseHeading = (value: string) => {
    setHomeConfig((previous: HomePageConfig) => ({
      ...previous,
      enterpriseSolutions: {
        ...previous.enterpriseSolutions,
        heading: value,
      },
    }))
  }

  const updateWhyChoosePair = (
    index: number,
    field: HeadingPairField,
    value: string
  ) => {
    setHomeConfig((previous: HomePageConfig) => {
      const pairs = [...previous.whyChooseUs.pairs]
      pairs[index] = {
        ...pairs[index],
        [field]: value,
      }

      return {
        ...previous,
        whyChooseUs: {
          ...previous.whyChooseUs,
          pairs,
        },
      }
    })
  }

  const updateCategory = (field: HeadingPairField | "bottomHeading", value: string) => {
    setHomeConfig((previous: HomePageConfig) => ({
      ...previous,
      category: {
        ...previous.category,
        [field]: value,
      },
    }))
  }

  const updateFeaturedParts = (
    field: "heading" | "subheading" | "buttonText" | "buttonSlug",
    value: string
  ) => {
    setHomeConfig((previous: HomePageConfig) => ({
      ...previous,
      featuredParts: {
        ...previous.featuredParts,
        [field]: value,
      },
    }))
  }

  const updateProcessStep = (
    index: number,
    field: HeadingPairField,
    value: string
  ) => {
    setHomeConfig((previous: HomePageConfig) => {
      const steps = [...previous.process.steps]
      steps[index] = {
        ...steps[index],
        [field]: value,
      }

      return {
        ...previous,
        process: {
          ...previous.process,
          steps,
        },
      }
    })
  }

  const addProcessStep = () => {
    setHomeConfig((previous: HomePageConfig) => {
      if (previous.process.steps.length >= MAX_PROCESS_STEPS) {
        return previous
      }

      return {
        ...previous,
        process: {
          ...previous.process,
          steps: [
            ...previous.process.steps,
            {
              heading: "",
              subheading: "",
            },
          ],
        },
      }
    })
  }

  const removeProcessStep = (index: number) => {
    setHomeConfig((previous: HomePageConfig) => {
      if (previous.process.steps.length <= 1) {
        return previous
      }

      const steps = [...previous.process.steps]
      steps.splice(index, 1)

      return {
        ...previous,
        process: {
          ...previous.process,
          steps,
        },
      }
    })
  }

  const updateEnterpriseCard = (
    index: number,
    field: EnterpriseCardField,
    value: string
  ) => {
    setHomeConfig((previous: HomePageConfig) => {
      const cards = [...previous.enterpriseSolutions.cards]
      cards[index] = {
        ...cards[index],
        [field]: value,
      }

      return {
        ...previous,
        enterpriseSolutions: {
          ...previous.enterpriseSolutions,
          cards,
        },
      }
    })
  }

  const updateCtaField = (field: CtaField, value: string) => {
    setHomeConfig((previous: HomePageConfig) => ({
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
        <h1 className="text-3xl font-bold text-white">Home Page Builder</h1>
        <p className="mt-2 max-w-2xl text-sm text-[#9CA3AF]">
          Configure each home section and save content changes per-tab.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[240px_1fr]">
        <aside className="space-y-2 rounded-lg border border-[#2A2A2A] bg-[#0A0A0A] p-2">
          {HOME_TABS.map((tab) => (
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
          {renderHomeTabContent(
            activeTab,
            homeConfig,
            sectionSaveStatus,
            sectionSaving,
            {
              updateBannerField,
              updateBannerPoint,
              updateBannerImage,
              updateSearchField,
              updateWhyChoosePair,
              updateCategory,
              updateEnterpriseHeading,
              updateFeaturedParts,
              updateProcessStep,
              addProcessStep,
              removeProcessStep,
              updateEnterpriseCard,
              updateCtaField,
            },
            initialSeo,
            saveSection
          )}
        </section>
      </div>
    </section>
  )
}

function renderHomeTabContent(
  activeTab: HomeTabKey,
  homeConfig: HomePageConfig,
  saveStatus: SaveSectionStatus,
  sectionSaving: Record<keyof HomePageConfig, boolean>,
  actions: HomeTabActions,
  initialSeo: HomePageContentProps["initialSeo"],
  saveSection: (
    section: HomeContentTabKey,
  ) => void | Promise<void>
): ReactNode {
  switch (activeTab) {
    case "banner":
      return (
        <BannerPanel
          config={homeConfig.banner}
          onFieldChange={actions.updateBannerField}
          onPointChange={actions.updateBannerPoint}
          onImageChange={actions.updateBannerImage}
          onSave={() => saveSection("banner")}
          isSaving={sectionSaving.banner}
          saveStatus={saveStatus.banner}
        />
      )
    case "search":
      return (
        <SearchPanel
          config={homeConfig.search}
          onChange={actions.updateSearchField}
          onSave={() => saveSection("search")}
          isSaving={sectionSaving.search}
          saveStatus={saveStatus.search}
        />
      )
    case "why-choose-us":
      return (
        <WhyChooseUsPanel
          config={homeConfig.whyChooseUs}
          onPairChange={actions.updateWhyChoosePair}
          onSave={() => saveSection("why-choose-us")}
          isSaving={sectionSaving.whyChooseUs}
          saveStatus={saveStatus.whyChooseUs}
        />
      )
    case "category":
      return (
        <CategoryPanel
          config={homeConfig.category}
          onChange={actions.updateCategory}
          onSave={() => saveSection("category")}
          isSaving={sectionSaving.category}
          saveStatus={saveStatus.category}
        />
      )
    case "featured-parts":
      return (
        <FeaturedPartsPanel
          config={homeConfig.featuredParts}
          onChange={actions.updateFeaturedParts}
          onSave={() => saveSection("featured-parts")}
          isSaving={sectionSaving.featuredParts}
          saveStatus={saveStatus.featuredParts}
        />
      )
    case "process":
      return (
        <ProcessPanel
          config={homeConfig.process}
          onUpdateStep={actions.updateProcessStep}
          onAddStep={actions.addProcessStep}
          onRemoveStep={actions.removeProcessStep}
          onSave={() => saveSection("process")}
          isSaving={sectionSaving.process}
          saveStatus={saveStatus.process}
        />
      )
    case "enterprise-solutions":
      return (
        <EnterpriseSolutionsPanel
          config={homeConfig.enterpriseSolutions}
          onSectionHeadingChange={actions.updateEnterpriseHeading}
          onCardChange={actions.updateEnterpriseCard}
          onSave={() =>
            saveSection("enterprise-solutions")
          }
          isSaving={sectionSaving.enterpriseSolutions}
          saveStatus={saveStatus.enterpriseSolutions}
        />
      )
    case "cta":
      return (
        <CTAPanel
          config={homeConfig.cta}
          onChange={actions.updateCtaField}
          onSave={() => saveSection("cta")}
          isSaving={sectionSaving.cta}
          saveStatus={saveStatus.cta}
        />
      )
    case "seo":
      return <SeoPanel slug="home" initialSeo={initialSeo} />
    default:
      return (
        <BannerPanel
          config={homeConfig.banner}
          onFieldChange={actions.updateBannerField}
          onPointChange={actions.updateBannerPoint}
          onImageChange={actions.updateBannerImage}
          onSave={() => saveSection("banner")}
          isSaving={sectionSaving.banner}
          saveStatus={saveStatus.banner}
        />
      )
  }
}
