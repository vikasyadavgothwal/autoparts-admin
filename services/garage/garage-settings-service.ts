import { randomBytes, randomInt, randomUUID, createHash } from "node:crypto"

import { db } from "@/lib/database/prisma"
import { verifyFirebaseIdToken } from "@/lib/firebase/admin"
import { assertMobileNumberAvailable } from "@/services/user-auth/mobile-availability-service"
import type {
  GarageDayHours,
  GarageProfileInput,
  GarageProfileRecord,
  GarageVerificationResponse,
} from "@/types/garage/settings"

type ProfileRow = Omit<
  GarageProfileRecord,
  "garageName" | "contactEmailVerifiedAt" | "mobileVerifiedAt" | "createdAt" | "updatedAt"
> & {
  contactEmailVerifiedAt: Date | null
  mobileVerifiedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

type VerificationTarget = "email" | "mobile"

type VerificationRow = {
  id: string
  garageId: string
  target: VerificationTarget
  targetValue: string
  tokenHash: string | null
  otpHash: string | null
  expiresAt: Date
  consumedAt: Date | null
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const MOBILE_PATTERN = /^\+\d{8,18}$/
const PLACE_PATTERN = /^[A-Za-z][A-Za-z\s'.-]*$/
const DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const
const DAY_SET = new Set<string>(DAYS)
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/

type GarageProfileScheduleRow = {
  workingDays: string[]
  workingHoursByDay: Record<string, unknown> | null
}

type BookingDateRow = {
  bookingDate: string | null
}

type GarageDaySchedule = {
  workingDays: string[]
  workingHoursByDay: Record<string, GarageDayHours>
}

const normalizedSchedule = (
  hoursByDay: Record<string, GarageDayHours>,
  fallbackDays: string[],
) => {
  const explicitDays = Object.entries(hoursByDay)
    .filter(([, dayHours]) => dayHours.enabled)
    .map(([day]) => day)
  return explicitDays.length > 0 ? explicitDays : fallbackDays
}

const bookingDayName = (value: string) =>
  new Date(`${value}T12:00:00`).toLocaleDateString("en-US", { weekday: "long" })

const validateNoActiveBookingsOnClosedDays = async (
  garageId: string,
  input: GarageProfileInput,
  hoursByDay: Record<string, GarageDayHours>,
  fallbackDays: string[],
) => {
  if (!("workingDays" in input) && !("workingHoursByDay" in input)) return

  const [currentProfile] = await db.$queryRaw<GarageProfileScheduleRow[]>`
    SELECT
      COALESCE("workingDays", ARRAY[]::text[]) AS "workingDays",
      "workingHoursByDay"
    FROM "garage_profiles"
    WHERE "garageId" = ${garageId}
    LIMIT 1
  `
  if (!currentProfile) return

  const currentHoursByDay =
    currentProfile.workingHoursByDay &&
    typeof currentProfile.workingHoursByDay === "object"
      ? (currentProfile.workingHoursByDay as Record<string, GarageDayHours>)
      : {}

  const currentSchedule: GarageDaySchedule = {
    workingDays: (currentProfile.workingDays ?? []).filter((day): day is string =>
      DAY_SET.has(day),
    ),
    workingHoursByDay: currentHoursByDay,
  }
  const requestedSchedule: GarageDaySchedule = {
    workingDays: fallbackDays,
    workingHoursByDay: hoursByDay,
  }

  const nextOpenDays = normalizedSchedule(
    requestedSchedule.workingHoursByDay,
    requestedSchedule.workingDays,
  )
  const currentOpenDays = normalizedSchedule(
    currentSchedule.workingHoursByDay,
    currentSchedule.workingDays,
  )
  const closedDays = currentOpenDays.filter((day) => !nextOpenDays.includes(day))
  if (closedDays.length === 0) return

  const pendingBookings = await db.$queryRaw<BookingDateRow[]>`
    SELECT "bookingDate"::text AS "bookingDate"
    FROM "garage_bookings"
    WHERE "garageId" = ${garageId}
      AND "status" IN ('pending', 'pending_slot_selection', 'confirmed')
      AND "bookingDate" IS NOT NULL
  `

  const blockedDays = closedDays.filter((day) =>
    pendingBookings.some(
      (booking) =>
        booking.bookingDate && bookingDayName(booking.bookingDate) === day,
    ),
  )
  if (blockedDays.length === 0) return

  if (blockedDays.length === 1) {
    throw new Error(
      `Complete booking(s) on ${blockedDays[0]} before marking this day as closed.`,
    )
  }

  throw new Error(
    `Complete active bookings on ${blockedDays.join(", ")} before marking these days as closed.`,
  )
}

const text = (value: unknown) =>
  typeof value === "string" ? value.trim().replace(/\s+/g, " ") : ""

const phoneText = (value: unknown) => text(value).replace(/[^\d+]/g, "")

const nullableText = (value: unknown, maxLength = 255) => {
  const normalized = text(value)
  if (!normalized) return null
  if (normalized.length > maxLength) {
    throw new Error(`Value must be ${maxLength} characters or fewer`)
  }
  return normalized
}

const paragraph = (value: unknown, maxLength = 2000) => {
  const normalized = typeof value === "string" ? value.trim() : ""
  if (!normalized) return null
  if (normalized.length > maxLength) {
    throw new Error(`Value must be ${maxLength} characters or fewer`)
  }
  return normalized
}

const integer = (value: unknown, label: string, min = 0, max = 100_000) => {
  const parsed = typeof value === "number" ? value : Number.parseInt(String(value), 10)
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    throw new Error(`${label} must be a whole number between ${min} and ${max}`)
  }
  return parsed
}

const stringList = (value: unknown, maxItems = 20, maxLength = 255) => {
  const rawValues = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(/\r?\n|,/)
      : []
  const values = rawValues
    .map((item) => text(item))
    .filter(Boolean)
    .slice(0, maxItems)
  if (values.some((item) => item.length > maxLength)) {
    throw new Error(`List values must be ${maxLength} characters or fewer`)
  }
  return Array.from(new Set(values))
}

const workingDays = (value: unknown) =>
  stringList(value, 7, 20).filter((day) => DAY_SET.has(day))

const workingHoursByDay = (value: unknown): Record<string, GarageDayHours> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {}
  }

  const entries = Object.entries(value as Record<string, unknown>)
  const result: Record<string, GarageDayHours> = {}
  for (const [day, rawHours] of entries) {
    if (!DAY_SET.has(day) || !rawHours || typeof rawHours !== "object") {
      continue
    }
    const hours = rawHours as Record<string, unknown>
    const enabled = Boolean(hours.enabled)
    const open = text(hours.open)
    const close = text(hours.close)
    if (enabled && (!TIME_PATTERN.test(open) || !TIME_PATTERN.test(close))) {
      throw new Error(`${day} working hours must use HH:MM format`)
    }
    if (enabled && open >= close) {
      throw new Error(`${day} close time must be after open time`)
    }
    result[day] = {
      enabled,
      open: enabled ? open : "",
      close: enabled ? close : "",
    }
  }
  return result
}

const hashSecret = (value: string) =>
  createHash("sha256").update(value).digest("hex")

const mapProfile = (row: ProfileRow): GarageProfileRecord => ({
  ...row,
  garageName: null,
  workingHoursByDay:
    row.workingHoursByDay && typeof row.workingHoursByDay === "object"
      ? row.workingHoursByDay
      : {},
  contactEmailVerifiedAt: row.contactEmailVerifiedAt?.toISOString() ?? null,
  mobileVerifiedAt: row.mobileVerifiedAt?.toISOString() ?? null,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
})

const userGarageName = (user?: {
  companyName?: string | null
  firstName?: string | null
  lastName?: string | null
  email?: string | null
} | null) =>
  user?.companyName ||
  [user?.firstName, user?.lastName].filter(Boolean).join(" ") ||
  user?.email ||
  null

const mapProfileWithUser = (
  row: ProfileRow,
  user?: {
    companyName?: string | null
    firstName?: string | null
    lastName?: string | null
    email?: string | null
  } | null,
): GarageProfileRecord => ({
  ...mapProfile(row),
  garageName: userGarageName(user),
})

export async function getGarageProfile(garageId: string) {
  const user = await db.user.findUnique({
    where: { id: garageId },
    select: {
      email: true,
      phone: true,
      companyName: true,
      firstName: true,
      lastName: true,
      firebaseUid: true,
      emailVerifiedAt: true,
      addressLine1: true,
      addressLine2: true,
      city: true,
      state: true,
      country: true,
    },
  })
  const fallbackAddress = [user?.addressLine1, user?.addressLine2]
    .filter(Boolean)
    .join(", ") || null

  const [profile] = await db.$queryRaw<ProfileRow[]>`
    INSERT INTO "garage_profiles" (
      "id",
      "garageId",
      "contactEmail",
      "contactEmailVerifiedAt",
      "mobile",
      "mobileVerifiedAt",
      "address",
      "country",
      "state",
      "city",
      "updatedAt"
    )
    VALUES (
      ${randomUUID()},
      ${garageId},
      ${user?.email ?? null},
      ${user?.emailVerifiedAt ?? null},
      ${user?.phone ?? null},
      ${user?.phone && user?.firebaseUid ? new Date() : null},
      ${fallbackAddress},
      ${user?.country ?? null},
      ${user?.state ?? null},
      ${user?.city ?? null},
      CURRENT_TIMESTAMP
    )
    ON CONFLICT ("garageId") DO UPDATE SET
      "garageId" = EXCLUDED."garageId"
    RETURNING
      "id",
      "garageId",
      "contactEmail",
      "contactEmailVerifiedAt",
      "mobile",
      "mobileVerifiedAt",
      "workingDays",
      "workingHours",
      "workingHoursByDay",
      "garageImageUrl",
      "garageImageKey",
      "address",
      "country",
      "state",
      "city",
      "jobCompletedNumber",
      "yearsExperience",
      "responseTime",
      "certifications",
      "about",
      "galleryImageUrls",
      "galleryImageKeys",
      "createdAt",
      "updatedAt"
  `

  let normalizedProfile = profile
  if (
    user?.email &&
    user.emailVerifiedAt &&
    normalizedProfile.contactEmail === user.email &&
    !normalizedProfile.contactEmailVerifiedAt
  ) {
    const [updated] = await db.$queryRaw<ProfileRow[]>`
      UPDATE "garage_profiles"
      SET "contactEmailVerifiedAt" = ${user.emailVerifiedAt}
      WHERE "garageId" = ${garageId}
      RETURNING
        "id", "garageId", "contactEmail", "contactEmailVerifiedAt", "mobile",
        "mobileVerifiedAt", "workingDays", "workingHours", "workingHoursByDay",
        "garageImageUrl", "garageImageKey", "address", "country", "state",
        "city", "jobCompletedNumber", "yearsExperience",
        "responseTime", "certifications", "about", "galleryImageUrls",
        "galleryImageKeys", "createdAt", "updatedAt"
    `
    normalizedProfile = updated
  }
  if (
    user?.phone &&
    user.firebaseUid &&
    normalizedProfile.mobile === user.phone &&
    !normalizedProfile.mobileVerifiedAt
  ) {
    const [updated] = await db.$queryRaw<ProfileRow[]>`
      UPDATE "garage_profiles"
      SET "mobileVerifiedAt" = CURRENT_TIMESTAMP
      WHERE "garageId" = ${garageId}
      RETURNING
        "id", "garageId", "contactEmail", "contactEmailVerifiedAt", "mobile",
        "mobileVerifiedAt", "workingDays", "workingHours", "workingHoursByDay",
        "garageImageUrl", "garageImageKey", "address", "country", "state",
        "city", "jobCompletedNumber", "yearsExperience",
        "responseTime", "certifications", "about", "galleryImageUrls",
        "galleryImageKeys", "createdAt", "updatedAt"
    `
    normalizedProfile = updated
  }

  return mapProfileWithUser(normalizedProfile, user)
}

export async function updateGarageProfile(
  garageId: string,
  input: GarageProfileInput,
) {
  const existing = await getGarageProfile(garageId)
  const user = await db.user.findUnique({
    where: { id: garageId },
    select: { email: true, phone: true, firebaseUid: true, emailVerifiedAt: true },
  })
  const garageName = nullableText(input.garageName, 160)
  const contactEmail = nullableText(input.contactEmail, 254)?.toLowerCase() ?? null
  if (contactEmail && !EMAIL_PATTERN.test(contactEmail)) {
    throw new Error("Enter a valid email address")
  }
  const mobile = nullableText(input.mobile, 40)
  if (mobile && !MOBILE_PATTERN.test(mobile)) {
    throw new Error("Enter a valid mobile number")
  }
  const country = nullableText(input.country, 80)
  const state = nullableText(input.state, 80)
  const city = nullableText(input.city, 80)
  for (const [label, value] of [
    ["Country", country],
    ["State", state],
    ["City", city],
  ] as const) {
    if (value && !PLACE_PATTERN.test(value)) {
      throw new Error(`${label} can use letters, spaces, apostrophes, periods, and hyphens only`)
    }
  }

  const emailChanged = (existing.contactEmail ?? "") !== (contactEmail ?? "")
  const mobileChanged = (existing.mobile ?? "") !== (mobile ?? "")
  if (mobileChanged && mobile !== user?.phone) {
    throw new Error("Verify the mobile number with OTP before saving")
  }
  const hoursByDay = workingHoursByDay(input.workingHoursByDay)
  const days = Object.entries(hoursByDay)
    .filter(([, hours]) => hours.enabled)
    .map(([day]) => day)
  const legacyDays = days.length ? days : workingDays(input.workingDays)
  await validateNoActiveBookingsOnClosedDays(
    garageId,
    input,
    hoursByDay,
    legacyDays,
  )
  const certifications = stringList(input.certifications, 30, 80)
  const invalidCertification = certifications.find(
    (name) => !/^[A-Za-z0-9][A-Za-z0-9\s&().,+/-]*$/.test(name),
  )
  if (invalidCertification) {
    throw new Error("Certification can only include letters, numbers, spaces, and common punctuation")
  }
  const galleryImageUrls = stringList(input.galleryImageUrls, 20, 2048)
  const galleryImageKeys = stringList(input.galleryImageKeys, 20, 2048)
  const emailVerifiedAt =
    contactEmail &&
    contactEmail === user?.email &&
    user.emailVerifiedAt
      ? user.emailVerifiedAt
      : null
  const mobileVerifiedAt =
    mobile &&
    mobile === user?.phone &&
    user.firebaseUid
      ? new Date()
      : null
  await db.user.update({
    where: { id: garageId },
    data: { companyName: garageName },
  })
  const [profile] = await db.$queryRaw<ProfileRow[]>`
    UPDATE "garage_profiles"
    SET
      "contactEmail" = ${contactEmail},
      "contactEmailVerifiedAt" = CASE
        WHEN ${emailChanged} THEN ${emailVerifiedAt}
        ELSE "contactEmailVerifiedAt"
      END,
      "mobile" = ${mobile},
      "mobileVerifiedAt" = CASE
        WHEN ${mobileChanged} THEN ${mobileVerifiedAt}
        ELSE "mobileVerifiedAt"
      END,
      "workingDays" = ${legacyDays},
      "workingHours" = ${nullableText(input.workingHours, 120)},
      "workingHoursByDay" = ${JSON.stringify(hoursByDay)}::jsonb,
      "garageImageUrl" = ${nullableText(input.garageImageUrl, 2048)},
      "garageImageKey" = ${nullableText(input.garageImageKey, 2048)},
      "address" = ${paragraph(input.address, 500)},
      "country" = ${country},
      "state" = ${state},
      "city" = ${city},
      "jobCompletedNumber" = ${integer(input.jobCompletedNumber ?? 0, "Job completed number", 0, 999999)},
      "yearsExperience" = ${integer(input.yearsExperience ?? 0, "Years of experience", 0, 150)},
      "responseTime" = ${nullableText(input.responseTime, 80)},
      "certifications" = ${certifications},
      "about" = ${paragraph(input.about, 1000)},
      "galleryImageUrls" = ${galleryImageUrls},
      "galleryImageKeys" = ${galleryImageKeys},
      "updatedAt" = CURRENT_TIMESTAMP
    WHERE "garageId" = ${garageId}
    RETURNING
      "id",
      "garageId",
      "contactEmail",
      "contactEmailVerifiedAt",
      "mobile",
      "mobileVerifiedAt",
      "workingDays",
      "workingHours",
      "workingHoursByDay",
      "garageImageUrl",
      "garageImageKey",
      "address",
      "country",
      "state",
      "city",
      "jobCompletedNumber",
      "yearsExperience",
      "responseTime",
      "certifications",
      "about",
      "galleryImageUrls",
      "galleryImageKeys",
      "createdAt",
      "updatedAt"
  `
  return {
    ...mapProfile(profile),
    garageName,
  }
}

async function sendWebhook(url: string | undefined, payload: Record<string, unknown>) {
  if (!url) return false
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  })
  return response.ok
}

export async function requestGarageEmailVerification(
  garageId: string,
  origin: string,
): Promise<GarageVerificationResponse> {
  const profile = await getGarageProfile(garageId)
  if (!profile.contactEmail) throw new Error("Add an email before verification")
  if (profile.contactEmailVerifiedAt) {
    return { ok: true, message: "Email is already verified" }
  }

  const token = randomBytes(32).toString("hex")
  await db.$executeRaw`
    INSERT INTO "garage_verification_requests" (
      "id",
      "garageId",
      "target",
      "targetValue",
      "tokenHash",
      "expiresAt"
    )
    VALUES (
      ${randomUUID()},
      ${garageId},
      'email'::"GarageVerificationTarget",
      ${profile.contactEmail},
      ${hashSecret(token)},
      CURRENT_TIMESTAMP + INTERVAL '1 hour'
    )
  `
  const verificationLink = `${origin.replace(/\/+$/, "")}/api/v1/garage/settings/verify-email?token=${token}`
  const sent = await sendWebhook(process.env.GARAGE_EMAIL_VERIFICATION_WEBHOOK_URL, {
    to: profile.contactEmail,
    verificationLink,
  })

  return {
    ok: true,
    message: sent
      ? "Verification link sent"
      : "Verification link created. Configure GARAGE_EMAIL_VERIFICATION_WEBHOOK_URL to send it automatically.",
    ...(process.env.NODE_ENV !== "production" ? { verificationLink } : {}),
  }
}

export async function verifyGarageEmail(token: string) {
  const tokenHash = hashSecret(token)
  const rows = await db.$queryRaw<VerificationRow[]>`
    UPDATE "garage_verification_requests"
    SET "consumedAt" = CURRENT_TIMESTAMP
    WHERE "id" = (
      SELECT "id"
      FROM "garage_verification_requests"
      WHERE
        "target" = 'email'::"GarageVerificationTarget"
        AND "tokenHash" = ${tokenHash}
        AND "consumedAt" IS NULL
        AND "expiresAt" > CURRENT_TIMESTAMP
      ORDER BY "createdAt" DESC
      LIMIT 1
    )
    RETURNING "id", "garageId", "target", "targetValue", "tokenHash", "otpHash", "expiresAt", "consumedAt"
  `
  const request = rows[0]
  if (!request) throw new Error("Verification link is invalid or expired")

  await db.$executeRaw`
    UPDATE "garage_profiles"
    SET
      "contactEmail" = ${request.targetValue},
      "contactEmailVerifiedAt" = CURRENT_TIMESTAMP,
      "updatedAt" = CURRENT_TIMESTAMP
    WHERE "garageId" = ${request.garageId}
  `
  return { ok: true as const, message: "Email verified successfully" }
}

export async function requestGarageMobileOtp(
  garageId: string,
): Promise<GarageVerificationResponse> {
  const profile = await getGarageProfile(garageId)
  if (!profile.mobile) throw new Error("Add a mobile number before verification")
  if (profile.mobileVerifiedAt) {
    return { ok: true, message: "Mobile number is already verified" }
  }

  const otp = String(randomInt(100000, 1000000))
  await db.$executeRaw`
    INSERT INTO "garage_verification_requests" (
      "id",
      "garageId",
      "target",
      "targetValue",
      "otpHash",
      "expiresAt"
    )
    VALUES (
      ${randomUUID()},
      ${garageId},
      'mobile'::"GarageVerificationTarget",
      ${profile.mobile},
      ${hashSecret(otp)},
      CURRENT_TIMESTAMP + INTERVAL '10 minutes'
    )
  `
  const sent = await sendWebhook(process.env.GARAGE_SMS_OTP_WEBHOOK_URL, {
    to: profile.mobile,
    otp,
  })
  return {
    ok: true,
    message: sent
      ? "OTP sent"
      : "OTP created. Configure GARAGE_SMS_OTP_WEBHOOK_URL to send it automatically.",
    ...(process.env.NODE_ENV !== "production" ? { otp } : {}),
  }
}

export async function verifyGarageMobileOtp(garageId: string, otp: string) {
  const otpHash = hashSecret(text(otp))
  const rows = await db.$queryRaw<VerificationRow[]>`
    UPDATE "garage_verification_requests"
    SET "consumedAt" = CURRENT_TIMESTAMP
    WHERE "id" = (
      SELECT "id"
      FROM "garage_verification_requests"
      WHERE
        "garageId" = ${garageId}
        AND "target" = 'mobile'::"GarageVerificationTarget"
        AND "otpHash" = ${otpHash}
        AND "consumedAt" IS NULL
        AND "expiresAt" > CURRENT_TIMESTAMP
      ORDER BY "createdAt" DESC
      LIMIT 1
    )
    RETURNING "id", "garageId", "target", "targetValue", "tokenHash", "otpHash", "expiresAt", "consumedAt"
  `
  const request = rows[0]
  if (!request) throw new Error("OTP is invalid or expired")

  await db.$executeRaw`
    UPDATE "garage_profiles"
    SET
      "mobile" = ${request.targetValue},
      "mobileVerifiedAt" = CURRENT_TIMESTAMP,
      "updatedAt" = CURRENT_TIMESTAMP
    WHERE "garageId" = ${garageId}
  `
  return getGarageProfile(garageId)
}

export async function verifyGarageMobileWithFirebase(
  garageId: string,
  firebaseIdToken: string,
) {
  const decodedToken = await verifyFirebaseIdToken(firebaseIdToken)
  const phone = phoneText(decodedToken.phone_number)
  if (!phone) {
    throw new Error("Firebase token does not include a verified mobile number")
  }

  await assertMobileNumberAvailable(garageId, phone)

  await db.user.update({
    where: { id: garageId },
    data: { phone },
  })

  await db.$executeRaw`
    UPDATE "garage_profiles"
    SET
      "mobile" = ${phone},
      "mobileVerifiedAt" = CURRENT_TIMESTAMP,
      "updatedAt" = CURRENT_TIMESTAMP
    WHERE "garageId" = ${garageId}
  `

  return getGarageProfile(garageId)
}
