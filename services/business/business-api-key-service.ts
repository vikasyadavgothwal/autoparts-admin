import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  randomUUID,
} from "node:crypto"
import { NextRequest, NextResponse } from "next/server"

import { db } from "@/lib/database/prisma"
import { BusinessAccountType, type Prisma } from "@/lib/generated/prisma/client"
import { consumeUserAuthRateLimit } from "@/lib/user-auth/security"
import { getMyBusinessAccess, logBusinessActivity } from "@/services/business/business-platform-service"

export const developerApiScopes = {
  Garage: [
    "account.profile.read",
    "account.profile.write",
    "garage.services.read",
    "garage.services.write",
    "garage.bookings.read",
    "garage.bookings.write",
  ],
  Fleet: [
    "account.profile.read",
    "account.profile.write",
    "fleet.vehicles.read",
    "fleet.vehicles.write",
  ],
  Supplier: [
    "account.profile.read",
    "account.profile.write",
    "supplier.inventory.read",
    "supplier.inventory.write",
  ],
} satisfies Record<BusinessAccountType, string[]>

export const developerApiScopeLabels = {
  "account.profile.read": "Read business profile",
  "account.profile.write": "Update business profile",
  "garage.services.read": "Read garage services",
  "garage.services.write": "Create and update garage services",
  "garage.bookings.read": "Read garage bookings",
  "garage.bookings.write": "Create and update garage bookings",
  "fleet.vehicles.read": "Read fleet vehicles",
  "fleet.vehicles.write": "Create and update fleet vehicles",
  "supplier.inventory.read": "Read supplier inventory",
  "supplier.inventory.write": "Create and update supplier inventory",
} satisfies Record<string, string>

type BusinessApiKeyRow = {
  id: string
  businessAccountId: string
  name: string
  keyPrefix: string
  scopes: string[]
  status: string
  createdByUserId: string | null
  revokedByUserId: string | null
  revokedAt: Date | null
  lastUsedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

type ApiBillingState = {
  allowed: boolean
  status: number
  code: string
  message: string
  apiTier: "standard" | "enterprise" | "none"
}

type ApiAccountAccess = Awaited<ReturnType<typeof getMyBusinessAccess>>[number]

export type DeveloperApiContext = {
  apiKeyId: string
  businessAccountId: string
  accountType: BusinessAccountType
  ownerUserId: string
  apiTier: "standard" | "enterprise"
  scopes: string[]
}

const cleanText = (value: unknown, max = 120) =>
  typeof value === "string"
    ? value.replace(/[\r\n\t]+/g, " ").replace(/\s+/g, " ").trim().slice(0, max)
    : ""

const normalizedTextLength = (value: unknown) =>
  typeof value === "string"
    ? value.replace(/[\r\n\t]+/g, " ").replace(/\s+/g, " ").trim().length
    : 0

const hashApiKey = (apiKey: string) =>
  createHash("sha256").update(apiKey).digest("hex")

const keyPrefixFor = (apiKey: string) => apiKey.slice(0, 28)

const apiKeyEncryptionKey = () => {
  const secret =
    process.env.API_KEY_ENCRYPTION_SECRET?.trim() ||
    process.env.ADMIN_TOKEN_PEPPER?.trim()
  if (!secret) {
    throw new Error(
      "API key encryption is not configured. Set API_KEY_ENCRYPTION_SECRET.",
    )
  }
  return createHash("sha256").update(`autoparts-api-key:${secret}`).digest()
}

const encryptApiKey = (apiKey: string) => {
  const iv = randomBytes(12)
  const cipher = createCipheriv("aes-256-gcm", apiKeyEncryptionKey(), iv)
  const ciphertext = Buffer.concat([cipher.update(apiKey, "utf8"), cipher.final()])
  const tag = cipher.getAuthTag()
  return [
    "v1",
    iv.toString("base64url"),
    tag.toString("base64url"),
    ciphertext.toString("base64url"),
  ].join(".")
}

const decryptApiKey = (encrypted: string) => {
  const [version, ivValue, tagValue, ciphertextValue] = encrypted.split(".")
  if (version !== "v1" || !ivValue || !tagValue || !ciphertextValue) {
    throw new Error("Invalid encrypted API key")
  }
  const decipher = createDecipheriv(
    "aes-256-gcm",
    apiKeyEncryptionKey(),
    Buffer.from(ivValue, "base64url"),
  )
  decipher.setAuthTag(Buffer.from(tagValue, "base64url"))
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertextValue, "base64url")),
    decipher.final(),
  ]).toString("utf8")
}

const mapApiKey = (row: BusinessApiKeyRow) => ({
  id: row.id,
  businessAccountId: row.businessAccountId,
  name: row.name,
  keyPrefix: row.keyPrefix,
  maskedKey: `${row.keyPrefix}••••••••`,
  scopes: row.scopes,
  status: row.status,
  createdByUserId: row.createdByUserId,
  revokedByUserId: row.revokedByUserId,
  revokedAt: row.revokedAt?.toISOString() ?? null,
  lastUsedAt: row.lastUsedAt?.toISOString() ?? null,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
})

const addPlanPeriod = (
  date: Date,
  plan: { billingPeriod?: string | null; monthlyBillingDays?: number | null },
) => {
  const period = plan.billingPeriod?.toLowerCase() ?? ""
  const next = new Date(date)
  if (period.includes("year")) {
    next.setFullYear(next.getFullYear() + 1)
    return next
  }
  if (period.includes("month")) {
    next.setDate(next.getDate() + (plan.monthlyBillingDays ?? 30))
    return next
  }
  return null
}

const apiBillingState = (access: ApiAccountAccess): ApiBillingState => {
  const enabled = new Set(access.enabledFeatures)
  const apiTier = enabled.has("api.enterprise")
    ? "enterprise"
    : enabled.has("api.standard")
      ? "standard"
      : "none"
  if (!access.businessAccount.plan.isActive) {
    return {
      allowed: false,
      status: 402,
      code: "API_BILLING_REQUIRED",
      message: "API access is paused because this business account or plan is inactive. Renew the plan or contact Admin.",
      apiTier,
    }
  }
  const endsAt = access.businessAccount.subscription.endsAt
    ? new Date(access.businessAccount.subscription.endsAt)
    : addPlanPeriod(new Date(access.businessAccount.updatedAt), access.businessAccount.plan.price)
  if (endsAt && endsAt.getTime() < Date.now()) {
    return {
      allowed: false,
      status: 402,
      code: "API_BILLING_REQUIRED",
      message: "API access is paused because the plan billing period has ended. Renew the plan or contact Admin.",
      apiTier,
    }
  }
  if (!access.actions["api.access"]?.allowed) {
    return {
      allowed: false,
      status: 402,
      code: "API_BILLING_REQUIRED",
      message: `${access.businessAccount.plan.name} does not include API access. Request the API add-on or upgrade your plan.`,
      apiTier,
    }
  }
  return {
    allowed: true,
    status: 200,
    code: "OK",
    message: "API access is active.",
    apiTier: apiTier === "none" ? "standard" : apiTier,
  }
}

const accountAccessForUser = async (userId: string, businessAccountId: unknown) => {
  const id = cleanText(businessAccountId, 80)
  if (!id) throw new Error("Business account id is required")
  const access = (await getMyBusinessAccess(userId)).find((item) => item.businessAccount.id === id)
  if (!access) throw new Error("Business account was not found")
  return access
}

export async function getBusinessApiAccessState(input: {
  userId: string
  businessAccountId: unknown
}) {
  const access = await accountAccessForUser(input.userId, input.businessAccountId)
  const billing = apiBillingState(access)
  return {
    allowed: billing.allowed,
    code: billing.code,
    message: billing.message,
    apiTier: billing.apiTier,
    availableScopes: developerApiScopes[access.businessAccount.type].map((scope) => ({
      key: scope,
      label: developerApiScopeLabels[scope as keyof typeof developerApiScopeLabels],
    })),
  }
}

const assertApiKeyManagementAccess = async (input: {
  userId: string
  businessAccountId: unknown
}) => {
  const access = await accountAccessForUser(input.userId, input.businessAccountId)
  if (!access.businessAccount.isOwner) {
    throw new Error("Only the business account owner can manage API keys")
  }
  const billing = apiBillingState(access)
  return { access, billing }
}

export async function listBusinessApiKeys(input: {
  userId: string
  businessAccountId: unknown
}) {
  const { access, billing } = await assertApiKeyManagementAccess(input)
  const rows = await db.$queryRaw<BusinessApiKeyRow[]>`
    SELECT
      "id", "businessAccountId", "name", "keyPrefix", "scopes", "status",
      "createdByUserId", "revokedByUserId", "revokedAt", "lastUsedAt",
      "createdAt", "updatedAt"
    FROM "business_api_keys"
    WHERE "businessAccountId" = ${access.businessAccount.id}
    ORDER BY "createdAt" DESC
  `
  return {
    apiAccess: {
      allowed: billing.allowed,
      code: billing.code,
      message: billing.message,
      apiTier: billing.apiTier,
      availableScopes: developerApiScopes[access.businessAccount.type].map((scope) => ({
        key: scope,
        label: developerApiScopeLabels[scope as keyof typeof developerApiScopeLabels],
      })),
    },
    apiKeys: rows.map(mapApiKey),
  }
}

const normalizeScopes = (accountType: BusinessAccountType, value: unknown) => {
  const allowed = new Set(developerApiScopes[accountType])
  const requested = Array.isArray(value)
    ? value.map((scope) => cleanText(scope, 120)).filter(Boolean)
    : []
  const scopes = Array.from(new Set(requested.filter((scope) => allowed.has(scope))))
  return scopes.length ? scopes : developerApiScopes[accountType].filter((scope) => scope.endsWith(".read"))
}

export async function createBusinessApiKey(input: {
  userId: string
  businessAccountId: unknown
  name: unknown
  scopes: unknown
}) {
  const { access, billing } = await assertApiKeyManagementAccess(input)
  if (!billing.allowed) {
    const error = new Error(billing.message)
    error.name = billing.code
    throw error
  }
  const nameLength = normalizedTextLength(input.name)
  if (nameLength < 3 || nameLength > 80) {
    throw new Error("API key name must be between 3 and 80 characters")
  }
  const name = cleanText(input.name, 80)
  const scopes = normalizeScopes(access.businessAccount.type, input.scopes)
  if (!scopes.length) throw new Error("Select at least one API scope")
  const apiKey = `app_live_${access.businessAccount.type.toLowerCase()}_${randomBytes(32).toString("base64url")}`
  const encryptedKey = encryptApiKey(apiKey)
  const id = randomUUID()
  const [row] = await db.$queryRaw<BusinessApiKeyRow[]>`
    INSERT INTO "business_api_keys" (
      "id", "businessAccountId", "name", "keyPrefix", "keyHash", "encryptedKey", "scopes",
      "status", "createdByUserId", "updatedAt"
    )
    VALUES (
      ${id},
      ${access.businessAccount.id},
      ${name},
      ${keyPrefixFor(apiKey)},
      ${hashApiKey(apiKey)},
      ${encryptedKey},
      ${scopes},
      'Active',
      ${input.userId},
      NOW()
    )
    RETURNING
      "id", "businessAccountId", "name", "keyPrefix", "scopes", "status",
      "createdByUserId", "revokedByUserId", "revokedAt", "lastUsedAt",
      "createdAt", "updatedAt"
  `
  await logBusinessActivity({
    businessAccountId: access.businessAccount.id,
    actorUserId: input.userId,
    action: "business_api_key.created",
    entityType: "business_api_key",
    entityId: row.id,
    metadata: { name, keyPrefix: row.keyPrefix, scopes } satisfies Prisma.InputJsonObject,
  })
  return { apiKey, key: mapApiKey(row) }
}

export async function revokeBusinessApiKey(input: {
  userId: string
  businessAccountId: unknown
  keyId: unknown
}) {
  const { access } = await assertApiKeyManagementAccess(input)
  const keyId = cleanText(input.keyId, 80)
  if (!keyId) throw new Error("API key id is required")
  const rows = await db.$queryRaw<BusinessApiKeyRow[]>`
    UPDATE "business_api_keys"
    SET "status" = 'Revoked',
        "revokedAt" = NOW(),
        "revokedByUserId" = ${input.userId},
        "updatedAt" = NOW()
    WHERE "id" = ${keyId}
      AND "businessAccountId" = ${access.businessAccount.id}
      AND "status" = 'Active'
    RETURNING
      "id", "businessAccountId", "name", "keyPrefix", "scopes", "status",
      "createdByUserId", "revokedByUserId", "revokedAt", "lastUsedAt",
      "createdAt", "updatedAt"
  `
  if (!rows[0]) throw new Error("Active API key was not found")
  await logBusinessActivity({
    businessAccountId: access.businessAccount.id,
    actorUserId: input.userId,
    action: "business_api_key.revoked",
    entityType: "business_api_key",
    entityId: rows[0].id,
    metadata: { keyPrefix: rows[0].keyPrefix } satisfies Prisma.InputJsonObject,
  })
  return mapApiKey(rows[0])
}

const apiKeyFromRequest = (request: NextRequest) => {
  const bearer = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim()
  return bearer || request.headers.get("x-api-key")?.trim() || ""
}

const errorResponse = (status: number, code: string, message: string, extra?: Record<string, unknown>) =>
  NextResponse.json({ ok: false, code, message, ...extra }, { status })

export async function requireDeveloperApiKey(
  request: NextRequest,
  accountType: BusinessAccountType,
  scope: string,
): Promise<
  | { ok: true; context: DeveloperApiContext }
  | { ok: false; response: NextResponse }
> {
  const apiKey = apiKeyFromRequest(request)
  if (!apiKey) {
    return { ok: false, response: errorResponse(401, "API_KEY_REQUIRED", "Send an API key using Authorization: Bearer <key> or x-api-key.") }
  }
  const rows = await db.$queryRaw<Array<{
    id: string
    businessAccountId: string
    ownerUserId: string
    accountType: BusinessAccountType
    encryptedKey: string | null
    scopes: string[]
    status: string
  }>>`
    SELECT
      k."id",
      k."businessAccountId",
      ba."ownerUserId",
      ba."type" AS "accountType",
      k."encryptedKey",
      k."scopes",
      k."status"
    FROM "business_api_keys" k
    JOIN "business_accounts" ba ON ba."id" = k."businessAccountId"
    WHERE k."keyHash" = ${hashApiKey(apiKey)}
    LIMIT 1
  `
  const row = rows[0]
  if (!row) {
    return { ok: false, response: errorResponse(401, "API_KEY_INVALID", "The API key you provided is not valid. Check that you copied the complete key and try again.") }
  }
  if (row.status !== "Active") {
    return { ok: false, response: errorResponse(401, "API_KEY_REVOKED", "This API key has been revoked. Create or use an active key and try again.") }
  }
  if (row.encryptedKey) {
    try {
      if (decryptApiKey(row.encryptedKey) !== apiKey) {
        return { ok: false, response: errorResponse(401, "API_KEY_INVALID", "The API key you provided is not valid. Check that you copied the complete key and try again.") }
      }
    } catch {
      return { ok: false, response: errorResponse(401, "API_KEY_INVALID", "The API key you provided is not valid. Check that you copied the complete key and try again.") }
    }
  }
  if (row.accountType !== accountType) {
    return { ok: false, response: errorResponse(403, "API_ACCOUNT_TYPE_FORBIDDEN", `This API key cannot access ${accountType} APIs.`) }
  }
  if (!row.scopes.includes(scope)) {
    return { ok: false, response: errorResponse(403, "API_SCOPE_FORBIDDEN", `This API key is missing scope: ${scope}.`) }
  }
  const access = (await getMyBusinessAccess(row.ownerUserId)).find((item) => item.businessAccount.id === row.businessAccountId)
  if (!access) {
    return { ok: false, response: errorResponse(402, "API_BILLING_REQUIRED", "API access is paused because the business account is no longer active.") }
  }
  const billing = apiBillingState(access)
  if (!billing.allowed) {
    return { ok: false, response: errorResponse(billing.status, billing.code, billing.message) }
  }
  const limit = billing.apiTier === "enterprise" ? 600 : 120
  const rateLimit = await consumeUserAuthRateLimit(`developer-api:${row.id}`, limit, 60_000)
  if (!rateLimit.allowed) {
    return {
      ok: false,
      response: errorResponse(429, "API_RATE_LIMITED", "Too many API requests. Try again after the retry window.", {
        retryAfterSeconds: rateLimit.retryAfterSeconds,
      }),
    }
  }
  await db.$executeRaw`
    UPDATE "business_api_keys"
    SET "lastUsedAt" = NOW(), "updatedAt" = NOW()
    WHERE "id" = ${row.id}
  `
  return {
    ok: true,
    context: {
      apiKeyId: row.id,
      businessAccountId: row.businessAccountId,
      accountType,
      ownerUserId: row.ownerUserId,
      apiTier: billing.apiTier === "enterprise" ? "enterprise" : "standard",
      scopes: row.scopes,
    },
  }
}
