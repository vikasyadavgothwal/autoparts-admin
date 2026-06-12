import type { PublicWebsiteContentSlug } from "@/types/admin-dashboard/public-pages/public-content-api"

export type PublicPageSeoConfig = {
  metaTitle: string
  metaDescription: string
  metaKeywords: string
  canonicalLink: string
  ogTitle: string
  ogDescription: string
  ogImage: string
  ogImageKey: string
  noIndex: boolean
  noFollow: boolean
  customHeadCode: string
  customBodyCode: string
}

export type PublicPageSeoSaveInput = {
  slug: PublicWebsiteContentSlug
  seo: PublicPageSeoConfig
}

export type PublicPageSeoUploadInput = {
  file: File
  currentSeo: PublicPageSeoConfig
}

export type PublicPageSeoUploadSuccess = {
  ok: true
  imageUrl: string
  imageKey: string
  previousImageKey: string
  seo: PublicPageSeoConfig
}

export type PublicPageSeoUploadError = {
  ok: false
  error: string
}

export type PublicPageSeoUploadResult =
  | PublicPageSeoUploadSuccess
  | PublicPageSeoUploadError
