import type {
  HomePageConfig,
  HomeTabConfig,
} from "@/types/admin-dashboard/public-pages/home-tabs-data"

export type { HomePageConfig, HomeTabConfig }

export const HOME_TABS: readonly HomeTabConfig[] = [
  { key: "banner", label: "Banner" },
  { key: "search", label: "Search" },
  { key: "why-choose-us", label: "Why Choose Us" },
  { key: "category", label: "Category" },
  { key: "featured-parts", label: "Featured Parts" },
  { key: "process", label: "Process" },
  { key: "enterprise-solutions", label: "ENTERPRISE SOLUTIONS" },
  { key: "cta", label: "CTA" },
  { key: "seo", label: "SEO" },
] as const

export const HOME_PAGE_DEFAULT_CONFIG: HomePageConfig = {
  banner: {
    backgroundImage: "",
    backgroundImageKey: "",
    badgeText: "Trusted Auto Parts Network",
    heading: "Fast parts sourcing for workshop and fleet teams",
    subheading:
      "Speed up procurement with verified suppliers, transparent pricing, and reliable delivery insights.",
    keyPoints: [
      "Verified supplier quality checks",
      "Real-time stock and availability visibility",
      "Consistent support for service and operations teams",
    ],
  },
  search: {
    heading: "Find the right part in seconds",
    subheading: "Search by VIN, part number, model, or vehicle category.",
  },
  whyChooseUs: {
    heading: "Why operators trust us",
    subheading: "Reliable sourcing built for maintenance and repair workflows.",
    pairs: [
      {
        heading: "Accelerated sourcing",
        subheading:
          "Match parts to qualified suppliers quickly with practical delivery windows.",
      },
      {
        heading: "Quality assurance",
        subheading:
          "Track approved partners and benchmark fulfillment outcomes across every order.",
      },
      {
        heading: "Operational clarity",
        subheading:
          "Get clear status updates and actionable insights from request to fulfillment.",
      },
    ],
  },
  category: {
    heading: "Explore categories",
    subheading: "Browse parts by your current workload and team priorities.",
    bottomHeading: "Need a specific category? Use advanced filters to narrow results.",
  },
  featuredParts: {
    heading: "Featured Parts",
    subheading: "Popular parts and service-ready items highlighted for teams.",
    buttonText: "Shop Featured",
    buttonSlug: "/pages/home-page",
  },
  process: {
    steps: [
      {
        heading: "Submit request details",
        subheading: "Share VIN, part specifics, and required delivery windows.",
      },
      {
        heading: "Review supplier options",
        subheading: "Compare proposals, pricing, and fulfillment commitments.",
      },
      {
        heading: "Approve and track",
        subheading:
          "Finalize the chosen supplier and receive status updates until completion.",
      },
    ],
  },
  enterpriseSolutions: {
    heading: "Enterprise solutions built for scale",
    cards: [
      {
        heading: "Fleet Operations",
        subheading:
          "Deploy enterprise-grade controls for high-volume operations and team approvals.",
        buttonText: "Talk to Sales",
        buttonLink: "/business",
      },
      {
        heading: "Parts Control Center",
        subheading:
          "Run consolidated procurement planning with reporting built for scale.",
        buttonText: "Request Demo",
        buttonLink: "/rfq",
      },
    ],
  },
  cta: {
    heading: "Ready to optimize procurement?",
    subheading:
      "Launch faster sourcing workflows with one consolidated dashboard and guided process.",
    primaryButtonText: "Get Started",
    primaryButtonLink: "/rfq",
    secondaryButtonText: "Talk to Support",
    secondaryButtonLink: "/services",
  },
}

export const HOME_INPUT_LIMITS = {
  bannerBadgeText: 45,
  bannerHeading: 90,
  bannerSubheading: 180,
  bannerKeyPoint: 70,
  sectionHeading: 80,
  sectionSubheading: 180,
  buttonText: 40,
  slug: 120,
  whyChoosePairHeading: 55,
  whyChoosePairSubheading: 120,
  stepHeading: 65,
  stepSubheading: 140,
  cardHeading: 65,
  cardSubheading: 140,
  ctaButtonText: 35,
  linkText: 120,
} as const

export const HOME_BANNER_IMAGE_MAX_BYTES = 10 * 1024 * 1024
export const HOME_BANNER_IMAGE_MAX_SIZE_LABEL = "10 MB"
export const HOME_BANNER_IMAGE_ACCEPTED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
] as const

export const ENTERPRISE_CARD_COUNT = 2
export const MIN_PROCESS_STEPS = 1
export const MAX_PROCESS_STEPS = 8



export const PROCESS_STEPS: readonly string[] = [
  "Submit request details and part requirements.",
  "Review supplier bids and compare options.",
  "Approve selected proposal and set delivery milestone.",
  "Track shipping and finalize transaction.",
]
