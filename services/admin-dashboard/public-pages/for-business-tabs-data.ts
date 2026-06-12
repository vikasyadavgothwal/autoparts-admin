import type {
  ForBusinessInputLimits,
  ForBusinessPageConfig,
  ForBusinessTabConfig,
} from "@/types/admin-dashboard/public-pages/for-business-tabs-data"

export const FOR_BUSINESS_TABS: readonly ForBusinessTabConfig[] = [
  { key: "banner", label: "Banner" },
  { key: "business-solutions", label: "Business Solutions" },
  { key: "pricing", label: "Pricing" },
  { key: "for-fleet-managers", label: "FOR FLEET MANAGERS" },
  { key: "cta", label: "CTA" },
  { key: "seo", label: "SEO" },
] as const

export const FOR_BUSINESS_PAGE_DEFAULT_CONFIG: ForBusinessPageConfig = {
  banner: {
    badgeText: "For Business",
    heading: "Fleet procurement built for scale.",
    redHeading: "Built for operators.",
    subheading:
      "Configure the headline and actions that introduce your business-focused page to workshop owners.",
    primaryButtonText: "Book a Demo",
    primaryButtonLink: "/business",
    secondaryButtonText: "Talk to Sales",
    secondaryButtonLink: "/services-page",
  },
  businessSolutions: {
    heading: "Business Solutions",
    subheading: "Tailored programs for maintenance, workshop, and fleet teams.",
    cards: [
      {
        heading: "Procurement Efficiency",
        subheading:
          "Automate quote collection, response tracking, and comparison for faster purchasing.",
      },
      {
        heading: "Operational Visibility",
        subheading:
          "Track demand, dispatch timings, and fulfillment confidence from one operations hub.",
      },
      {
        heading: "Support and Governance",
        subheading:
          "Add policy-driven workflows, approval gates, and escalation paths.",
      },
    ],
  },
  pricing: {
    heading: "Simple, scalable pricing",
    subheading: "Choose the right plan and configure each tier directly from the dashboard.",
    plans: [
      {
        heading: "Starter",
        subheading: "For single workshop operations.",
        price: "$299",
        duration: "per month",
        buttonText: "Choose Starter",
        mostPopular: false,
        keyPoints: [
          "Core request management",
          "Supplier discovery",
          "Order tracking dashboard",
        ],
      },
      {
        heading: "Growth",
        subheading: "For multi-unit operations with approvals.",
        price: "$899",
        duration: "per month",
        buttonText: "Choose Growth",
        mostPopular: true,
        keyPoints: [
          "Team roles and permissions",
          "Escalation and reminders",
          "Usage and demand analytics",
        ],
      },
      {
        heading: "Enterprise",
        subheading: "For large-scale service fleets and procurement teams.",
        price: "Custom",
        duration: "custom contract",
        buttonText: "Contact Sales",
        mostPopular: false,
        keyPoints: [
          "Dedicated support",
          "Priority fulfillment coordination",
          "Advanced reporting and SLAs",
        ],
      },
    ],
  },
  forFleetManagers: {
    topHeading: "FOR FLEET MANAGERS",
    heading: "Control parts planning and costs from one place.",
    subheading:
      "Add program-level details, growth points, and manager actions to this section.",
    keyPoints: [
      "Monitor vehicle health and part demand across your fleet.",
      "Trigger replenishment windows by budget and mileage.",
      "Escalate shortages before downtime occurs.",
    ],
    buttonText: "Open Fleet Toolkit",
    buttonLink: "/orders",
    cards: [
      {
        topHeading: "Operations",
        heading: "Delivery Confidence",
        growthText: "Up to 35% fewer delayed maintenances.",
      },
      {
        topHeading: "Finance",
        heading: "Cost Control",
        growthText: "Improved plan adherence and spend predictability.",
      },
      {
        topHeading: "Quality",
        heading: "Supplier Performance",
        growthText: "Clearer scorecards for repeatable sourcing.",
      },
    ],
  },
  cta: {
    heading: "Ready to modernize procurement?",
    subheading: "Launch your business page with consistent, high-performing messaging.",
    primaryButtonText: "Get Started",
    primaryButtonLink: "/rfqs",
    secondaryButtonText: "Explore Services",
    secondaryButtonLink: "/services-page",
  },
}

export const FOR_BUSINESS_INPUT_LIMITS: ForBusinessInputLimits = {
  badgeText: 45,
  heading: 110,
  redHeading: 70,
  subheading: 180,
  buttonText: 40,
  buttonLink: 140,
  cardHeading: 60,
  cardSubheading: 140,
  planHeading: 50,
  planSubheading: 120,
  planPrice: 40,
  planDuration: 70,
  planButtonText: 40,
  planKeyPoint: 120,
  topHeading: 60,
  growthText: 90,
  point: 140,
}

export const FOR_BUSINESS_PLAN_KEY_POINTS = 3 as const
export const FOR_BUSINESS_CARD_COUNT = 3 as const
