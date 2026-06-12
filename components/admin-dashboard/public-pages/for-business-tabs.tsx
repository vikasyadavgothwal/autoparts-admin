"use client"

import { ForBusinessPage } from "./for-business-page"
import type { ForBusinessPageProps } from "@/types/admin-dashboard/public-pages/for-business-page"

export function ForBusinessTabs({
  initialConfig,
  initialSeo,
}: ForBusinessPageProps) {
  return <ForBusinessPage initialConfig={initialConfig} initialSeo={initialSeo} />
}

export { ForBusinessPage }
