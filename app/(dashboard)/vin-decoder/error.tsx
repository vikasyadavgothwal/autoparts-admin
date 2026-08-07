"use client"

export default function VinDecoderError({ reset }: { reset: () => void }) {
  return (
    <div className="flex min-h-[40vh] flex-col items-start justify-center gap-3 text-sm text-muted-foreground">
      <p>Unable to load VIN decoder.</p>
      <button type="button" onClick={reset} className="rounded-sm border border-border px-3 py-2 text-foreground">
        Retry
      </button>
    </div>
  )
}
