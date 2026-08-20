"use client"

import { useEffect, useState } from "react"
import { Copyright, ExternalLink, Globe2, Image as ImageIcon, Link2, Mail, Save, Search, Trash2, UploadCloud } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { MainWebsiteSiteSettings } from "@/types/site-settings"

const EMPTY_SETTINGS: MainWebsiteSiteSettings = {
  siteName: "",
  logoUrl: "",
  logoKey: "",
  faviconUrl: "",
  faviconKey: "",
  robotsTxt: "",
  copyright: "",
  seo: { title: "", description: "", keywords: "", canonicalUrl: "", noIndex: false, noFollow: false },
  social: { facebook: "", instagram: "", x: "", youtube: "", linkedin: "" },
  contact: { phone: "", email: "", address: "" },
}

const SITE_SETTINGS_TABS = [
  { key: "brand", label: "Brand assets", icon: ImageIcon },
  { key: "seo", label: "Robots.txt", icon: Search },
  { key: "social", label: "Social media", icon: Link2 },
  { key: "contact", label: "Contact info", icon: Mail },
  { key: "copyright", label: "Copyright", icon: Copyright },
] as const

type SiteSettingsTabKey = (typeof SITE_SETTINGS_TABS)[number]["key"]

const PHONE_COUNTRIES = [
  { country: "UAE", code: "+971", digits: 9 },
  { country: "India", code: "+91", digits: 10 },
  { country: "Saudi Arabia", code: "+966", digits: 9 },
  { country: "United States", code: "+1", digits: 10 },
  { country: "United Kingdom", code: "+44", digits: 10 },
  { country: "Oman", code: "+968", digits: 8 },
  { country: "Qatar", code: "+974", digits: 8 },
  { country: "Bahrain", code: "+973", digits: 8 },
  { country: "Kuwait", code: "+965", digits: 8 },
] as const

const DEFAULT_PHONE_COUNTRY = PHONE_COUNTRIES[0]
type PhoneCountryCode = (typeof PHONE_COUNTRIES)[number]["code"]
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const ASSET_RULES: Record<"logo" | "favicon", { maxBytes: number; types: readonly string[] }> = {
  logo: { maxBytes: 5 * 1024 * 1024, types: ["image/svg+xml", "image/png", "image/jpeg", "image/webp"] },
  favicon: { maxBytes: 1 * 1024 * 1024, types: ["image/x-icon", "image/vnd.microsoft.icon", "image/svg+xml", "image/png", "image/webp"] },
}

function phoneCountryFor(value: string) {
  const normalized = value.trim()
  return PHONE_COUNTRIES.find((country) => normalized.startsWith(country.code)) ?? DEFAULT_PHONE_COUNTRY
}

function selectedPhoneCountry(code: string) {
  return PHONE_COUNTRIES.find((country) => country.code === code) ?? DEFAULT_PHONE_COUNTRY
}

function phoneLocalNumber(value: string, countryCode: string) {
  const digits = value.replace(/\D/g, "")
  const countryDigits = countryCode.replace(/\D/g, "")
  return digits.startsWith(countryDigits) ? digits.slice(countryDigits.length) : digits
}

function hasHttpUrl(value: string) {
  if (!value) return true
  try {
    const url = new URL(value)
    return url.protocol === "http:" || url.protocol === "https:"
  } catch {
    return false
  }
}

function cleanSettings(settings: MainWebsiteSiteSettings): MainWebsiteSiteSettings {
  return {
    ...settings,
    siteName: settings.siteName.trim(),
    robotsTxt: settings.robotsTxt.trim(),
    copyright: settings.copyright.trim(),
    seo: {
      ...settings.seo,
      title: settings.seo.title.trim(),
      description: settings.seo.description.trim(),
      keywords: settings.seo.keywords.trim(),
      canonicalUrl: settings.seo.canonicalUrl.trim(),
    },
    social: {
      facebook: settings.social.facebook.trim(),
      instagram: settings.social.instagram.trim(),
      x: settings.social.x.trim(),
      youtube: settings.social.youtube.trim(),
      linkedin: settings.social.linkedin.trim(),
    },
    contact: {
      phone: settings.contact.phone.trim(),
      email: settings.contact.email.trim().toLowerCase(),
      address: settings.contact.address.trim(),
    },
  }
}

function validateSettings(settings: MainWebsiteSiteSettings, phoneCountryCode: PhoneCountryCode) {
  const country = selectedPhoneCountry(phoneCountryCode)
  const localPhone = phoneLocalNumber(settings.contact.phone, country.code)
  const socialEntries = Object.entries(settings.social)
  const invalidSocial = socialEntries.find(([, value]) => value && !hasHttpUrl(value))

  if (settings.robotsTxt.length > 12000) return "robots.txt must be 12,000 characters or fewer."
  if (settings.copyright.length > 240) return "Copyright text must be 240 characters or fewer."
  if (invalidSocial) return `${invalidSocial[0]} must be a valid http or https URL.`
  if (!settings.contact.phone) return "Mobile number is required."
  if (localPhone.length !== country.digits) return `${country.country} mobile number must be ${country.digits} digits.`
  if (!settings.contact.email) return "Contact email is required."
  if (!EMAIL_PATTERN.test(settings.contact.email)) return "Enter a valid contact email."
  if (!settings.contact.address) return "Contact address is required."
  return ""
}

const publicWebsiteOrigin = (
  process.env.NEXT_PUBLIC_MAIN_WEBSITE_URL?.trim() ||
  process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
  (process.env.NODE_ENV === "production" ? "https://websitedesignersdubai.ae" : "http://localhost:3001")
).replace(/\/+$/, "")

type TextareaProps = React.ComponentProps<"textarea"> & { label: React.ReactNode }

function TextareaField({ label, id, className, ...props }: TextareaProps) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <textarea
        id={id}
        className={`min-h-24 w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 ${className ?? ""}`}
        {...props}
      />
    </div>
  )
}

function AssetCard({
  kind,
  url,
  hasAsset,
  uploading,
  onUpload,
  onRemove,
}: {
  kind: "logo" | "favicon"
  url: string
  hasAsset: boolean
  uploading: boolean
  onUpload: (file: File | undefined) => void
  onRemove: () => void
}) {
  const isLogo = kind === "logo"
  const inputId = `${kind}-file`
  return (
    <div className="rounded-xl border border-[#2A2A2A] bg-[#111111] p-4">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <p className="font-medium text-white">{isLogo ? "Logo" : "Favicon"}</p>
          <p className="mt-1 text-xs text-[#9CA3AF]">{hasAsset ? "Active asset" : "Text fallback is active"}</p>
        </div>
        <span className="rounded-full border border-[#2A2A2A] px-2 py-1 text-[11px] text-[#9CA3AF]">
          {isLogo ? "5 MB max" : "1 MB max"}
        </span>
      </div>
      <div className="flex min-h-28 items-center justify-center rounded-lg border border-dashed border-[#3A3A3A] bg-[#0A0A0A] p-4">
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt={`Current ${kind}`} className={isLogo ? "h-14 max-w-[240px] object-contain" : "size-14 object-contain"} />
        ) : (
          <span className="text-lg font-semibold text-white">AutoParts<span className="text-[#DC2626]">Pro</span></span>
        )}
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <Input
          id={inputId}
          type="file"
          accept={isLogo ? "image/svg+xml,image/png,image/jpeg,image/webp" : "image/x-icon,image/vnd.microsoft.icon,image/svg+xml,image/png,image/webp"}
          className="sr-only"
          disabled={uploading}
          onChange={(event) => { onUpload(event.target.files?.[0]); event.currentTarget.value = "" }}
        />
        <Button type="button" variant="outline" asChild disabled={uploading} className="gap-2">
          <label htmlFor={inputId} className="cursor-pointer"><UploadCloud className="size-4" />{uploading ? "Uploading..." : `Upload ${kind}`}</label>
        </Button>
        {hasAsset ? (
          <Button type="button" variant="ghost" disabled={uploading} onClick={onRemove} className="gap-2 text-red-300 hover:bg-red-500/10 hover:text-red-200">
            <Trash2 className="size-4" />Remove
          </Button>
        ) : null}
      </div>
    </div>
  )
}

export function SiteSettingsManager() {
  const [settings, setSettings] = useState(EMPTY_SETTINGS)
  const [activeTab, setActiveTab] = useState<SiteSettingsTabKey>(SITE_SETTINGS_TABS[0].key)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploadingAsset, setUploadingAsset] = useState<"logo" | "favicon" | null>(null)
  const [phoneCountryCode, setPhoneCountryCode] = useState<PhoneCountryCode>(DEFAULT_PHONE_COUNTRY.code)

  useEffect(() => {
    void fetch("/api/v1/admin/platform-settings", { cache: "no-store" })
      .then(async (response) => {
        const payload = (await response.json()) as { ok?: boolean; siteSettings?: MainWebsiteSiteSettings; message?: string }
        if (!response.ok || !payload.ok || !payload.siteSettings) {
          throw new Error(payload.message ?? "Unable to load site settings")
        }
        setSettings(payload.siteSettings)
        setPhoneCountryCode(phoneCountryFor(payload.siteSettings.contact.phone).code)
      })
      .catch((error) => toast.error(error instanceof Error ? error.message : "Unable to load site settings"))
      .finally(() => setLoading(false))
  }, [])

  const update = (path: string, value: string | boolean) => {
    setSettings((current) => {
      if (!path.includes(".")) return { ...current, [path]: value } as MainWebsiteSiteSettings
      const [group, field] = path.split(".") as ["seo" | "social" | "contact", string]
      return { ...current, [group]: { ...current[group], [field]: value } }
    })
  }

  async function uploadAsset(kind: "logo" | "favicon", file: File | undefined) {
    if (!file) return
    const rule = ASSET_RULES[kind]
    if (!rule.types.includes(file.type)) {
      toast.error(kind === "logo" ? "Upload an SVG, PNG, JPG, or WebP logo." : "Upload an ICO, SVG, PNG, or WebP favicon.")
      return
    }
    if (!file.size || file.size > rule.maxBytes) {
      toast.error(kind === "logo" ? "Logo must be 5 MB or smaller." : "Favicon must be 1 MB or smaller.")
      return
    }
    setUploadingAsset(kind)
    try {
      const body = new FormData()
      body.set("kind", kind)
      body.set("file", file)
      const response = await fetch("/api/v1/admin/platform-settings/assets", { method: "POST", body })
      const payload = (await response.json().catch(() => ({}))) as {
        ok?: boolean
        settings?: MainWebsiteSiteSettings
        message?: string
      }
      if (!response.ok || !payload.ok || !payload.settings) {
        throw new Error(payload.message ?? `Unable to upload ${kind}`)
      }
      setSettings(payload.settings)
      toast.success(`${kind === "logo" ? "Logo" : "Favicon"} uploaded.`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : `Unable to upload ${kind}`)
    } finally {
      setUploadingAsset(null)
    }
  }

  async function removeAsset(kind: "logo" | "favicon") {
    setUploadingAsset(kind)
    try {
      const response = await fetch(`/api/v1/admin/platform-settings/assets?kind=${kind}`, { method: "DELETE" })
      const payload = (await response.json().catch(() => ({}))) as {
        ok?: boolean
        settings?: MainWebsiteSiteSettings
        message?: string
      }
      if (!response.ok || !payload.ok || !payload.settings) {
        throw new Error(payload.message ?? `Unable to remove ${kind}`)
      }
      setSettings(payload.settings)
      toast.success(`${kind === "logo" ? "Logo" : "Favicon"} removed.`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : `Unable to remove ${kind}`)
    } finally {
      setUploadingAsset(null)
    }
  }

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!event.currentTarget.checkValidity()) {
      event.currentTarget.reportValidity()
      return
    }
    const nextSettings = cleanSettings({
      ...settings,
      contact: { ...settings.contact, phone: `${phoneCountry.code}${localPhone}` },
    })
    const validationError = validateSettings(nextSettings, phoneCountryCode)
    if (validationError) {
      toast.error(validationError)
      return
    }
    setSaving(true)
    try {
      const response = await fetch("/api/v1/admin/platform-settings", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ siteSettings: nextSettings }),
      })
      const payload = (await response.json().catch(() => ({}))) as {
        ok?: boolean
        siteSettings?: MainWebsiteSiteSettings
        message?: string
      }
      if (!response.ok || !payload.ok || !payload.siteSettings) {
        throw new Error(payload.message ?? "Unable to save site settings")
      }
      setSettings(payload.siteSettings)
      toast.success("Website settings saved.")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to save site settings")
    } finally {
      setSaving(false)
    }
  }

  const phoneCountry = selectedPhoneCountry(phoneCountryCode)
  const localPhone = phoneLocalNumber(settings.contact.phone, phoneCountry.code).slice(0, phoneCountry.digits)

  function updatePhoneCountry(code: string) {
    const nextCountry = selectedPhoneCountry(code)
    const nextLocalPhone = localPhone.slice(0, nextCountry.digits)
    setPhoneCountryCode(nextCountry.code)
    update("contact.phone", `${nextCountry.code}${nextLocalPhone}`)
  }

  function updateLocalPhone(value: string) {
    const digits = value.replace(/\D/g, "").slice(0, phoneCountry.digits)
    update("contact.phone", `${phoneCountry.code}${digits}`)
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-medium uppercase tracking-wide text-[#9CA3AF]">Main website</p>
        <h1 className="mt-2 text-3xl font-bold text-white">Site Settings</h1>
      </div>

      <form onSubmit={save} noValidate={false}>
        <div className="grid gap-4 lg:grid-cols-[240px_1fr]">
          <aside className="space-y-2 rounded-lg border border-[#2A2A2A] bg-[#0A0A0A] p-2">
            {SITE_SETTINGS_TABS.map((tab) => {
              const Icon = tab.icon
              const isActive = activeTab === tab.key
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveTab(tab.key)}
                  className={`flex w-full items-center gap-2 rounded-md px-4 py-3 text-left font-medium transition ${
                    isActive
                      ? "bg-[#DC2626] text-white"
                      : "bg-transparent text-[#9CA3AF] hover:bg-[#1A1A1A] hover:text-white"
                  }`}
                >
                  <Icon className="size-4" />
                  {tab.label}
                </button>
              )
            })}
          </aside>

          <section>

          {activeTab === "brand" ? (
            <Card className="border-[#2A2A2A] bg-[#1A1A1A] shadow-none">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-white"><Globe2 className="size-5 text-[#DC2626]" /> Brand assets</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-5 md:grid-cols-2">
                <AssetCard kind="logo" url={settings.logoUrl} hasAsset={Boolean(settings.logoUrl || settings.logoKey)} uploading={uploadingAsset === "logo"} onUpload={(file) => { void uploadAsset("logo", file) }} onRemove={() => { void removeAsset("logo") }} />
                <AssetCard kind="favicon" url={settings.faviconUrl} hasAsset={Boolean(settings.faviconUrl || settings.faviconKey)} uploading={uploadingAsset === "favicon"} onUpload={(file) => { void uploadAsset("favicon", file) }} onRemove={() => { void removeAsset("favicon") }} />
              </CardContent>
            </Card>
          ) : null}

          {activeTab === "seo" ? (
            <Card className="border-[#2A2A2A] bg-[#1A1A1A] shadow-none">
              <CardHeader><CardTitle className="flex items-center gap-2 text-white"><Search className="size-5 text-[#DC2626]" /> robots.txt</CardTitle></CardHeader>
              <CardContent className="space-y-5">
                <TextareaField id="robots-txt" label="robots.txt" value={settings.robotsTxt} onChange={(event) => update("robotsTxt", event.target.value)} maxLength={12000} rows={10} spellCheck={false} className="font-mono" />
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" asChild className="gap-2">
                    <a href={`${publicWebsiteOrigin}/robots.txt`} target="_blank" rel="noreferrer"><ExternalLink className="size-4" />View robots.txt</a>
                  </Button>
                  <Button type="button" variant="outline" asChild className="gap-2">
                    <a href={`${publicWebsiteOrigin}/sitemap.xml`} target="_blank" rel="noreferrer"><ExternalLink className="size-4" />View sitemap.xml</a>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : null}

          {activeTab === "social" ? (
            <Card className="border-[#2A2A2A] bg-[#1A1A1A] shadow-none">
              <CardHeader><CardTitle className="flex items-center gap-2 text-white"><Link2 className="size-5 text-[#DC2626]" /> Social media</CardTitle></CardHeader>
              <CardContent className="grid gap-5 md:grid-cols-2">
                {(["facebook", "instagram", "x", "youtube", "linkedin"] as const).map((network) => (
                  <div className="space-y-2" key={network}><Label htmlFor={`social-${network}`}>{network === "x" ? "X (Twitter)" : network[0].toUpperCase() + network.slice(1)}</Label><Input id={`social-${network}`} type="url" value={settings.social[network]} onChange={(event) => update(`social.${network}`, event.target.value)} maxLength={500} placeholder="https://" /></div>
                ))}
              </CardContent>
            </Card>
          ) : null}

          {activeTab === "contact" ? (
            <Card className="border-[#2A2A2A] bg-[#1A1A1A] shadow-none">
              <CardHeader><CardTitle className="flex items-center gap-2 text-white"><Mail className="size-5 text-[#DC2626]" /> Contact info</CardTitle></CardHeader>
              <CardContent className="grid gap-5 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="contact-phone">Mobile <span className="text-[#DC2626]">*</span></Label>
                  <div className="grid grid-cols-[140px_minmax(0,1fr)] gap-2">
                    <Select value={phoneCountry.code} onValueChange={updatePhoneCountry}>
                      <SelectTrigger className="h-10 w-full border-[#2A2A2A] bg-[#0A0A0A] text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="border-[#2A2A2A] bg-[#111111] text-white">
                        {PHONE_COUNTRIES.map((country) => (
                          <SelectItem key={country.code} value={country.code}>{country.country} {country.code}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      id="contact-phone"
                      type="tel"
                      inputMode="numeric"
                      pattern={`\\d{${phoneCountry.digits}}`}
                      value={localPhone}
                      onChange={(event) => updateLocalPhone(event.target.value)}
                      maxLength={phoneCountry.digits}
                      required
                      placeholder={"0".repeat(phoneCountry.digits)}
                    />
                  </div>
                  <p className="text-xs text-[#9CA3AF]">{phoneCountry.digits} digits required.</p>
                </div>
                <div className="space-y-2"><Label htmlFor="contact-email">Email <span className="text-[#DC2626]">*</span></Label><Input id="contact-email" type="email" value={settings.contact.email} onChange={(event) => update("contact.email", event.target.value)} maxLength={254} required placeholder="info@example.com" /></div>
                <TextareaField id="contact-address" label={<>Address <span className="text-[#DC2626]">*</span></>} value={settings.contact.address} onChange={(event) => update("contact.address", event.target.value)} maxLength={240} required className="md:col-span-2" placeholder="Abu Dhabi, UAE" />
              </CardContent>
            </Card>
          ) : null}
          {activeTab === "copyright" ? (
            <Card className="border-[#2A2A2A] bg-[#1A1A1A] shadow-none">
              <CardHeader><CardTitle className="flex items-center gap-2 text-white"><Copyright className="size-5 text-[#DC2626]" /> Copyright</CardTitle></CardHeader>
              <CardContent>
                <TextareaField id="copyright" label="Copyright text" value={settings.copyright} onChange={(event) => update("copyright", event.target.value)} maxLength={240} rows={3} placeholder="© 2026 AutoParts Pro" />
              </CardContent>
            </Card>
          ) : null}
          </section>
        </div>

        <div className="mt-6 flex items-center justify-between gap-4 rounded-lg border border-[#2A2A2A] bg-[#1A1A1A] p-4">
          <p className="text-sm text-[#9CA3AF]">{loading ? "Loading current site settings..." : "Changes apply to the public website after saving."}</p>
          <Button type="submit" disabled={loading || saving} className="gap-2"><Save className="size-4" />{saving ? "Saving..." : "Save site settings"}</Button>
        </div>
      </form>
    </div>
  )
}
