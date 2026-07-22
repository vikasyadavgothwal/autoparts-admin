import { db } from "@/lib/database/prisma"
import { Prisma } from "@/lib/generated/prisma/client"
import { createSignedS3ObjectUrl } from "@/lib/storage/s3"
import type {
  PublicGarageDetail,
  PublicGarageListResponse,
  PublicGarageReview,
  PublicGarageService,
  PublicGarageSummary,
} from "@/types/garage/public"
import type { GarageDayHours } from "@/types/garage/settings"

const DEFAULT_PAGE_SIZE = 6
const MAX_PAGE_SIZE = 24
const DEFAULT_CURRENCY = "AED"

type PublicGarageRow = {
  id: string
  email: string | null
  phone: string | null
  companyName: string | null
  firstName: string | null
  lastName: string | null
  addressLine1: string | null
  city: string | null
  state: string | null
  postalCode: string | null
  country: string | null
  contactEmail: string | null
  mobile: string | null
  workingDays: string[] | null
  workingHours: string | null
  workingHoursByDay: unknown
  garageImageUrl: string | null
  garageImageKey: string | null
  profileAddress: string | null
  profileCountry: string | null
  profileState: string | null
  profileCity: string | null
  pincode: string | null
  jobCompletedNumber: number | null
  yearsExperience: number | null
  responseTime: string | null
  certifications: string[] | null
  about: string | null
  galleryImageUrls: string[] | null
  galleryImageKeys: string[] | null
  services: PublicGarageService[] | null
  ratingAverage: number | string | null
  reviewCount: bigint | number | null
  reviews: PublicGarageReview[] | null
}

type CountRow = { total: bigint | number }

const numberParam = (
  value: string | number | null | undefined,
  fallback: number,
  max?: number,
) => {
  const parsed = Number.parseInt(String(value ?? ""), 10)
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback
  return max ? Math.min(parsed, max) : parsed
}

const displayName = (garage: PublicGarageRow) =>
  garage.companyName ||
  [garage.firstName, garage.lastName].filter(Boolean).join(" ") ||
  garage.email ||
  "Garage"

const publicImageUrl = async (key?: string | null, fallback?: string | null) => {
  if (!key) return fallback ?? null

  try {
    return await createSignedS3ObjectUrl(key, 5 * 60)
  } catch {
    return fallback ?? null
  }
}

const workingHoursByDay = (value: unknown): Record<string, GarageDayHours> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, GarageDayHours>)
    : {}

const mapServices = (services: PublicGarageService[] | null = []) =>
  (services ?? []).map((service) => ({
    id: service.id,
    name: service.name,
    category: service.category,
    durationMinutes: service.durationMinutes,
    price: service.price,
    currency: service.currency,
  }))

const mapReviews = (reviews: PublicGarageReview[] | null = []) =>
  (reviews ?? []).map((review) => ({
    id: review.id,
    customerName: review.customerName,
    serviceName: review.serviceName,
    rating: review.rating,
    comment: review.comment,
    garageReply: review.garageReply,
    date: review.date,
  }))

const mapSummary = async (
  garage: PublicGarageRow,
): Promise<PublicGarageSummary> => {
  const services = mapServices(garage.services)
  const firstPricedService = services.find((service) => service.price > 0)
  const specialties = Array.from(
    new Set(services.map((service) => service.category || service.name).filter(Boolean)),
  )
  const schedule = workingHoursByDay(garage.workingHoursByDay)
  const todayName = new Intl.DateTimeFormat("en-US", { weekday: "long", timeZone: "Asia/Dubai" }).format(new Date())
  const availableToday = Boolean(schedule[todayName]?.enabled || garage.workingDays?.includes(todayName))
  const availableThisWeek = Object.values(schedule).some((hours) => hours?.enabled) || Boolean(garage.workingDays?.length)

  return {
    id: garage.id,
    name: displayName(garage),
    email: garage.contactEmail ?? garage.email ?? null,
    mobile: garage.mobile ?? garage.phone ?? null,
    address: garage.profileAddress ?? garage.addressLine1 ?? null,
    country: garage.profileCountry ?? garage.country ?? null,
    state: garage.profileState ?? garage.state ?? null,
    city: garage.profileCity ?? garage.city ?? null,
    pincode: garage.pincode ?? garage.postalCode ?? null,
    image: await publicImageUrl(garage.garageImageKey, garage.garageImageUrl),
    imageKey: garage.garageImageKey ?? null,
    jobCompletedNumber: garage.jobCompletedNumber ?? 0,
    yearsExperience: garage.yearsExperience ?? 0,
    responseTime: garage.responseTime ?? null,
    certifications: garage.certifications ?? [],
    specialties,
    startingPrice: firstPricedService?.price ?? null,
    currency: firstPricedService?.currency ?? DEFAULT_CURRENCY,
    ratingAverage: Number(garage.ratingAverage ?? 0),
    reviewCount: Number(garage.reviewCount ?? 0),
    availableToday,
    availableThisWeek,
  }
}

const baseGarageWhere = Prisma.sql`
  u."isActive" = true
  AND ('Garage'::"UserRole" = ANY(u."roles") OR u."activeRole" = 'Garage'::"UserRole")
`

const textSearchCondition = (value: string) => Prisma.sql`
  (
    u."companyName" ILIKE ${`%${value}%`}
    OR u."firstName" ILIKE ${`%${value}%`}
    OR u."lastName" ILIKE ${`%${value}%`}
    OR u."email" ILIKE ${`%${value}%`}
    OR u."city" ILIKE ${`%${value}%`}
    OR u."state" ILIKE ${`%${value}%`}
    OR u."country" ILIKE ${`%${value}%`}
    OR u."postalCode" ILIKE ${`%${value}%`}
    OR gp."address" ILIKE ${`%${value}%`}
    OR gp."city" ILIKE ${`%${value}%`}
    OR gp."state" ILIKE ${`%${value}%`}
    OR gp."country" ILIKE ${`%${value}%`}
    OR gp."pincode" ILIKE ${`%${value}%`}
    OR EXISTS (
      SELECT 1 FROM "garage_services" gs
      WHERE gs."garageId" = u."id"
        AND gs."status" = 'active'::"GarageServiceStatus"
        AND (gs."name" ILIKE ${`%${value}%`} OR gs."category" ILIKE ${`%${value}%`})
    )
  )
`

const serviceSearchCondition = (value: string) => Prisma.sql`
  (
    u."companyName" ILIKE ${`%${value}%`}
    OR EXISTS (
      SELECT 1 FROM "garage_services" gs
      WHERE gs."garageId" = u."id"
        AND gs."status" = 'active'::"GarageServiceStatus"
        AND (gs."name" ILIKE ${`%${value}%`} OR gs."category" ILIKE ${`%${value}%`})
    )
  )
`

const locationSearchCondition = (value: string) => Prisma.sql`
  (
    u."city" ILIKE ${`%${value}%`}
    OR u."state" ILIKE ${`%${value}%`}
    OR u."country" ILIKE ${`%${value}%`}
    OR u."postalCode" ILIKE ${`%${value}%`}
    OR gp."address" ILIKE ${`%${value}%`}
    OR gp."city" ILIKE ${`%${value}%`}
    OR gp."state" ILIKE ${`%${value}%`}
    OR gp."country" ILIKE ${`%${value}%`}
    OR gp."pincode" ILIKE ${`%${value}%`}
  )
`

const garageSelect = Prisma.sql`
  SELECT
    u."id",
    u."email",
    u."phone",
    u."companyName",
    u."firstName",
    u."lastName",
    u."addressLine1",
    u."city",
    u."state",
    u."postalCode",
    u."country",
    gp."contactEmail",
    gp."mobile",
    gp."workingDays",
    gp."workingHours",
    gp."workingHoursByDay",
    gp."garageImageUrl",
    gp."garageImageKey",
    gp."address" AS "profileAddress",
    gp."country" AS "profileCountry",
    gp."state" AS "profileState",
    gp."city" AS "profileCity",
    gp."pincode",
    gp."jobCompletedNumber",
    gp."yearsExperience",
    gp."responseTime",
    gp."certifications",
    gp."about",
    gp."galleryImageUrls",
    gp."galleryImageKeys",
    COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', gs."id",
            'name', gs."name",
            'category', gs."category",
            'durationMinutes', gs."durationMinutes",
            'price', gs."price",
            'currency', gs."currency"
          )
          ORDER BY gs."createdAt" DESC
        )
        FROM "garage_services" gs
        WHERE gs."garageId" = u."id"
          AND gs."status" = 'active'::"GarageServiceStatus"
      ),
      '[]'::jsonb
    ) AS "services",
    COALESCE(
      (
        SELECT ROUND(AVG(gsr."rating")::numeric, 1)
        FROM "garage_service_reviews" gsr
        WHERE gsr."garageId" = u."id"
      ),
      0
    ) AS "ratingAverage",
    COALESCE(
      (
        SELECT COUNT(*)
        FROM "garage_service_reviews" gsr
        WHERE gsr."garageId" = u."id"
      ),
      0
    ) AS "reviewCount",
    COALESCE(
      (
        SELECT jsonb_agg(review_row ORDER BY (review_row->>'rating')::int DESC, review_row->>'date' DESC)
        FROM (
          SELECT jsonb_build_object(
            'id', gsr."id",
            'customerName', COALESCE(NULLIF(CONCAT_WS(' ', cu."firstName", cu."lastName"), ''), cu."email", 'Customer'),
            'serviceName', COALESCE(gs."name", 'Service'),
            'rating', gsr."rating",
            'comment', gsr."comment",
            'garageReply', gsr."garageReply",
            'date', TO_CHAR(gsr."createdAt", 'Mon DD, YYYY')
          ) AS review_row
          FROM "garage_service_reviews" gsr
          LEFT JOIN "users" cu ON cu."id" = gsr."customerId"
          LEFT JOIN "garage_services" gs ON gs."id" = gsr."serviceId"
          WHERE gsr."garageId" = u."id"
          ORDER BY gsr."rating" DESC, gsr."createdAt" DESC
          LIMIT 5
        ) top_reviews
      ),
      '[]'::jsonb
    ) AS "reviews"
  FROM "users" u
  LEFT JOIN "garage_profiles" gp ON gp."garageId" = u."id"
`

export async function listPublicGarages(params: {
  q?: string | null
  service?: string | null
  location?: string | null
  page?: string | number | null
  pageSize?: string | number | null
}): Promise<PublicGarageListResponse> {
  const page = numberParam(params.page, 1)
  const pageSize = numberParam(params.pageSize, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE)
  const q = params.q?.trim()
  const service = params.service?.trim()
  const location = params.location?.trim()
  const conditions = [
    baseGarageWhere,
    ...(q ? [textSearchCondition(q)] : []),
    ...(service ? [serviceSearchCondition(service)] : []),
    ...(location ? [locationSearchCondition(location)] : []),
  ]
  const whereClause = Prisma.sql`WHERE ${Prisma.join(conditions, " AND ")}`
  const [countRow] = await db.$queryRaw<CountRow[]>`
    SELECT COUNT(*) AS "total"
    FROM "users" u
    LEFT JOIN "garage_profiles" gp ON gp."garageId" = u."id"
    ${whereClause}
  `
  const garages = await db.$queryRaw<PublicGarageRow[]>`
    ${garageSelect}
    ${whereClause}
    ORDER BY u."createdAt" DESC
    OFFSET ${(page - 1) * pageSize}
    LIMIT ${pageSize}
  `
  const total = Number(countRow?.total ?? 0)

  return {
    ok: true,
    garages: await Promise.all(garages.map((garage) => mapSummary(garage))),
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    },
  }
}

export async function getPublicGarage(
  garageId: string,
): Promise<PublicGarageDetail | null> {
  const [garage] = await db.$queryRaw<PublicGarageRow[]>`
    ${garageSelect}
    WHERE u."id" = ${garageId}
      AND ${baseGarageWhere}
    LIMIT 1
  `

  if (!garage) return null

  const summary = await mapSummary(garage)
  const galleryImageUrls = garage.galleryImageUrls ?? []
  const galleryImageKeys = garage.galleryImageKeys ?? []
  const galleryImageCount = Math.max(galleryImageUrls.length, galleryImageKeys.length)
  const signedGalleryImages = await Promise.all(
    Array.from({ length: galleryImageCount }, (_, index) =>
      publicImageUrl(galleryImageKeys[index] ?? null, galleryImageUrls[index] ?? null),
    ),
  )

  return {
    ...summary,
    about: garage.about ?? null,
    workingDays: garage.workingDays ?? [],
    workingHours: garage.workingHours ?? null,
    workingHoursByDay: workingHoursByDay(garage.workingHoursByDay),
    galleryImages: Array.from(
      new Set(signedGalleryImages.filter((url): url is string => Boolean(url))),
    ),
    galleryImageKeys,
    services: mapServices(garage.services),
    reviews: mapReviews(garage.reviews),
  }
}
