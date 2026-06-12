import type {
  PublicPageDefinition,
  PublicPageSlug,
} from "@/types/admin-dashboard/public-pages/public-pages-data"

export const PUBLIC_PAGES: readonly PublicPageDefinition[] = [
  {
    slug: "home",
    title: "Home",
    description:
      "Welcome to the public pages area. Use this section to add quick links and campaign content for your storefront.",
    details: [
      "Track important dashboard entry points.",
      "Keep quick actions and summaries here.",
      "Add notices and promotional sections as needed.",
    ],
  },
  {
    slug: "browse-part",
    title: "Browse Part",
    description:
      "Browse parts, vehicles, and supplier listings from a central catalog page.",
    details: [
      "Add product filters and category tabs.",
      "Add search and sort controls.",
      "Display part availability and lead times.",
    ],
  },
  {
    slug: "req",
    title: "Req",
    description: "Request history and request management landing page placeholder.",
    details: [
      "Show active and completed requests.",
      "Track request statuses and escalation states.",
      "Highlight pending response times.",
    ],
  },
  {
    slug: "for-business",
    title: "For Business",
    description: "Business-focused onboarding and capabilities information.",
    details: [
      "Add service tiers and business plans.",
      "Mention support and onboarding SLAs.",
      "Track enterprise-level capabilities.",
    ],
  },
  {
    slug: "privacy-policy",
    title: "Privacy Policy",
    description:
      "Privacy policy page content. Replace this copy with your legal policy text.",
    details: [
      "Describe data collection scope.",
      "Explain data storage and retention.",
      "Document security and user rights details.",
    ],
  },
  {
    slug: "terms-of-services",
    title: "Terms of Services",
    description:
      "Terms of Service page placeholder. Use this section for legal policy updates.",
    details: [
      "List platform usage rules.",
      "Define account and payment terms.",
      "Mention dispute and service limitation clauses.",
    ],
  },
  {
    slug: "cookies-settings",
    title: "Cookies Settings",
    description:
      "Cookie settings page for managing consent preferences and tracking controls.",
    details: [
      "Add consent toggles for preferences.",
      "List third-party analytics tools.",
      "Expose consent history and revision timestamps.",
    ],
  },
  {
    slug: "search",
    title: "Search",
    description:
      "Global search page where users can find relevant records and resources.",
    details: [
      "Add global search index.",
      "Show recent search terms and suggestions.",
      "Render filtered results with clear categories.",
    ],
  },
] as const

export const getPublicPage = (slug: PublicPageSlug): PublicPageDefinition | undefined =>
  PUBLIC_PAGES.find((page) => page.slug === slug)
