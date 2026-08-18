const DEFAULT_BASE_PATH = "/fleet"

/**
 * Normalize a base path from env/config input to the app route format.
 */
function normalizeBasePath(value?: string) {
  if (!value) {
    return DEFAULT_BASE_PATH
  }

  const trimmedValue = value.trim().replace(/\/+$/, "")

  if (!trimmedValue || trimmedValue === "/") {
    return DEFAULT_BASE_PATH
  }
  return trimmedValue.startsWith("/") ? trimmedValue : `/${trimmedValue}`
}
export const appBasePath = normalizeBasePath(process.env.NEXT_PUBLIC_BASE_PATH)
export const appRoutes = {
  overview: "/",
  legacyOverview: "/dashboard",
  home: "/pages/home-page",
  req: "/pages/rfq-page",
  forBusiness: "/pages/for-business-page",
  privacyPolicy: "/pages/privacy-policy-page",
  termsOfServices: "/pages/terms-of-services-page",
  cookiesSettings: "/pages/cookies-settings-page",
  search: "/search",
  business: "/business",
  rfqs: "/rfqs",
  queries: "/queries",
  orders: "/orders",
  partsMapping: "/parts-mapping",
  vehicleDatabase: "/vehicle-database",
  vinDecoder: "/vin-decoder",
  fitmentRules: "/fitment-rules",
  oeMapping: "/oe-mapping",
  crossReferences: "/cross-references",
  supplierValidation: "/supplier-validation",
  inventoryMapping: "/inventory-mapping",
  marketplaceAnalytics: "/marketplace-analytics",
  partSearches: "/part-searches",
  aiIntelligence: "/ai-intelligence",
  suppliers: "/pages/suppliers-page",
  supplier: "/suppliers",
  reports: "/reports",
  services: "/pages/services-page",
  settings: "/settings",
  login: "/login",
} as const

export const appPageLinks = [
  { key: "home", title: "Home", url: appRoutes.home },
  { key: "req", title: "RFQs", url: appRoutes.req },
  { key: "forBusiness", title: "For Business", url: appRoutes.forBusiness },
  { key: "suppliers", title: "Suppliers", url: appRoutes.suppliers },
  { key: "services", title: "Services", url: appRoutes.services },
  { key: "privacyPolicy", title: "Privacy Policy", url: appRoutes.privacyPolicy },
  {
    key: "termsOfServices",
    title: "Terms of Services",
    url: appRoutes.termsOfServices,
  },
  {
    key: "cookiesSettings",
    title: "Cookies Settings",
    url: appRoutes.cookiesSettings,
  },
] as const

export type AppPageLinkKey = (typeof appPageLinks)[number]["key"]

export type AppPageLink = (typeof appPageLinks)[number]

/**
 * Remove configured base path from a pathname for active-link checks.
 */
export function stripBasePath(pathname: string | null) {
  if (!pathname) {
    return appRoutes.overview
  }
  if (pathname === appBasePath) {
    return appRoutes.overview
  }
  if (pathname.startsWith(`${appBasePath}/`)) {
    return pathname.slice(appBasePath.length) || appRoutes.overview
  }
  return pathname
}
