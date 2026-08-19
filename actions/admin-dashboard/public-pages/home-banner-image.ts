"use server"

import { logError } from "@/lib/logger"
import { revalidatePath } from "next/cache"
import { getCurrentAdminSession } from "@/actions/admin-auth/me"
import {
  requireAdminPermission,
} from "@/lib/auth/admin-guard"
import { ADMIN_CONTENT_EDIT_PERMISSION } from "@/lib/auth/admin-permissions"
import { saveHomePageContent } from "@/actions/admin-dashboard/public-pages/public-content"
import {
  HOME_BANNER_IMAGE_MAX_SIZE_LABEL,
} from "@/services/admin-dashboard/public-pages/home-tabs-data"
import {
  createHomeBannerImageSignedUrl,
  deleteHomeBannerImageFromS3,
  uploadHomeBannerImageToS3,
} from "@/services/admin-dashboard/public-pages/home-banner-image"
import type {
  HomeBannerImageSignedUrlResult,
  HomeBannerImageUploadResult,
} from "@/types/admin-dashboard/public-pages/home-banner-image"

const HOME_PAGE_ROUTE = "/pages/home-page"
const IMAGE_FIELD = "image"
const CONTENT_FIELD = "content"

type ParsedContentResult =
  | {
      ok: true
      content: unknown
    }
  | {
      ok: false
      error: string
    }

const isFormFile = (value: FormDataEntryValue | null): value is File =>
  typeof File !== "undefined" && value instanceof File

const parseHomeContent = (
  value: FormDataEntryValue | null,
): ParsedContentResult => {
  if (typeof value !== "string") {
    return {
      ok: false,
      error: "Home page content payload is required.",
    }
  }

  try {
    return {
      ok: true,
      content: JSON.parse(value),
    }
  } catch {
    return {
      ok: false,
      error: "Home page content payload is invalid.",
    }
  }
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
    return `Image must be ${HOME_BANNER_IMAGE_MAX_SIZE_LABEL} or smaller.`
  }
  return message || "Unable to upload banner image"
}

export async function uploadHomeBannerImage(
  formData: FormData,
): Promise<HomeBannerImageUploadResult> {
  const authorization = await requireAdminPermission(ADMIN_CONTENT_EDIT_PERMISSION)
  if (!authorization.ok) {
    return authorization
  }

  const image = formData.get(IMAGE_FIELD)
  if (!isFormFile(image)) {
    return {
      ok: false,
      error: "Image file is required.",
    }
  }

  const parsedContent = parseHomeContent(formData.get(CONTENT_FIELD))
  if (!parsedContent.ok) {
    return parsedContent
  }

  try {
    const uploadResult = await uploadHomeBannerImageToS3({
      file: image,
      currentContent: parsedContent.content,
    })

    if (!uploadResult.ok) {
      return uploadResult
    }

    const saveResult = await saveHomePageContent({
      content: uploadResult.data,
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
      const deletionResult = await deleteHomeBannerImageFromS3(
        uploadResult.previousImageKey,
      )

      if (!deletionResult.ok) {
        console.warn("[home-banner-image] unable to remove previous image", {
          previousImageKey: uploadResult.previousImageKey,
          error: deletionResult.error,
        })
      }
    }

    revalidatePath(HOME_PAGE_ROUTE)

    return {
      ok: true,
      imageUrl: uploadResult.imageUrl,
      imageKey: uploadResult.imageKey,
      previousImageKey: uploadResult.previousImageKey,
      data: saveResult.data,
    }
  } catch (error) {
    logError("[home-banner-image] uploadHomeBannerImage failed", error)
    return { ok: false, error: toUploadError(error) }
  }
}

export async function getHomeBannerImageSignedUrl(
  key: string | null,
): Promise<HomeBannerImageSignedUrlResult> {
  const actor = await getCurrentAdminSession()

  if (!actor.ok) {
    return {
      ok: false,
      error: "Unauthorized",
    }
  }

  if (!actor.admin.isActive) {
    return {
      ok: false,
      error: "Admin is deactivated",
    }
  }

  return createHomeBannerImageSignedUrl(key)
}
