export type PublicPageSlug =
  | "home"
  | "req"
  | "for-business"
  | "privacy-policy"
  | "terms-of-services"
  | "cookies-settings"

export type PublicPageProps = {
  slug: PublicPageSlug
}
