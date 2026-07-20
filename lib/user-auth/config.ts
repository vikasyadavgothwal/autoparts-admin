const parsePositiveInt = (value: string | undefined, fallback: number) => {
  const parsed = Number.parseInt(value ?? "", 10)
  return Number.isNaN(parsed) || parsed <= 0 ? fallback : parsed
}

export const USER_AUTH = {
  accessCookieName: process.env.USER_ACCESS_COOKIE_NAME ?? "user_access_token",
  refreshCookieName:
    process.env.USER_REFRESH_COOKIE_NAME ?? "user_refresh_token",
  accessTokenSecret: process.env.USER_JWT_ACCESS_SECRET,
  refreshTokenSecret: process.env.USER_JWT_REFRESH_SECRET,
  accessTokenTtlSeconds: parsePositiveInt(
    process.env.USER_ACCESS_TTL_SECONDS,
    15 * 60,
  ),
  refreshTokenTtlDays: parsePositiveInt(
    process.env.USER_REFRESH_TTL_DAYS,
    30,
  ),
  refreshTokenHashRounds: parsePositiveInt(
    process.env.USER_REFRESH_HASH_ROUNDS,
    12,
  ),
}

export const getUserCookieOptions = () => {
  const configuredDomain = process.env.USER_COOKIE_DOMAIN?.trim()
  const domain = configuredDomain ||
    (process.env.NODE_ENV === "production"
      ? ".websitedesignersdubai.ae"
      : undefined)

  return {
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
    sameSite: "strict" as const,
    path: "/",
    ...(domain ? { domain } : {}),
  }
}

export const isUserAuthConfigured = () =>
  Boolean(USER_AUTH.accessTokenSecret && USER_AUTH.refreshTokenSecret)
