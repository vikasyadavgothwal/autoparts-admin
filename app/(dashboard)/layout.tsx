import type { ReactNode } from "react"
import { redirect } from "next/navigation"

import { appRoutes } from "@/lib/routes"
import { getCurrentAdminSession } from "@/actions/admin-auth/me"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/app-sidebar"
import { DashboardHeader } from "@/components/app-header"
import { Toaster } from "@/components/ui/sonner"

export default async function DashboardLayout({
  children,
}: {
  children: ReactNode
}) {
  const authResult = await getCurrentAdminSession()

  if (!authResult.ok || !authResult.admin.isActive) {
    redirect(appRoutes.login)
  }

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset className="min-h-svh bg-[#0A0A0A]">
        <DashboardHeader />
        <div className="flex flex-1 flex-col p-4 lg:p-6">{children}</div>
      </SidebarInset>
      <Toaster position="top-right" richColors />
    </SidebarProvider>
  )
}
