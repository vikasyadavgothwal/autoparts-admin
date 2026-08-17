import { redirect } from "next/navigation"

export const dynamic = "force-dynamic"

export default function AdminBusinessPlatformWorkflowsPage() {
  redirect("/business-platform/add-on-requests")
}
