import type {
  ForBusinessBannerConfig,
  ForBusinessBusinessSolutionsConfig,
  ForBusinessCtaConfig,
  ForBusinessFleetCard,
  ForBusinessFleetManagerConfig,
  ForBusinessPlan,
  ForBusinessPricingConfig,
} from "@/types/admin-dashboard/public-pages/for-business-tabs-data"

export type InputFieldProps = {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  maxLength: number
  placeholder?: string
}

export type TextareaFieldProps = InputFieldProps & {
  rows?: number
}

export type SaveSectionProps = {
  saveStatus: string
  isSaving?: boolean
  onSave: () => void | Promise<void>
  saveLabel?: string
}

export type BannerChangeHandler = (
  field: keyof ForBusinessBannerConfig,
  value: string,
) => void

export type BusinessSolutionTextField = keyof Omit<ForBusinessBusinessSolutionsConfig, "cards">
export type BusinessSolutionCardField = keyof ForBusinessBusinessSolutionsConfig["cards"][number]
export type BusinessSolutionCardChangeHandler = (
  index: number,
  field: BusinessSolutionCardField,
  value: string,
) => void

export type PricingTextField = keyof Omit<ForBusinessPricingConfig, "plans">
export type PricingPlanField = keyof Omit<ForBusinessPlan, "keyPoints" | "mostPopular">
export type PricingPlanChangeHandler = (
  index: number,
  field: PricingPlanField,
  value: string,
) => void
export type PricingPlanMostPopularChangeHandler = (
  index: number,
  isMostPopular: boolean,
) => void

export type FleetTextField = keyof Omit<ForBusinessFleetManagerConfig, "keyPoints" | "cards">
export type FleetPointChangeHandler = (index: number, value: string) => void
export type FleetCardField = keyof ForBusinessFleetCard
export type FleetCardChangeHandler = (
  index: number,
  field: FleetCardField,
  value: string,
) => void

export type CtaChangeHandler = (
  field: keyof ForBusinessCtaConfig,
  value: string,
) => void

export type BannerPanelProps = {
  config: ForBusinessBannerConfig
  onChange: BannerChangeHandler
  onSave: () => void | Promise<void>
  isSaving?: boolean
  saveStatus: string
}

export type BusinessSolutionsPanelProps = {
  config: ForBusinessBusinessSolutionsConfig
  onTextChange: (field: BusinessSolutionTextField, value: string) => void
  onCardChange: BusinessSolutionCardChangeHandler
  onSave: () => void | Promise<void>
  isSaving?: boolean
  saveStatus: string
}

export type PricingPanelProps = {
  config: ForBusinessPricingConfig
  onSectionChange: (field: PricingTextField, value: string) => void
  onPlanChange: PricingPlanChangeHandler
  onPlanPointChange: (planIndex: number, pointIndex: number, value: string) => void
  onAddPoint: (planIndex: number) => void
  onRemovePoint: (planIndex: number, pointIndex: number) => void
  onPlanMostPopularChange: PricingPlanMostPopularChangeHandler
  onSave: () => void | Promise<void>
  isSaving?: boolean
  saveStatus: string
}

export type FleetManagersPanelProps = {
  config: ForBusinessFleetManagerConfig
  onTextChange: (field: FleetTextField, value: string) => void
  onPointChange: FleetPointChangeHandler
  onPointAdd: () => void
  onPointRemove: (index: number) => void
  onCardChange: FleetCardChangeHandler
  onSave: () => void | Promise<void>
  isSaving?: boolean
  saveStatus: string
}

export type CTAPanelProps = {
  config: ForBusinessCtaConfig
  onChange: CtaChangeHandler
  onSave: () => void | Promise<void>
  isSaving?: boolean
  saveStatus: string
}
