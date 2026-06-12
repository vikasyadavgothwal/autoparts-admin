const parsePositiveInt = (value: string | undefined, fallback: number) => {
  const parsed = Number.parseInt(value ?? "", 10)
  return Number.isNaN(parsed) || parsed <= 0 ? fallback : parsed
}

export const ADMIN_AUTH = {
  accessCookieName: process.env.ADMIN_ACCESS_COOKIE_NAME ?? "admin_access_token",
  refreshCookieName: process.env.ADMIN_REFRESH_COOKIE_NAME ?? "admin_refresh_token",
  accessTokenSecret: process.env.ADMIN_JWT_ACCESS_SECRET,
  refreshTokenSecret: process.env.ADMIN_JWT_REFRESH_SECRET,
  tokenPepper: process.env.ADMIN_TOKEN_PEPPER,
  firstAdminToken: process.env.ADMIN_BOOTSTRAP_TOKEN ?? "",
  accessTokenTtlSeconds: parsePositiveInt(process.env.ADMIN_ACCESS_TTL_SECONDS, 900),
  refreshTokenTtlDays: parsePositiveInt(process.env.ADMIN_REFRESH_TTL_DAYS, 7),
}

export const isAdminAuthSecretConfigured = () =>
  Boolean(ADMIN_AUTH.accessTokenSecret && ADMIN_AUTH.refreshTokenSecret)

export const getAdminCookieOptions = () => {
  const isProd = process.env.NODE_ENV === "production"

  return {
    secure: isProd,
    httpOnly: true,
    sameSite: "strict" as const,
    path: "/",
  }
}
