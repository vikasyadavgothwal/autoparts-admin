"use client"

import { type ChangeEvent } from "react"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { LimitedInput } from "@/components/ui/limited-input"
import type {
  BannerPanelProps,
  BusinessSolutionsPanelProps,
  CTAPanelProps,
  FleetManagersPanelProps,
  InputFieldProps,
  PricingPanelProps,
  SaveSectionProps,
  TextareaFieldProps,
} from "@/types/admin-dashboard/public-pages/for-business-components"
import {
  FOR_BUSINESS_CARD_COUNT,
  FOR_BUSINESS_INPUT_LIMITS,
} from "@/services/admin-dashboard/public-pages/for-business-tabs-data"

function InputField({
  id,
  label,
  value,
  onChange,
  maxLength,
  placeholder,
}: InputFieldProps) {
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="text-sm font-medium text-[#9CA3AF]">
        {label}
      </label>
      <LimitedInput
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        maxLength={maxLength}
        placeholder={placeholder}
        className="rounded-lg border-[#2A2A2A] bg-[#0A0A0A]"
        counterLabel={label}
      />
    </div>
  )
}

function TextareaField({
  id,
  label,
  value,
  onChange,
  maxLength,
  rows = 4,
  placeholder,
}: TextareaFieldProps) {
  return (
    <div className="space-y-1">
      <label className="text-sm font-medium text-[#9CA3AF]" htmlFor={id}>
        {label}
      </label>
      <textarea
        id={id}
        rows={rows}
        value={value}
        onChange={(event: ChangeEvent<HTMLTextAreaElement>) => {
          onChange(event.target.value.slice(0, maxLength))
        }}
        maxLength={maxLength}
        className="w-full rounded-lg border-[#2A2A2A] bg-[#0A0A0A] px-3 py-2 text-sm text-[#E5E7EB] outline-none placeholder:text-[#9CA3AF]"
        placeholder={placeholder}
      />
      <p className="text-right text-xs text-[#9CA3AF]">
        {value.length}/{maxLength}
      </p>
    </div>
  )
}

function ToggleField({
  id,
  label,
  checked,
  onChange,
}: {
  id: string
  label: string
  checked: boolean
  onChange: (value: boolean) => void
}) {
  return (
    <label
      htmlFor={id}
      className="flex items-center gap-2 rounded-lg border border-[#2A2A2A] bg-[#0A0A0A] px-3 py-2 text-sm"
    >
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="h-4 w-4 rounded border-[#374151] bg-[#111827] text-[#DC2626] focus:ring-[#DC2626] focus:ring-offset-[#0A0A0A]"
      />
      <span className="text-[#9CA3AF]">{label}</span>
    </label>
  )
}

function SectionSaveAction({
  onSave,
  saveStatus,
  isSaving,
  saveLabel = "Save",
}: SaveSectionProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#2A2A2A] pt-4">
      <Button
        type="button"
        onClick={onSave}
        className="h-auto px-4 py-2"
        disabled={isSaving}
      >
        {isSaving ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            {saveLabel}
          </>
        ) : (
          saveLabel
        )}
      </Button>
      <span className="text-xs text-[#9CA3AF]">
        {isSaving ? "Saving..." : saveStatus || "Ready to save"}
      </span>
    </div>
  )
}

export function BannerPanel({
  config,
  onChange,
  onSave,
  isSaving,
  saveStatus,
}: BannerPanelProps) {
  return (
    <Card className="rounded-lg border-[#2A2A2A] bg-[#1A1A1A]">
      <CardHeader>
        <CardTitle className="text-white">Banner</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <InputField
          id="business-banner-badge"
          label="Badge text"
          value={config.badgeText}
          onChange={(value) => onChange("badgeText", value)}
          maxLength={FOR_BUSINESS_INPUT_LIMITS.badgeText}
          placeholder="Top strip text"
        />

        <InputField
          id="business-banner-heading"
          label="Heading"
          value={config.heading}
          onChange={(value) => onChange("heading", value)}
          maxLength={FOR_BUSINESS_INPUT_LIMITS.heading}
          placeholder="Set your main business heading"
        />

        <InputField
          id="business-banner-red-heading"
          label="Red heading"
          value={config.redHeading}
          onChange={(value) => onChange("redHeading", value)}
          maxLength={FOR_BUSINESS_INPUT_LIMITS.redHeading}
          placeholder="Accent heading in red"
        />

        <InputField
          id="business-banner-subheading"
          label="Subheading"
          value={config.subheading}
          onChange={(value) => onChange("subheading", value)}
          maxLength={FOR_BUSINESS_INPUT_LIMITS.subheading}
          placeholder="Describe your business value offer"
        />

        <div className="grid gap-4 md:grid-cols-2">
          <InputField
            id="business-banner-primary-button-text"
            label="Button 1 text"
            value={config.primaryButtonText}
            onChange={(value) => onChange("primaryButtonText", value)}
            maxLength={FOR_BUSINESS_INPUT_LIMITS.buttonText}
            placeholder="Primary button"
          />
          <InputField
            id="business-banner-primary-button-link"
            label="Button 1 link"
            value={config.primaryButtonLink}
            onChange={(value) => onChange("primaryButtonLink", value)}
            maxLength={FOR_BUSINESS_INPUT_LIMITS.buttonLink}
            placeholder="/business"
          />
          <InputField
            id="business-banner-secondary-button-text"
            label="Button 2 text"
            value={config.secondaryButtonText}
            onChange={(value) => onChange("secondaryButtonText", value)}
            maxLength={FOR_BUSINESS_INPUT_LIMITS.buttonText}
            placeholder="Secondary button"
          />
          <InputField
            id="business-banner-secondary-button-link"
            label="Button 2 link"
            value={config.secondaryButtonLink}
            onChange={(value) => onChange("secondaryButtonLink", value)}
            maxLength={FOR_BUSINESS_INPUT_LIMITS.buttonLink}
            placeholder="/services-page"
          />
        </div>

        <SectionSaveAction
          onSave={onSave}
          isSaving={isSaving}
          saveStatus={saveStatus}
        />
      </CardContent>
    </Card>
  )
}

export function BusinessSolutionsPanel({
  config,
  onTextChange,
  onCardChange,
  onSave,
  isSaving,
  saveStatus,
}: BusinessSolutionsPanelProps) {
  return (
    <Card className="rounded-lg border-[#2A2A2A] bg-[#1A1A1A]">
      <CardHeader>
        <CardTitle className="text-white">Business Solutions</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-4 md:grid-cols-2">
          <InputField
            id="business-solutions-heading"
            label="Section heading"
            value={config.heading}
            onChange={(value) => onTextChange("heading", value)}
            maxLength={FOR_BUSINESS_INPUT_LIMITS.heading}
            placeholder="Business Solutions"
          />
          <InputField
            id="business-solutions-subheading"
            label="Section subheading"
            value={config.subheading}
            onChange={(value) => onTextChange("subheading", value)}
            maxLength={FOR_BUSINESS_INPUT_LIMITS.subheading}
            placeholder="Supporting copy for the section"
          />
        </div>

        <div className="space-y-3">
          <p className="text-sm font-medium text-[#9CA3AF]">3 boxes</p>
          {config.cards.slice(0, FOR_BUSINESS_CARD_COUNT).map((card, index) => (
            <Card key={`business-card-${index}`} className="rounded-lg border-[#2A2A2A] bg-[#0A0A0A]">
              <CardContent className="space-y-3 p-4">
                <InputField
                  id={`business-solution-${index}-heading`}
                  label={`Box ${index + 1} heading`}
                  value={card.heading}
                  onChange={(value) => onCardChange(index, "heading", value)}
                  maxLength={FOR_BUSINESS_INPUT_LIMITS.cardHeading}
                  placeholder="Box heading"
                />
                <InputField
                  id={`business-solution-${index}-subheading`}
                  label="Box subheading"
                  value={card.subheading}
                  onChange={(value) => onCardChange(index, "subheading", value)}
                  maxLength={FOR_BUSINESS_INPUT_LIMITS.cardSubheading}
                  placeholder="Box subheading"
                />
              </CardContent>
            </Card>
          ))}
        </div>

        <SectionSaveAction
          onSave={onSave}
          isSaving={isSaving}
          saveStatus={saveStatus}
        />
      </CardContent>
    </Card>
  )
}

export function PricingPanel({
  config,
  onSectionChange,
  onPlanChange,
  onPlanPointChange,
  onAddPoint,
  onRemovePoint,
  onPlanMostPopularChange,
  onSave,
  isSaving,
  saveStatus,
}: PricingPanelProps) {
  const visiblePlans = config.plans.slice(0, 3)

  return (
    <Card className="rounded-lg border-[#2A2A2A] bg-[#1A1A1A]">
      <CardHeader>
        <CardTitle className="text-white">Pricing</CardTitle>
      </CardHeader>

      <CardContent className="space-y-5">
        <div className="grid gap-4 md:grid-cols-2">
          <InputField
            id="pricing-heading"
            label="Section heading"
            value={config.heading}
            onChange={(value) => onSectionChange("heading", value)}
            maxLength={FOR_BUSINESS_INPUT_LIMITS.heading}
            placeholder="Pricing heading"
          />
          <InputField
            id="pricing-subheading"
            label="Section subheading"
            value={config.subheading}
            onChange={(value) => onSectionChange("subheading", value)}
            maxLength={FOR_BUSINESS_INPUT_LIMITS.subheading}
            placeholder="Pricing intro"
          />
        </div>

        <div className="space-y-5">
          <section className="space-y-3">
            <div>
              <h3 className="text-base font-semibold text-white">Pricing plans</h3>
              <p className="text-sm text-[#9CA3AF]">Edit the three public pricing cards shown on the For Business page.</p>
            </div>
            <div className="grid gap-4 xl:grid-cols-3">
                {visiblePlans.map((plan, index) => (
                  <Card
                    key={`pricing-plan-${index}`}
                    className="rounded-lg border-[#2A2A2A] bg-[#0A0A0A]"
                  >
                    <CardContent className="space-y-4 p-4">
                      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-1">
                        <InputField
                          id={`pricing-${index}-heading`}
                          label="Plan heading"
                          value={plan.heading}
                          onChange={(value) => onPlanChange(index, "heading", value)}
                          maxLength={FOR_BUSINESS_INPUT_LIMITS.planHeading}
                          placeholder="Fleet Free"
                        />
                        <InputField
                          id={`pricing-${index}-subheading`}
                          label="Plan subheading"
                          value={plan.subheading}
                          onChange={(value) => onPlanChange(index, "subheading", value)}
                          maxLength={FOR_BUSINESS_INPUT_LIMITS.planSubheading}
                          placeholder="What this plan includes"
                        />
                        <InputField
                          id={`pricing-${index}-price`}
                          label="Price"
                          value={plan.price}
                          onChange={(value) => onPlanChange(index, "price", value)}
                          maxLength={FOR_BUSINESS_INPUT_LIMITS.planPrice}
                          placeholder="AED 299 or Custom"
                        />
                        <InputField
                          id={`pricing-${index}-duration`}
                          label="Duration"
                          value={plan.duration}
                          onChange={(value) => onPlanChange(index, "duration", value)}
                          maxLength={FOR_BUSINESS_INPUT_LIMITS.planDuration}
                          placeholder="per month"
                        />
                        <InputField
                          id={`pricing-${index}-button-text`}
                          label="Button text"
                          value={plan.buttonText}
                          onChange={(value) => onPlanChange(index, "buttonText", value)}
                          maxLength={FOR_BUSINESS_INPUT_LIMITS.planButtonText}
                          placeholder="Choose plan"
                        />
                        <ToggleField
                          id={`pricing-${index}-most-popular`}
                          label="Most popular"
                          checked={plan.mostPopular}
                          onChange={(checked) => onPlanMostPopularChange(index, checked)}
                        />
                      </div>

                      <div>
                        <p className="mb-2 text-sm font-medium text-[#9CA3AF]">Key points</p>
                        <div className="space-y-2">
                          {plan.keyPoints.map((point, pointIndex) => (
                            <div key={`pricing-${index}-point-${pointIndex}`} className="flex items-end gap-2">
                              <div className="flex-1">
                                <InputField
                                  id={`pricing-${index}-point-${pointIndex}`}
                                  label={`Point ${pointIndex + 1}`}
                                  value={point}
                                  onChange={(value) => onPlanPointChange(index, pointIndex, value)}
                                  maxLength={FOR_BUSINESS_INPUT_LIMITS.planKeyPoint}
                                  placeholder="Feature statement"
                                />
                              </div>
                              <Button
                                type="button"
                                className="mb-1 h-auto px-3 py-2 text-xs"
                                variant="outline"
                                onClick={() => onRemovePoint(index, pointIndex)}
                              >
                                Remove
                              </Button>
                            </div>
                          ))}
                        </div>

                        <div className="mt-2">
                          <Button
                            type="button"
                            size="sm"
                            className="h-auto px-3 py-1.5"
                            variant="outline"
                            onClick={() => onAddPoint(index)}
                          >
                            Add point
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
            </div>
          </section>
        </div>

        <SectionSaveAction
          onSave={onSave}
          isSaving={isSaving}
          saveStatus={saveStatus}
        />
      </CardContent>
    </Card>
  )
}

export function FleetManagersPanel({
  config,
  onTextChange,
  onPointChange,
  onPointAdd,
  onPointRemove,
  onCardChange,
  onSave,
  isSaving,
  saveStatus,
}: FleetManagersPanelProps) {
  return (
    <Card className="rounded-lg border-[#2A2A2A] bg-[#1A1A1A]">
      <CardHeader>
        <CardTitle className="text-white">FOR FLEET MANAGERS</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-4 md:grid-cols-2">
          <InputField
            id="fleet-top-heading"
            label="Top heading"
            value={config.topHeading}
            onChange={(value) => onTextChange("topHeading", value)}
            maxLength={FOR_BUSINESS_INPUT_LIMITS.topHeading}
            placeholder="FOR FLEET MANAGERS"
          />
          <InputField
            id="fleet-heading"
            label="Heading"
            value={config.heading}
            onChange={(value) => onTextChange("heading", value)}
            maxLength={FOR_BUSINESS_INPUT_LIMITS.heading}
            placeholder="Section heading"
          />
        </div>

        <TextareaField
          id="fleet-subheading"
          label="Section subheading"
          value={config.subheading}
          onChange={(value) => onTextChange("subheading", value)}
          maxLength={FOR_BUSINESS_INPUT_LIMITS.subheading}
          placeholder="Describe fleet manager support"
        />

        <div>
          <p className="text-sm font-medium text-[#9CA3AF]">Key points</p>
          <div className="mt-2 space-y-2">
            {config.keyPoints.map((point, index) => (
              <div key={`fleet-point-${index}`} className="flex items-end gap-2">
                <div className="flex-1">
                  <InputField
                    id={`fleet-point-${index}`}
                    label={`Point ${index + 1}`}
                    value={point}
                    onChange={(value) => onPointChange(index, value)}
                    maxLength={FOR_BUSINESS_INPUT_LIMITS.point}
                    placeholder="Fleet key point"
                  />
                </div>
                <Button
                  type="button"
                  className="mb-1 h-auto px-3 py-2 text-xs"
                  variant="outline"
                  onClick={() => onPointRemove(index)}
                >
                  Remove
                </Button>
              </div>
            ))}
            <Button
              type="button"
              size="sm"
              className="h-auto px-3 py-1.5"
              variant="outline"
              onClick={onPointAdd}
            >
              Add point
            </Button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <InputField
            id="fleet-button-text"
            label="Button text"
            value={config.buttonText}
            onChange={(value) => onTextChange("buttonText", value)}
            maxLength={FOR_BUSINESS_INPUT_LIMITS.buttonText}
            placeholder="Open Fleet Toolkit"
          />
          <InputField
            id="fleet-button-link"
            label="Button link"
            value={config.buttonLink}
            onChange={(value) => onTextChange("buttonLink", value)}
            maxLength={FOR_BUSINESS_INPUT_LIMITS.buttonLink}
            placeholder="/orders"
          />
        </div>

        <div className="space-y-3">
          <p className="text-sm font-medium text-[#9CA3AF]">3 boxes</p>
          {config.cards.slice(0, FOR_BUSINESS_CARD_COUNT).map((card, index) => (
            <Card
              key={`fleet-card-${index}`}
              className="rounded-lg border-[#2A2A2A] bg-[#0A0A0A]"
            >
              <CardContent className="space-y-3 p-4">
                <InputField
                  id={`fleet-card-${index}-top`}
                  label="Box top heading"
                  value={card.topHeading}
                  onChange={(value) => onCardChange(index, "topHeading", value)}
                  maxLength={FOR_BUSINESS_INPUT_LIMITS.topHeading}
                  placeholder="Operations"
                />
                <InputField
                  id={`fleet-card-${index}-heading`}
                  label="Box heading"
                  value={card.heading}
                  onChange={(value) => onCardChange(index, "heading", value)}
                  maxLength={FOR_BUSINESS_INPUT_LIMITS.topHeading}
                  placeholder="Card heading"
                />
                <InputField
                  id={`fleet-card-${index}-growth`}
                  label="Growth text"
                  value={card.growthText}
                  onChange={(value) => onCardChange(index, "growthText", value)}
                  maxLength={FOR_BUSINESS_INPUT_LIMITS.growthText}
                  placeholder="Growth outcome text"
                />
              </CardContent>
            </Card>
          ))}
        </div>

        <SectionSaveAction
          onSave={onSave}
          isSaving={isSaving}
          saveStatus={saveStatus}
        />
      </CardContent>
    </Card>
  )
}

export function CTAPanel({
  config,
  onChange,
  onSave,
  isSaving,
  saveStatus,
}: CTAPanelProps) {
  return (
    <Card className="rounded-lg border-[#2A2A2A] bg-[#1A1A1A]">
      <CardHeader>
        <CardTitle className="text-white">CTA</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <InputField
          id="business-cta-heading"
          label="Heading"
          value={config.heading}
          onChange={(value) => onChange("heading", value)}
          maxLength={FOR_BUSINESS_INPUT_LIMITS.heading}
          placeholder="Primary CTA heading"
        />
        <InputField
          id="business-cta-subheading"
          label="Subheading"
          value={config.subheading}
          onChange={(value) => onChange("subheading", value)}
          maxLength={FOR_BUSINESS_INPUT_LIMITS.subheading}
          placeholder="Explain CTA purpose"
        />

        <div className="grid gap-4 md:grid-cols-2">
          <InputField
            id="business-cta-btn-1-text"
            label="Button 1 text"
            value={config.primaryButtonText}
            onChange={(value) => onChange("primaryButtonText", value)}
            maxLength={FOR_BUSINESS_INPUT_LIMITS.buttonText}
            placeholder="Book a Call"
          />
          <InputField
            id="business-cta-btn-1-link"
            label="Button 1 link"
            value={config.primaryButtonLink}
            onChange={(value) => onChange("primaryButtonLink", value)}
            maxLength={FOR_BUSINESS_INPUT_LIMITS.buttonLink}
            placeholder="/business"
          />
          <InputField
            id="business-cta-btn-2-text"
            label="Button 2 text"
            value={config.secondaryButtonText}
            onChange={(value) => onChange("secondaryButtonText", value)}
            maxLength={FOR_BUSINESS_INPUT_LIMITS.buttonText}
            placeholder="Talk to Sales"
          />
          <InputField
            id="business-cta-btn-2-link"
            label="Button 2 link"
            value={config.secondaryButtonLink}
            onChange={(value) => onChange("secondaryButtonLink", value)}
            maxLength={FOR_BUSINESS_INPUT_LIMITS.buttonLink}
            placeholder="/services-page"
          />
        </div>

        <SectionSaveAction
          onSave={onSave}
          isSaving={isSaving}
          saveStatus={saveStatus}
        />
      </CardContent>
    </Card>
  )
}
