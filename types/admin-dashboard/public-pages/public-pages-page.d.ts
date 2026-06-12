export type PublicPageSlug =
  | "home"
  | "browse-part"
  | "req"
  | "for-business"
  | "privacy-policy"
  | "terms-of-services"
  | "cookies-settings"
  | "search"

export type PublicPageProps = {
  slug: PublicPageSlug
}
