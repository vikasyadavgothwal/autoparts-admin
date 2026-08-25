import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Suspense } from "react";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import {
  DEFAULT_MAIN_WEBSITE_SITE_SETTINGS,
  getMainWebsiteSiteSettings,
} from "@/services/platform-settings/main-website-site-settings";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getMainWebsiteSiteSettings().catch(
    () => DEFAULT_MAIN_WEBSITE_SITE_SETTINGS,
  );
  const faviconUrl = settings.faviconKey
    ? `/api/v1/user/public-asset?key=${encodeURIComponent(settings.faviconKey)}`
    : settings.faviconUrl || "/favicon.ico";

  return {
    title: "Admin Dashboard",
    description: "The best way to manage your Admin Dashboard.",
    icons: {
      icon: faviconUrl,
    },
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <Suspense fallback={null}>{children}</Suspense>
        </ThemeProvider>
      </body>
    </html>
  );
}
