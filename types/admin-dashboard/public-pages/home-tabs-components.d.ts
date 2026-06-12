import type { ChangeEventHandler } from "react"
import type { HomePageConfig } from "@/types/admin-dashboard/public-pages/home-tabs-data"

export type HeadingPairField = "heading" | "subheading"
export type BannerField = "badgeText" | "heading" | "subheading"
export type SearchField = "heading" | "subheading"
export type CtaField =
  | "heading"
  | "subheading"
  | "primaryButtonText"
  | "primaryButtonLink"
  | "secondaryButtonText"
  | "secondaryButtonLink"
export type EnterpriseCardField =
  | "heading"
  | "subheading"
  | "buttonText"
  | "buttonLink"
export type FeaturedPartsField =
  | "heading"
  | "subheading"
  | "buttonText"
  | "buttonSlug"

export type HomeTabActions = {
  updateBannerField: (field: BannerField, value: string) => void
  updateBannerPoint: (index: number, value: string) => void
  updateBannerImage: ChangeEventHandler<HTMLInputElement>
  updateSearchField: (field: SearchField, value: string) => void
  updateWhyChoosePair: (
    index: number,
    field: HeadingPairField,
    value: string,
  ) => void
  updateCategory: (field: HeadingPairField | "bottomHeading", value: string) => void
  updateFeaturedParts: (
    field: "heading" | "subheading" | "buttonText" | "buttonSlug",
    value: string,
  ) => void
  updateProcessStep: (index: number, field: HeadingPairField, value: string) => void
  addProcessStep: () => void
  removeProcessStep: (index: number) => void
  updateEnterpriseHeading: (value: string) => void
  updateEnterpriseCard: (
    index: number,
    field: EnterpriseCardField,
    value: string,
  ) => void
  updateCtaField: (field: CtaField, value: string) => void
}

export type HomeTabsNavigationButtonProps = {
  isActive: boolean
  children: string
  onClick: () => void
  className?: string
}

export type SaveSectionProps = {
  saveStatus: string
  isSaving?: boolean
  onSave: () => void | Promise<void>
  saveLabel?: string
}

export type TextInputFieldProps = {
  label: string
  value: string
  onChange: (value: string) => void
  id: string
  maxLength: number
  placeholder?: string
}

export type BannerPanelProps = {
  config: HomePageConfig["banner"]
  onFieldChange: (field: BannerField, value: string) => void
  onPointChange: (index: number, value: string) => void
  onImageChange: ChangeEventHandler<HTMLInputElement>
  onSave: () => void | Promise<void>
  isSaving?: boolean
  saveStatus: string
}

export type SearchPanelProps = {
  config: HomePageConfig["search"]
  onChange: (field: SearchField, value: string) => void
  onSave: () => void | Promise<void>
  isSaving?: boolean
  saveStatus: string
}

export type WhyChooseUsPanelProps = {
  config: HomePageConfig["whyChooseUs"]
  onPairChange: (index: number, field: HeadingPairField, value: string) => void
  onSave: () => void | Promise<void>
  isSaving?: boolean
  saveStatus: string
}

export type CategoryPanelProps = {
  config: HomePageConfig["category"]
  onChange: (field: HeadingPairField | "bottomHeading", value: string) => void
  onSave: () => void | Promise<void>
  isSaving?: boolean
  saveStatus: string
}

export type FeaturedPartsPanelProps = {
  config: HomePageConfig["featuredParts"]
  onChange: (
    field: "heading" | "subheading" | "buttonText" | "buttonSlug",
    value: string,
  ) => void
  onSave: () => void | Promise<void>
  isSaving?: boolean
  saveStatus: string
}

export type ProcessPanelProps = {
  config: HomePageConfig["process"]
  onUpdateStep: (index: number, field: HeadingPairField, value: string) => void
  onAddStep: () => void
  onRemoveStep: (index: number) => void
  onSave: () => void | Promise<void>
  isSaving?: boolean
  saveStatus: string
}

export type EnterpriseSolutionsPanelProps = {
  config: HomePageConfig["enterpriseSolutions"]
  onSectionHeadingChange: (value: string) => void
  onCardChange: (
    index: number,
    field: EnterpriseCardField,
    value: string,
  ) => void
  onSave: () => void | Promise<void>
  isSaving?: boolean
  saveStatus: string
}

export type CTAPanelProps = {
  config: HomePageConfig["cta"]
  onChange: (field: CtaField, value: string) => void
  onSave: () => void | Promise<void>
  isSaving?: boolean
  saveStatus: string
}
