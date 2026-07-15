import { DashboardPageHeader } from "@/components/dashboard/page-header"
import type { PageHeadingProps } from "@/types/admin-dashboard/shared/page-heading"

export function PageHeading({ title, subtitle, action }: PageHeadingProps) {
  return (
    <DashboardPageHeader title={title} subtitle={subtitle} action={action} />
  )
}
