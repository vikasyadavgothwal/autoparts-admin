import { db } from "@/lib/database/prisma";
import {
  OrderSource,
  OrderStatus,
  Prisma,
  SupplierApprovalStatus,
  SupplierPartMappingStatus,
  UserRole,
} from "@/lib/generated/prisma/client";
import {
  activeAdminRecipientIds,
  createNotificationsSafely,
  type CreateNotificationInput,
} from "@/services/notifications/notification-service";
import { getUserAddressForCheckout } from "@/services/user-addresses/user-address-service";

const normalizePaging = (page: number, pageSize: number) => ({
  page: Math.max(1, Number.isFinite(page) ? page : 1),
  pageSize: Math.min(
    50,
    Math.max(1, Number.isFinite(pageSize) ? pageSize : 10),
  ),
});

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
  items: { orderBy: { createdAt: "asc" as const } },
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
} satisfies Prisma.OrderInclude;

type DirectOrderLineInput = {
  supplierPartId?: unknown;
  quantity?: unknown;
};

type DirectOrderCheckoutInput = DirectOrderLineInput & {
  items?: unknown;
  addressId?: unknown;
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

const normalizeAddressId = (value: unknown) =>
  typeof value === "string" ? value.trim() : "";

const mapOrder = <
  T extends {
    totalAmount: number;
    items: Array<{ unitPrice: number | null; lineTotal: number | null }>;
  },
>(
  order: T,
) => ({
  ...order,
  totalAmount: order.totalAmount / 100,
  items: order.items.map((item) => ({
    ...item,
    unitPrice: item.unitPrice === null ? null : item.unitPrice / 100,
    lineTotal: item.lineTotal === null ? null : item.lineTotal / 100,
  })),
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
  const lines = normalizeDirectOrderLines(input);
  const addressId = normalizeAddressId(input.addressId);
  if (!addressId) throw new Error("Select a delivery address before checkout");
  const deliveryAddress = await getUserAddressForCheckout(buyerId, addressId);
  const supplierPartIds = lines.map((line) => line.supplierPartId);

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
      include: { part: true },
    });

    const supplierPartById = new Map(
      supplierParts.map((part) => [part.id, part]),
    );
    const groupedOrders = new Map<
      string,
      {
        supplierId: string;
        totalAmount: number;
        items: Prisma.OrderItemCreateWithoutOrderInput[];
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
          `Insufficient stock for ${supplierPart.part?.partName || supplierPart.originalPartName}`,
        );
      }

      const lineTotal = supplierPart.price * line.quantity;
      const existingGroup = groupedOrders.get(supplierPart.supplierId) ?? {
        supplierId: supplierPart.supplierId,
        totalAmount: 0,
        items: [],
      };
      existingGroup.totalAmount += lineTotal;
      existingGroup.items.push({
        supplierPart: { connect: { id: supplierPart.id } },
        partName: supplierPart.part?.partName || supplierPart.originalPartName,
        partNumber:
          supplierPart.part?.partNumber ||
          supplierPart.originalOemNumber ||
          supplierPart.originalMpn,
        quantity: line.quantity,
        unitPrice: supplierPart.price,
        lineTotal,
      });
      groupedOrders.set(supplierPart.supplierId, existingGroup);
    }

    const orders = [];
    for (const group of groupedOrders.values()) {
      orders.push(
        await transaction.order.create({
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
            deliveryPostalCode: deliveryAddress.postalCode,
            deliveryCountry: deliveryAddress.country,
            totalAmount: group.totalAmount,
            status: OrderStatus.confirmed,
            items: { create: group.items },
          },
          include: orderInclude,
        }),
      );
    }

    return {
      orders: orders.map(mapOrder),
      summary: {
        orderCount: orders.length,
        itemCount: lines.reduce((total, line) => total + line.quantity, 0),
        totalAmount:
          orders.reduce((total, order) => total + order.totalAmount, 0) / 100,
      },
    };
  });

  const adminIds = await activeAdminRecipientIds();
  const notifications: CreateNotificationInput[] = [];

  for (const order of checkout.orders) {
    notifications.push({
      recipientUserId: order.supplier.id,
      actorUserId: buyerId,
      type: "order.created",
      title: "New order received",
      body: `Order ${order.publicId} was created from a customer checkout.`,
      linkUrl: "/orders",
      entityType: "order",
      entityId: order.id,
    });
    notifications.push({
      recipientUserId: buyerId,
      type: "order.created",
      title: "Order confirmed",
      body: `Order ${order.publicId} has been created and sent to the supplier.`,
      linkUrl: "/orders",
      entityType: "order",
      entityId: order.id,
    });

    for (const adminId of adminIds) {
      notifications.push({
        recipientAdminId: adminId,
        actorUserId: buyerId,
        type: "order.created",
        title: "New direct order",
        body: `Direct order ${order.publicId} was created.`,
        linkUrl: "/orders",
        entityType: "order",
        entityId: order.id,
      });
    }
  }

  await createNotificationsSafely(notifications);
  return checkout;
}
