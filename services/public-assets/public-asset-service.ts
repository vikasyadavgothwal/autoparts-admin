import { createSignedS3ObjectUrl } from "@/lib/storage/s3"

const PUBLIC_ASSET_CACHE_CONTROL = "public, max-age=31536000, immutable"

const PUBLIC_ASSET_PREFIXES = [
  "home/banner/",
  "site-settings/logo/",
  "site-settings/favicon/",
] as const

export const isPublicAssetKey = (key: string) =>
  Boolean(key) &&
  !key.includes("..") &&
  PUBLIC_ASSET_PREFIXES.some((prefix) => key.startsWith(prefix))

export async function fetchPublicAssetByKey(key: string) {
  const normalizedKey = key.trim()

  if (!isPublicAssetKey(normalizedKey)) {
    return { ok: false as const, status: 404, message: "Asset not found." }
  }

  const signedUrl = await createSignedS3ObjectUrl(normalizedKey)
  const response = await fetch(signedUrl, { cache: "no-store" })

  if (!response.ok || !response.body) {
    return { ok: false as const, status: 404, message: "Asset not found." }
  }

  return {
    ok: true as const,
    body: response.body,
    contentType: response.headers.get("content-type") ?? "application/octet-stream",
    contentLength: response.headers.get("content-length"),
    cacheControl: PUBLIC_ASSET_CACHE_CONTROL,
  }
}
