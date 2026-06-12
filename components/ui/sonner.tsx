"use client"

import { useTheme } from "next-themes"
import { Toaster as Sonner, type ToasterProps } from "sonner"
import { CircleCheckIcon, InfoIcon, TriangleAlertIcon, OctagonXIcon, Loader2Icon } from "lucide-react"

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      icons={{
        success: (
          <CircleCheckIcon className="size-4" />
        ),
        info: (
          <InfoIcon className="size-4" />
        ),
        warning: (
          <TriangleAlertIcon className="size-4" />
        ),
        error: (
          <OctagonXIcon className="size-4" />
        ),
        loading: (
          <Loader2Icon className="size-4 animate-spin" />
        ),
      }}
      style={
        {
          "--normal-bg": "var(--dashboard-panel-bg)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--dashboard-panel-border)",
          "--normal-bg-hover": "var(--dashboard-surface-hover)",
          "--normal-border-hover": "var(--dashboard-accent-soft)",
          "--success-bg": "color-mix(in srgb, var(--dashboard-success) 16%, var(--dashboard-panel-bg))",
          "--success-border": "color-mix(in srgb, var(--dashboard-success) 55%, var(--dashboard-panel-border))",
          "--success-text": "var(--dashboard-success)",
          "--info-bg": "color-mix(in srgb, var(--dashboard-info) 18%, var(--dashboard-panel-bg))",
          "--info-border": "color-mix(in srgb, var(--dashboard-info) 55%, var(--dashboard-panel-border))",
          "--info-text": "var(--dashboard-info)",
          "--warning-bg": "color-mix(in srgb, var(--dashboard-warning) 18%, var(--dashboard-panel-bg))",
          "--warning-border": "color-mix(in srgb, var(--dashboard-warning) 55%, var(--dashboard-panel-border))",
          "--warning-text": "var(--dashboard-warning)",
          "--error-bg": "color-mix(in srgb, var(--dashboard-danger) 18%, var(--dashboard-panel-bg))",
          "--error-border": "color-mix(in srgb, var(--dashboard-danger) 55%, var(--dashboard-panel-border))",
          "--error-text": "var(--dashboard-danger)",
          "--border-radius": "var(--radius)",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast: "cn-toast",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
