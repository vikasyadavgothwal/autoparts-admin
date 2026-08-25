"use server"

import { logError } from "@/lib/logger"
import type { Prisma } from "@/lib/generated/prisma/client"
import { db } from "@/lib/database/prisma"
import { randomUUID } from "node:crypto"
import {
  requireAdminPermission,
} from "@/lib/auth/admin-guard"
import { ADMIN_CONTENT_EDIT_PERMISSION } from "@/lib/auth/admin-permissions"
import type { HomePageConfig } from "@/types/admin-dashboard/public-pages/home-tabs-data"
import type { ForBusinessPageConfig } from "@/types/admin-dashboard/public-pages/for-business-tabs-data"
import { LEGAL_CONTENT_FALLBACK_TEXT } from "@/services/admin-dashboard/public-pages/legal-content-fallback"
import type {
  PublicWebsiteContentData,
  PublicWebsiteContentError,
  PublicWebsiteContentSlug,
  PublicWebsiteContentSaveInput,
  PublicWebsiteContentSlugInput,
} from "@/types/admin-dashboard/public-pages/public-content-api"
import {
  resolveForBusinessPageConfigFromDb,
  resolveHomePageConfigFromDb,
} from "@/services/admin-dashboard/public-pages/public-page-content"
import {
  prepareHomePageConfigForStorage,
  resolveHomePageBannerSignedUrl,
} from "@/services/admin-dashboard/public-pages/home-banner-image"
import {
  DEFAULT_PUBLIC_PAGE_SEO_CONFIG,
  attachSeoToStoredContent,
  deletePublicPageSeoImageFromS3,
  getPublicPageSeoFromStoredContent,
  normalizePublicPageSeoConfig,
  preparePublicPageSeoForStorage,
  resolvePublicPageSeoForResponse,
  uploadPublicPageSeoImageToS3,
} from "@/services/admin-dashboard/public-pages/seo"
import type {
  ForBusinessPageSaveInput,
  HomePageSaveInput,
  ProfessionalSectionPage,
  PublicPageSectionContent,
  PublicPageSectionSaveInput,
  PublicPageContentResult,
} from "@/types/admin-dashboard/public-pages/public-page-content"
import type {
  PublicPageSeoConfig,
  PublicPageSeoSaveInput,
  PublicPageSeoUploadResult,
} from "@/types/admin-dashboard/public-pages/seo"

const HOME_PAGE_SLUG = "home"
const FOR_BUSINESS_SLUG = "for-business"
const RFQ_SLUG: ProfessionalSectionPage = "rfq"
const SUPPLIERS_SLUG: ProfessionalSectionPage = "suppliers"
const SERVICES_SLUG: ProfessionalSectionPage = "services"
const PRIVACY_POLICY_SLUG = "privacy-policy"
const TERMS_OF_SERVICES_SLUG = "terms-of-services"
const COOKIES_SETTINGS_SLUG = "cookies-settings"

const PUBLIC_WEBSITE_CONTENT_SLUGS = [
  HOME_PAGE_SLUG,
  FOR_BUSINESS_SLUG,
  RFQ_SLUG,
  SUPPLIERS_SLUG,
  SERVICES_SLUG,
  PRIVACY_POLICY_SLUG,
  TERMS_OF_SERVICES_SLUG,
  COOKIES_SETTINGS_SLUG,
] as const satisfies readonly PublicWebsiteContentSlug[]

const PUBLIC_WEBSITE_CONTENT_SLUG_ALIASES: Record<string, PublicWebsiteContentSlug> = {
  "terms-condition": TERMS_OF_SERVICES_SLUG,
  "terms-and-conditions": TERMS_OF_SERVICES_SLUG,
  "terms-conditions": TERMS_OF_SERVICES_SLUG,
  "cookies-setting": COOKIES_SETTINGS_SLUG,
  "cookie-setting": COOKIES_SETTINGS_SLUG,
  "cookie-settings": COOKIES_SETTINGS_SLUG,
}

type LegalDocumentSlug =
  | typeof PRIVACY_POLICY_SLUG
  | typeof TERMS_OF_SERVICES_SLUG
  | typeof COOKIES_SETTINGS_SLUG

const toErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : "Unable to complete request"

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null

const normalizeText = (value: unknown, fallback: string): string =>
  typeof value === "string" ? value : fallback

const normalizeSectionContent = (content: unknown): PublicPageSectionContent => {
  const source = isObject(content) ? content : {}

  return {
    heading: normalizeText(source.heading, ""),
    subheading: normalizeText(source.subheading, ""),
  }
}

const LEGAL_FALLBACK_TEXT: Record<LegalDocumentSlug, string> =
  LEGAL_CONTENT_FALLBACK_TEXT

const normalizeLegalContent = (value: unknown, fallback: string): string => {
  if (typeof value === "string") {
    return value
  }

  if (isObject(value)) {
    return normalizeText(value.content, fallback)
  }

  return fallback
}

const normalizeDatabaseJson = (value: unknown): Prisma.InputJsonValue => {
  return JSON.parse(
    JSON.stringify(value),
  ) as Prisma.InputJsonValue
}

const createSectionRecordId = (): string => randomUUID()

const sanitizeSectionSaveSlug = (
  slug: ProfessionalSectionPage,
): string => slug.trim()

const toActionError = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message
  }

  if (typeof error === "object" && error !== null) {
    const maybeError = error as {
      code?: string
      message?: string
      meta?: {
        target?: string[]
        cause?: string
      }
    }

    if (maybeError.meta?.target?.length) {
      return `${maybeError.message ?? "Unable to complete request"} (${maybeError.meta.target.join(", ")})`
    }

    if (maybeError.meta?.cause) {
      return `${maybeError.message ?? "Unable to complete request"} (${maybeError.meta.cause})`
    }

    if (maybeError.message) {
      return maybeError.message
    }
  }

  return "Unable to complete request"
}

const resolvePublicContentSlug = (
  slug: string | null,
): PublicWebsiteContentSlug | null => {
  if (!slug) {
    return null
  }

  const normalized = slug.trim().toLowerCase()
  if (PUBLIC_WEBSITE_CONTENT_SLUGS.includes(normalized as PublicWebsiteContentSlug)) {
    return normalized as PublicWebsiteContentSlug
  }

  return PUBLIC_WEBSITE_CONTENT_SLUG_ALIASES[normalized] ?? null
}

const getPageContent = async <T>(
  slug: string,
  normalize: (content: unknown) => T,
): Promise<PublicPageContentResult<T>> => {
  try {
    const row = await db.mainWebsiteContent.findUnique({
      where: { slug },
    })

    return {
      ok: true,
      data: normalize(row?.content),
    }
  } catch (error) {
    return {
      ok: false,
      error: toErrorMessage(error),
    }
  }
}

const getContentBySlug = async (
  slug: PublicWebsiteContentSlug,
): Promise<PublicPageContentResult<PublicWebsiteContentData>> => {
  switch (slug) {
    case "home":
      return getHomePageContent()
    case "for-business":
      return getForBusinessPageContent()
    case "rfq":
      return getRfqPageContent()
    case "suppliers":
      return getSuppliersPageContent()
    case "services":
      return getServicesPageContent()
    case "privacy-policy":
      return getPrivacyPolicyPageContent()
    case "terms-of-services":
      return getTermsOfServicesPageContent()
    case "cookies-settings":
      return getCookiesSettingsPageContent()
  }
}

export type PublicWebsiteSingleContentResult = {
  ok: true
  slug: PublicWebsiteContentSlug
  data: PublicWebsiteContentData
  seo: PublicPageSeoConfig
}

export async function getPublicContentBySlug(
  slug: PublicWebsiteContentSlugInput,
): Promise<PublicWebsiteSingleContentResult | PublicWebsiteContentError> {
  const normalizedSlug = resolvePublicContentSlug(slug)

  if (!normalizedSlug) {
    return {
      ok: false,
      error:
        "Valid slug is required. Use one of home, for-business, rfq, suppliers, services, privacy-policy, terms-of-services, or cookies-settings.",
    }
  }

  const result = await getContentBySlug(normalizedSlug)
  const seoResult = await getPublicPageSeoContent(normalizedSlug)

  if (!result.ok) {
    return {
      ok: false,
      error: result.error,
    }
  }

  return {
    ok: true,
    slug: normalizedSlug,
    data: result.data,
    seo: seoResult.ok ? seoResult.data : DEFAULT_PUBLIC_PAGE_SEO_CONFIG,
  }
}

export async function getHomePageContent(): Promise<
  PublicPageContentResult<HomePageConfig>
> {
  const result = await getPageContent<HomePageConfig>(
    HOME_PAGE_SLUG,
    resolveHomePageConfigFromDb,
  )

  if (!result.ok) {
    return result
  }

  try {
    return {
      ok: true,
      data: await resolveHomePageBannerSignedUrl(result.data),
    }
  } catch (error) {
    return {
      ok: false,
      error: toActionError(error),
    }
  }
}

export async function getForBusinessPageContent(): Promise<
  PublicPageContentResult<ForBusinessPageConfig>
> {
  return getPageContent<ForBusinessPageConfig>(
    FOR_BUSINESS_SLUG,
    resolveForBusinessPageConfigFromDb,
  )
}

export async function getRfqPageContent(): Promise<
  PublicPageContentResult<PublicPageSectionContent>
> {
  return getPageContent<PublicPageSectionContent>(RFQ_SLUG, normalizeSectionContent)
}

export async function getSuppliersPageContent(): Promise<
  PublicPageContentResult<PublicPageSectionContent>
> {
  return getPageContent<PublicPageSectionContent>(
    SUPPLIERS_SLUG,
    normalizeSectionContent,
  )
}

export async function getServicesPageContent(): Promise<
  PublicPageContentResult<PublicPageSectionContent>
> {
  return getPageContent<PublicPageSectionContent>(
    SERVICES_SLUG,
    normalizeSectionContent,
  )
}

const getLegalPageContent = async <T extends LegalDocumentSlug>(
  slug: T,
): Promise<PublicPageContentResult<string>> => {
  try {

    const row = await db.mainWebsiteContent.findUnique({
      where: { slug },
    })
    return {
      ok: true,
      data: normalizeLegalContent(row?.content, LEGAL_FALLBACK_TEXT[slug]),
    }
  } catch (error) {
    return {
      ok: false,
      error: toErrorMessage(error),
    }
  }
}

export async function getPrivacyPolicyPageContent(): Promise<
  PublicPageContentResult<string>
> {
  return getLegalPageContent(PRIVACY_POLICY_SLUG)
}

export async function getTermsOfServicesPageContent(): Promise<
  PublicPageContentResult<string>
> {
  return getLegalPageContent(TERMS_OF_SERVICES_SLUG)
}

export async function getCookiesSettingsPageContent(): Promise<
  PublicPageContentResult<string>
> {
  return getLegalPageContent(COOKIES_SETTINGS_SLUG)
}

export async function getPublicPageSeoContent(
  slug: PublicWebsiteContentSlugInput,
): Promise<PublicPageContentResult<PublicPageSeoConfig>> {
  const normalizedSlug = resolvePublicContentSlug(slug)

  if (!normalizedSlug) {
    return {
      ok: false,
      error:
        "Valid slug is required. Use one of home, for-business, rfq, suppliers, services, privacy-policy, terms-of-services, or cookies-settings.",
    }
  }

  try {
    const row = await db.mainWebsiteContent.findUnique({
      where: { slug: normalizedSlug },
      select: { content: true },
    })

    return {
      ok: true,
      data: await resolvePublicPageSeoForResponse(row?.content),
    }
  } catch (error) {
    return {
      ok: false,
      error: toErrorMessage(error),
    }
  }
}

export async function savePublicPageSeoContent(
  input: PublicPageSeoSaveInput,
): Promise<PublicPageContentResult<PublicPageSeoConfig>> {
  const authorization = await requireAdminPermission(ADMIN_CONTENT_EDIT_PERMISSION)
  if (!authorization.ok) {
    return authorization
  }

  const normalizedSlug = resolvePublicContentSlug(input.slug)

  if (!normalizedSlug) {
    return {
      ok: false,
      error:
        "Valid slug is required. Use one of home, for-business, rfq, suppliers, services, privacy-policy, terms-of-services, or cookies-settings.",
    }
  }

  try {
    const existingRow = await db.mainWebsiteContent.findUnique({
      where: { slug: normalizedSlug },
      select: { content: true },
    })
    const seoForStorage = preparePublicPageSeoForStorage(input.seo)
    const contentWithSeo = attachSeoToStoredContent(
      existingRow?.content,
      seoForStorage,
    )

    await db.mainWebsiteContent.upsert({
      where: { slug: normalizedSlug },
      create: {
        slug: normalizedSlug,
        id: createSectionRecordId(),
        content: normalizeDatabaseJson(contentWithSeo),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      update: {
        content: normalizeDatabaseJson(contentWithSeo),
        updatedAt: new Date(),
      },
    })

    return {
      ok: true,
      data: await resolvePublicPageSeoForResponse(contentWithSeo),
    }
  } catch (error) {
    logError("[public-content] savePublicPageSeoContent failed", error)
    return {
      ok: false,
      error: toActionError(error),
    }
  }
}

const isFormFile = (value: FormDataEntryValue | null): value is File =>
  typeof File !== "undefined" && value instanceof File

const parseSeoPayload = (
  value: FormDataEntryValue | null,
):
  | { ok: true; seo: PublicPageSeoConfig }
  | { ok: false; error: string } => {
  if (typeof value !== "string") {
    return {
      ok: false,
      error: "SEO payload is required.",
    }
  }

  try {
    return {
      ok: true,
      seo: normalizePublicPageSeoConfig(JSON.parse(value)),
    }
  } catch {
    return {
      ok: false,
      error: "SEO payload is invalid.",
    }
  }
}

export async function uploadPublicPageSeoOgImage(
  formData: FormData,
): Promise<PublicPageSeoUploadResult> {
  const authorization = await requireAdminPermission(ADMIN_CONTENT_EDIT_PERMISSION)
  if (!authorization.ok) {
    return authorization
  }

  const normalizedSlug = resolvePublicContentSlug(
    typeof formData.get("slug") === "string" ? String(formData.get("slug")) : null,
  )

  if (!normalizedSlug) {
    return {
      ok: false,
      error: "Valid page slug is required.",
    }
  }

  const image = formData.get("image")
  if (!isFormFile(image)) {
    return {
      ok: false,
      error: "Open Graph image file is required.",
    }
  }

  const parsedSeo = parseSeoPayload(formData.get("seo"))
  if (!parsedSeo.ok) {
    return parsedSeo
  }

  const uploadResult = await uploadPublicPageSeoImageToS3({
    file: image,
    currentSeo: parsedSeo.seo,
  })

  if (!uploadResult.ok) {
    return uploadResult
  }

  const saveResult = await savePublicPageSeoContent({
    slug: normalizedSlug,
    seo: uploadResult.seo,
  })

  if (!saveResult.ok) {
    return {
      ok: false,
      error: saveResult.error,
    }
  }

  if (
    uploadResult.previousImageKey &&
    uploadResult.previousImageKey !== uploadResult.imageKey
  ) {
    const deleteResult = await deletePublicPageSeoImageFromS3(
      uploadResult.previousImageKey,
    )

    if (!deleteResult.ok) {
      console.warn("[public-page-seo] unable to remove previous image", {
        previousImageKey: uploadResult.previousImageKey,
        error: deleteResult.error,
      })
    }
  }

  return {
    ok: true,
    imageUrl: uploadResult.imageUrl,
    imageKey: saveResult.data.ogImageKey,
    previousImageKey: uploadResult.previousImageKey,
    seo: saveResult.data,
  }
}

const isLegalSlug = (slug: PublicWebsiteContentSlug): slug is LegalDocumentSlug =>
  slug === PRIVACY_POLICY_SLUG || slug === TERMS_OF_SERVICES_SLUG || slug === COOKIES_SETTINGS_SLUG

export async function saveLegalDocumentContent(
  input: PublicWebsiteContentSaveInput,
): Promise<PublicPageContentResult<string>> {
  const authorization = await requireAdminPermission(ADMIN_CONTENT_EDIT_PERMISSION)
  if (!authorization.ok) {
    return authorization
  }

  const normalizedSlug = resolvePublicContentSlug(input.slug)

  if (!normalizedSlug || !isLegalSlug(normalizedSlug)) {
    return {
      ok: false,
      error:
        "Invalid slug. Use one of privacy-policy, terms-of-services, or cookies-settings.",
    }
  }

  return saveContent<string>(
    normalizedSlug,
    input.content,
    (content: unknown) =>
      normalizeLegalContent(content, LEGAL_FALLBACK_TEXT[normalizedSlug]),
  )
}

export async function saveSectionContent(
  input: PublicPageSectionSaveInput,
): Promise<PublicPageContentResult<PublicPageSectionContent>> {
  const authorization = await requireAdminPermission(ADMIN_CONTENT_EDIT_PERMISSION)
  if (!authorization.ok) {
    return authorization
  }

  try {
    const normalized = normalizeSectionContent(input.content)
    const slug = resolvePublicContentSlug(sanitizeSectionSaveSlug(input.slug))

    if (!slug || ![RFQ_SLUG, SUPPLIERS_SLUG, SERVICES_SLUG].includes(slug as ProfessionalSectionPage)) {
      return {
        ok: false,
        error: "Invalid page section identifier.",
      }
    }

    const existingRow = await db.mainWebsiteContent.findUnique({
      where: { slug },
      select: { content: true },
    })
    const contentWithSeo = attachSeoToStoredContent(
      normalized,
      getPublicPageSeoFromStoredContent(existingRow?.content),
    )

    await db.mainWebsiteContent.upsert({
      where: { slug },
      create: {
        slug,
        id: createSectionRecordId(),
        content: normalizeDatabaseJson(contentWithSeo),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      update: {
        content: normalizeDatabaseJson(contentWithSeo),
        updatedAt: new Date(),
      },
    })

    return {
      ok: true,
      data: normalized,
    }
  } catch (error) {
    logError("[public-content] saveSectionContent failed", error)
    return {
      ok: false,
      error: toActionError(error),
    }
  }
}

const saveContent = async <T>(
  slug: string,
  content: T,
  normalize: (input: unknown) => T,
): Promise<PublicPageContentResult<T>> => {
  try {
    const normalized = normalize(content)
    const existingRow = await db.mainWebsiteContent.findUnique({
      where: { slug },
      select: { content: true },
    })
    const contentWithSeo = attachSeoToStoredContent(
      normalized,
      getPublicPageSeoFromStoredContent(existingRow?.content),
    )

    await db.mainWebsiteContent.upsert({
      where: { slug },
      create: {
        slug,
        id: createSectionRecordId(),
        content: normalizeDatabaseJson(contentWithSeo),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      update: {
        content: normalizeDatabaseJson(contentWithSeo),
        updatedAt: new Date(),
      },
    })
    return {
      ok: true,
      data: normalized,
    }
  } catch (error) {
    logError("[public-content] saveContent failed", error)
    return {
      ok: false,
      error: toActionError(error),
    }
  }
}

export async function saveHomePageContent(
  input: HomePageSaveInput,
): Promise<PublicPageContentResult<HomePageConfig>> {
  const authorization = await requireAdminPermission(ADMIN_CONTENT_EDIT_PERMISSION)
  if (!authorization.ok) {
    return authorization
  }

  const saveResult = await saveContent<HomePageConfig>(
    HOME_PAGE_SLUG,
    prepareHomePageConfigForStorage(input.content),
    resolveHomePageConfigFromDb,
  )

  if (!saveResult.ok) {
    return saveResult
  }

  try {
    return {
      ok: true,
      data: await resolveHomePageBannerSignedUrl(saveResult.data),
    }
  } catch (error) {
    return {
      ok: false,
      error: toActionError(error),
    }
  }
}

export async function saveForBusinessPageContent(
  input: ForBusinessPageSaveInput,
): Promise<PublicPageContentResult<ForBusinessPageConfig>> {
  const authorization = await requireAdminPermission(ADMIN_CONTENT_EDIT_PERMISSION)
  if (!authorization.ok) {
    return authorization
  }

  return saveContent<ForBusinessPageConfig>(
    FOR_BUSINESS_SLUG,
    input.content,
    resolveForBusinessPageConfigFromDb,
  )
}
