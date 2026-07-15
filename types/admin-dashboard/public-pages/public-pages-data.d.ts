export type PublicPageSlug =
  | "home"
  | "req"
  | "for-business"
  | "privacy-policy"
  | "terms-of-services"
  | "cookies-settings"

export type PublicPageDefinition = {
  slug: PublicPageSlug
  title: string
  description: string
  details: readonly string[]
}
