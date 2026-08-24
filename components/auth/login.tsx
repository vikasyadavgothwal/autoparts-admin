"use client"
/* eslint-disable @next/next/no-img-element */

import { Eye, EyeOff } from "lucide-react"
import { useState } from "react"

import { loginAdmin } from "@/actions/admin-auth"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

const errorMessages: Record<string, string> = {
  missing_credentials: "Email and password are required.",
  invalid_credentials: "Invalid email or password.",
  invalid_token: "Session token is invalid.",
  missing_refresh_token: "Refresh token is missing. Sign in again.",
}

type LoginFormProps = {
  error?: string
  branding?: { siteName: string; logoUrl: string }
}

export function LoginForm({ error, branding = { siteName: "AutoPartsPro", logoUrl: "" } }: LoginFormProps) {
  const [showPassword, setShowPassword] = useState(false)

  const errorMessage = error
    ? (errorMessages[error] ?? "Unable to sign in. Please try again.")
    : null

  return (
    <div className="flex min-h-svh items-center justify-center px-4">
      <Card className="w-full max-w-md border border-white/10 text-white shadow-2xl">
        <CardHeader>
          <div className="mb-3 flex justify-center">
            {branding.logoUrl ? <img src={branding.logoUrl} alt={branding.siteName} className="h-16 max-w-[280px] object-contain" /> : <span className="text-2xl font-bold">{branding.siteName === "AutoPartsPro" || branding.siteName === "AutoParts Pro" ? <>AutoParts<span className="text-primary"> Pro</span></> : branding.siteName}</span>}
          </div>
          <CardTitle className="text-center text-2xl">
            Admin Login
          </CardTitle>
        </CardHeader>

        <CardContent>
          {errorMessage && (
            <p className="mb-4 rounded-md bg-red-500/15 px-3 py-2 text-sm text-red-200">
              {errorMessage}
            </p>
          )}

          <form action={loginAdmin} className="space-y-4">
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="admin@autopartspro.com"
                required
                autoComplete="username"
                className="mt-1 h-11 border-white/15 bg-white/5"
              />
            </div>

            <div>
              <Label htmlFor="password">Password</Label>

              <div className="relative mt-1">
                <Input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  required
                  minLength={8}
                  autoComplete="current-password"
                  className="h-11 border-white/15 bg-white/5 pr-12"
                />

                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2 top-1/2 -translate-y-1/2"
                >
                  {showPassword ? (
                    <EyeOff className="size-4" />
                  ) : (
                    <Eye className="size-4" />
                  )}
                </button>
              </div>
            </div>

            <Button type="submit" className="h-11 w-full">
              Login
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
