import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";

import { db } from "@/lib/database/prisma";
import { sendSmtpMail } from "@/lib/email/smtp";
import { PaymentStatus, Prisma } from "@/lib/generated/prisma/client";
import { logError } from "@/lib/logger";
import {
  featuredCategorySource,
  featuredVendorFeatureKey,
  setSupplierFeaturedCategories,
} from "@/services/featured-vendor/featured-vendor-category-service";
import {
  createNotificationsSafely,
  type CreateNotificationInput,
} from "@/services/notifications/notification-service";
import {
  getPaidDowngradeEffectiveAt,
  getPlanPeriodEnd,
  getPlanTransition,
  type BusinessPlanTier,
} from "@/services/business/plan-transition";

type PaymentPurpose =
  | "direct_order"
  | "garage_booking_advance"
  | "business_plan"
  | "business_add_on"
  | "rfq_order";

type PaymentEntityInput = {
  entityType: "order" | "garage_booking" | "business_plan" | "business_add_on";
  entityId: string;
  amount: number;
};

type CreateCheckoutPaymentInput = {
  payerUserId?: string | null;
  businessAccountId?: string | null;
  purpose: PaymentPurpose;
  amount: number;
  currency?: string | null;
  description: string;
  idempotencyKey: string;
  successUrl: string;
  cancelUrl: string;
  entities: PaymentEntityInput[];
  metadata?: Prisma.InputJsonValue;
};

type PaymentRow = {
  id: string;
  publicId: string;
  payerUserId: string | null;
  businessAccountId: string | null;
  purpose: string;
  amount: number;
  currency: string;
  status: string;
  stripePaymentIntentId: string | null;
  stripeCheckoutSessionId: string | null;
  stripeCustomerId: string | null;
  idempotencyKey: string;
  description: string;
  failureCode: string | null;
  failureMessage: string | null;
  metadata: Prisma.JsonValue | null;
  createdAt: Date;
  updatedAt: Date;
  paidAt: Date | null;
  failedAt: Date | null;
  refundedAt: Date | null;
};

type PaymentHistoryRow = PaymentRow & {
  entitySummary: string | null;
  itemCount: number;
};

type PaymentHistoryFilters = {
  page?: number;
  pageSize?: number;
  from?: Date | null;
  to?: Date | null;
};

type PaymentHistoryResult = {
  payments: ReturnType<typeof serializePaymentHistory>[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
};

type StripeCheckoutSession = {
  id: string;
  url?: string | null;
  payment_intent?: string | { id?: string } | null;
  customer?: string | { id?: string } | null;
  payment_status?: string;
  status?: string | null;
};

type StripeWebhookEvent = {
  id: string;
  type: string;
  data?: { object?: Record<string, unknown> };
};

const stripeApiBase = "https://api.stripe.com/v1";
const defaultCurrency = "AED";

const normalizeCurrency = (value: string | null | undefined) =>
  (value || defaultCurrency).trim().toUpperCase();

const publicPaymentId = () => `PAY-${randomUUID().replace(/-/g, "").slice(0, 12).toUpperCase()}`;

const normalizeIdempotencyKey = (value: string) => value.trim().slice(0, 255);

const stripeSecretKey = () => process.env.STRIPE_SECRET_KEY?.trim() || "";

export const isStripePaymentsConfigured = () => stripeSecretKey().startsWith("sk_");

const businessPlanTier = (value: string): BusinessPlanTier | null =>
  value === "Free" || value === "Pro" || value === "Enterprise" ? value : null;

const paymentMetadata = (value: Prisma.JsonValue | null | undefined) =>
  value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};

const scheduledEffectiveAt = (metadata: Record<string, unknown>) => {
  if (typeof metadata.effectiveAt !== "string") return null;
  const value = new Date(metadata.effectiveAt);
  return Number.isNaN(value.getTime()) ? null : value;
};

const stripeObjectId = (value: unknown) => {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && typeof (value as { id?: unknown }).id === "string") {
    return (value as { id: string }).id;
  }
  return null;
};

const appendFormValue = (form: URLSearchParams, key: string, value: unknown) => {
  if (value === undefined || value === null) return;
  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      if (item && typeof item === "object") {
        Object.entries(item).forEach(([childKey, childValue]) =>
          appendFormValue(form, `${key}[${index}][${childKey}]`, childValue),
        );
      } else {
        appendFormValue(form, `${key}[${index}]`, item);
      }
    });
    return;
  }
  if (value && typeof value === "object") {
    Object.entries(value).forEach(([childKey, childValue]) =>
      appendFormValue(form, `${key}[${childKey}]`, childValue),
    );
    return;
  }
  form.append(key, String(value));
};

async function stripeRequest<T>(
  path: string,
  input?: {
    method?: "GET" | "POST";
    body?: Record<string, unknown>;
    idempotencyKey?: string;
  },
) {
  const secret = stripeSecretKey();
  if (!secret) throw new Error("STRIPE_SECRET_KEY is not configured");
  const headers: Record<string, string> = {
    authorization: `Bearer ${secret}`,
  };
  let body: URLSearchParams | undefined;
  if (input?.body) {
    body = new URLSearchParams();
    Object.entries(input.body).forEach(([key, value]) => appendFormValue(body!, key, value));
    headers["content-type"] = "application/x-www-form-urlencoded";
  }
  if (input?.idempotencyKey) headers["idempotency-key"] = input.idempotencyKey;
  const response = await fetch(`${stripeApiBase}${path}`, {
    method: input?.method ?? (body ? "POST" : "GET"),
    headers,
    body,
    cache: "no-store",
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      payload && typeof payload === "object" && "error" in payload
        ? ((payload.error as { message?: string })?.message ?? "Stripe request failed")
        : "Stripe request failed";
    throw new Error(message);
  }
  return payload as T;
}

const jsonSql = (value: Prisma.InputJsonValue | undefined) =>
  value === undefined ? Prisma.sql`NULL` : Prisma.sql`${JSON.stringify(value)}::jsonb`;

async function findPaymentByIdempotencyKey(idempotencyKey: string) {
  const rows = await db.$queryRaw<PaymentRow[]>`
    SELECT * FROM "payments" WHERE "idempotencyKey" = ${idempotencyKey} LIMIT 1
  `;
  return rows[0] ?? null;
}

async function findPaymentById(paymentId: string) {
  const rows = await db.$queryRaw<PaymentRow[]>`
    SELECT * FROM "payments" WHERE "id" = ${paymentId} OR "publicId" = ${paymentId} LIMIT 1
  `;
  return rows[0] ?? null;
}

async function findPaymentByIdOrSession(paymentId: string) {
  const rows = await db.$queryRaw<PaymentRow[]>`
    SELECT * FROM "payments"
    WHERE "id" = ${paymentId}
       OR "publicId" = ${paymentId}
       OR "stripeCheckoutSessionId" = ${paymentId}
    LIMIT 1
  `;
  return rows[0] ?? null;
}

async function findPaymentForStripeObject(input: {
  sessionId?: string | null;
  paymentIntentId?: string | null;
}) {
  const rows = await db.$queryRaw<PaymentRow[]>`
    SELECT * FROM "payments"
    WHERE (${input.sessionId}::text IS NOT NULL AND "stripeCheckoutSessionId" = ${input.sessionId})
       OR (${input.paymentIntentId}::text IS NOT NULL AND "stripePaymentIntentId" = ${input.paymentIntentId})
    LIMIT 1
  `;
  return rows[0] ?? null;
}

async function retrieveCheckoutSession(sessionId: string | null) {
  if (!sessionId || !isStripePaymentsConfigured()) return null;
  try {
    return await stripeRequest<StripeCheckoutSession>(`/checkout/sessions/${sessionId}`);
  } catch (error) {
    logError("Unable to retrieve Stripe Checkout session", error);
    return null;
  }
}

async function clearCheckoutSession(paymentId: string) {
  await db.$executeRaw`
    UPDATE "payments"
    SET "stripeCheckoutSessionId" = NULL,
        "updatedAt" = CURRENT_TIMESTAMP
    WHERE "id" = ${paymentId}
  `;
}

export async function createStripeCheckoutPayment(input: CreateCheckoutPaymentInput) {
  const idempotencyKey = normalizeIdempotencyKey(input.idempotencyKey);
  if (!idempotencyKey) throw new Error("Payment idempotency key is required");
  if (!Number.isInteger(input.amount) || input.amount <= 0) {
    throw new Error("Payment amount must be greater than zero");
  }
  if (!input.entities.length) throw new Error("Payment must reference at least one item");

  const currency = normalizeCurrency(input.currency);
  let payment = await findPaymentByIdempotencyKey(idempotencyKey);
  let checkoutIdempotencyKey = idempotencyKey;
  if (!payment) {
    const paymentId = randomUUID();
    await db.$transaction(async (tx) => {
      await tx.$executeRaw`
        INSERT INTO "payments" (
          "id", "publicId", "payerUserId", "businessAccountId", "purpose",
          "amount", "currency", "status", "idempotencyKey", "description",
          "metadata", "createdAt", "updatedAt"
        )
        VALUES (
          ${paymentId}, ${publicPaymentId()}, ${input.payerUserId ?? null},
          ${input.businessAccountId ?? null}, ${input.purpose}, ${input.amount},
          ${currency}, 'requires_payment', ${idempotencyKey}, ${input.description},
          ${jsonSql(input.metadata)}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        )
      `;
      for (const entity of input.entities) {
        await tx.$executeRaw`
          INSERT INTO "payment_items" (
            "id", "paymentId", "entityType", "entityId", "amount", "currency"
          )
          VALUES (
            ${randomUUID()}, ${paymentId}, ${entity.entityType}, ${entity.entityId},
            ${Math.max(0, Math.round(entity.amount))}, ${currency}
          )
          ON CONFLICT ("paymentId", "entityType", "entityId") DO NOTHING
        `;
      }
    });
    payment = await findPaymentByIdempotencyKey(idempotencyKey);
  }
  if (!payment) throw new Error("Unable to create payment");
  if (payment.status === "succeeded") {
    return { payment, checkoutUrl: null, stripeConfigured: isStripePaymentsConfigured() };
  }

  if (payment.stripeCheckoutSessionId) {
    const session = await retrieveCheckoutSession(payment.stripeCheckoutSessionId);
    if (session?.payment_status === "paid") {
      const settled = await settlePaymentSucceeded({
        sessionId: session.id,
        paymentIntentId: stripeObjectId(session.payment_intent),
      });
      return { payment: settled ?? payment, checkoutUrl: null, stripeConfigured: isStripePaymentsConfigured() };
    }
    if (session?.status === "open" && session.url) {
      return {
        payment,
        checkoutUrl: session.url,
        stripeConfigured: isStripePaymentsConfigured(),
      };
    }
    await clearCheckoutSession(payment.id);
    payment = (await findPaymentById(payment.id)) ?? payment;
    checkoutIdempotencyKey = normalizeIdempotencyKey(`${idempotencyKey}:recovered`);
  }

  if (!isStripePaymentsConfigured()) {
    return { payment, checkoutUrl: null, stripeConfigured: false };
  }

  const session = await stripeRequest<StripeCheckoutSession>("/checkout/sessions", {
    method: "POST",
    idempotencyKey: checkoutIdempotencyKey,
    body: {
      mode: "payment",
      success_url: input.successUrl,
      cancel_url: input.cancelUrl,
      adaptive_pricing: {
        enabled: false,
      },
      // Stripe renders Apple Pay, Google Pay, and Link from the card method when eligible.
      payment_method_types: ["card"],
      client_reference_id: payment.id,
      metadata: {
        paymentId: payment.id,
        purpose: input.purpose,
      },
      payment_intent_data: {
        metadata: {
          paymentId: payment.id,
          purpose: input.purpose,
        },
      },
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: currency.toLowerCase(),
            unit_amount: input.amount,
            product_data: { name: input.description.slice(0, 120) },
          },
        },
      ],
    },
  });

  const paymentIntentId = stripeObjectId(session.payment_intent);
  const customerId = stripeObjectId(session.customer);
  if (!session.url) throw new Error("Stripe did not return a Checkout URL");
  await db.$executeRaw`
    UPDATE "payments"
    SET "stripeCheckoutSessionId" = ${session.id},
        "stripePaymentIntentId" = COALESCE(${paymentIntentId}, "stripePaymentIntentId"),
        "stripeCustomerId" = COALESCE(${customerId}, "stripeCustomerId"),
        "updatedAt" = CURRENT_TIMESTAMP
    WHERE "id" = ${payment.id}
  `;
  return {
    payment: (await findPaymentById(payment.id)) ?? payment,
    checkoutUrl: session.url,
    stripeConfigured: true,
  };
}

async function paymentItems(paymentId: string) {
  return db.$queryRaw<Array<{ entityType: string; entityId: string; amount: number }>>`
    SELECT "entityType", "entityId", "amount" FROM "payment_items" WHERE "paymentId" = ${paymentId}
  `;
}

async function paymentPurposeDetails(paymentId: string) {
  const items = await paymentItems(paymentId);
  const details: string[] = [];

  const orderIds = items.filter((item) => item.entityType === "order").map((item) => item.entityId);
  if (orderIds.length) {
    const orders = await db.order.findMany({
      where: { id: { in: orderIds } },
      select: { publicId: true, totalAmount: true, paymentStatus: true },
      orderBy: { createdAt: "asc" },
    });
    details.push(
      ...orders.map(
        (order) =>
          `Order ${order.publicId} - ${moneyText(order.totalAmount, defaultCurrency)} (${order.paymentStatus})`,
      ),
    );
  }

  const bookingIds = items.filter((item) => item.entityType === "garage_booking").map((item) => item.entityId);
  if (bookingIds.length) {
    const bookings = await db.garageBooking.findMany({
      where: { id: { in: bookingIds } },
      select: {
        publicId: true,
        serviceName: true,
        advanceAmount: true,
        currency: true,
        advancePaymentStatus: true,
      },
      orderBy: { createdAt: "asc" },
    });
    details.push(
      ...bookings.map(
        (booking) =>
          `Booking ${booking.publicId} - ${booking.serviceName} advance ${moneyText(
            booking.advanceAmount ?? 0,
            booking.currency,
          )} (${booking.advancePaymentStatus ?? "pending"})`,
      ),
    );
  }

  const planIds = items.filter((item) => item.entityType === "business_plan").map((item) => item.entityId);
  if (planIds.length) {
    const plans = await db.businessPlan.findMany({
      where: { id: { in: planIds } },
      select: { name: true, code: true, accountType: true, priceAmount: true, priceCurrency: true },
    });
    details.push(
      ...plans.map(
        (plan) =>
          `Plan ${plan.name} (${plan.accountType}, ${plan.code}) - ${moneyText(
            plan.priceAmount,
            plan.priceCurrency,
          )}`,
      ),
    );
  }

  const addOnIds = items.filter((item) => item.entityType === "business_add_on").map((item) => item.entityId);
  if (addOnIds.length) {
    const addOns = await db.businessAddOnRequest.findMany({
      where: { id: { in: addOnIds } },
      select: {
        label: true,
        featureKey: true,
        status: true,
        priceAmount: true,
        priceCurrency: true,
        validUntil: true,
      },
    });
    details.push(
      ...addOns.map((addOn) => {
        const expiry = addOn.validUntil ? `, expires ${addOn.validUntil.toISOString().slice(0, 10)}` : "";
        return `Add-on ${addOn.label} (${addOn.featureKey}) - ${moneyText(
          addOn.priceAmount ?? 0,
          addOn.priceCurrency ?? defaultCurrency,
        )} (${addOn.status}${expiry})`;
      }),
    );
  }

  return details;
}

const paymentStatusLabel = (status: string) =>
  status === "succeeded" ? "Paid" : status === "failed" ? "Failed" : "Pending";

const paymentNeedsStripeRefresh = (status: string) =>
  status === "pending" || status === "requires_payment";

const moneyText = (amount: number, currency: string) =>
  `${currency || defaultCurrency} ${(amount / 100).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

function serializePaymentHistory(row: PaymentHistoryRow) {
  return {
    id: row.id,
    publicId: row.publicId,
    purpose: row.purpose,
    description: row.description,
    amount: row.amount,
    currency: row.currency,
    status: row.status,
    statusLabel: paymentStatusLabel(row.status),
    failureCode: row.failureCode,
    failureMessage: row.failureMessage,
    entitySummary: row.entitySummary,
    itemCount: Number(row.itemCount ?? 0),
    createdAt: row.createdAt.toISOString(),
    paidAt: row.paidAt?.toISOString() ?? null,
    failedAt: row.failedAt?.toISOString() ?? null,
  };
}

async function refreshPendingHistoryRows(rows: PaymentHistoryRow[]) {
  const pendingRows = rows.filter(
    (row) => paymentNeedsStripeRefresh(row.status) && row.stripeCheckoutSessionId,
  );
  if (!pendingRows.length || !isStripePaymentsConfigured()) return false;

  const results = await Promise.allSettled(
    pendingRows.map((row) => refreshStripePaymentStatus(row.id)),
  );
  return results.some(
    (result) =>
      result.status === "fulfilled" &&
      result.value?.status &&
      !paymentNeedsStripeRefresh(result.value.status),
  );
}

const paymentHistoryPagination = (input: PaymentHistoryFilters) => {
  const page = Math.max(1, Math.floor(input.page ?? 1));
  const pageSize = Math.min(100, Math.max(1, Math.floor(input.pageSize ?? 10)));
  return { page, pageSize, skip: (page - 1) * pageSize };
};

const paymentCreatedAtFilter = (from?: Date | null, to?: Date | null) => Prisma.sql`
  AND (${from ?? null}::timestamp IS NULL OR p."createdAt" >= ${from ?? null})
  AND (${to ?? null}::timestamp IS NULL OR p."createdAt" < ${to ?? null})
`;

export async function listUserPaymentHistory(
  userId: string,
  filters: PaymentHistoryFilters = {},
): Promise<PaymentHistoryResult> {
  const { page, pageSize, skip } = paymentHistoryPagination(filters);
  const count = await db.$queryRaw<Array<{ total: number }>>`
    SELECT COUNT(*)::int AS "total"
    FROM "payments" p
    WHERE p."payerUserId" = ${userId}
    ${paymentCreatedAtFilter(filters.from, filters.to)}
  `;
  const rows = await db.$queryRaw<PaymentHistoryRow[]>`
    SELECT p.*,
      COUNT(pi."id")::int AS "itemCount",
      STRING_AGG(DISTINCT pi."entityType", ', ') AS "entitySummary"
    FROM "payments" p
    LEFT JOIN "payment_items" pi ON pi."paymentId" = p."id"
    WHERE p."payerUserId" = ${userId}
    ${paymentCreatedAtFilter(filters.from, filters.to)}
    GROUP BY p."id"
    ORDER BY p."createdAt" DESC
    LIMIT ${pageSize} OFFSET ${skip}
  `;
  const refreshed = await refreshPendingHistoryRows(rows);
  const finalRows = refreshed
    ? await db.$queryRaw<PaymentHistoryRow[]>`
        SELECT p.*,
          COUNT(pi."id")::int AS "itemCount",
          STRING_AGG(DISTINCT pi."entityType", ', ') AS "entitySummary"
        FROM "payments" p
        LEFT JOIN "payment_items" pi ON pi."paymentId" = p."id"
        WHERE p."payerUserId" = ${userId}
        ${paymentCreatedAtFilter(filters.from, filters.to)}
        GROUP BY p."id"
        ORDER BY p."createdAt" DESC
        LIMIT ${pageSize} OFFSET ${skip}
      `
    : rows;
  const total = count[0]?.total ?? 0;
  return {
    payments: finalRows.map(serializePaymentHistory),
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    },
  };
}

export async function listBusinessPaymentHistory(input: {
  userId: string;
  businessAccountId?: string | null;
} & PaymentHistoryFilters): Promise<PaymentHistoryResult> {
  const { page, pageSize, skip } = paymentHistoryPagination(input);
  const count = await db.$queryRaw<Array<{ total: number }>>`
    SELECT COUNT(*)::int AS "total"
    FROM "payments" p
    WHERE p."businessAccountId" IS NOT NULL
      AND (${input.businessAccountId ?? null}::text IS NULL OR p."businessAccountId" = ${input.businessAccountId ?? null})
      AND (
        p."payerUserId" = ${input.userId}
        OR p."businessAccountId" IN (
          SELECT "id" FROM "business_accounts" WHERE "ownerUserId" = ${input.userId}
        )
      )
      ${paymentCreatedAtFilter(input.from, input.to)}
  `;
  const rows = await db.$queryRaw<PaymentHistoryRow[]>`
    SELECT p.*,
      COUNT(pi."id")::int AS "itemCount",
      STRING_AGG(DISTINCT pi."entityType", ', ') AS "entitySummary"
    FROM "payments" p
    LEFT JOIN "payment_items" pi ON pi."paymentId" = p."id"
    WHERE p."businessAccountId" IS NOT NULL
      AND (${input.businessAccountId ?? null}::text IS NULL OR p."businessAccountId" = ${input.businessAccountId ?? null})
      AND (
        p."payerUserId" = ${input.userId}
        OR p."businessAccountId" IN (
          SELECT "id" FROM "business_accounts" WHERE "ownerUserId" = ${input.userId}
        )
      )
      ${paymentCreatedAtFilter(input.from, input.to)}
    GROUP BY p."id"
    ORDER BY p."createdAt" DESC
    LIMIT ${pageSize} OFFSET ${skip}
  `;
  const refreshed = await refreshPendingHistoryRows(rows);
  const finalRows = refreshed
    ? await db.$queryRaw<PaymentHistoryRow[]>`
        SELECT p.*,
          COUNT(pi."id")::int AS "itemCount",
          STRING_AGG(DISTINCT pi."entityType", ', ') AS "entitySummary"
        FROM "payments" p
        LEFT JOIN "payment_items" pi ON pi."paymentId" = p."id"
        WHERE p."businessAccountId" IS NOT NULL
          AND (${input.businessAccountId ?? null}::text IS NULL OR p."businessAccountId" = ${input.businessAccountId ?? null})
          AND (
            p."payerUserId" = ${input.userId}
            OR p."businessAccountId" IN (
              SELECT "id" FROM "business_accounts" WHERE "ownerUserId" = ${input.userId}
            )
          )
          ${paymentCreatedAtFilter(input.from, input.to)}
        GROUP BY p."id"
        ORDER BY p."createdAt" DESC
        LIMIT ${pageSize} OFFSET ${skip}
      `
    : rows;
  const total = count[0]?.total ?? 0;
  return {
    payments: finalRows.map(serializePaymentHistory),
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    },
  };
}

async function notifyPaymentStatus(payment: PaymentRow, status: "succeeded" | "failed") {
  const recipient = payment.payerUserId
    ? await db.user.findUnique({
        where: { id: payment.payerUserId },
        select: { id: true, email: true },
      })
    : null;
  if (!recipient) return;

  const title = status === "succeeded" ? "Payment successful" : "Payment failed";
  const purposeDetails = await paymentPurposeDetails(payment.id);
  const purposeText = purposeDetails.length
    ? purposeDetails.join("; ")
    : payment.purpose.replace(/_/g, " ");
  const failureText =
    status === "failed" && payment.failureMessage ? ` Reason: ${payment.failureMessage}` : "";
  await createNotificationsSafely([
    {
      recipientUserId: recipient.id,
      type: status === "succeeded" ? "payment.succeeded" : "payment.failed",
      title,
      body: `${payment.description} - ${purposeText} - ${moneyText(payment.amount, payment.currency)}.${failureText}`,
      linkUrl: "/payments",
      entityType: "payment",
      entityId: payment.id,
    },
  ]);

  if (!recipient.email) return;
  await sendSmtpMail({
    to: recipient.email,
    subject: `${title}: ${payment.publicId}`,
    text: [
      `${title}: ${payment.publicId}`,
      `Description: ${payment.description}`,
      `Purpose: ${payment.purpose.replace(/_/g, " ")}`,
      ...purposeDetails.map((detail) => `Detail: ${detail}`),
      `Amount: ${moneyText(payment.amount, payment.currency)}`,
      `Status: ${paymentStatusLabel(payment.status)}`,
      payment.failureMessage ? `Failure reason: ${payment.failureMessage}` : "",
    ]
      .filter(Boolean)
      .join("\n"),
  });
}

async function notifySettledPayment(payment: PaymentRow) {
  const items = await paymentItems(payment.id);
  const orderIds = items.filter((item) => item.entityType === "order").map((item) => item.entityId);
  if (!orderIds.length) return;
  const orders = await db.order.findMany({
    where: { id: { in: orderIds } },
    include: {
      buyer: { select: { id: true } },
      supplier: { select: { id: true } },
      items: { select: { partName: true, quantity: true } },
    },
  });
  const notifications: CreateNotificationInput[] = [];
  for (const order of orders) {
    const summary = order.items.slice(0, 3).map((item) => `${item.partName} x ${item.quantity}`).join(", ");
    notifications.push({
      recipientUserId: order.supplierId,
      actorUserId: order.buyerId,
      type: "order.created",
      title: "New paid order received",
      body: `Order ${order.publicId} is paid and ready to confirm${summary ? `: ${summary}` : "."}`,
      linkUrl: "/orders",
      entityType: "order",
      entityId: order.id,
    });
    notifications.push({
      recipientUserId: order.buyerId,
      type: "order.payment.succeeded",
      title: "Payment successful",
      body: `Payment for ${order.publicId} was successful.`,
      linkUrl: "/orders",
      entityType: "order",
      entityId: order.id,
    });
  }
  await createNotificationsSafely(notifications);
}

async function hasAppliedBusinessPlanPayment(paymentId: string) {
  const rows = await db.$queryRaw<Array<{ id: string }>>`
    SELECT "id"
    FROM "business_payment_transactions"
    WHERE "type" = 'plan'
      AND (
        "metadata"->>'paymentId' = ${paymentId}
        OR "metadata"->'paymentIds' ? ${paymentId}
      )
    LIMIT 1
  `;
  return rows.length > 0;
}

async function schedulePaidPlanDowngrade(input: {
  payment: PaymentRow;
  account: {
    id: string;
    planName: string;
    planCode: string;
    planBillingPeriod: string;
    planMonthlyBillingDays: number;
    updatedAt: Date;
  };
  nextPlan: {
    id: string;
    code: string;
    name: string;
    priceCurrency: string;
    billingPeriod: string;
    monthlyBillingDays: number;
  };
}) {
  if (await hasAppliedBusinessPlanPayment(input.payment.id)) return;

  const existing = await db.businessPaymentTransaction.findFirst({
    where: {
      businessAccountId: input.account.id,
      type: "plan",
      status: "Scheduled",
      sourceId: input.nextPlan.id,
    },
    orderBy: { createdAt: "desc" },
  });
  const existingMetadata = paymentMetadata(existing?.metadata);
  const currentPeriodEnd = getPlanPeriodEnd(input.account.updatedAt, {
    billingPeriod: input.account.planBillingPeriod,
    monthlyBillingDays: input.account.planMonthlyBillingDays,
  });
  const effectiveAt = getPaidDowngradeEffectiveAt(
    currentPeriodEnd,
    scheduledEffectiveAt(existingMetadata),
    input.nextPlan,
  );
  const existingPaymentIds = Array.isArray(existingMetadata.paymentIds)
    ? existingMetadata.paymentIds.filter((id): id is string => typeof id === "string")
    : [];
  const existingIntentIds = Array.isArray(existingMetadata.stripePaymentIntentIds)
    ? existingMetadata.stripePaymentIntentIds.filter((id): id is string => typeof id === "string")
    : [];
  const metadata = {
    ...existingMetadata,
    fromPlanName: input.account.planName,
    toPlanName: input.nextPlan.name,
    effectiveAt: effectiveAt.toISOString(),
    periodCount: Math.max(1, Number(existingMetadata.periodCount) || 0) + (existing ? 1 : 0),
    paymentIds: [...existingPaymentIds, input.payment.id],
    stripePaymentIntentIds: [
      ...existingIntentIds,
      ...(input.payment.stripePaymentIntentId ? [input.payment.stripePaymentIntentId] : []),
    ],
  };

  await db.businessPaymentTransaction.updateMany({
    where: {
      businessAccountId: input.account.id,
      type: "plan",
      status: "Scheduled",
      sourceId: { not: input.nextPlan.id },
    },
    data: { status: "Cancelled" },
  });

  const description = `Downgrade from ${input.account.planName} to ${input.nextPlan.name} scheduled for ${effectiveAt.toISOString().slice(0, 10)}`;
  if (existing) {
    await db.businessPaymentTransaction.update({
      where: { id: existing.id },
      data: {
        description,
        amount: existing.amount + input.payment.amount,
        currency: input.payment.currency || input.nextPlan.priceCurrency,
        metadata,
      },
    });
    return;
  }

  await db.businessPaymentTransaction.create({
    data: {
      businessAccountId: input.account.id,
      payerUserId: input.payment.payerUserId,
      type: "plan",
      sourceId: input.nextPlan.id,
      sourceKey: input.nextPlan.code,
      description,
      amount: input.payment.amount,
      currency: input.payment.currency || input.nextPlan.priceCurrency,
      status: "Scheduled",
      metadata,
    },
  });
}

async function applyBusinessPayment(payment: PaymentRow) {
  if (!payment.businessAccountId) return;
  const items = await paymentItems(payment.id);
  const plan = items.find((item) => item.entityType === "business_plan");
  if (plan) {
    const [nextPlan] = await db.$queryRaw<Array<{
      id: string;
      code: string;
      name: string;
      priceCurrency: string;
      billingPeriod: string;
      monthlyBillingDays: number;
    }>>`
      SELECT "id", "code"::text, "name", "priceCurrency", "billingPeriod", "monthlyBillingDays"
      FROM "business_plans"
      WHERE "id" = ${plan.entityId}
      LIMIT 1
    `;
    if (nextPlan) {
      const [account] = await db.$queryRaw<Array<{
        id: string;
        planName: string;
        planCode: string;
        planBillingPeriod: string;
        planMonthlyBillingDays: number;
        updatedAt: Date;
      }>>`
        SELECT ba."id", ba."updatedAt", bp."name" AS "planName", bp."code"::text AS "planCode",
          bp."billingPeriod" AS "planBillingPeriod", bp."monthlyBillingDays" AS "planMonthlyBillingDays"
        FROM "business_accounts" ba
        JOIN "business_plans" bp ON bp."id" = ba."planId"
        WHERE ba."id" = ${payment.businessAccountId}
        LIMIT 1
      `;
      const currentTier = account ? businessPlanTier(account.planCode) : null;
      const nextTier = businessPlanTier(nextPlan.code);
      if (account && currentTier && nextTier && getPlanTransition(currentTier, nextTier) === "downgrade") {
        await schedulePaidPlanDowngrade({ payment, account, nextPlan });
        return;
      }
      await db.$executeRaw`
        UPDATE "business_accounts"
        SET "planId" = ${nextPlan.id}, "updatedAt" = CURRENT_TIMESTAMP
        WHERE "id" = ${payment.businessAccountId}
      `;
      await db.$executeRaw`
        INSERT INTO "business_payment_transactions" (
          "id", "businessAccountId", "payerUserId", "type", "sourceId",
          "sourceKey", "description", "amount", "currency", "status", "metadata"
        )
        SELECT
          ${randomUUID()}, ${payment.businessAccountId}, ${payment.payerUserId},
          'plan', ${nextPlan.id}, ${nextPlan.code},
          ${`Plan upgraded from ${account?.planName ?? "current plan"} to ${nextPlan.name}`},
          ${payment.amount}, ${payment.currency || nextPlan.priceCurrency}, 'Paid',
          ${JSON.stringify({
            paymentId: payment.id,
            stripePaymentIntentId: payment.stripePaymentIntentId,
            toPlanName: nextPlan.name,
          })}::jsonb
        WHERE NOT EXISTS (
          SELECT 1 FROM "business_payment_transactions"
          WHERE "type" = 'plan'
            AND "metadata"->>'paymentId' = ${payment.id}
        )
      `;
    }
  }

  const addOn = items.find((item) => item.entityType === "business_add_on");
  if (addOn) {
    await db.$executeRaw`
      UPDATE "business_add_on_requests"
      SET "status" = 'Enabled'::"BusinessAddOnRequestStatus",
          "decidedAt" = CURRENT_TIMESTAMP,
          "validFrom" = COALESCE("validFrom", CURRENT_TIMESTAMP),
          "updatedAt" = CURRENT_TIMESTAMP
      WHERE "id" = ${addOn.entityId}
    `;
    const [row] = await db.$queryRaw<Array<{
      id: string;
      featureKey: string;
      label: string;
      priceCurrency: string | null;
      validUntil: Date | null;
      renewalAt: Date | null;
    }>>`
      SELECT "id", "featureKey", "label", "priceCurrency", "validUntil", "renewalAt"
      FROM "business_add_on_requests"
      WHERE "id" = ${addOn.entityId}
      LIMIT 1
    `;
    if (row) {
      const metadata =
        payment.metadata && typeof payment.metadata === "object" && !Array.isArray(payment.metadata)
          ? (payment.metadata as Record<string, unknown>)
          : {};
      const categoryIds = Array.isArray(metadata.categoryIds)
        ? metadata.categoryIds.filter((value): value is string => typeof value === "string" && value.trim().length > 0)
        : [];
      if (row.featureKey === featuredVendorFeatureKey && categoryIds.length) {
        const [account] = await db.$queryRaw<Array<{ ownerUserId: string }>>`
          SELECT "ownerUserId" FROM "business_accounts" WHERE "id" = ${payment.businessAccountId} LIMIT 1
        `;
        if (account) {
          await setSupplierFeaturedCategories({
            supplierId: account.ownerUserId,
            categoryIds,
            source: featuredCategorySource.addOn,
            businessAccountId: payment.businessAccountId,
            addOnRequestId: row.id,
            validFrom: new Date(),
            validUntil: row.validUntil,
            replaceExisting: false,
          });
        }
      }
      await db.$executeRaw`
        INSERT INTO "business_payment_transactions" (
          "id", "businessAccountId", "payerUserId", "type", "sourceId",
          "sourceKey", "description", "amount", "currency", "status", "metadata"
        )
        VALUES (
          ${randomUUID()}, ${payment.businessAccountId}, ${payment.payerUserId},
          'add_on', ${row.id}, ${row.featureKey}, ${`Add-on enabled: ${row.label}`},
          ${payment.amount}, ${payment.currency || row.priceCurrency || "AED"}, 'Paid',
          ${JSON.stringify({
            paymentId: payment.id,
            stripePaymentIntentId: payment.stripePaymentIntentId,
            featureKey: row.featureKey,
            label: row.label,
            validUntil: row.validUntil?.toISOString() ?? null,
            renewalAt: row.renewalAt?.toISOString() ?? null,
          })}::jsonb
        )
      `;
    }
  }
}

export async function settlePaymentSucceeded(input: {
  sessionId?: string | null;
  paymentIntentId?: string | null;
}) {
  const payment = await findPaymentForStripeObject(input);
  if (!payment) return null;
  if (payment.status === "succeeded") {
    await applyBusinessPayment(payment);
    return (await findPaymentById(payment.id)) ?? payment;
  }

  await db.$transaction(async (tx) => {
    await tx.$executeRaw`
      UPDATE "payments"
      SET "status" = 'succeeded',
          "stripePaymentIntentId" = COALESCE(${input.paymentIntentId ?? null}, "stripePaymentIntentId"),
          "paidAt" = COALESCE("paidAt", CURRENT_TIMESTAMP),
          "updatedAt" = CURRENT_TIMESTAMP
      WHERE "id" = ${payment.id} AND "status" <> 'succeeded'
    `;
    await tx.$executeRaw`
      UPDATE "orders"
      SET "paymentStatus" = ${PaymentStatus.succeeded}::"PaymentStatus",
          "paidAt" = COALESCE("paidAt", CURRENT_TIMESTAMP),
          "updatedAt" = CURRENT_TIMESTAMP
      WHERE "id" IN (
        SELECT "entityId" FROM "payment_items"
        WHERE "paymentId" = ${payment.id} AND "entityType" = 'order'
      )
    `;
    await tx.$executeRaw`
      UPDATE "garage_bookings"
      SET "advancePaymentStatus" = 'succeeded',
          "advancePaidAt" = COALESCE("advancePaidAt", CURRENT_TIMESTAMP),
          "status" = CASE
            WHEN "bookingDate" IS NULL OR "bookingTime" IS NULL THEN 'pending_slot_selection'::"GarageBookingStatus"
            ELSE 'confirmed'::"GarageBookingStatus"
          END,
          "updatedAt" = CURRENT_TIMESTAMP
      WHERE "id" IN (
        SELECT "entityId" FROM "payment_items"
        WHERE "paymentId" = ${payment.id} AND "entityType" = 'garage_booking'
      )
    `;
  });

  const settled = (await findPaymentById(payment.id)) ?? payment;
  await applyBusinessPayment(settled);
  await notifySettledPayment(settled).catch((error) =>
    logError("Unable to send payment settlement notifications", error),
  );
  await notifyPaymentStatus(settled, "succeeded").catch((error) =>
    logError("Unable to send payment success email", error),
  );
  return settled;
}

export async function markPaymentFailed(input: {
  sessionId?: string | null;
  paymentIntentId?: string | null;
  failureCode?: string | null;
  failureMessage?: string | null;
}) {
  const payment = await findPaymentForStripeObject(input);
  if (!payment || payment.status === "succeeded" || payment.status === "failed") return payment;
  await db.$transaction(async (tx) => {
    await tx.$executeRaw`
      UPDATE "supplier_parts" sp
      SET "stock" = sp."stock" + oi."quantity",
          "updatedAt" = CURRENT_TIMESTAMP
      FROM "order_items" oi
      WHERE oi."supplierPartId" = sp."id"
        AND oi."orderId" IN (
          SELECT "entityId" FROM "payment_items"
          WHERE "paymentId" = ${payment.id} AND "entityType" = 'order'
        )
    `;
    await tx.$executeRaw`
      UPDATE "payments"
      SET "status" = 'failed',
          "failureCode" = ${input.failureCode ?? null},
          "failureMessage" = ${input.failureMessage ?? null},
          "failedAt" = COALESCE("failedAt", CURRENT_TIMESTAMP),
          "updatedAt" = CURRENT_TIMESTAMP
      WHERE "id" = ${payment.id} AND "status" <> 'succeeded'
    `;
    await tx.$executeRaw`
      UPDATE "orders"
      SET "paymentStatus" = ${PaymentStatus.failed}::"PaymentStatus",
          "updatedAt" = CURRENT_TIMESTAMP
      WHERE "paymentStatus" = ${PaymentStatus.pending}::"PaymentStatus"
        AND "id" IN (
          SELECT "entityId" FROM "payment_items"
          WHERE "paymentId" = ${payment.id} AND "entityType" = 'order'
        )
    `;
    await tx.$executeRaw`
      UPDATE "garage_bookings"
      SET "advancePaymentStatus" = 'failed',
          "status" = CASE
            WHEN "status" = 'pending'::"GarageBookingStatus" THEN 'cancelled'::"GarageBookingStatus"
            ELSE "status"
          END,
          "updatedAt" = CURRENT_TIMESTAMP
      WHERE "id" IN (
        SELECT "entityId" FROM "payment_items"
        WHERE "paymentId" = ${payment.id} AND "entityType" = 'garage_booking'
      )
    `;
  });
  const failed = await findPaymentById(payment.id);
  if (failed) {
    await notifyPaymentStatus(failed, "failed").catch((error) =>
      logError("Unable to send payment failure email", error),
    );
  }
  return failed;
}

export async function refreshStripePaymentStatus(paymentId: string) {
  const payment = await findPaymentByIdOrSession(paymentId.trim());
  if (!payment) throw new Error("Payment not found");
  if (!isStripePaymentsConfigured() || !payment.stripeCheckoutSessionId || payment.status === "succeeded") {
    return payment;
  }
  const session = await stripeRequest<StripeCheckoutSession>(
    `/checkout/sessions/${payment.stripeCheckoutSessionId}`,
  );
  const paymentIntentId = stripeObjectId(session.payment_intent);
  if (paymentIntentId && paymentIntentId !== payment.stripePaymentIntentId) {
    await db.$executeRaw`
      UPDATE "payments"
      SET "stripePaymentIntentId" = ${paymentIntentId}, "updatedAt" = CURRENT_TIMESTAMP
      WHERE "id" = ${payment.id}
    `;
  }
  if (session.payment_status === "paid") {
    return settlePaymentSucceeded({ sessionId: session.id, paymentIntentId });
  }
  if (session.status === "expired") {
    return markPaymentFailed({
      sessionId: session.id,
      paymentIntentId,
      failureCode: "checkout_session_expired",
      failureMessage: "Stripe Checkout session expired before payment was completed.",
    });
  }
  return (await findPaymentById(payment.id)) ?? payment;
}

export function verifyStripeWebhookSignature(rawBody: string, signatureHeader: string | null) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  if (!secret) throw new Error("STRIPE_WEBHOOK_SECRET is not configured");
  if (!signatureHeader) throw new Error("Missing Stripe signature");
  const parts = Object.fromEntries(
    signatureHeader.split(",").map((part) => {
      const [key, ...rest] = part.split("=");
      return [key, rest.join("=")];
    }),
  );
  const timestamp = parts.t;
  const signature = parts.v1;
  if (!timestamp || !signature) throw new Error("Invalid Stripe signature");
  const expected = createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex");
  const expectedBuffer = Buffer.from(expected, "hex");
  const signatureBuffer = Buffer.from(signature, "hex");
  if (
    expectedBuffer.length !== signatureBuffer.length ||
    !timingSafeEqual(expectedBuffer, signatureBuffer)
  ) {
    throw new Error("Invalid Stripe signature");
  }
}

export async function processStripeWebhook(rawBody: string, signatureHeader: string | null) {
  verifyStripeWebhookSignature(rawBody, signatureHeader);
  const event = JSON.parse(rawBody) as StripeWebhookEvent;
  const object = event.data?.object ?? {};
  const objectId = typeof object.id === "string" ? object.id : null;
  const eventRows = await db.$queryRaw<Array<{ stripeEventId: string; processedAt: Date | null }>>`
    SELECT "stripeEventId", "processedAt"
    FROM "stripe_webhook_events"
    WHERE "stripeEventId" = ${event.id}
    LIMIT 1
  `;
  if (eventRows[0]?.processedAt) return { duplicate: true };
  if (!eventRows.length) {
    await db.$executeRaw`
      INSERT INTO "stripe_webhook_events" (
        "id", "stripeEventId", "eventType", "objectId", "payload"
      )
      VALUES (
        ${randomUUID()}, ${event.id}, ${event.type}, ${objectId}, ${JSON.stringify(event)}::jsonb
      )
    `;
  }

  try {
    if (event.type === "checkout.session.completed") {
      const sessionId = objectId;
      const paymentIntentId = stripeObjectId(object.payment_intent);
      await settlePaymentSucceeded({ sessionId, paymentIntentId });
    } else if (event.type === "payment_intent.succeeded") {
      await settlePaymentSucceeded({ paymentIntentId: objectId });
    } else if (event.type === "payment_intent.payment_failed") {
      const lastError =
        object.last_payment_error && typeof object.last_payment_error === "object"
          ? (object.last_payment_error as { code?: string; message?: string })
          : {};
      await markPaymentFailed({
        paymentIntentId: objectId,
        failureCode: lastError.code ?? null,
        failureMessage: lastError.message ?? null,
      });
    } else if (event.type === "checkout.session.expired") {
      await markPaymentFailed({
        sessionId: objectId,
        failureCode: "checkout_session_expired",
        failureMessage: "Stripe Checkout session expired before payment.",
      });
    }
    await db.$executeRaw`
      UPDATE "stripe_webhook_events"
      SET "processedAt" = CURRENT_TIMESTAMP, "processingError" = NULL
      WHERE "stripeEventId" = ${event.id}
    `;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Webhook processing failed";
    await db.$executeRaw`
      UPDATE "stripe_webhook_events"
      SET "processingError" = ${message}
      WHERE "stripeEventId" = ${event.id}
    `;
    throw error;
  }

  return { duplicate: false };
}
