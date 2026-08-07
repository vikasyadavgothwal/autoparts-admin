import Link from "next/link"
import { House, SearchX } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

const helpfulLinks = [
  {
    title: "Dashboard",
    description: "Return to the admin overview",
    href: "/dashboard",
  },
  {
    title: "Orders",
    description: "Review platform orders",
    href: "/orders",
  },
  {
    title: "RFQs",
    description: "Review quote requests",
    href: "/rfqs",
  },
  {
    title: "Users",
    description: "Manage platform accounts",
    href: "/users",
  },
] as const

export default function NotFoundPage() {
  return (
    <main className="min-h-screen bg-brand-surface p-6 sm:p-8">
      <div className="flex min-h-screen items-center justify-center">
        <div className="w-full max-w-2xl text-center">
          <div className="mx-auto mb-8 flex h-24 w-24 items-center justify-center rounded-full border border-primary/20 bg-primary/10">
            <SearchX className="h-12 w-12 text-primary" />
          </div>

          <h1 className="mb-4 text-5xl font-bold text-foreground sm:text-6xl">
            404
          </h1>
          <h2 className="mb-4 text-2xl font-bold text-foreground sm:text-3xl">
            Page Not Found
          </h2>
          <p className="mb-8 text-base text-muted-foreground sm:text-xl">
            The page you requested is not available in the admin app.
          </p>

          <Button asChild className="gap-2 px-6 py-3">
            <Link href="/dashboard">
              <House className="h-5 w-5" />
              Go Home
            </Link>
          </Button>

          <Card className="mt-12 text-left">
            <CardContent className="p-6">
              <h3 className="mb-4 text-lg font-semibold text-foreground">
                Helpful Links
              </h3>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {helpfulLinks.map((item) => (
                  <Link
                    key={item.title}
                    href={item.href}
                    className="group rounded-sm border border-border bg-background p-4 transition-all hover:border-primary"
                  >
                    <h4 className="mb-1 font-semibold text-foreground transition-colors group-hover:text-primary">
                      {item.title}
                    </h4>
                    <p className="text-sm text-muted-foreground">
                      {item.description}
                    </p>
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  )
}
