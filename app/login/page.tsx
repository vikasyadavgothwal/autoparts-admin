import { LoginForm } from "@/components/auth/login"

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

  return <LoginForm error={resolved.error} />
}
