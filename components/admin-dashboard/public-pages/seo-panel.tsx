"use client"

import { type ChangeEvent, type FormEvent, useEffect, useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  savePublicPageSeoContent,
  uploadPublicPageSeoOgImage,
} from "@/actions/admin-dashboard/public-pages/public-content"
import { cn } from "@/lib/utils"
import type { PublicWebsiteContentSlug } from "@/types/admin-dashboard/public-pages/public-content-api"
import type { PublicPageSeoConfig } from "@/types/admin-dashboard/public-pages/seo"

const LABEL_CLASS = "text-sm font-medium text-[#E5E7EB]"
const INPUT_CLASS =
  "w-full rounded-lg border border-[#2A2A2A] bg-[#010101] px-4 py-3 text-white outline-none transition focus:border-[#DC2626] focus:ring-2 focus:ring-[#DC2626]/30"
const META_CLASS = "text-xs text-[#9CA3AF]"
const IMAGE_ACCEPT = "image/jpeg,image/png,image/webp,image/gif"
const IMAGE_MAX_BYTES = 10 * 1024 * 1024
const IMAGE_MAX_SIZE_LABEL = "10 MB"

type SeoPanelProps = {
  slug: PublicWebsiteContentSlug
  initialSeo: PublicPageSeoConfig
}

type SeoTextField = Exclude<
  keyof PublicPageSeoConfig,
  "noIndex" | "noFollow"
>

const isAcceptedImageFile = (file: File): boolean =>
  ["image/jpeg", "image/png", "image/webp", "image/gif"].includes(file.type)

export function SeoPanel({ slug, initialSeo }: SeoPanelProps) {
  const [seo, setSeo] = useState<PublicPageSeoConfig>(initialSeo)
  const [pendingOgImage, setPendingOgImage] = useState<File | null>(null)
  const [statusMessage, setStatusMessage] = useState("No SEO changes saved yet.")
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    const currentImage = seo.ogImage

    return () => {
      if (currentImage.startsWith("blob:")) {
        URL.revokeObjectURL(currentImage)
      }
    }
  }, [seo.ogImage])

  const updateTextField = (field: SeoTextField, value: string) => {
    setSeo((previous) => ({
      ...previous,
      [field]: value,
    }))
  }

  const updateBooleanField = (
    field: "noIndex" | "noFollow",
    value: boolean,
  ) => {
    setSeo((previous) => ({
      ...previous,
      [field]: value,
    }))
  }

  const onOgImageChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]

    if (!file) {
      return
    }

    if (!isAcceptedImageFile(file)) {
      toast.error("Upload a JPG, PNG, WebP, or GIF image.")
      event.target.value = ""
      return
    }

    if (file.size > IMAGE_MAX_BYTES) {
      toast.error(`Image must be ${IMAGE_MAX_SIZE_LABEL} or smaller.`)
      event.target.value = ""
      return
    }

    const objectUrl = URL.createObjectURL(file)
    setSeo((previous) => ({
      ...previous,
      ogImage: objectUrl,
    }))
    setPendingOgImage(file)
    setStatusMessage("Open Graph image selected. Click Save SEO to upload.")
    event.target.value = ""
  }

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setIsSaving(true)
    setStatusMessage(pendingOgImage ? "Uploading image..." : "Saving SEO...")

    try {
      if (pendingOgImage) {
        const formData = new FormData()
        formData.set("slug", slug)
        formData.set("seo", JSON.stringify(seo))
        formData.set("image", pendingOgImage)

        const uploadResult = await uploadPublicPageSeoOgImage(formData)

        if (!uploadResult.ok) {
          setStatusMessage(uploadResult.error)
          toast.error(uploadResult.error)
          return
        }

        setSeo(uploadResult.seo)
        setPendingOgImage(null)
        setStatusMessage(`SEO saved at ${new Date().toLocaleTimeString()}`)
        toast.success("SEO updated successfully.")
        return
      }

      const result = await savePublicPageSeoContent({ slug, seo })

      if (!result.ok) {
        setStatusMessage(result.error)
        toast.error(result.error)
        return
      }

      setSeo(result.data)
      setStatusMessage(`SEO saved at ${new Date().toLocaleTimeString()}`)
      toast.success("SEO updated successfully.")
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unable to save SEO settings."
      setStatusMessage(errorMessage)
      toast.error(errorMessage)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Card className="rounded-lg border-[#2A2A2A] bg-[#1A1A1A]">
      <CardHeader>
        <CardTitle className="text-white">SEO Settings</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <TextField
              id={`${slug}-meta-title`}
              label="Meta title"
              value={seo.metaTitle}
              onChange={(value) => updateTextField("metaTitle", value)}
              placeholder="Auto Parts Pro | Page title"
            />
            <TextField
              id={`${slug}-canonical-link`}
              label="Canonical link"
              value={seo.canonicalLink}
              onChange={(value) => updateTextField("canonicalLink", value)}
              placeholder="https://example.com/page"
            />
          </div>

          <TextareaField
            id={`${slug}-meta-description`}
            label="Meta description"
            value={seo.metaDescription}
            onChange={(value) => updateTextField("metaDescription", value)}
            placeholder="Short search result description for this page."
            rows={3}
          />

          <TextareaField
            id={`${slug}-meta-keywords`}
            label="Meta keywords"
            value={seo.metaKeywords}
            onChange={(value) => updateTextField("metaKeywords", value)}
            placeholder="auto parts, suppliers, rfq"
            rows={2}
          />

          <div className="grid gap-6 md:grid-cols-2">
            <TextField
              id={`${slug}-og-title`}
              label="Open Graph title"
              value={seo.ogTitle}
              onChange={(value) => updateTextField("ogTitle", value)}
              placeholder="Social sharing title"
            />
            <div className="space-y-2">
              <label htmlFor={`${slug}-og-image`} className={LABEL_CLASS}>
                Open Graph image
              </label>
              <input
                id={`${slug}-og-image`}
                type="file"
                accept={IMAGE_ACCEPT}
                onChange={onOgImageChange}
                className={cn(INPUT_CLASS, "file:mr-4 file:rounded-md file:border-0 file:bg-[#DC2626] file:px-3 file:py-1.5 file:text-white")}
              />
              <p className={META_CLASS}>JPG, PNG, WebP, or GIF. Max {IMAGE_MAX_SIZE_LABEL}.</p>
              {seo.ogImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={seo.ogImage}
                  alt="Open Graph preview"
                  className="mt-3 aspect-[1.91/1] w-full max-w-md rounded-lg border border-[#2A2A2A] object-cover"
                />
              ) : null}
            </div>
          </div>

          <TextareaField
            id={`${slug}-og-description`}
            label="Open Graph description"
            value={seo.ogDescription}
            onChange={(value) => updateTextField("ogDescription", value)}
            placeholder="Description shown when this page is shared."
            rows={3}
          />

          <div className="grid gap-3 rounded-lg border border-[#2A2A2A] bg-[#0A0A0A] p-4 md:grid-cols-2">
            <CheckboxField
              id={`${slug}-no-index`}
              label="No index"
              checked={seo.noIndex}
              onChange={(value) => updateBooleanField("noIndex", value)}
            />
            <CheckboxField
              id={`${slug}-no-follow`}
              label="No follow"
              checked={seo.noFollow}
              onChange={(value) => updateBooleanField("noFollow", value)}
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#2A2A2A] pt-4">
            <p className="text-sm text-[#9CA3AF]">{statusMessage}</p>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? "Saving..." : "Save SEO"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

function TextField({
  id,
  label,
  value,
  onChange,
  placeholder,
}: {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  placeholder: string
}) {
  return (
    <div className="space-y-2">
      <label htmlFor={id} className={LABEL_CLASS}>
        {label}
      </label>
      <input
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={INPUT_CLASS}
        placeholder={placeholder}
      />
    </div>
  )
}

function TextareaField({
  id,
  label,
  value,
  onChange,
  placeholder,
  rows,
}: {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  placeholder: string
  rows: number
}) {
  return (
    <div className="space-y-2">
      <label htmlFor={id} className={LABEL_CLASS}>
        {label}
      </label>
      <textarea
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={rows}
        className={cn(INPUT_CLASS, "resize-y font-mono text-sm")}
        placeholder={placeholder}
      />
    </div>
  )
}

function CheckboxField({
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
    <label htmlFor={id} className="flex items-center gap-3 text-sm text-[#E5E7EB]">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="h-4 w-4 rounded border-[#2A2A2A] accent-[#DC2626]"
      />
      {label}
    </label>
  )
}
