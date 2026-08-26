import { createHash } from "node:crypto";

import { db } from "@/lib/database/prisma";
import { sendSmtpMail } from "@/lib/email/smtp";
import {
  OrderSource,
  OrderStatus,
  PaymentStatus,
  Prisma,
  BusinessAccountType,
  SupplierApprovalStatus,
  SupplierPartMappingStatus,
  UserRole,
} from "@/lib/generated/prisma/client";
import {
  activeAdminRecipientIds,
  createNotificationsSafely,
  type CreateNotificationInput,
} from "@/services/notifications/notification-service";
import {
  calculateGarageBookingAdvanceAmount,
  getGarageBookingAdvanceSetting,
} from "@/services/platform-settings/platform-settings-service";
import {
  getSupplierPartPriceBreakdownCents,
} from "@/services/supplier-part-pricing";
import { getUserAddressForCheckout } from "@/services/user-addresses/user-address-service";
import {
  createStripeCheckoutPayment,
  isStripePaymentsConfigured,
} from "@/services/payments/stripe-payment-service";
import { getEffectiveBusinessLimits } from "@/services/business/business-platform-service";

const normalizePaging = (page: number, pageSize: number) => ({
  page: Math.max(1, Number.isFinite(page) ? page : 1),
  pageSize: Math.min(
    50,
    Math.max(1, Number.isFinite(pageSize) ? pageSize : 10),
  ),
});

const leadTimeDays = (value: string | null | undefined) => {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) return null;

  const numbers = Array.from(normalized.matchAll(/\d+(?:\.\d+)?/g), (match) =>
    Number.parseFloat(match[0]),
  ).filter(Number.isFinite);
  if (!numbers.length) return null;

  const longestValue = Math.max(...numbers);
  const multiplier = /month/.test(normalized)
    ? 30
    : /week/.test(normalized)
      ? 7
      : /hour/.test(normalized)
        ? 1 / 24
        : 1;

  return Math.max(1, Math.ceil(longestValue * multiplier));
};

const addCalendarDays = (date: Date, days: number) => {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
};

const deliveryOptions = {
  "24_hours": { label: "24 hours", days: 1 },
  "48_hours": { label: "48 hours", days: 2 },
  "72_hours": { label: "72 hours", days: 3 },
  one_week: { label: "One week", days: 7 },
  one_month: { label: "One month", days: 30 },
  more_than_one_month: { label: "More than one month", days: 31 },
} as const;

type DeliveryOption = keyof typeof deliveryOptions;

const expectedDeliveryForOption = (confirmedAt: Date, value: string | null) =>
  value && value in deliveryOptions
    ? addCalendarDays(confirmedAt, deliveryOptions[value as DeliveryOption].days)
    : null;
const MAX_PROOF_RECIPIENT_NAME_LENGTH = 80;
const MAX_PROOF_NOTE_LENGTH = 500;
const sendMailSafely = (input: Parameters<typeof sendSmtpMail>[0]) =>
  sendSmtpMail(input).catch(() => undefined);
const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
const money = (value: number | null | undefined, cents: boolean) =>
  value === null || value === undefined
    ? "—"
    : new Intl.NumberFormat("en-AE", {
        style: "currency",
        currency: "AED",
      }).format(cents ? value / 100 : value);
const orderItemName = (item: {
  partName: string;
  supplierPart?: { originalPartName: string } | null;
}) => item.supplierPart?.originalPartName || item.partName;
const orderItemNumber = (item: {
  partNumber: string | null;
  supplierPart?: {
    originalMpn: string | null;
    originalOemNumber: string | null;
  } | null;
}) => item.supplierPart?.originalOemNumber || item.supplierPart?.originalMpn || item.partNumber;
const orderItemsText = (
  items: Array<{
    partName: string;
    partNumber: string | null;
    quantity: number;
    lineTotal: number | null;
    supplierPart?: {
      originalPartName: string;
      originalMpn: string | null;
      originalOemNumber: string | null;
    } | null;
  }>,
  cents = false,
) =>
  [
    "Order parts:",
    ...items.map(
      (item) =>
        `- ${orderItemName(item)}${orderItemNumber(item) ? ` (${orderItemNumber(item)})` : ""} × ${item.quantity} — ${money(item.lineTotal, cents)}`,
    ),
  ].join("\n");
const orderItemsHtml = (
  items: Array<{
    partName: string;
    partNumber: string | null;
    quantity: number;
    lineTotal: number | null;
    supplierPart?: {
      originalPartName: string;
      originalMpn: string | null;
      originalOemNumber: string | null;
    } | null;
  }>,
  cents = false,
) =>
  [
    `<p style="margin:0 0 12px"><strong>Order parts</strong></p>`,
    `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;border:1px solid #2a2a2a;border-radius:12px;overflow:hidden">`,
    ...items.map((item) => [
      `<tr>`,
      `<td style="padding:12px;border-bottom:1px solid #2a2a2a;color:#f9fafb">`,
      `<strong>${escapeHtml(orderItemName(item))}</strong>`,
      orderItemNumber(item) ? `<br><span style="color:#9ca3af;font-size:12px">${escapeHtml(orderItemNumber(item)!)}</span>` : "",
      `</td>`,
      `<td align="center" style="padding:12px;border-bottom:1px solid #2a2a2a;color:#d1d5db;white-space:nowrap">× ${item.quantity}</td>`,
      `<td align="right" style="padding:12px;border-bottom:1px solid #2a2a2a;color:#ffffff;white-space:nowrap">${escapeHtml(money(item.lineTotal, cents))}</td>`,
      `</tr>`,
    ].join("")),
    `</table>`,
  ].join("");
const orderItemsSectionHtml = (
  title: string,
  items: Parameters<typeof orderItemsHtml>[0],
  cents = false,
) =>
  items.length
    ? orderItemsHtml(items, cents).replace("<strong>Order parts</strong>", `<strong>${escapeHtml(title)}</strong>`)
    : "";
const orderItemsSummary = (
  items: Array<{
    partName: string;
    quantity: number;
    supplierPart?: { originalPartName: string } | null;
  }>,
) =>
  items
    .slice(0, 3)
    .map((item) => `${orderItemName(item)} × ${item.quantity}`)
    .join(", ");

const searchWhere = (search: string): Prisma.OrderWhereInput => {
  const query = search.trim();
  if (!query) return {};
  return {
    OR: [
      { publicId: { contains: query, mode: "insensitive" } },
      { buyer: { companyName: { contains: query, mode: "insensitive" } } },
      { buyer: { firstName: { contains: query, mode: "insensitive" } } },
      { buyer: { lastName: { contains: query, mode: "insensitive" } } },
      { supplier: { companyName: { contains: query, mode: "insensitive" } } },
      { supplier: { firstName: { contains: query, mode: "insensitive" } } },
      { supplier: { lastName: { contains: query, mode: "insensitive" } } },
      {
        items: { some: { partName: { contains: query, mode: "insensitive" } } },
      },
      {
        items: {
          some: { partNumber: { contains: query, mode: "insensitive" } },
        },
      },
      { rfq: { publicId: { contains: query, mode: "insensitive" } } },
    ],
  };
};

const orderInclude = {
  buyer: {
    select: {
      id: true,
      companyName: true,
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
      activeRole: true,
    },
  },
  supplier: {
    select: {
      id: true,
      supplierPublicId: true,
      companyName: true,
      firstName: true,
      lastName: true,
      email: true,
    },
  },
  items: {
    orderBy: { createdAt: "asc" as const },
    include: {
      supplierPart: {
        select: {
          originalPartName: true,
          originalMpn: true,
          originalOemNumber: true,
        },
      },
      review: {
        select: {
          id: true,
          rating: true,
          comment: true,
          createdAt: true,
          updatedAt: true,
        },
      },
    },
  },
  rfq: {
    select: {
      id: true,
      publicId: true,
      projectName: true,
      deliveryRequirement: true,
      paymentTerms: true,
      vehicleVin: true,
      vehicleYear: true,
      vehicleMake: true,
      vehicleModel: true,
      vehicleTrim: true,
    },
  },
  deliveryAddress: true,
  garageBookings: {
    orderBy: { createdAt: "asc" as const },
    select: {
      id: true,
      publicId: true,
      serviceName: true,
      garageId: true,
      serviceId: true,
      bookingDate: true,
      bookingTime: true,
      durationMinutes: true,
      price: true,
      currency: true,
      status: true,
      linkedOrderId: true,
      garage: {
        select: {
          companyName: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      },
    },
  },
} satisfies Prisma.OrderInclude;

type DirectOrderLineInput = {
  supplierPartId?: unknown;
  quantity?: unknown;
};

type DirectServiceBookingInput = {
  garageId?: unknown;
  serviceId?: unknown;
  quantity?: unknown;
  vehicleYear?: unknown;
  vehicleMake?: unknown;
  vehicleModel?: unknown;
  vehicleVin?: unknown;
  notes?: unknown;
};

type DirectOrderCheckoutInput = DirectOrderLineInput & {
  items?: unknown;
  services?: unknown;
  addressId?: unknown;
  paymentSuccessUrl?: unknown;
  paymentCancelUrl?: unknown;
  idempotencyKey?: unknown;
};

const maxDirectOrderLines = 50;

const parseDirectOrderQuantity = (value: unknown) => {
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number.parseInt(value, 10);
  return Number.NaN;
};

const normalizeDirectOrderLines = (input: DirectOrderCheckoutInput) => {
  const rawLines = Array.isArray(input.items) ? input.items : [input];
  if (rawLines.length === 0)
    throw new Error("Add at least one product to checkout");
  if (rawLines.length > maxDirectOrderLines) {
    throw new Error(
      `Checkout supports up to ${maxDirectOrderLines} products at a time`,
    );
  }

  const totalsBySupplierPart = new Map<string, number>();
  for (const rawLine of rawLines) {
    const line =
      rawLine && typeof rawLine === "object"
        ? (rawLine as DirectOrderLineInput)
        : {};
    const supplierPartId =
      typeof line.supplierPartId === "string" ? line.supplierPartId.trim() : "";
    const quantity = parseDirectOrderQuantity(line.quantity);

    if (!supplierPartId) throw new Error("Supplier part is required");
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 999) {
      throw new Error("Quantity must be between 1 and 999");
    }

    const nextQuantity =
      (totalsBySupplierPart.get(supplierPartId) ?? 0) + quantity;
    if (nextQuantity > 999) {
      throw new Error("Quantity must be between 1 and 999 for each product");
    }
    totalsBySupplierPart.set(supplierPartId, nextQuantity);
  }

  return Array.from(totalsBySupplierPart, ([supplierPartId, quantity]) => ({
    supplierPartId,
    quantity,
  }));
};

const normalizeText = (value: unknown, maxLength = 160) => {
  const normalized =
    typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
  if (!normalized) return null;
  return normalized.slice(0, maxLength);
};

const normalizeDirectServiceBookings = (input: DirectOrderCheckoutInput) => {
  const rawServices = Array.isArray(input.services) ? input.services : [];
  if (rawServices.length > 20) {
    throw new Error("Checkout supports up to 20 garage services at a time");
  }

  const services: Array<{
    garageId: string;
    serviceId: string;
    quantity: number;
    vehicleYear: string | null;
    vehicleMake: string | null;
    vehicleModel: string | null;
    vehicleVin: string | null;
    notes: string | null;
  }> = [];

  for (const rawService of rawServices) {
    const service =
      rawService && typeof rawService === "object"
        ? (rawService as DirectServiceBookingInput)
        : {};
    const garageId =
      typeof service.garageId === "string" ? service.garageId.trim() : "";
    const serviceId =
      typeof service.serviceId === "string" ? service.serviceId.trim() : "";
    const quantity = parseDirectOrderQuantity(service.quantity ?? 1);
    if (!garageId || !serviceId) {
      throw new Error("Garage and service are required for service checkout");
    }
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 20) {
      throw new Error("Service quantity must be between 1 and 20");
    }
    services.push({
      garageId,
      serviceId,
      quantity,
      vehicleYear: normalizeText(service.vehicleYear, 20),
      vehicleMake: normalizeText(service.vehicleMake, 80),
      vehicleModel: normalizeText(service.vehicleModel, 80),
      vehicleVin: normalizeText(service.vehicleVin, 40)?.toUpperCase() ?? null,
      notes: normalizeText(service.notes, 500),
    });
  }

  return services;
};

const normalizeAddressId = (value: unknown) =>
  typeof value === "string" ? value.trim() : "";

const normalizeCheckoutUrl = (value: unknown, fallback: string) => {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw) return fallback;
  try {
    const url = new URL(raw);
    if (url.protocol !== "http:" && url.protocol !== "https:") return fallback;
    return url.toString();
  } catch {
    return fallback;
  }
};

const checkoutFingerprint = (value: unknown) =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex").slice(0, 32);

const mapOrder = <
  T extends {
    totalAmount: number;
    items: Array<{
      quantity: number;
      unitPrice: number | null;
      lineTotal: number | null;
      supplierOriginalUnitPrice?: number | null;
      supplierVatPercentage?: number | null;
      supplierVatAmount?: number | null;
      supplierVatMode?: string | null;
      deliveredAt?: Date | string | null;
    }>;
    garageBookings?: Array<{
      price: number;
      status: string;
      linkedOrderId: string | null;
    }>;
  },
>(
  order: T,
) => ({
  ...order,
  totalAmount: order.totalAmount / 100,
  deliveryProgress: (() => {
    const totalUnits = order.items.reduce((sum, item) => sum + item.quantity, 0);
    if (!totalUnits) return 0;
    const deliveredUnits = order.items.reduce(
      (sum, item) => sum + (item.deliveredAt ? item.quantity : 0),
      0,
    );
    return Math.round((deliveredUnits / totalUnits) * 100);
  })(),
  deliveredItemCount: order.items.filter((item) => item.deliveredAt).length,
  totalItemCount: order.items.length,
  items: order.items.map((item) => {
    const publicItem = { ...item };
    delete publicItem.supplierOriginalUnitPrice;
    delete publicItem.supplierVatPercentage;
    delete publicItem.supplierVatAmount;
    delete publicItem.supplierVatMode;

    return {
      ...publicItem,
      unitPrice: item.unitPrice === null ? null : item.unitPrice / 100,
      lineTotal: item.lineTotal === null ? null : item.lineTotal / 100,
    };
  }),
  garageBookings: order.garageBookings?.map((booking) => ({
    ...booking,
    price: booking.price / 100,
    canSelectSlot:
      booking.status === "pending_slot_selection" &&
      Boolean(booking.linkedOrderId) &&
      order.items.length > 0 &&
      order.items.every((item) => Boolean(item.deliveredAt)),
  })) ?? [],
});

async function listOrders(
  where: Prisma.OrderWhereInput,
  page: number,
  pageSize: number,
) {
  const paging = normalizePaging(page, pageSize);
  const [orders, total, aggregate, statuses] = await Promise.all([
    db.order.findMany({
      where,
      include: orderInclude,
      orderBy: { createdAt: "desc" },
      skip: (paging.page - 1) * paging.pageSize,
      take: paging.pageSize,
    }),
    db.order.count({ where }),
    db.order.aggregate({ where, _sum: { totalAmount: true } }),
    db.order.groupBy({ by: ["status"], where, _count: { _all: true } }),
  ]);
  return {
    orders: orders.map(mapOrder),
    pagination: {
      ...paging,
      total,
      totalPages: Math.max(1, Math.ceil(total / paging.pageSize)),
    },
    summary: {
      totalOrders: total,
      totalAmount: (aggregate._sum.totalAmount ?? 0) / 100,
      byStatus: Object.fromEntries(
        statuses.map((item) => [item.status, item._count._all]),
      ),
    },
  };
}

export function listUserOrders(
  userId: string,
  activeRole: UserRole,
  page: number,
  pageSize: number,
  search: string,
  status?: OrderStatus | null,
) {
  const scope =
    activeRole === UserRole.Supplier
      ? { supplierId: userId }
      : { buyerId: userId };
  return listOrders(
    {
      AND: [scope, searchWhere(search), status ? { status } : {}],
    },
    page,
    pageSize,
  );
}

export function listAllOrders(page: number, pageSize: number, search: string) {
  return listOrders(searchWhere(search), page, pageSize);
}

export async function confirmSupplierOrder(
  supplierId: string,
  orderId: string,
) {
  const confirmedAt = new Date();
  const expectedDeliveryAt = await db.$transaction(async (transaction) => {
    const pendingOrder = await transaction.order.findFirst({
      where: {
        id: orderId,
        supplierId,
        status: OrderStatus.pending,
        paymentStatus: PaymentStatus.succeeded,
      },
      select: {
        id: true,
        items: {
          select: {
            id: true,
            deliveryOption: true,
            supplierPart: {
              select: {
                stockRows: { select: { leadTime: true } },
              },
            },
          },
        },
      },
    });
    if (!pendingOrder) {
      throw new Error("Only a paid pending order can be confirmed");
    }

    const expectedDates: Date[] = [];
    for (const item of pendingOrder.items) {
      let itemExpectedDeliveryAt: Date | null = null;
      if (item.deliveryOption) {
        itemExpectedDeliveryAt = expectedDeliveryForOption(
          confirmedAt,
          item.deliveryOption,
        );
      } else {
        const warehouseLeadTimes =
          item.supplierPart?.stockRows
            .map((row) => leadTimeDays(row.leadTime))
            .filter((days): days is number => days !== null) ?? [];
        if (warehouseLeadTimes.length) {
          itemExpectedDeliveryAt = addCalendarDays(
            confirmedAt,
            Math.max(...warehouseLeadTimes),
          );
        }
      }
      if (itemExpectedDeliveryAt) expectedDates.push(itemExpectedDeliveryAt);
      await transaction.orderItem.update({
        where: { id: item.id },
        data: { expectedDeliveryAt: itemExpectedDeliveryAt },
      });
    }

    const calculatedDate = expectedDates.length
      ? new Date(Math.max(...expectedDates.map((date) => date.getTime())))
      : null;
    const updated = await transaction.order.updateMany({
      where: {
        id: orderId,
        supplierId,
        status: OrderStatus.pending,
        paymentStatus: PaymentStatus.succeeded,
      },
      data: {
        status: OrderStatus.confirmed,
        supplierConfirmedAt: confirmedAt,
        expectedDeliveryAt: calculatedDate,
      },
    });
    if (updated.count !== 1) {
      throw new Error("Only a paid pending order can be confirmed");
    }
    return calculatedDate;
  });

  const order = await db.order.findUniqueOrThrow({
    where: { id: orderId },
    include: orderInclude,
  });
  await createNotificationsSafely([
    {
      recipientUserId: order.buyerId,
      actorUserId: supplierId,
      type: "order.confirmed",
      title: "Order confirmed",
      body: expectedDeliveryAt
        ? `Your order ${order.publicId} has been confirmed. Expected delivery: ${expectedDeliveryAt.toLocaleDateString("en-AE", { timeZone: "Asia/Dubai" })}.`
        : `Your order ${order.publicId} has been confirmed.`,
      linkUrl: "/orders",
      entityType: "order",
      entityId: order.id,
    },
    {
      recipientUserId: supplierId,
      type: "order.confirmed",
      title: "Order status updated",
      body: `You confirmed order ${order.publicId}.`,
      linkUrl: "/orders",
      entityType: "order",
      entityId: order.id,
    },
  ]);
  const expectedDateText = expectedDeliveryAt
    ? `Expected delivery: ${expectedDeliveryAt.toLocaleDateString("en-AE", { timeZone: "Asia/Dubai" })}.`
    : "";
  await Promise.all([
    order.buyer.email
      ? sendMailSafely({
          to: order.buyer.email,
          subject: `Order ${order.publicId} confirmed by supplier`,
          text: [`Your order ${order.publicId} has been confirmed.`, expectedDateText, orderItemsText(order.items, true)]
            .filter(Boolean)
            .join("\n"),
          html: [
            `<p>Your order <strong>${escapeHtml(order.publicId)}</strong> has been confirmed.</p>`,
            expectedDateText ? `<p>${escapeHtml(expectedDateText)}</p>` : "",
            orderItemsHtml(order.items, true),
          ].join(""),
        })
      : undefined,
    order.supplier.email
      ? sendMailSafely({
          to: order.supplier.email,
          subject: `You confirmed order ${order.publicId}`,
          text: [`You confirmed order ${order.publicId}.`, expectedDateText, orderItemsText(order.items, true)]
            .filter(Boolean)
            .join("\n"),
          html: [
            `<p>You confirmed order <strong>${escapeHtml(order.publicId)}</strong>.</p>`,
            expectedDateText ? `<p>${escapeHtml(expectedDateText)}</p>` : "",
            orderItemsHtml(order.items, true),
          ].join(""),
        })
      : undefined,
  ]);
  return mapOrder(order);
}

export async function submitOrderProofOfDelivery(
  supplierId: string,
  orderId: string,
  input: {
    itemIds?: string[];
    proofUrl: string;
    proofKey: string;
    recipientName?: string;
    note?: string;
  },
) {
  const saved = await db.$transaction(async (transaction) => {
    const order = await transaction.order.findFirst({
      where: { id: orderId, supplierId },
      include: { items: true },
    });
    if (!order) throw new Error("Order not found");
    const proofEligibleStatuses = new Set<OrderStatus>([
      OrderStatus.confirmed,
      OrderStatus.processing,
      OrderStatus.shipped,
    ]);
    if (!proofEligibleStatuses.has(order.status)) {
      throw new Error("Confirm the order before submitting proof of delivery");
    }

    const uniqueItemIds = Array.from(
      new Set((input.itemIds ?? []).map((itemId) => itemId.trim()).filter(Boolean)),
    );
    if (!uniqueItemIds.length) {
      throw new Error("Select at least one order item for this delivery batch");
    }
    const selectedItems = order.items.filter((item) => uniqueItemIds.includes(item.id));
    if (selectedItems.length !== uniqueItemIds.length) {
      throw new Error("One or more selected items do not belong to this order");
    }
    if (selectedItems.some((item) => item.deliveredAt)) {
      throw new Error("One or more selected items were already delivered");
    }
    const proofRecipientName = input.recipientName?.trim().replace(/\s+/g, " ") || null;
    const proofNote = input.note?.trim().replace(/\s+/g, " ") || null;
    if (proofRecipientName && proofRecipientName.length > MAX_PROOF_RECIPIENT_NAME_LENGTH) {
      throw new Error(`Recipient name cannot exceed ${MAX_PROOF_RECIPIENT_NAME_LENGTH} characters`);
    }
    if (proofNote && proofNote.length > MAX_PROOF_NOTE_LENGTH) {
      throw new Error(`Delivery note cannot exceed ${MAX_PROOF_NOTE_LENGTH} characters`);
    }

    const deliveredAt = new Date();
    await transaction.orderItem.updateMany({
      where: { id: { in: uniqueItemIds }, orderId: order.id },
      data: {
        deliveredAt,
        proofOfDeliveryUrl: input.proofUrl,
        proofOfDeliveryKey: input.proofKey,
        proofRecipientName,
        proofOfDeliveryNote: proofNote,
        proofSubmittedAt: deliveredAt,
      },
    });

    const remaining = await transaction.orderItem.count({
      where: { orderId: order.id, deliveredAt: null },
    });
    const nextStatus = remaining === 0 ? OrderStatus.delivered : OrderStatus.processing;

    await transaction.order.update({
      where: { id: order.id },
      data: {
        status: nextStatus,
        proofOfDeliveryUrl: input.proofUrl,
        proofOfDeliveryKey: input.proofKey,
        proofRecipientName,
        proofOfDeliveryNote: proofNote,
        proofSubmittedAt: deliveredAt,
      },
    });

    return transaction.order.findUniqueOrThrow({
      where: { id: order.id },
      include: orderInclude,
    });
  });

  const deliveredItemCount = saved.items.filter((item) => item.deliveredAt).length;
  const isComplete = saved.items.length > 0 && deliveredItemCount === saved.items.length;
  const deliveredItems = saved.items.filter((item) => item.deliveredAt);
  const pendingItems = saved.items.filter((item) => !item.deliveredAt);
  const deliveredTextTitle = isComplete ? "Delivered parts:" : "Delivered in this update:";
  const pendingText = pendingItems.length
    ? ["Pending parts:", ...orderItemsText(pendingItems, true).split("\n").slice(1)].join("\n")
    : "";
  await createNotificationsSafely([
    {
      recipientUserId: saved.buyerId,
      actorUserId: supplierId,
      type: isComplete ? "order.delivered" : "order.delivery.partial",
      title: isComplete ? "Order delivered" : "Order delivery updated",
      body: isComplete
        ? `All parts for ${saved.publicId} have been delivered.`
        : `${deliveredItemCount} of ${saved.items.length} parts for ${saved.publicId} have been delivered.`,
      linkUrl: "/orders",
      entityType: "order",
      entityId: saved.id,
    },
    {
      recipientUserId: supplierId,
      type: isComplete ? "order.delivered" : "order.delivery.partial",
      title: isComplete ? "Order marked delivered" : "Order delivery updated",
      body: isComplete
        ? `You marked all parts for ${saved.publicId} as delivered.`
        : `You marked ${deliveredItemCount} of ${saved.items.length} parts for ${saved.publicId} as delivered.`,
      linkUrl: "/orders",
      entityType: "order",
      entityId: saved.id,
    },
  ]);
  await Promise.all([
    saved.buyer.email
      ? sendMailSafely({
          to: saved.buyer.email,
          subject: isComplete ? `Order ${saved.publicId} delivered` : `${deliveredItems.length} part${deliveredItems.length === 1 ? "" : "s"} delivered for order ${saved.publicId}`,
          text: [
            isComplete
            ? `All parts for ${saved.publicId} have been delivered.`
            : `${deliveredItemCount} of ${saved.items.length} parts for ${saved.publicId} have been delivered.`,
            [deliveredTextTitle, ...orderItemsText(deliveredItems, true).split("\n").slice(1)].join("\n"),
            pendingText,
          ].filter(Boolean).join("\n\n"),
          html: [
            `<p>${isComplete
              ? `All parts for <strong>${escapeHtml(saved.publicId)}</strong> have been delivered.`
              : `${deliveredItemCount} of ${saved.items.length} parts for <strong>${escapeHtml(saved.publicId)}</strong> have been delivered.`}</p>`,
            orderItemsSectionHtml(deliveredTextTitle.replace(":", ""), deliveredItems, true),
            orderItemsSectionHtml("Pending parts", pendingItems, true),
          ].join(""),
        })
      : undefined,
    saved.supplier.email
      ? sendMailSafely({
          to: saved.supplier.email,
          subject: isComplete ? `You marked order ${saved.publicId} delivered` : `${deliveredItems.length} part${deliveredItems.length === 1 ? "" : "s"} marked delivered for order ${saved.publicId}`,
          text: [
            isComplete
            ? `You marked all parts for ${saved.publicId} as delivered.`
            : `You marked ${deliveredItemCount} of ${saved.items.length} parts for ${saved.publicId} as delivered.`,
            [deliveredTextTitle, ...orderItemsText(deliveredItems, true).split("\n").slice(1)].join("\n"),
            pendingText,
          ].filter(Boolean).join("\n\n"),
          html: [
            `<p>${isComplete
              ? `You marked all parts for <strong>${escapeHtml(saved.publicId)}</strong> as delivered.`
              : `You marked ${deliveredItemCount} of ${saved.items.length} parts for <strong>${escapeHtml(saved.publicId)}</strong> as delivered.`}</p>`,
            orderItemsSectionHtml(deliveredTextTitle.replace(":", ""), deliveredItems, true),
            orderItemsSectionHtml("Pending parts", pendingItems, true),
          ].join(""),
        })
      : undefined,
  ]);
  return mapOrder(saved);
}

export async function confirmOrderItemReceipt(
  buyerId: string,
  orderId: string,
  itemId: string,
) {
  const trimmedOrderId = orderId.trim();
  const trimmedItemId = itemId.trim();
  if (!trimmedOrderId || !trimmedItemId) {
    throw new Error("Order and item are required");
  }

  const saved = await db.$transaction(async (transaction) => {
    const order = await transaction.order.findFirst({
      where: {
        buyerId,
        OR: [{ id: trimmedOrderId }, { publicId: trimmedOrderId }],
      },
      include: { items: true },
    });
    if (!order) throw new Error("Order not found");

    const item = order.items.find((orderItem) => orderItem.id === trimmedItemId);
    if (!item) throw new Error("Order item not found");
    if (!item.deliveredAt) {
      throw new Error("This part has not been delivered yet");
    }

    if (!item.buyerConfirmedAt) {
      await transaction.orderItem.update({
        where: { id: item.id },
        data: { buyerConfirmedAt: new Date() },
      });
    }

    return transaction.order.findUniqueOrThrow({
      where: { id: order.id },
      include: orderInclude,
    });
  });

  await createNotificationsSafely([
    {
      recipientUserId: saved.supplierId,
      actorUserId: buyerId,
      type: "order.delivery.received",
      title: "Delivery receipt confirmed",
      body: `A delivered part for ${saved.publicId} was confirmed by the buyer.`,
      linkUrl: "/orders",
      entityType: "order",
      entityId: saved.id,
    },
  ]);
  await Promise.all([
    saved.supplier.email
      ? sendMailSafely({
          to: saved.supplier.email,
          subject: `Buyer confirmed receipt for order ${saved.publicId}`,
          text: `A delivered part for ${saved.publicId} was confirmed by the buyer.`,
        })
      : undefined,
    saved.buyer.email
      ? sendMailSafely({
          to: saved.buyer.email,
          subject: `Receipt confirmed for order ${saved.publicId}`,
          text: `You confirmed receipt of a delivered part for ${saved.publicId}.`,
        })
      : undefined,
  ]);

  return mapOrder(saved);
}

export async function createDirectOrder(
  buyerId: string,
  input: DirectOrderLineInput,
) {
  const checkout = await createDirectOrders(buyerId, input);
  const order = checkout.orders[0];
  if (!order) throw new Error("Unable to create order");
  return order;
}

export async function createDirectOrders(
  buyerId: string,
  input: DirectOrderCheckoutInput,
) {
  if (!isStripePaymentsConfigured()) {
    throw new Error("Stripe test keys are not configured on the backend");
  }
  const lines = normalizeDirectOrderLines(input);
  const serviceBookings = normalizeDirectServiceBookings(input);
  const addressId = normalizeAddressId(input.addressId);
  if (!addressId) throw new Error("Select a delivery address before checkout");
  if (serviceBookings.length && !lines.length) {
    throw new Error("Add at least one product before adding a delayed service slot");
  }
  const defaultSuccessUrl =
    process.env.STRIPE_SUCCESS_URL ??
    process.env.NEXT_PUBLIC_SITE_URL ??
    process.env.SITE_URL ??
    "http://localhost:3001/cart?payment=success&session_id={CHECKOUT_SESSION_ID}";
  const defaultCancelUrl =
    process.env.STRIPE_CANCEL_URL ??
    process.env.NEXT_PUBLIC_SITE_URL ??
    process.env.SITE_URL ??
    "http://localhost:3001/cart?payment=cancelled";
  const paymentSuccessUrl = normalizeCheckoutUrl(input.paymentSuccessUrl, defaultSuccessUrl);
  const paymentCancelUrl = normalizeCheckoutUrl(input.paymentCancelUrl, defaultCancelUrl);
  const deliveryAddress = await getUserAddressForCheckout(buyerId, addressId);
  const supplierPartIds = lines.map((line) => line.supplierPartId);
  const precheckSupplierParts = await db.supplierPart.findMany({
    where: {
      id: { in: supplierPartIds },
      mappingStatus: SupplierPartMappingStatus.mapped,
      supplier: { is: { isActive: true, supplierApprovalStatus: SupplierApprovalStatus.Approved } },
    },
    select: { supplierId: true },
  });
  for (const supplierId of new Set(precheckSupplierParts.map((part) => part.supplierId))) {
    const { limits } = await getEffectiveBusinessLimits({ userId: supplierId, accountType: BusinessAccountType.Supplier });
    if (limits.orders === null) continue;
    const currentOrders = await db.order.count({ where: { supplierId, status: { not: OrderStatus.cancelled } } });
    if (currentOrders >= limits.orders) {
      throw new Error("This supplier is not accepting new orders right now. Please remove their item from your cart or choose another supplier.");
    }
  }
  for (const garageId of new Set(serviceBookings.map((booking) => booking.garageId))) {
    const requestedBookings = serviceBookings
      .filter((booking) => booking.garageId === garageId)
      .reduce((total, booking) => total + booking.quantity, 0);
    const { limits } = await getEffectiveBusinessLimits({ userId: garageId, accountType: BusinessAccountType.Garage });
    if (limits.appointments === null) continue;
    const monthStart = new Date();
    monthStart.setUTCDate(1);
    monthStart.setUTCHours(0, 0, 0, 0);
    const currentAppointments = await db.garageBooking.count({ where: { garageId, createdAt: { gte: monthStart }, status: { not: "cancelled" } } });
    if (currentAppointments + requestedBookings > limits.appointments) {
      throw new Error("This garage is not accepting new bookings right now. Please remove their service from your cart or choose another garage.");
    }
  }

  const checkout = await db.$transaction(async (transaction) => {
    const supplierParts = await transaction.supplierPart.findMany({
      where: {
        id: { in: supplierPartIds },
        mappingStatus: SupplierPartMappingStatus.mapped,
        supplier: {
          is: {
            isActive: true,
            supplierApprovalStatus: SupplierApprovalStatus.Approved,
          },
        },
      },
      include: { part: true, pricing: true },
    });

    const supplierPartById = new Map(
      supplierParts.map((part) => [part.id, part]),
    );
    const groupedOrders = new Map<
      string,
      {
        supplierId: string;
        totalAmount: number;
        items: Array<{
          create: Prisma.OrderItemCreateWithoutOrderInput;
          supplierPartId: string;
          supplierOriginalUnitPrice: number;
          supplierVatPercentage: number;
          supplierVatAmount: number;
          supplierVatMode: string | null;
        }>;
      }
    >();

    for (const line of lines) {
      const supplierPart = supplierPartById.get(line.supplierPartId);
      if (!supplierPart)
        throw new Error("One or more products are not available for ordering");
      if (supplierPart.supplierId === buyerId)
        throw new Error("A supplier cannot order its own part");

      const reserved = await transaction.supplierPart.updateMany({
        where: { id: supplierPart.id, stock: { gte: line.quantity } },
        data: { stock: { decrement: line.quantity } },
      });
      if (reserved.count !== 1) {
        throw new Error(
          `Insufficient stock for ${supplierPart.originalPartName || supplierPart.part?.partName || "this product"}`,
        );
      }

      const price = getSupplierPartPriceBreakdownCents(supplierPart);
      const unitPrice = price.customerUnitPrice;
      const lineTotal = unitPrice * line.quantity;
      const existingGroup = groupedOrders.get(supplierPart.supplierId) ?? {
        supplierId: supplierPart.supplierId,
        totalAmount: 0,
        items: [],
      };
      existingGroup.totalAmount += lineTotal;
      existingGroup.items.push({
        create: {
          supplierPart: { connect: { id: supplierPart.id } },
          partName: supplierPart.originalPartName || supplierPart.part?.partName || "Auto part",
          partNumber:
            supplierPart.originalOemNumber ||
            supplierPart.originalMpn ||
            supplierPart.part?.partNumber,
          quantity: line.quantity,
          unitPrice,
          lineTotal,
        },
        supplierPartId: supplierPart.id,
        supplierOriginalUnitPrice: price.supplierUnitPrice,
        supplierVatPercentage: price.vatPercent,
        supplierVatAmount: price.vatAmount,
        supplierVatMode: price.vatMode,
      });
      groupedOrders.set(supplierPart.supplierId, existingGroup);
    }

    const orders = [];
    for (const group of groupedOrders.values()) {
      const createdOrder = await transaction.order.create({
        data: {
          source: OrderSource.direct,
          buyerId,
          supplierId: group.supplierId,
          deliveryAddressId: deliveryAddress.id,
          deliveryRecipientName: deliveryAddress.recipientName,
          deliveryPhone: deliveryAddress.phone,
          deliveryAddressLine1: deliveryAddress.addressLine1,
          deliveryAddressLine2: deliveryAddress.addressLine2,
          deliveryLandmark: deliveryAddress.landmark,
          deliveryCity: deliveryAddress.city,
          deliveryState: deliveryAddress.state,
          deliveryCountry: deliveryAddress.country,
          totalAmount: group.totalAmount,
          status: OrderStatus.pending,
          paymentStatus: PaymentStatus.pending,
          items: { create: group.items.map((item) => item.create) },
        },
        include: orderInclude,
      });
      orders.push(createdOrder);
      for (const item of group.items) {
        await transaction.$executeRaw`
          UPDATE "order_items"
          SET
            "supplierOriginalUnitPrice" = ${item.supplierOriginalUnitPrice},
            "supplierVatPercentage" = ${item.supplierVatPercentage},
            "supplierVatAmount" = ${item.supplierVatAmount},
            "supplierVatMode" = ${item.supplierVatMode}
          WHERE "orderId" = ${createdOrder.id} AND "supplierPartId" = ${item.supplierPartId}
        `;
      }
    }

    const firstLinkedOrder = orders[0];
    let serviceTotalAmount = 0;
    let serviceBookingCount = 0;
    if (serviceBookings.length && firstLinkedOrder) {
      const buyer = await transaction.user.findUnique({
        where: { id: buyerId },
        select: { email: true },
      });
      const advanceSetting = await getGarageBookingAdvanceSetting();
      const services = await transaction.garageService.findMany({
        where: {
          OR: serviceBookings.map((service) => ({
            id: service.serviceId,
            garageId: service.garageId,
            status: "active",
          })),
        },
      });
      const serviceByKey = new Map(
        services.map((service) => [`${service.garageId}:${service.id}`, service]),
      );
      for (const line of serviceBookings) {
        const service = serviceByKey.get(`${line.garageId}:${line.serviceId}`);
        if (!service) {
          throw new Error("One or more garage services are no longer available");
        }
        const advanceAmount = calculateGarageBookingAdvanceAmount(
          service.price,
          advanceSetting,
        );
        for (let index = 0; index < line.quantity; index += 1) {
          await transaction.garageBooking.create({
            data: {
              garageId: service.garageId,
              customerId: buyerId,
              serviceId: service.id,
              serviceName: service.name,
              customerName: deliveryAddress.recipientName,
              customerEmail: buyer?.email ?? null,
              customerPhone: deliveryAddress.phone,
              vehicleYear: line.vehicleYear,
              vehicleMake: line.vehicleMake,
              vehicleModel: line.vehicleModel,
              vehicleVin: line.vehicleVin,
              notes:
                line.notes ??
                "Paid with product checkout. Customer will select slot after part delivery.",
              bookingDate: null,
              bookingTime: null,
              durationMinutes: service.durationMinutes,
              price: service.price,
              currency: service.currency,
              advancePercentage:
                advanceSetting.mode === "percentage"
                  ? advanceSetting.value
                  : null,
              advanceAmount,
              advancePaymentStatus: "pending",
              status: "pending_slot_selection",
              linkedOrderId: firstLinkedOrder.id,
            },
          });
          serviceBookingCount += 1;
          serviceTotalAmount += advanceAmount;
        }
        await transaction.garageService.update({
          where: { id: service.id },
          data: { bookingsCount: { increment: line.quantity } },
        });
      }
    }

    return {
      rawOrders: orders.map((order) => ({
        id: order.id,
        publicId: order.publicId,
        totalAmount: order.totalAmount,
      })),
      orders: orders.map(mapOrder),
      summary: {
        orderCount: orders.length,
        itemCount: lines.reduce((total, line) => total + line.quantity, 0),
        serviceBookingCount,
        totalAmount:
          (orders.reduce((total, order) => total + order.totalAmount, 0) +
            serviceTotalAmount) /
          100,
      },
    };
  });

  const adminIds = await activeAdminRecipientIds();
  const notifications: CreateNotificationInput[] = [];
  const orderIds = checkout.orders.map((order) => order.id);
  const garageBookings = orderIds.length
    ? await db.garageBooking.findMany({
        where: { linkedOrderId: { in: orderIds } },
        select: {
          id: true,
          publicId: true,
          garageId: true,
          customerId: true,
          customerName: true,
          customerEmail: true,
          serviceName: true,
          advanceAmount: true,
          garage: { select: { email: true } },
        },
      })
    : [];

  const payment = await createStripeCheckoutPayment({
    payerUserId: buyerId,
    purpose: "direct_order",
    amount:
      checkout.rawOrders.reduce((total, order) => total + order.totalAmount, 0) +
      garageBookings.reduce((total, booking) => total + (booking.advanceAmount ?? 0), 0),
    currency: "AED",
    description: `AutoParts Pro checkout (${checkout.summary.itemCount} product${checkout.summary.itemCount === 1 ? "" : "s"})`,
    idempotencyKey:
      typeof input.idempotencyKey === "string" && input.idempotencyKey.trim()
        ? input.idempotencyKey.trim()
        : `direct-order:${buyerId}:${checkoutFingerprint({ lines, serviceBookings, addressId })}`,
    successUrl: paymentSuccessUrl,
    cancelUrl: paymentCancelUrl,
    entities: [
      ...checkout.rawOrders.map((order) => ({
        entityType: "order" as const,
        entityId: order.id,
        amount: order.totalAmount,
      })),
      ...garageBookings.map((booking) => ({
        entityType: "garage_booking" as const,
        entityId: booking.id,
        amount: booking.advanceAmount ?? 0,
      })),
    ].filter((entity) => entity.amount > 0),
    metadata: {
      orderIds: checkout.rawOrders.map((order) => order.id),
      garageBookingIds: garageBookings.map((booking) => booking.id),
    },
  });

  for (const order of checkout.orders) {
    notifications.push({
      recipientUserId: order.supplier.id,
      actorUserId: buyerId,
      type: "order.created",
      title: "New order pending payment",
      body: `Order ${order.publicId} was created and is waiting for customer payment.`,
      linkUrl: "/orders",
      entityType: "order",
      entityId: order.id,
    });
    notifications.push({
      recipientUserId: buyerId,
      type: "order.created",
      title: "Checkout started",
      body: `Complete payment for ${order.publicId}: ${orderItemsSummary(order.items)}.`,
      linkUrl: "/orders",
      entityType: "order",
      entityId: order.id,
    });

    for (const adminId of adminIds) {
      notifications.push({
        recipientAdminId: adminId,
        actorUserId: buyerId,
        type: "order.created",
        title: "Direct order pending payment",
        body: `Direct order ${order.publicId} was created and is waiting for payment.`,
        linkUrl: "/orders",
        entityType: "order",
        entityId: order.id,
      });
    }

    await Promise.all([
      order.supplier.email
        ? sendMailSafely({
            to: order.supplier.email,
            subject: `New order ${order.publicId} pending payment`,
            text: [
              `Order ${order.publicId} was created from a customer checkout and is waiting for payment.`,
              orderItemsText(order.items),
              `Order total: ${money(order.totalAmount, false)}`,
            ].join("\n"),
            html: [
              `<p>Order <strong>${escapeHtml(order.publicId)}</strong> was created from a customer checkout and is waiting for payment.</p>`,
              orderItemsHtml(order.items),
              `<p style="margin:16px 0 0;color:#ffffff"><strong>Order total:</strong> ${escapeHtml(money(order.totalAmount, false))}</p>`,
            ].join(""),
          })
        : undefined,
      order.buyer.email
        ? sendMailSafely({
            to: order.buyer.email,
            subject: `Finish payment for order ${order.publicId}`,
            text: [
              `Your order ${order.publicId} has been created. Finish payment to send it to the supplier.`,
              orderItemsText(order.items),
              `Order total: ${money(order.totalAmount, false)}`,
            ].join("\n"),
            html: [
              `<p>Your order <strong>${escapeHtml(order.publicId)}</strong> has been created. Finish payment to send it to the supplier.</p>`,
              orderItemsHtml(order.items),
              `<p style="margin:16px 0 0;color:#ffffff"><strong>Order total:</strong> ${escapeHtml(money(order.totalAmount, false))}</p>`,
            ].join(""),
          })
        : undefined,
    ]);
  }

  for (const booking of garageBookings) {
    notifications.push({
      recipientUserId: booking.garageId,
      actorUserId: buyerId,
      type: "booking.created",
      title: "New service booking",
      body: `${booking.customerName} booked ${booking.serviceName} from checkout.`,
      linkUrl: "/bookings",
      entityType: "garage_booking",
      entityId: booking.id,
    });
    if (booking.customerId) {
      notifications.push({
        recipientUserId: booking.customerId,
        type: "booking.created",
        title: "Service booking created",
        body: `${booking.serviceName} was added to your checkout.`,
        linkUrl: "/bookings",
        entityType: "garage_booking",
        entityId: booking.id,
      });
    }

    await Promise.all([
      booking.garage.email
        ? sendMailSafely({
            to: booking.garage.email,
            subject: `New checkout service booking ${booking.publicId}`,
            text: `${booking.customerName} booked ${booking.serviceName} from checkout. The customer will select a slot after part delivery.`,
          })
        : undefined,
      booking.customerEmail
        ? sendMailSafely({
            to: booking.customerEmail,
            subject: `Service booking ${booking.publicId} added to your order`,
            text: `${booking.serviceName} was added to your checkout. You can select the service slot after the linked parts are delivered.`,
          })
        : undefined,
    ]);
  }

  await createNotificationsSafely(notifications);
  return {
    orders: checkout.orders,
    summary: checkout.summary,
    payment: {
      id: payment.payment.id,
      publicId: payment.payment.publicId,
      status: payment.payment.status,
      checkoutUrl: payment.checkoutUrl,
      stripeConfigured: payment.stripeConfigured,
    },
  };
}
