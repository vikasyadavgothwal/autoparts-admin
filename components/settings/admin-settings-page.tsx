"use client"

import { useState } from "react"
import { ShieldCheck, UserRound, KeyRound, Settings2 } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { GarageBookingFeeSettings } from "@/components/settings/garage-booking-fee-settings"

type AdminProfile = {
  email: string
  name: string | null
}

const PASSWORD_MIN_LENGTH = 8
const PASSWORD_MAX_LENGTH = 128
const PASSWORD_PATTERN = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/

const RequiredMark = () => <span aria-hidden="true" className="text-[#DC2626]"> *</span>

export function AdminSettingsPage({ admin }: { admin: AdminProfile }) {
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [savingPassword, setSavingPassword] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  async function changePassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setMessage(null)
    if (!currentPassword) {
      toast.error("Current password is required.")
      return
    }
    if (!newPassword) {
      toast.error("New password is required.")
      return
    }
    if (!confirmPassword) {
      toast.error("Confirm password is required.")
      return
    }
    if (newPassword.length < PASSWORD_MIN_LENGTH || newPassword.length > PASSWORD_MAX_LENGTH) {
      toast.error(`New password must be between ${PASSWORD_MIN_LENGTH} and ${PASSWORD_MAX_LENGTH} characters.`)
      return
    }
    if (!PASSWORD_PATTERN.test(newPassword)) {
      toast.error("New password must include uppercase, lowercase, and number characters.")
      return
    }
    if (currentPassword === newPassword) {
      toast.error("New password must be different from current password.")
      return
    }
    if (newPassword !== confirmPassword) {
      toast.error("New password and confirmation do not match.")
      return
    }
    setSavingPassword(true)
    try {
      const response = await fetch("/api/v1/admin/auth/change-password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok || payload?.ok === false) {
        throw new Error(payload?.message ?? "Unable to change password")
      }
      setCurrentPassword("")
      setNewPassword("")
      setConfirmPassword("")
      setMessage("Password changed. Please sign in again.")
      toast.success("Password changed successfully.")
      window.setTimeout(() => {
        window.location.href = "/login"
      }, 900)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unable to change password"
      setMessage(errorMessage)
      toast.error(errorMessage)
    } finally {
      setSavingPassword(false)
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm font-medium uppercase tracking-wide text-[#9CA3AF]">Admin console</p>
        <h1 className="mt-2 text-3xl font-bold text-white">Settings</h1>
        <p className="mt-2 max-w-3xl text-sm text-[#9CA3AF]">
          Manage secure access and platform-level controls for AutoParts Pro.
        </p>
      </div>

      <section className="grid gap-4 lg:grid-cols-3">
        {[
          { label: "Signed in as", value: admin.email, icon: UserRound },
          { label: "Access level", value: "Administrator", icon: ShieldCheck },
          { label: "Security", value: "Session protected", icon: KeyRound },
        ].map((item) => {
          const Icon = item.icon
          return (
            <Card key={item.label} className="rounded-lg border border-[#2A2A2A] bg-[#1A1A1A] shadow-none">
              <CardContent className="flex items-center gap-4 p-4">
                <span className="flex h-10 w-10 items-center justify-center rounded-md border border-[#DC2626]/20 bg-[#DC2626]/10 text-[#DC2626]">
                  <Icon className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <p className="text-xs uppercase tracking-wide text-[#9CA3AF]">{item.label}</p>
                  <p className="truncate text-sm font-semibold text-white">{item.value}</p>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="space-y-6">
          <GarageBookingFeeSettings />

          <Card className="rounded-lg border border-[#2A2A2A] bg-[#1A1A1A] shadow-none">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-white">
                <Settings2 className="h-5 w-5 text-[#DC2626]" />
                Platform Operations
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 text-sm text-[#9CA3AF] md:grid-cols-2">
              <div className="rounded-md border border-[#2A2A2A] bg-[#0A0A0A] p-3">
                <p className="font-medium text-white">Business plans</p>
                <p className="mt-1">Plan pricing, limits, add-ons, and support workflows are managed from Business Platform.</p>
              </div>
              <div className="rounded-md border border-[#2A2A2A] bg-[#0A0A0A] p-3">
                <p className="font-medium text-white">Public content</p>
                <p className="mt-1">Homepage, business, supplier, RFQ, services, and legal pages are managed from Pages.</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="rounded-lg border border-[#2A2A2A] bg-[#1A1A1A] shadow-none">
          <CardHeader>
            <CardTitle className="text-white">Change Password</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={changePassword}>
              <div className="space-y-2">
                <Label htmlFor="current-password">Current Password<RequiredMark /></Label>
                <Input id="current-password" type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value.slice(0, PASSWORD_MAX_LENGTH))} maxLength={PASSWORD_MAX_LENGTH} className="border-[#2A2A2A] bg-[#0A0A0A]" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-password">New Password<RequiredMark /></Label>
                <Input id="new-password" type="password" minLength={PASSWORD_MIN_LENGTH} maxLength={PASSWORD_MAX_LENGTH} value={newPassword} onChange={(event) => setNewPassword(event.target.value.slice(0, PASSWORD_MAX_LENGTH))} className="border-[#2A2A2A] bg-[#0A0A0A]" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirm New Password<RequiredMark /></Label>
                <Input id="confirm-password" type="password" minLength={PASSWORD_MIN_LENGTH} maxLength={PASSWORD_MAX_LENGTH} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value.slice(0, PASSWORD_MAX_LENGTH))} className="border-[#2A2A2A] bg-[#0A0A0A]" required />
              </div>
              {message ? <p className="rounded-md border border-[#2A2A2A] bg-[#0A0A0A] px-3 py-2 text-sm text-[#E5E7EB]">{message}</p> : null}
              <Button type="submit" disabled={savingPassword} className="w-full bg-[#DC2626] text-white hover:bg-[#B91C1C]">
                {savingPassword ? "Updating..." : "Update Password"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </section>
    </div>
  )
}
