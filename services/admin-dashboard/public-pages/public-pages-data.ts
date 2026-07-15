import type {
  PublicPageDefinition,
  PublicPageSlug,
} from "@/types/admin-dashboard/public-pages/public-pages-data"

export const PUBLIC_PAGES: readonly PublicPageDefinition[] = [
  {
    slug: "home",
    title: "Home",
    description: "Manage the existing public marketplace home-page content.",
    details: [
      "Edit the existing banner and marketplace sections.",
      "Manage the existing public SEO metadata.",
    ],
  },
  {
    slug: "req",
    title: "Request for Quote",
    description: "Manage the existing public RFQ page content.",
    details: [
      "Edit the existing RFQ heading and supporting content.",
      "Manage the existing public SEO metadata.",
    ],
  },
  {
    slug: "for-business",
    title: "For Business",
    description: "Business-focused onboarding and capabilities information.",
    details: [
      "Edit the existing business page sections.",
      "Manage the existing public SEO metadata.",
    ],
  },
  {
    slug: "privacy-policy",
    title: "Privacy Policy",
    description: "Manage the published privacy-policy document.",
    details: [
      "Edit the existing rich-text legal document.",
      "Manage the existing public SEO metadata.",
    ],
  },
  {
    slug: "terms-of-services",
    title: "Terms of Services",
    description: "Manage the published terms-of-service document.",
    details: [
      "Edit the existing rich-text legal document.",
      "Manage the existing public SEO metadata.",
    ],
  },
  {
    slug: "cookies-settings",
    title: "Cookies Settings",
    description: "Manage the published cookie-settings document.",
    details: [
      "Edit the existing rich-text cookie document.",
      "Manage the existing public SEO metadata.",
    ],
  },
] as const

export const getPublicPage = (slug: PublicPageSlug): PublicPageDefinition | undefined =>
  PUBLIC_PAGES.find((page) => page.slug === slug)
