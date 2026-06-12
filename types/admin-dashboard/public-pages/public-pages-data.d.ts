export type PublicPageSlug =
  | "home"
  | "browse-part"
  | "req"
  | "for-business"
  | "privacy-policy"
  | "terms-of-services"
  | "cookies-settings"
  | "search"

export type PublicPageDefinition = {
  slug: PublicPageSlug
  title: string
  description: string
  details: readonly string[]
}
