import { db } from "@/lib/database/prisma"
import {
  OrderSource,
  OrderStatus,
  Prisma,
  SupplierPartMappingStatus,
  UserRole,
} from "@/lib/generated/prisma/client"

const normalizePaging = (page: number, pageSize: number) => ({
  page: Math.max(1, Number.isFinite(page) ? page : 1),
  pageSize: Math.min(50, Math.max(1, Number.isFinite(pageSize) ? pageSize : 10)),
})

const searchWhere = (search: string): Prisma.OrderWhereInput => {
  const query = search.trim()
  if (!query) return {}
  return {
    OR: [
      { publicId: { contains: query, mode: "insensitive" } },
      { buyer: { companyName: { contains: query, mode: "insensitive" } } },
      { buyer: { firstName: { contains: query, mode: "insensitive" } } },
      { buyer: { lastName: { contains: query, mode: "insensitive" } } },
      { supplier: { companyName: { contains: query, mode: "insensitive" } } },
      { supplier: { firstName: { contains: query, mode: "insensitive" } } },
      { supplier: { lastName: { contains: query, mode: "insensitive" } } },
      { items: { some: { partName: { contains: query, mode: "insensitive" } } } },
      { items: { some: { partNumber: { contains: query, mode: "insensitive" } } } },
      { rfq: { publicId: { contains: query, mode: "insensitive" } } },
    ],
  }
}

const orderInclude = {
  buyer: {
    select: {
      id: true,
      companyName: true,
      firstName: true,
      lastName: true,
      email: true,
      activeRole: true,
    },
  },
  supplier: {
    select: {
      id: true,
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
} satisfies Prisma.OrderInclude

const mapOrder = <T extends {
  totalAmount: number
  items: Array<{ unitPrice: number | null; lineTotal: number | null }>
}>(order: T) => ({
  ...order,
  totalAmount: order.totalAmount / 100,
  items: order.items.map((item) => ({
    ...item,
    unitPrice: item.unitPrice === null ? null : item.unitPrice / 100,
    lineTotal: item.lineTotal === null ? null : item.lineTotal / 100,
  })),
})

async function listOrders(where: Prisma.OrderWhereInput, page: number, pageSize: number) {
  const paging = normalizePaging(page, pageSize)
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
  ])
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
      byStatus: Object.fromEntries(statuses.map((item) => [item.status, item._count._all])),
    },
  }
}

export function listUserOrders(
  userId: string,
  activeRole: UserRole,
  page: number,
  pageSize: number,
  search: string,
) {
  const scope = activeRole === UserRole.Supplier
    ? { supplierId: userId }
    : { buyerId: userId }
  return listOrders({ AND: [scope, searchWhere(search)] }, page, pageSize)
}

export function listAllOrders(page: number, pageSize: number, search: string) {
  return listOrders(searchWhere(search), page, pageSize)
}

export async function createDirectOrder(
  buyerId: string,
  input: { supplierPartId?: unknown; quantity?: unknown },
) {
  const supplierPartId = typeof input.supplierPartId === "string" ? input.supplierPartId.trim() : ""
  const quantity = typeof input.quantity === "number"
    ? input.quantity
    : Number.parseInt(String(input.quantity), 10)
  if (!supplierPartId) throw new Error("Supplier part is required")
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 999) {
    throw new Error("Quantity must be between 1 and 999")
  }

  return db.$transaction(async (transaction) => {
    const supplierPart = await transaction.supplierPart.findFirst({
      where: {
        id: supplierPartId,
        mappingStatus: SupplierPartMappingStatus.mapped,
      },
      include: { part: true },
    })
    if (!supplierPart) throw new Error("This supplier part is not available for ordering")
    if (supplierPart.supplierId === buyerId) throw new Error("A supplier cannot order its own part")

    const reserved = await transaction.supplierPart.updateMany({
      where: { id: supplierPart.id, stock: { gte: quantity } },
      data: { stock: { decrement: quantity } },
    })
    if (reserved.count !== 1) throw new Error("Insufficient stock for this order")

    const totalAmount = supplierPart.price * quantity
    const order = await transaction.order.create({
      data: {
        source: OrderSource.direct,
        buyerId,
        supplierId: supplierPart.supplierId,
        totalAmount,
        status: OrderStatus.pending,
        items: {
          create: {
            supplierPartId: supplierPart.id,
            partName: supplierPart.part?.partName || supplierPart.originalPartName,
            partNumber: supplierPart.part?.partNumber || supplierPart.originalOemNumber || supplierPart.originalMpn,
            quantity,
            unitPrice: supplierPart.price,
            lineTotal: totalAmount,
          },
        },
      },
      include: orderInclude,
    })
    return mapOrder(order)
  })
}
