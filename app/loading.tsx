import { Skeleton } from "@/components/ui/skeleton"

export default function Loading() {
  return (
    <main className="min-h-screen bg-brand-surface p-6">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4">
        <Skeleton className="h-10 w-56" />
        <Skeleton className="h-32 w-full" />
        <div className="grid gap-4 md:grid-cols-3">
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
        </div>
      </div>
    </main>
  )
}
