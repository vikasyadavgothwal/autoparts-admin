import type { HomePageConfig } from "@/types/admin-dashboard/public-pages/home-tabs-data"

export type HomeBannerImageUploadResult =
  | {
      ok: true
      data: HomePageConfig
      imageUrl: string
      imageKey: string
      previousImageKey: string
    }
  | {
      ok: false
      error: string
    }

export type HomeBannerImageUploadInput = {
  file: File
  currentContent: unknown
}

export type HomeBannerImageSignedUrlResult =
  | {
      ok: true
      key: string
      url: string
    }
  | {
      ok: false
      error: string
    }

export type HomeBannerImageSignedUrlApiResponse =
  | {
      ok: true
      key: string
      url: string
    }
  | {
      ok: false
      error: string
    }
