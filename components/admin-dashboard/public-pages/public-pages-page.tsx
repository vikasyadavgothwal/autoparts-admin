import { getPublicPage } from "@/services/admin-dashboard/public-pages/public-pages-data"
import { PublicPageRenderer } from "./public-pages-components"
import type { PublicPageProps } from "@/types/admin-dashboard/public-pages/public-pages-page"

export function PublicPage({ slug }: PublicPageProps) {
  const page = getPublicPage(slug)

  if (!page) {
    return <div className="text-white">Page not found.</div>
  }

  return <PublicPageRenderer page={page} />
}
