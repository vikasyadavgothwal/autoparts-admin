import { Buffer } from "node:buffer"
import { randomUUID } from "node:crypto"
import { db } from "@/lib/database/prisma"
import {
  getS3ImageDisplayUrlFromKey,
  deleteObjectFromS3,
  uploadObjectToS3,
} from "@/lib/storage/s3"
import type { MainWebsiteSiteSettings } from "@/types/site-settings"

const MAIN_WEBSITE_SITE_SETTINGS_KEY = "main_website_site_settings"

export const DEFAULT_MAIN_WEBSITE_SITE_SETTINGS: MainWebsiteSiteSettings = {
  siteName: "AutoParts Pro",
  logoUrl: "",
  logoKey: "",
  faviconUrl: "",
  faviconKey: "",
  robotsTxt: [
    "User-agent: *",
    "Allow: /",
    "Disallow: /cart",
    "Disallow: /checkout",
    "Disallow: /dashboard",
    "Disallow: /login",
    "Sitemap: /sitemap.xml",
  ].join("\n"),
  copyright: "© 2026 DALEEL MUSAFFAH MARKETING SERVICES - SOLE PROPRIETORSHIP L.L.C.",
  seo: {
    title: "Auto Parts Pro",
    description: "Quality automotive parts, services, and fleet solutions.",
    keywords: "auto parts, car parts, automotive services, fleet solutions",
    canonicalUrl: "",
    noIndex: false,
    noFollow: false,
  },
  social: {
    facebook: "",
    instagram: "",
    x: "",
    youtube: "",
    linkedin: "",
  },
  contact: {
    phone: "+971585008555",
    email: "info@autoparts.ae",
    address: "Abu Dhabi, Abu Dhabi 147712",
  },
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)

const text = (value: unknown, fallback: string, maxLength: number) =>
  typeof value === "string" ? value.trim().slice(0, maxLength) : fallback

const bool = (value: unknown, fallback: boolean) =>
  typeof value === "boolean" ? value : fallback

const safeUrl = (value: unknown, fallback: string) => {
  const normalized = text(value, fallback, 500)
  if (!normalized) return ""
  try {
    const parsed = new URL(normalized)
    return parsed.protocol === "http:" || parsed.protocol === "https:"
      ? parsed.toString()
      : fallback
  } catch {
    return fallback
  }
}

const normalizeSettings = (value: unknown): MainWebsiteSiteSettings => {
  const source = isRecord(value) ? value : {}
  const seo = isRecord(source.seo) ? source.seo : {}
  const social = isRecord(source.social) ? source.social : {}
  const contact = isRecord(source.contact) ? source.contact : {}

  return {
    siteName: text(source.siteName, DEFAULT_MAIN_WEBSITE_SITE_SETTINGS.siteName, 120),
    logoUrl: safeUrl(source.logoUrl, DEFAULT_MAIN_WEBSITE_SITE_SETTINGS.logoUrl),
    logoKey: text(source.logoKey, DEFAULT_MAIN_WEBSITE_SITE_SETTINGS.logoKey, 500),
    faviconUrl: safeUrl(source.faviconUrl, DEFAULT_MAIN_WEBSITE_SITE_SETTINGS.faviconUrl),
    faviconKey: text(source.faviconKey, DEFAULT_MAIN_WEBSITE_SITE_SETTINGS.faviconKey, 500),
    robotsTxt: text(source.robotsTxt, DEFAULT_MAIN_WEBSITE_SITE_SETTINGS.robotsTxt, 12000),
    copyright: text(source.copyright, DEFAULT_MAIN_WEBSITE_SITE_SETTINGS.copyright, 240),
    seo: {
      title: text(seo.title, DEFAULT_MAIN_WEBSITE_SITE_SETTINGS.seo.title, 160),
      description: text(seo.description, DEFAULT_MAIN_WEBSITE_SITE_SETTINGS.seo.description, 320),
      keywords: text(seo.keywords, DEFAULT_MAIN_WEBSITE_SITE_SETTINGS.seo.keywords, 500),
      canonicalUrl: safeUrl(seo.canonicalUrl, DEFAULT_MAIN_WEBSITE_SITE_SETTINGS.seo.canonicalUrl),
      noIndex: bool(seo.noIndex, DEFAULT_MAIN_WEBSITE_SITE_SETTINGS.seo.noIndex),
      noFollow: bool(seo.noFollow, DEFAULT_MAIN_WEBSITE_SITE_SETTINGS.seo.noFollow),
    },
    social: {
      facebook: safeUrl(social.facebook, DEFAULT_MAIN_WEBSITE_SITE_SETTINGS.social.facebook),
      instagram: safeUrl(social.instagram, DEFAULT_MAIN_WEBSITE_SITE_SETTINGS.social.instagram),
      x: safeUrl(social.x, DEFAULT_MAIN_WEBSITE_SITE_SETTINGS.social.x),
      youtube: safeUrl(social.youtube, DEFAULT_MAIN_WEBSITE_SITE_SETTINGS.social.youtube),
      linkedin: safeUrl(social.linkedin, DEFAULT_MAIN_WEBSITE_SITE_SETTINGS.social.linkedin),
    },
    contact: {
      phone: text(contact.phone, DEFAULT_MAIN_WEBSITE_SITE_SETTINGS.contact.phone, 40),
      email: text(contact.email, DEFAULT_MAIN_WEBSITE_SITE_SETTINGS.contact.email, 254).toLowerCase(),
      address: text(contact.address, DEFAULT_MAIN_WEBSITE_SITE_SETTINGS.contact.address, 240),
    },
  }
}

export async function getMainWebsiteSiteSettings() {
  const row = await db.platformSetting.findUnique({
    where: { key: MAIN_WEBSITE_SITE_SETTINGS_KEY },
  })
  if (!row?.value) return DEFAULT_MAIN_WEBSITE_SITE_SETTINGS

  try {
    const settings = normalizeSettings(JSON.parse(row.value))
    const [logoUrl, faviconUrl] = await Promise.all([
      resolveStoredAssetUrl(settings.logoKey, settings.logoUrl),
      resolveStoredAssetUrl(settings.faviconKey, settings.faviconUrl),
    ])
    return { ...settings, logoUrl, faviconUrl }
  } catch {
    return DEFAULT_MAIN_WEBSITE_SITE_SETTINGS
  }
}

async function resolveStoredAssetUrl(key: string, fallback: string) {
  if (!key) return fallback
  try {
    return getS3ImageDisplayUrlFromKey(key)
  } catch {
    return fallback
  }
}

export async function setMainWebsiteSiteSettings(input: unknown) {
  const settings = normalizeSettings(input)
  await db.platformSetting.upsert({
    where: { key: MAIN_WEBSITE_SITE_SETTINGS_KEY },
    create: { key: MAIN_WEBSITE_SITE_SETTINGS_KEY, value: JSON.stringify(settings) },
    update: { value: JSON.stringify(settings) },
  })
  return settings
}

export type MainWebsiteAssetKind = "logo" | "favicon"

const ASSET_RULES: Record<MainWebsiteAssetKind, { maxBytes: number; types: readonly string[] }> = {
  logo: { maxBytes: 5 * 1024 * 1024, types: ["image/svg+xml", "image/png", "image/jpeg", "image/webp"] },
  favicon: { maxBytes: 1 * 1024 * 1024, types: ["image/x-icon", "image/vnd.microsoft.icon", "image/svg+xml", "image/png", "image/webp"] },
}

export async function uploadMainWebsiteAsset(file: File, kind: MainWebsiteAssetKind) {
  const rule = ASSET_RULES[kind]
  if (!rule.types.includes(file.type)) {
    throw new Error(kind === "logo" ? "Upload an SVG, PNG, JPG, or WebP logo." : "Upload an ICO, SVG, PNG, or WebP favicon.")
  }
  if (!file.size || file.size > rule.maxBytes) {
    throw new Error(kind === "logo" ? "Logo must be 5 MB or smaller." : "Favicon must be 1 MB or smaller.")
  }

  const current = await getMainWebsiteSiteSettings()
  const keyField = kind === "logo" ? "logoKey" : "faviconKey"
  const urlField = kind === "logo" ? "logoUrl" : "faviconUrl"
  const uploaded = await uploadObjectToS3({
    key: `site-settings/${kind}/${new Date().toISOString().slice(0, 10)}/${randomUUID()}`,
    body: Buffer.from(await file.arrayBuffer()),
    contentType: file.type,
    cacheControl: "public, max-age=31536000, immutable",
  })
  const displayUrl = getS3ImageDisplayUrlFromKey(uploaded.key)
  const saved = await setMainWebsiteSiteSettings({
    ...current,
    [keyField]: uploaded.key,
    [urlField]: uploaded.objectUrl,
  })

  const previousKey = current[keyField]
  if (previousKey && previousKey !== uploaded.key) {
    try {
      await deleteObjectFromS3(previousKey)
    } catch {
      // Keep the new asset active if cleanup of the previous object fails.
    }
  }

  return { settings: { ...saved, [urlField]: displayUrl, [keyField]: uploaded.key } }
}

export async function removeMainWebsiteAsset(kind: MainWebsiteAssetKind) {
  const current = await getMainWebsiteSiteSettings()
  const keyField = kind === "logo" ? "logoKey" : "faviconKey"
  const urlField = kind === "logo" ? "logoUrl" : "faviconUrl"
  const previousKey = current[keyField]
  const settings = await setMainWebsiteSiteSettings({
    ...current,
    [keyField]: "",
    [urlField]: "",
  })

  if (previousKey) {
    try {
      await deleteObjectFromS3(previousKey)
    } catch {
      // Keep the setting cleared if cleanup of the old object fails.
    }
  }

  return { settings }
}
