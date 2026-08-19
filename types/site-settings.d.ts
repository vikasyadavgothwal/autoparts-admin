export type MainWebsiteSiteSettings = {
  siteName: string
  logoUrl: string
  logoKey: string
  faviconUrl: string
  faviconKey: string
  robotsTxt: string
  copyright: string
  seo: {
    title: string
    description: string
    keywords: string
    canonicalUrl: string
    noIndex: boolean
    noFollow: boolean
  }
  social: {
    facebook: string
    instagram: string
    x: string
    youtube: string
    linkedin: string
  }
  contact: {
    phone: string
    email: string
    address: string
  }
}
