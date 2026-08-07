"use client"

import { useEffect } from "react"
import { AlertTriangle, RotateCcw } from "lucide-react"

import { Button } from "@/components/ui/button"

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <main className="flex min-h-screen items-center justify-center bg-brand-surface p-6">
      <div className="w-full max-w-md text-center">
        <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-full border border-destructive/20 bg-destructive/10 text-destructive">
          <AlertTriangle className="h-7 w-7" />
        </div>
        <h1 className="text-2xl font-semibold text-foreground">
          Something went wrong
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">
          The admin app could not finish loading this view.
        </p>
        <Button type="button" className="mt-6 gap-2" onClick={reset}>
          <RotateCcw className="h-4 w-4" />
          Try again
        </Button>
      </div>
    </main>
  )
}
