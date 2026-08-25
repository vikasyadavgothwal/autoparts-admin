import { Buffer } from "node:buffer"
import { randomUUID } from "node:crypto"
import { logError } from "@/lib/logger"
import {
  deleteObjectFromS3,
  getS3ImageDisplayUrlFromKey,
  getS3ObjectKeyFromUrl,
  uploadObjectToS3,
} from "@/lib/storage/s3"
import {
  HOME_BANNER_IMAGE_ACCEPTED_TYPES,
  HOME_BANNER_IMAGE_MAX_BYTES,
  HOME_BANNER_IMAGE_MAX_SIZE_LABEL,
} from "@/services/admin-dashboard/public-pages/home-tabs-data"
import { resolveHomePageConfigFromDb } from "@/services/admin-dashboard/public-pages/public-page-content"
import type {
  HomeBannerImageUploadInput,
  HomeBannerImageUploadResult,
  HomeBannerImageSignedUrlResult,
} from "@/types/admin-dashboard/public-pages/home-banner-image"
import type { HomePageConfig } from "@/types/admin-dashboard/public-pages/home-tabs-data"

const HOME_BANNER_DEFAULT_PREFIX = "home/banner"
const HOME_BANNER_CACHE_CONTROL = "public, max-age=31536000, immutable"

const IMAGE_EXTENSION_BY_TYPE: Record<
  (typeof HOME_BANNER_IMAGE_ACCEPTED_TYPES)[number],
  string
> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
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

const toErrorMessage = (error: unknown): string => {
  const message = error instanceof Error ? error.message : `${error}`
  if (isPayloadSizeError(message)) {
    return `Image must be ${HOME_BANNER_IMAGE_MAX_SIZE_LABEL} or smaller.`
  }

  return message || "Unable to upload banner image"
}

const getHomeBannerUploadPrefix = (): string => {
  const configuredPrefix =
    process.env.AWS_S3_HOME_BANNER_PREFIX?.trim() ||
    process.env.S3_HOME_BANNER_PREFIX?.trim()

  return (configuredPrefix || HOME_BANNER_DEFAULT_PREFIX)
    .replace(/^\/+|\/+$/g, "")
    .replace(/\/{2,}/g, "/")
}

const isAcceptedImageType = (
  contentType: string,
): contentType is (typeof HOME_BANNER_IMAGE_ACCEPTED_TYPES)[number] =>
  HOME_BANNER_IMAGE_ACCEPTED_TYPES.includes(
    contentType as (typeof HOME_BANNER_IMAGE_ACCEPTED_TYPES)[number],
  )

const validateHomeBannerImage = (file: File): string | null => {
  if (!file.size) {
    return "Image file is required."
  }

  if (!isAcceptedImageType(file.type)) {
    return "Upload a JPG, PNG, WebP, or GIF image."
  }

  if (file.size > HOME_BANNER_IMAGE_MAX_BYTES) {
    return `Image must be ${HOME_BANNER_IMAGE_MAX_SIZE_LABEL} or smaller.`
  }

  return null
}

const createHomeBannerObjectKey = (contentType: File["type"]): string => {
  const extension = isAcceptedImageType(contentType)
    ? IMAGE_EXTENSION_BY_TYPE[contentType]
    : "bin"
  const datePath = new Date().toISOString().slice(0, 10)

  return `${getHomeBannerUploadPrefix()}/${datePath}/${randomUUID()}.${extension}`
}

export const resolveHomeBannerImageKey = (
  backgroundImage: string,
  backgroundImageKey: string,
): string => {
  if (backgroundImageKey.trim()) {
    return backgroundImageKey.trim()
  }

  if (!backgroundImage.trim()) {
    return ""
  }

  return getS3ObjectKeyFromUrl(backgroundImage) ?? ""
}

const toDeleteResult = (error: unknown): string =>
  error instanceof Error ? error.message : "Unable to delete banner image"

export const deleteHomeBannerImageFromS3 = async (
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
    logError("[home-banner-image] delete failed", error)
    return { ok: false, error: toDeleteResult(error) }
  }
}

const withHomeBannerImageUrl = (
  currentContent: unknown,
  imageUrl: string,
  imageKey: string,
): HomePageConfig => {
  const normalizedContent = resolveHomePageConfigFromDb(currentContent)

  return {
    ...normalizedContent,
    banner: {
      ...normalizedContent.banner,
      backgroundImage: imageUrl,
      backgroundImageKey: imageKey,
    },
  }
}

export const prepareHomePageConfigForStorage = (
  content: unknown,
): HomePageConfig => {
  const normalizedContent = resolveHomePageConfigFromDb(content)
  const backgroundImageKey = resolveHomeBannerImageKey(
    normalizedContent.banner.backgroundImage,
    normalizedContent.banner.backgroundImageKey,
  )

  return {
    ...normalizedContent,
    banner: {
      ...normalizedContent.banner,
      backgroundImage: backgroundImageKey
        ? ""
        : normalizedContent.banner.backgroundImage,
      backgroundImageKey,
    },
  }
}

export const resolveHomePageBannerSignedUrl = async (
  content: unknown,
): Promise<HomePageConfig> => {
  const normalizedContent = resolveHomePageConfigFromDb(content)
  const backgroundImageKey = resolveHomeBannerImageKey(
    normalizedContent.banner.backgroundImage,
    normalizedContent.banner.backgroundImageKey,
  )

  if (!backgroundImageKey) {
    return normalizedContent
  }

  const signedUrl = getS3ImageDisplayUrlFromKey(backgroundImageKey)

  return {
    ...normalizedContent,
    banner: {
      ...normalizedContent.banner,
      backgroundImage: signedUrl,
      backgroundImageKey,
    },
  }
}

export const createHomeBannerImageSignedUrl = async (
  key: string | null,
): Promise<HomeBannerImageSignedUrlResult> => {
  const normalizedKey = key?.trim()

  if (!normalizedKey) {
    return {
      ok: false,
      error: "Image key is required.",
    }
  }

  try {
    const url = getS3ImageDisplayUrlFromKey(normalizedKey)

    return {
      ok: true,
      key: normalizedKey,
      url,
    }
  } catch (error) {
    logError("[home-banner-image] signed url failed", error)
    return {
      ok: false,
      error: toErrorMessage(error),
    }
  }
}

export const uploadHomeBannerImageToS3 = async (
  input: HomeBannerImageUploadInput,
): Promise<HomeBannerImageUploadResult> => {
  const validationError = validateHomeBannerImage(input.file)

  if (validationError) {
    return {
      ok: false,
      error: validationError,
    }
  }

  try {
    const normalizedContent = resolveHomePageConfigFromDb(input.currentContent)
    const previousImageKey = resolveHomeBannerImageKey(
      normalizedContent.banner.backgroundImage,
      normalizedContent.banner.backgroundImageKey,
    )
    const body = Buffer.from(await input.file.arrayBuffer())
    const uploadedImage = await uploadObjectToS3({
      key: createHomeBannerObjectKey(input.file.type),
      body,
      contentType: input.file.type,
      cacheControl: HOME_BANNER_CACHE_CONTROL,
    })
    const imageUrl = getS3ImageDisplayUrlFromKey(uploadedImage.key)

    return {
      ok: true,
      imageUrl,
      imageKey: uploadedImage.key,
      previousImageKey,
      data: withHomeBannerImageUrl(
        input.currentContent,
        uploadedImage.objectUrl,
        uploadedImage.key,
      ),
    }
  } catch (error) {
    logError("[home-banner-image] upload failed", error)
    return {
      ok: false,
      error: toErrorMessage(error),
    }
  }
}
