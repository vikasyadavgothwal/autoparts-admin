"use client"

import { type FormEvent, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { saveSectionContent } from "@/actions/admin-dashboard/public-pages/public-content"
import { SeoPanel } from "@/components/admin-dashboard/public-pages/seo-panel"

const LABEL_CLASS =
  "text-sm font-medium text-[#E5E7EB]"

const INPUT_CLASS =
  "w-full rounded-lg border border-[#2A2A2A] bg-[#010101] px-4 py-3 text-white outline-none transition focus:border-[#DC2626] focus:ring-2 focus:ring-[#DC2626]/30"

const META_CLASS = "text-xs text-[#9CA3AF]"
import type { ProfessionalPageFormProps } from "@/types/admin-dashboard/public-pages/professional-page-form"
import type { PublicPageContentResult } from "@/types/admin-dashboard/public-pages/public-page-content"

export function ProfessionalPageForm({
  pageTitle,
  pageDescription,
  headingPlaceholder,
  subheadingPlaceholder,
  statusText,
  initialValues,
  initialSeo,
  saveSlug,
}: ProfessionalPageFormProps) {
  const [activeTab, setActiveTab] = useState<"content" | "seo">("content")
  const [heading, setHeading] = useState(initialValues?.heading ?? "")
  const [subheading, setSubheading] = useState(initialValues?.subheading ?? "")
  const [statusMessage, setStatusMessage] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  const canSave = useMemo(
    () => Boolean(heading.trim() || subheading.trim()),
    [heading, subheading],
  )

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!canSave) {
      const message = "Add content before saving."
      setStatusMessage(message)
      toast.error(message)
      return
    }

    setIsSubmitting(true)
    setStatusMessage("Saving...")
    const values = { heading: heading.trim(), subheading: subheading.trim() }
    const fallbackResult: PublicPageContentResult<{
      heading: string
      subheading: string
    }> = { ok: true, data: values }

    try {
      const actionResult = saveSlug
        ? await saveSectionContent({ slug: saveSlug, content: values })
        : fallbackResult

      if (actionResult.ok) {
        setHeading(actionResult.data.heading)
        setSubheading(actionResult.data.subheading)
        setStatusMessage(`${statusText} saved at ${new Date().toLocaleTimeString()}`)
        toast.success(`${statusText} updated successfully.`)
      } else {
        const message = actionResult.error || "Failed to save changes."
        setStatusMessage(message)
        toast.error(message)
      }
    } catch {
      const message = "Unable to save changes. Please try again."
      setStatusMessage(message)
      toast.error(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <section className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <div>
        <h1 className="text-3xl font-bold text-white">{pageTitle}</h1>
        <p className="mt-2 max-w-3xl text-sm text-[#9CA3AF]">
          {pageDescription}
        </p>
      </div>

      <div className="flex gap-2 rounded-lg border border-[#2A2A2A] bg-[#0A0A0A] p-2">
        <button
          type="button"
          onClick={() => setActiveTab("content")}
          className={cn(
            "rounded-md px-4 py-2 text-sm font-medium transition",
            activeTab === "content"
              ? "bg-[#DC2626] text-white"
              : "text-[#9CA3AF] hover:bg-[#1A1A1A] hover:text-white",
          )}
        >
          Content
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("seo")}
          className={cn(
            "rounded-md px-4 py-2 text-sm font-medium transition",
            activeTab === "seo"
              ? "bg-[#DC2626] text-white"
              : "text-[#9CA3AF] hover:bg-[#1A1A1A] hover:text-white",
          )}
        >
          SEO
        </button>
      </div>

      {activeTab === "seo" && saveSlug ? (
        <SeoPanel slug={saveSlug} initialSeo={initialSeo} />
      ) : (
        <Card className="rounded-lg border-[#2A2A2A] bg-[#1A1A1A]">


        <CardContent>
          <form onSubmit={onSubmit} className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label htmlFor="heading" className={LABEL_CLASS}>
                    Heading
                  </label>
                  <span className={META_CLASS}>{heading.length}/80</span>
                </div>
                <input
                  id="heading"
                  value={heading}
                  onChange={(event) => setHeading(event.target.value)}
                  maxLength={80}
                  className={INPUT_CLASS}
                  placeholder={headingPlaceholder}
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label htmlFor="subheading" className={LABEL_CLASS}>
                    Subheading
                  </label>
                  <span className={META_CLASS}>{subheading.length}/140</span>
                </div>
                <textarea
                  id="subheading"
                  value={subheading}
                  onChange={(event) => setSubheading(event.target.value)}
                  maxLength={140}
                  rows={4}
                  className={cn(INPUT_CLASS, "resize-none")}
                  placeholder={subheadingPlaceholder}
                />
              </div>
            </div>

            <div className="flex items-center justify-between gap-4 border-t border-[#2A2A2A] pt-4">
              <p className="text-sm text-[#9CA3AF]">{statusMessage || "No changes saved yet."}</p>
              <Button
                type="submit"
                className="rounded-lg"
                disabled={isSubmitting}
              >
                {isSubmitting ? "Saving..." : "Save"}
              </Button>
            </div>
          </form>
        </CardContent>
        </Card>
      )}
    </section>
  )
}
