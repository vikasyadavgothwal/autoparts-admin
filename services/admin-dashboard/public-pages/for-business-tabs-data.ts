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
    subheading: "Flexible options for every business type and growth stage.",
    plans: [
      {
        heading: "Fleet Free",
        subheading: "For small fleets getting started.",
        price: "AED 0",
        duration: "per month",
        buttonText: "Start Free",
        mostPopular: false,
        keyPoints: ["Up to 5 vehicles", "Basic RFQ access", "Dashboard reports"],
      },
      {
        heading: "Garage Pro",
        subheading: "For repair businesses managing bookings and service demand.",
        price: "AED 199",
        duration: "per month",
        buttonText: "Upgrade Garage",
        mostPopular: true,
        keyPoints: ["Appointment controls", "Staff roles and permissions", "Usage and activity reports"],
      },
      {
        heading: "Supplier Free",
        subheading: "For suppliers testing the marketplace.",
        price: "AED 0",
        duration: "per month",
        buttonText: "Start Free",
        mostPopular: false,
        keyPoints: ["Up to 10 products", "Basic RFQ inbox", "Dashboard reports"],
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
