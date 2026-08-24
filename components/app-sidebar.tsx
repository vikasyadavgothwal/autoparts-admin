"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  ChevronDown,
  Cookie,
  FileText as FileTextIcon,
  Bot,
  House,
  LayoutDashboard,
  LayoutTemplate,
  LifeBuoy,
  MessageSquareText,
  ShieldCheck,
  ShoppingCart,
  Users,
  Wrench,
  FileText,
  Building2,
  ChartColumn,
  BadgeCheck,
  CircleDollarSign,
  PackageSearch,
  Plug,
  ScanLine,
  Settings,
  Database,
  GitBranch,
  Link2,
  Globe2,
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
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "VIN Decoder", url: appRoutes.vinDecoder, icon: ScanLine },
  { title: "Vehicle Database", url: appRoutes.vehicleDatabase, icon: Database },
  { title: "Fitment Rules", url: appRoutes.fitmentRules, icon: GitBranch },
  { title: "OE Mapping", url: appRoutes.oeMapping, icon: Link2 },
  { title: "Cross References", url: appRoutes.crossReferences, icon: Link2 },
  { title: "Supplier Validation", url: appRoutes.supplierValidation, icon: ShieldCheck },
  { title: "Inventory Mapping", url: appRoutes.inventoryMapping, icon: PackageSearch },
  { title: "Analytics", url: appRoutes.marketplaceAnalytics, icon: ChartColumn },
  { title: "Part Searches", url: appRoutes.partSearches, icon: PackageSearch },
  { title: "AI Intelligence", url: appRoutes.aiIntelligence, icon: Bot },
  { title: "Reports", url: "/reports", icon: ChartColumn },
  { title: "Users", url: "/users", icon: Users },
  { title: "Suppliers", url: appRoutes.supplier, icon: Building2 },
  { title: "Garages", url: "/garages", icon: Wrench },
  { title: "RFQs", url: "/rfqs", icon: FileText },
  { title: "Queries", url: appRoutes.queries, icon: MessageSquareText },
  { title: "Orders", url: "/orders", icon: ShoppingCart },
  { title: "Parts Mapping", url: appRoutes.partsMapping, icon: PackageSearch },
]

const businessPlatformLinks = [
  { title: "Plans", url: "/business-platform", icon: BadgeCheck },
  { title: "Users & Plans", url: "/business-platform/users-with-plans", icon: Users },
  { title: "Add-on Requests", url: "/business-platform/add-on-requests", icon: Plug },
  { title: "Support Requests", url: "/business-platform/support-requests", icon: LifeBuoy },
  { title: "Set Pricing", url: "/business-platform/add-on-pricing", icon: CircleDollarSign },
  { title: "FAQ & Videos", url: "/business-platform/faq-videos", icon: LifeBuoy },
] as const

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

export function AppSidebar({ branding }: { branding?: { siteName: string; logoUrl: string } }) {
  const currentPath = stripBasePath(usePathname())

  const isLinkActive = (url: string) => {
    if (url === appRoutes.overview) {
      return isDashboardOverviewPath(currentPath)
    }

    if (url === "/dashboard/admin") {
      return isDashboardOverviewPath(currentPath) || currentPath === "/dashboard/admin"
    }

    return currentPath === url || currentPath.startsWith(`${url}/`)
  }

  const [isBusinessPlatformOpen, setIsBusinessPlatformOpen] = useState(false)
  const [isPagesOpen, setIsPagesOpen] = useState(false)
  const isBusinessPlatformActive = businessPlatformLinks.some((item) => isLinkActive(item.url))
  const isSiteSettingsActive = isLinkActive(appRoutes.siteSettings)
  const isPagesActive = appPageLinks.some((item) => isLinkActive(item.url)) || isSiteSettingsActive

  useEffect(() => {
    if (isBusinessPlatformActive) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsBusinessPlatformOpen(true)
    }
  }, [isBusinessPlatformActive])

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
          {branding?.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={branding.logoUrl} alt={branding.siteName} className="h-20 w-auto max-w-full object-contain object-left" />
          ) : <h2 className="text-2xl font-bold text-white">{branding?.siteName === "AutoPartsPro" || branding?.siteName === "AutoParts Pro" || !branding?.siteName ? <>AutoParts<span className="text-[#DC2626]"> Pro</span></> : branding.siteName}</h2>}
          <p className="mt-1 text-sm text-[#9CA3AF]">Administrator</p>
        </Link>
      </SidebarHeader>

      <SidebarContent className="flex-1 space-y-1 overflow-y-auto px-4 py-4">
        <div className="px-4 pb-2 text-[11px] font-semibold uppercase tracking-wider text-[#9CA3AF]">
          Intelligence Suite
        </div>
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
              isActive={isBusinessPlatformActive}
              className={`h-auto px-4 py-3 rounded-lg transition-all ${
                isBusinessPlatformActive
                  ? "bg-[#DC2626] text-white hover:bg-[#DC2626]"
                  : "text-[#9CA3AF] hover:bg-[#2A2A2A] hover:text-white"
              }`}
            >
              <button
                type="button"
                onClick={() => setIsBusinessPlatformOpen((value) => !value)}
                className="flex w-full items-center gap-3"
              >
                <BadgeCheck className="h-5 w-5" />
                <span className="font-medium">Plans and Support</span>
                <ChevronDown
                  className={`ml-auto h-4 w-4 transition-transform ${
                    isBusinessPlatformOpen ? "rotate-180" : ""
                  }`}
                />
              </button>
            </SidebarMenuButton>
          </SidebarMenuItem>

          {isBusinessPlatformOpen && (
            <SidebarMenuSub>
              {businessPlatformLinks.map((businessItem) => {
                const Icon = businessItem.icon
                const isActive = isLinkActive(businessItem.url)

                return (
                  <SidebarMenuSubItem key={businessItem.title}>
                    <SidebarMenuSubButton
                      asChild
                      isActive={isActive}
                      className={`${
                        isActive
                          ? "bg-[#DC2626] text-white hover:bg-[#DC2626]"
                          : "text-[#9CA3AF] hover:bg-[#2A2A2A] hover:text-white"
                      }`}
                    >
                      <Link href={businessItem.url} className="flex items-center gap-3">
                        <Icon className="h-4 w-4" />
                        <span>{businessItem.title}</span>
                      </Link>
                    </SidebarMenuSubButton>
                  </SidebarMenuSubItem>
                )
              })}
            </SidebarMenuSub>
          )}

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
                <span className="font-medium">Site Pages</span>
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
              <SidebarMenuSubItem>
                <SidebarMenuSubButton
                  asChild
                  isActive={isSiteSettingsActive}
                  className={`${
                    isSiteSettingsActive
                      ? "bg-[#DC2626] text-white hover:bg-[#DC2626]"
                      : "text-[#9CA3AF] hover:bg-[#2A2A2A] hover:text-white"
                  }`}
                >
                  <Link href={appRoutes.siteSettings} className="flex items-center gap-3">
                    <Globe2 className="h-4 w-4" />
                    <span>Site Settings</span>
                  </Link>
                </SidebarMenuSubButton>
              </SidebarMenuSubItem>
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
