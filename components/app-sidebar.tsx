"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  ChevronDown,
  Cookie,
  FileText as FileTextIcon,
  House,
  LayoutTemplate,
  MessageSquareText,
  ShieldCheck,
  ShoppingCart,
  Users,
  Wrench,
  FileText,
  Building2,
  ChartColumn,
  PackageSearch,
  Settings,
} from "lucide-react"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar"
import { appPageLinks, appRoutes, stripBasePath } from "@/lib/routes"
import type { AppPageLink } from "@/lib/routes"
import type { AppPageLinkKey } from "@/lib/routes"
import type { AppSidebarNavItem } from "@/types/app-sidebar"

const items: readonly AppSidebarNavItem[] = [
  { title: "Overview", url: "/", icon: House },
  { title: "Users", url: "/users", icon: Users },
  { title: "Suppliers", url: appRoutes.supplier, icon: Building2 },
  { title: "Garages", url: "/garages", icon: Wrench },
  { title: "RFQs", url: "/rfqs", icon: FileText },
  { title: "Queries", url: appRoutes.queries, icon: MessageSquareText },
  { title: "Orders", url: "/orders", icon: ShoppingCart },
  { title: "Parts Mapping", url: appRoutes.partsMapping, icon: PackageSearch },
  { title: "Reports", url: "/reports", icon: ChartColumn },
]

const pageIconByKey: Record<AppPageLinkKey, (typeof House)> = {
  home: House,
  req: FileTextIcon,
  forBusiness: Building2,
  suppliers: Building2,
  services: FileTextIcon,
  privacyPolicy: ShieldCheck,
  termsOfServices: FileTextIcon,
  cookiesSettings: Cookie,
}

const isDashboardOverviewPath = (path: string) =>
  path === appRoutes.overview || path === appRoutes.legacyOverview

export function AppSidebar() {
  const currentPath = stripBasePath(usePathname())

  const isLinkActive = (url: string) => {
    if (url === "/dashboard/admin") {
      return isDashboardOverviewPath(currentPath) || currentPath === "/dashboard/admin"
    }

    return currentPath === url || currentPath.startsWith(`${url}/`)
  }

  const [isPagesOpen, setIsPagesOpen] = useState(false)
  const isPagesActive = appPageLinks.some((item) => isLinkActive(item.url))

  useEffect(() => {
    if (isPagesActive) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsPagesOpen(true)
    }
  }, [isPagesActive])

  return (
    <Sidebar className="border-sidebar-border bg-[#1A1A1A] text-white">
      <SidebarHeader className="border-b border-[#2A2A2A] p-6">
        <Link href="/" className="block">
          <h2 className="text-xl font-bold text-white">AutoPartsPro</h2>
          <p className="mt-1 text-sm text-[#9CA3AF]">Administrator</p>
        </Link>
      </SidebarHeader>

      <SidebarContent className="flex-1 space-y-1 overflow-y-auto px-4 py-4">
        <SidebarMenu className="space-y-1">
          {items.map((item) => {
            const Icon = item.icon
            const isActive = isLinkActive(item.url)

            return (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton
                  asChild
                  isActive={isActive}
                  className={`h-auto px-4 py-3 rounded-lg transition-all ${
                    isActive
                      ? "bg-[#DC2626] text-white hover:bg-[#DC2626]"
                      : "text-[#9CA3AF] hover:bg-[#2A2A2A] hover:text-white"
                  }`}
                >
                  <Link href={item.url} className="flex items-center gap-3">
                    <Icon className="h-5 w-5" />
                    <span className="font-medium">{item.title}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            )
          })}

          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              isActive={isPagesActive}
              className={`h-auto px-4 py-3 rounded-lg transition-all ${
                isPagesActive
                  ? "bg-[#DC2626] text-white hover:bg-[#DC2626]"
                  : "text-[#9CA3AF] hover:bg-[#2A2A2A] hover:text-white"
              }`}
            >
              <button
                type="button"
                onClick={() => setIsPagesOpen((value) => !value)}
                className="flex w-full items-center gap-3"
              >
                <LayoutTemplate className="h-5 w-5" />
                <span className="font-medium">Pages</span>
                <ChevronDown
                  className={`ml-auto h-4 w-4 transition-transform ${
                    isPagesOpen ? "rotate-180" : ""
                  }`}
                />
              </button>
            </SidebarMenuButton>
          </SidebarMenuItem>

          {isPagesOpen && (
            <SidebarMenuSub>
              {appPageLinks.map((pageItem: AppPageLink) => {
                const Icon = pageIconByKey[pageItem.key]
                const isActive = isLinkActive(pageItem.url)

                return (
                    <SidebarMenuSubItem key={pageItem.title}>
                      <SidebarMenuSubButton
                      asChild
                      isActive={isActive}
                      className={`${
                        isActive
                          ? "bg-[#DC2626] text-white hover:bg-[#DC2626]"
                          : "text-[#9CA3AF] hover:bg-[#2A2A2A] hover:text-white"
                      }`}
                    >
                        <Link href={pageItem.url} className="flex items-center gap-3">
                          <Icon className="h-4 w-4" />
                          <span>{pageItem.title}</span>
                        </Link>
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                )
              })}
            </SidebarMenuSub>
          )}
        </SidebarMenu>
      </SidebarContent>

      <SidebarFooter className="border-t border-[#2A2A2A] p-4">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              isActive={
                currentPath === appRoutes.settings ||
                currentPath.startsWith(`${appRoutes.settings}/`)
              }
              className={`h-auto px-4 py-3 rounded-lg transition-all ${
                currentPath === appRoutes.settings ||
                currentPath.startsWith(`${appRoutes.settings}/`)
                  ? "bg-[#DC2626] text-white hover:bg-[#DC2626]"
                  : "text-[#9CA3AF] hover:bg-[#2A2A2A] hover:text-white"
              }`}
            >
              <Link
                href={appRoutes.settings}
                className="flex items-center gap-3"
              >
                <Settings className="h-5 w-5" />
                <span className="font-medium">Settings</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}
