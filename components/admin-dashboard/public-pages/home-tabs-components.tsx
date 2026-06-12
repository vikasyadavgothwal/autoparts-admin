"use client";

import Image from "next/image";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LimitedInput } from "@/components/ui/limited-input";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import {
  ENTERPRISE_CARD_COUNT,
  HOME_BANNER_IMAGE_MAX_SIZE_LABEL,
  HOME_INPUT_LIMITS,
  MAX_PROCESS_STEPS,
  MIN_PROCESS_STEPS,
} from "@/services/admin-dashboard/public-pages/home-tabs-data";
import type {
  BannerPanelProps,
  CategoryPanelProps,
  CTAPanelProps,
  EnterpriseSolutionsPanelProps,
  FeaturedPartsPanelProps,
  HomeTabsNavigationButtonProps,
  ProcessPanelProps,
  SearchPanelProps,
  SaveSectionProps,
  TextInputFieldProps,
  WhyChooseUsPanelProps,
} from "@/types/admin-dashboard/public-pages/home-tabs-components";

export function HomeTabsNavigationButton({
  children,
  onClick,
  className,
}: HomeTabsNavigationButtonProps) {
  return (
    <button type="button" onClick={onClick} className={className}>
      {children}
    </button>
  );
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
  );
}

function InputField({
  label,
  value,
  onChange,
  id,
  maxLength,
  placeholder,
}: TextInputFieldProps) {
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
  );
}

export function BannerPanel({
  config,
  onFieldChange,
  onPointChange,
  onImageChange,
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
        <div>
          <label className="text-sm font-medium text-[#9CA3AF]">
            Background image
          </label>
          <input
            type="file"
            accept="image/*"
            onChange={onImageChange}
            disabled={isSaving}
            className="mt-2 block w-full rounded-md border border-[#2A2A2A] bg-[#0A0A0A] px-3 py-2 text-sm text-[#9CA3AF]"
          />
          <p className="mt-1 text-xs text-[#6B7280]">
            JPG, PNG, WebP, or GIF up to {HOME_BANNER_IMAGE_MAX_SIZE_LABEL}.
          </p>
          {config.backgroundImage ? (
            <div className="mt-3 overflow-hidden rounded-md border border-[#2A2A2A]">
              <Image
                src={config.backgroundImage}
                alt="Banner preview"
                width={1200}
                height={256}
                unoptimized
                className="h-44 w-full object-cover"
              />
            </div>
          ) : (
            <div className="mt-3 flex h-32 items-center justify-center rounded-md border border-dashed border-[#2A2A2A] bg-[#0A0A0A] text-sm text-[#6B7280]">
              No banner image selected.
            </div>
          )}
        </div>

        <InputField
          label="Badge text"
          id="banner-badge"
          value={config.badgeText}
          onChange={(value) => onFieldChange("badgeText", value)}
          maxLength={HOME_INPUT_LIMITS.bannerBadgeText}
          placeholder="Featured badge label"
        />

        <InputField
          label="Heading"
          id="banner-heading"
          value={config.heading}
          onChange={(value) => onFieldChange("heading", value)}
          maxLength={HOME_INPUT_LIMITS.bannerHeading}
          placeholder="Build your banner heading"
        />

        <InputField
          label="Subheading"
          id="banner-subheading"
          value={config.subheading}
          onChange={(value) => onFieldChange("subheading", value)}
          maxLength={HOME_INPUT_LIMITS.bannerSubheading}
          placeholder="Build your banner subheading"
        />

        <div className="space-y-3">
          <p className="text-sm font-medium text-[#9CA3AF]">3 key points</p>
          {config.keyPoints.map((point, index) => (
            <InputField
              key={point + index}
              label={`Key point ${index + 1}`}
              id={`banner-point-${index}`}
              value={point}
              onChange={(value) => onPointChange(index, value)}
              maxLength={HOME_INPUT_LIMITS.bannerKeyPoint}
              placeholder={`Point ${index + 1}`}
            />
          ))}
        </div>

        <SectionSaveAction
          onSave={onSave}
          isSaving={isSaving}
          saveStatus={saveStatus}
        />
      </CardContent>
    </Card>
  );
}

export function SearchPanel({
  config,
  onChange,
  onSave,
  isSaving,
  saveStatus,
}: SearchPanelProps) {
  return (
    <Card className="rounded-lg border-[#2A2A2A] bg-[#1A1A1A]">
      <CardHeader>
        <CardTitle className="text-white">Search</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <InputField
          label="Heading 1"
          id="search-heading"
          value={config.heading}
          onChange={(value) => onChange("heading", value)}
          maxLength={HOME_INPUT_LIMITS.sectionHeading}
          placeholder="Search section heading"
        />

        <InputField
          label="Heading 2"
          id="search-subheading"
          value={config.subheading}
          onChange={(value) => onChange("subheading", value)}
          maxLength={HOME_INPUT_LIMITS.sectionSubheading}
          placeholder="Search section subheading"
        />

        <SectionSaveAction
          onSave={onSave}
          isSaving={isSaving}
          saveStatus={saveStatus}
        />
      </CardContent>
    </Card>
  );
}

export function WhyChooseUsPanel({
  config,
  onPairChange,
  onSave,
  isSaving,
  saveStatus,
}: WhyChooseUsPanelProps) {
  return (
    <Card className="rounded-lg border-[#2A2A2A] bg-[#1A1A1A]">
      <CardHeader>
        <CardTitle className="text-white">Why Choose Us</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {config.pairs.map((point, index) => (
          <div
            key={`why-pair-${index}`}
            className="space-y-3 rounded-lg border border-[#2A2A2A] bg-[#0A0A0A] p-3"
          >
            <p className="text-sm font-medium text-[#9CA3AF]">
              Pair {index + 1}
            </p>
            <InputField
              label="Pair heading"
              id={`why-heading-${index}`}
              value={point.heading}
              onChange={(value) => onPairChange(index, "heading", value)}
              maxLength={HOME_INPUT_LIMITS.whyChoosePairHeading}
              placeholder="Heading"
            />
            <InputField
              label="Pair subheading"
              id={`why-subheading-${index}`}
              value={point.subheading}
              onChange={(value) => onPairChange(index, "subheading", value)}
              maxLength={HOME_INPUT_LIMITS.whyChoosePairSubheading}
              placeholder="Subheading"
            />
          </div>
        ))}

        <SectionSaveAction
          onSave={onSave}
          isSaving={isSaving}
          saveStatus={saveStatus}
        />
      </CardContent>
    </Card>
  );
}

export function CategoryPanel({
  config,
  onChange,
  onSave,
  isSaving,
  saveStatus,
}: CategoryPanelProps) {
  return (
    <Card className="rounded-lg border-[#2A2A2A] bg-[#1A1A1A]">
      <CardHeader>
        <CardTitle className="text-white">Category</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-2">
          <InputField
            label="Section heading"
            id="category-heading"
            value={config.heading}
            onChange={(value) => onChange("heading", value)}
            maxLength={HOME_INPUT_LIMITS.sectionHeading}
            placeholder="Category heading"
          />
          <InputField
            label="Section subheading"
            id="category-subheading"
            value={config.subheading}
            onChange={(value) => onChange("subheading", value)}
            maxLength={HOME_INPUT_LIMITS.sectionSubheading}
            placeholder="Category subheading"
          />
          <InputField
            label="Bottom heading"
            id="category-bottom-heading"
            value={config.bottomHeading}
            onChange={(value) => onChange("bottomHeading", value)}
            maxLength={HOME_INPUT_LIMITS.sectionSubheading}
            placeholder="Bottom heading"
          />
        </div>

        <SectionSaveAction
          onSave={onSave}
          isSaving={isSaving}
          saveStatus={saveStatus}
        />
      </CardContent>
    </Card>
  );
}

export function FeaturedPartsPanel({
  config,
  onChange,
  onSave,
  isSaving,
  saveStatus,
}: FeaturedPartsPanelProps) {
  return (
    <Card className="rounded-lg border-[#2A2A2A] bg-[#1A1A1A]">
      <CardHeader>
        <CardTitle className="text-white">Featured Parts</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-2">
          <InputField
            label="Heading"
            id="featured-heading"
            value={config.heading}
            onChange={(value) => onChange("heading", value)}
            maxLength={HOME_INPUT_LIMITS.sectionHeading}
            placeholder="Featured section heading"
          />
          <InputField
            label="Subheading"
            id="featured-subheading"
            value={config.subheading}
            onChange={(value) => onChange("subheading", value)}
            maxLength={HOME_INPUT_LIMITS.sectionSubheading}
            placeholder="Featured section subheading"
          />
          <InputField
            label="Button text"
            id="featured-button-text"
            value={config.buttonText}
            onChange={(value) => onChange("buttonText", value)}
            maxLength={HOME_INPUT_LIMITS.buttonText}
            placeholder="Featured button text"
          />
          <InputField
            label="Button slug"
            id="featured-button-slug"
            value={config.buttonSlug}
            onChange={(value) => onChange("buttonSlug", value)}
            maxLength={HOME_INPUT_LIMITS.slug}
            placeholder="/featured"
          />
        </div>

        <SectionSaveAction
          onSave={onSave}
          isSaving={isSaving}
          saveStatus={saveStatus}
        />
      </CardContent>
    </Card>
  );
}

export function ProcessPanel({
  config,
  onUpdateStep,
  onAddStep,
  onRemoveStep,
  onSave,
  isSaving,
  saveStatus,
}: ProcessPanelProps) {
  return (
    <Card className="rounded-lg border-[#2A2A2A] bg-[#1A1A1A]">
      <CardHeader className="flex flex-wrap items-center justify-between gap-3">
        <CardTitle className="text-white">Process</CardTitle>
        <Button
          type="button"
          onClick={onAddStep}
          disabled={config.steps.length >= MAX_PROCESS_STEPS}
          className="h-auto px-3 py-1.5"
        >
          Add step
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {config.steps.map((step, index) => (
          <div
            key={`process-step-${index}`}
            className="space-y-3 rounded-lg border border-[#2A2A2A] bg-[#0A0A0A] p-3"
          >
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium text-[#9CA3AF]">
                Step {index + 1}
              </h4>
              <Button
                type="button"
                variant="outline"
                className="h-auto px-2 py-1 text-xs"
                onClick={() => onRemoveStep(index)}
                disabled={config.steps.length <= MIN_PROCESS_STEPS}
              >
                Remove
              </Button>
            </div>
            <InputField
              label="Step heading"
              id={`step-heading-${index}`}
              value={step.heading}
              onChange={(value) => onUpdateStep(index, "heading", value)}
              maxLength={HOME_INPUT_LIMITS.stepHeading}
              placeholder="Step heading"
            />
            <InputField
              label="Step subheading"
              id={`step-subheading-${index}`}
              value={step.subheading}
              onChange={(value) => onUpdateStep(index, "subheading", value)}
              maxLength={HOME_INPUT_LIMITS.stepSubheading}
              placeholder="Step subheading"
            />
          </div>
        ))}

        <SectionSaveAction
          onSave={onSave}
          isSaving={isSaving}
          saveStatus={saveStatus}
        />
      </CardContent>
    </Card>
  );
}

export function EnterpriseSolutionsPanel({
  config,
  onSectionHeadingChange,
  onCardChange,
  onSave,
  isSaving,
  saveStatus,
}: EnterpriseSolutionsPanelProps) {
  return (
    <Card className="rounded-lg border-[#2A2A2A] bg-[#1A1A1A]">
      <CardHeader>
        <CardTitle className="text-white">Enterprise Solutions</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <InputField
          label="Section heading"
          id="enterprise-heading"
          value={config.heading}
          onChange={onSectionHeadingChange}
          maxLength={HOME_INPUT_LIMITS.sectionHeading}
          placeholder="Enterprise solutions heading"
        />

        {config.cards.slice(0, ENTERPRISE_CARD_COUNT).map((card, index) => (
          <div
            key={`enterprise-card-${index}`}
            className="space-y-3 rounded-lg border border-[#2A2A2A] bg-[#0A0A0A] p-4"
          >
            <p className="text-sm font-medium text-[#9CA3AF]">
              Card {index + 1}
            </p>
            <div className="grid gap-3 md:grid-cols-2">
              <InputField
                label="Card heading"
                id={`enterprise-heading-${index}`}
                value={card.heading}
                onChange={(value) => onCardChange(index, "heading", value)}
                maxLength={HOME_INPUT_LIMITS.cardHeading}
                placeholder="Card heading"
              />
              <InputField
                label="Card subheading"
                id={`enterprise-subheading-${index}`}
                value={card.subheading}
                onChange={(value) => onCardChange(index, "subheading", value)}
                maxLength={HOME_INPUT_LIMITS.cardSubheading}
                placeholder="Card subheading"
              />
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <InputField
                label="Button text"
                id={`enterprise-button-text-${index}`}
                value={card.buttonText}
                onChange={(value) => onCardChange(index, "buttonText", value)}
                maxLength={HOME_INPUT_LIMITS.buttonText}
                placeholder="Button text"
              />
              <InputField
                label="Button link"
                id={`enterprise-button-link-${index}`}
                value={card.buttonLink}
                onChange={(value) => onCardChange(index, "buttonLink", value)}
                maxLength={HOME_INPUT_LIMITS.linkText}
                placeholder="/enterprise/solution"
              />
            </div>
          </div>
        ))}
        <SectionSaveAction
          onSave={onSave}
          isSaving={isSaving}
          saveStatus={saveStatus}
        />
      </CardContent>
    </Card>
  );
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
          label="Section heading"
          id="cta-heading"
          value={config.heading}
          onChange={(value) => onChange("heading", value)}
          maxLength={HOME_INPUT_LIMITS.sectionHeading}
          placeholder="CTA heading"
        />
        <InputField
          label="Section subheading"
          id="cta-subheading"
          value={config.subheading}
          onChange={(value) => onChange("subheading", value)}
          maxLength={HOME_INPUT_LIMITS.sectionSubheading}
          placeholder="CTA description"
        />

        <div className="grid gap-3 md:grid-cols-2">
          <InputField
            label="Primary button text"
            id="cta-primary-text"
            value={config.primaryButtonText}
            onChange={(value) => onChange("primaryButtonText", value)}
            maxLength={HOME_INPUT_LIMITS.ctaButtonText}
            placeholder="Primary button"
          />
          <InputField
            label="Primary button link"
            id="cta-primary-link"
            value={config.primaryButtonLink}
            onChange={(value) => onChange("primaryButtonLink", value)}
            maxLength={HOME_INPUT_LIMITS.linkText}
            placeholder="/primary-action"
          />
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <InputField
            label="Secondary button text"
            id="cta-secondary-text"
            value={config.secondaryButtonText}
            onChange={(value) => onChange("secondaryButtonText", value)}
            maxLength={HOME_INPUT_LIMITS.ctaButtonText}
            placeholder="Secondary button"
          />
          <InputField
            label="Secondary button link"
            id="cta-secondary-link"
            value={config.secondaryButtonLink}
            onChange={(value) => onChange("secondaryButtonLink", value)}
            maxLength={HOME_INPUT_LIMITS.linkText}
            placeholder="/secondary-action"
          />
        </div>
        <SectionSaveAction
          onSave={onSave}
          isSaving={isSaving}
          saveStatus={saveStatus}
        />
      </CardContent>
    </Card>
  );
}
