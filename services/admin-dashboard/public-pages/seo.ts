import { Buffer } from "node:buffer"
import { randomUUID } from "node:crypto"
import { logError } from "@/lib/logger"
import {
  createSignedS3ObjectUrl,
  deleteObjectFromS3,
  getS3ObjectKeyFromUrl,
  uploadObjectToS3,
} from "@/lib/storage/s3"
import type {
  PublicPageSeoConfig,
  PublicPageSeoUploadInput,
  PublicPageSeoUploadResult,
} from "@/types/admin-dashboard/public-pages/seo"

type JsonObject = Record<string, unknown>

export const DEFAULT_PUBLIC_PAGE_SEO_CONFIG: PublicPageSeoConfig = {
  metaTitle: "",
  metaDescription: "",
  metaKeywords: "",
  canonicalLink: "",
  ogTitle: "",
  ogDescription: "",
  ogImage: "",
  ogImageKey: "",
  noIndex: false,
  noFollow: false,
  customHeadCode: "",
  customBodyCode: "",
}

export const PUBLIC_PAGE_SEO_IMAGE_MAX_BYTES = 10 * 1024 * 1024
export const PUBLIC_PAGE_SEO_IMAGE_MAX_SIZE_LABEL = "10 MB"
export const PUBLIC_PAGE_SEO_IMAGE_ACCEPTED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
] as const

const SEO_IMAGE_DEFAULT_PREFIX = "seo/open-graph"
const SEO_IMAGE_CACHE_CONTROL = "public, max-age=31536000, immutable"

const IMAGE_EXTENSION_BY_TYPE: Record<
  (typeof PUBLIC_PAGE_SEO_IMAGE_ACCEPTED_TYPES)[number],
  string
> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
}

const isObject = (value: unknown): value is JsonObject =>
  typeof value === "object" && value !== null && !Array.isArray(value)

const normalizeText = (value: unknown): string =>
  typeof value === "string" ? value : ""

const normalizeBoolean = (value: unknown): boolean =>
  typeof value === "boolean" ? value : false

const isAcceptedSeoImageType = (
  contentType: string,
): contentType is (typeof PUBLIC_PAGE_SEO_IMAGE_ACCEPTED_TYPES)[number] =>
  PUBLIC_PAGE_SEO_IMAGE_ACCEPTED_TYPES.includes(
    contentType as (typeof PUBLIC_PAGE_SEO_IMAGE_ACCEPTED_TYPES)[number],
  )

const getSeoImageUploadPrefix = (): string => {
  const configuredPrefix =
    process.env.AWS_S3_SEO_IMAGE_PREFIX?.trim() ||
    process.env.S3_SEO_IMAGE_PREFIX?.trim()

  return (configuredPrefix || SEO_IMAGE_DEFAULT_PREFIX)
    .replace(/^\/+|\/+$/g, "")
    .replace(/\/{2,}/g, "/")
}

const createSeoImageObjectKey = (contentType: File["type"]): string => {
  const extension = isAcceptedSeoImageType(contentType)
    ? IMAGE_EXTENSION_BY_TYPE[contentType]
    : "bin"
  const datePath = new Date().toISOString().slice(0, 10)

  return `${getSeoImageUploadPrefix()}/${datePath}/${randomUUID()}.${extension}`
}

const validateSeoImage = (file: File): string | null => {
  if (!file.size) {
    return "Open Graph image file is required."
  }

  if (!isAcceptedSeoImageType(file.type)) {
    return "Upload a JPG, PNG, WebP, or GIF image."
  }

  if (file.size > PUBLIC_PAGE_SEO_IMAGE_MAX_BYTES) {
    return `Image must be ${PUBLIC_PAGE_SEO_IMAGE_MAX_SIZE_LABEL} or smaller.`
  }

  return null
}

const isPayloadSizeError = (errorMessage: string): boolean => {
  const message = errorMessage.toLowerCase()
  return (
    message.includes("body exceeded") ||
    message.includes("body size limit") ||
    message.includes("request entity too large") ||
    message.includes("payload too large") ||
    message.includes("413") ||
    message.includes("maxrequestbodysize") ||
    message.includes("max request body size")
  )
}

const toUploadError = (error: unknown): string => {
  const message = error instanceof Error ? error.message : `${error}`
  if (isPayloadSizeError(message)) {
    return `Image must be ${PUBLIC_PAGE_SEO_IMAGE_MAX_SIZE_LABEL} or smaller.`
  }

  return message || "Unable to upload Open Graph image"
}

export const normalizePublicPageSeoConfig = (
  value: unknown,
): PublicPageSeoConfig => {
  const source = isObject(value) ? value : {}

  return {
    metaTitle: normalizeText(source.metaTitle),
    metaDescription: normalizeText(source.metaDescription),
    metaKeywords: normalizeText(source.metaKeywords),
    canonicalLink: normalizeText(source.canonicalLink),
    ogTitle: normalizeText(source.ogTitle),
    ogDescription: normalizeText(source.ogDescription),
    ogImage: normalizeText(source.ogImage),
    ogImageKey: normalizeText(source.ogImageKey),
    noIndex: normalizeBoolean(source.noIndex),
    noFollow: normalizeBoolean(source.noFollow),
    customHeadCode: "",
    customBodyCode: "",
  }
}

export const getPublicPageSeoFromStoredContent = (
  storedContent: unknown,
): PublicPageSeoConfig => {
  if (!isObject(storedContent)) {
    return DEFAULT_PUBLIC_PAGE_SEO_CONFIG
  }

  return normalizePublicPageSeoConfig(storedContent.seo)
}

export const resolvePublicPageSeoImageKey = (
  ogImage: string,
  ogImageKey: string,
): string => {
  if (ogImageKey.trim()) {
    return ogImageKey.trim()
  }

  if (!ogImage.trim()) {
    return ""
  }

  try {
    return getS3ObjectKeyFromUrl(ogImage) ?? ""
  } catch {
    return ""
  }
}

export const preparePublicPageSeoForStorage = (
  seo: unknown,
): PublicPageSeoConfig => {
  const normalizedSeo = normalizePublicPageSeoConfig(seo)
  const ogImageKey = resolvePublicPageSeoImageKey(
    normalizedSeo.ogImage,
    normalizedSeo.ogImageKey,
  )

  return {
    ...normalizedSeo,
    ogImage: ogImageKey ? "" : normalizedSeo.ogImage,
    ogImageKey,
  }
}

export const resolvePublicPageSeoForResponse = async (
  storedContent: unknown,
): Promise<PublicPageSeoConfig> => {
  const seo = getPublicPageSeoFromStoredContent(storedContent)
  const ogImageKey = resolvePublicPageSeoImageKey(seo.ogImage, seo.ogImageKey)

  if (!ogImageKey) {
    return seo
  }

  try {
    return {
      ...seo,
      ogImage: await createSignedS3ObjectUrl(ogImageKey),
      ogImageKey,
    }
  } catch (error) {
    logError("[public-page-seo] signed image url failed", error)
    return {
      ...seo,
      ogImageKey,
    }
  }
}

export const attachSeoToStoredContent = (
  storedContent: unknown,
  seo: unknown,
): unknown => {
  const normalizedSeo = preparePublicPageSeoForStorage(seo)

  if (typeof storedContent === "string") {
    return {
      content: storedContent,
      seo: normalizedSeo,
    }
  }

  if (isObject(storedContent)) {
    return {
      ...storedContent,
      seo: normalizedSeo,
    }
  }

  return {
    seo: normalizedSeo,
  }
}

export const uploadPublicPageSeoImageToS3 = async (
  input: PublicPageSeoUploadInput,
): Promise<PublicPageSeoUploadResult> => {
  const validationError = validateSeoImage(input.file)

  if (validationError) {
    return {
      ok: false,
      error: validationError,
    }
  }

  try {
    const currentSeo = normalizePublicPageSeoConfig(input.currentSeo)
    const previousImageKey = resolvePublicPageSeoImageKey(
      currentSeo.ogImage,
      currentSeo.ogImageKey,
    )
    const body = Buffer.from(await input.file.arrayBuffer())
    const uploadedImage = await uploadObjectToS3({
      key: createSeoImageObjectKey(input.file.type),
      body,
      contentType: input.file.type,
      cacheControl: SEO_IMAGE_CACHE_CONTROL,
    })
    const imageUrl = await createSignedS3ObjectUrl(uploadedImage.key)

    return {
      ok: true,
      imageUrl,
      imageKey: uploadedImage.key,
      previousImageKey,
      seo: {
        ...currentSeo,
        ogImage: imageUrl,
        ogImageKey: uploadedImage.key,
      },
    }
  } catch (error) {
    logError("[public-page-seo] upload failed", error)
    return {
      ok: false,
      error: toUploadError(error),
    }
  }
}

export const deletePublicPageSeoImageFromS3 = async (
  imageKey: string,
): Promise<{ ok: true } | { ok: false; error: string }> => {
  const normalizedKey = imageKey.trim()

  if (!normalizedKey) {
    return { ok: true }
  }

  try {
    await deleteObjectFromS3(normalizedKey)
    return { ok: true }
  } catch (error) {
    logError("[public-page-seo] delete failed", error)
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Unable to delete image",
    }
  }
}
