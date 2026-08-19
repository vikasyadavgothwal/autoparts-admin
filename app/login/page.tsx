import { LoginForm } from "@/components/auth/login"
import { getMainWebsiteSiteSettings } from "@/services/platform-settings/main-website-site-settings"

type LoginPageSearchParams =
  | {
      error?: string
    }
  | Promise<{
      error?: string
    }>

export default async function LoginPage({
  searchParams,
}: {
  searchParams: LoginPageSearchParams
}) {
  const resolved = await Promise.resolve(searchParams)
  const branding = await getMainWebsiteSiteSettings()

  return <LoginForm error={resolved.error} branding={branding} />
}
