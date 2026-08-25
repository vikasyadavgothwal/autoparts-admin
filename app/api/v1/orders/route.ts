import { NextRequest, NextResponse } from "next/server";

import {
  getOptionalUserFromRequest,
  readJsonBody,
} from "@/lib/auth/api-guards";
import { BusinessAccountType, OrderStatus, UserRole } from "@/lib/generated/prisma/client";
import {
  createDirectOrders,
  listUserOrders,
} from "@/services/orders/order-service";
import { assertBusinessMenuAccess, getBusinessAccountOwnerId } from "@/services/business/business-platform-service";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await getOptionalUserFromRequest(request);
  if (!auth)
    return NextResponse.json(
      { ok: false, message: "Unauthorized" },
      { status: 401 },
    );
  const page = Number.parseInt(
    request.nextUrl.searchParams.get("page") ?? "1",
    10,
  );
  const pageSize = Number.parseInt(
    request.nextUrl.searchParams.get("pageSize") ?? "10",
    10,
  );
  const search = request.nextUrl.searchParams.get("search") ?? "";
  const statusParam = request.nextUrl.searchParams.get("status") ?? "";
  const status = Object.values(OrderStatus).includes(statusParam as OrderStatus)
    ? (statusParam as OrderStatus)
    : null;
  if (auth.user.activeRole === UserRole.Supplier) {
    try {
      await assertBusinessMenuAccess({ userId: auth.user.id, accountType: BusinessAccountType.Supplier, menuKey: "orders" });
    } catch (error) {
      return NextResponse.json({ ok: false, message: error instanceof Error ? error.message : "You do not have permission to view orders" }, { status: 403 });
    }
  }
  if (auth.user.activeRole === UserRole.Fleet) {
    try {
      await assertBusinessMenuAccess({ userId: auth.user.id, accountType: BusinessAccountType.Fleet, menuKey: "orders" });
    } catch (error) {
      return NextResponse.json({ ok: false, message: error instanceof Error ? error.message : "You do not have permission to view orders" }, { status: 403 });
    }
  }
  const dataOwnerId = auth.user.activeRole === UserRole.Supplier
    ? await getBusinessAccountOwnerId(auth.user.id, BusinessAccountType.Supplier)
    : auth.user.activeRole === UserRole.Fleet
      ? await getBusinessAccountOwnerId(auth.user.id, BusinessAccountType.Fleet)
      : auth.user.id;
  return NextResponse.json({
    ok: true,
    ...(await listUserOrders(
      dataOwnerId,
      auth.user.activeRole,
      page,
      pageSize,
      search,
      status,
    )),
  });
}

export async function POST(request: NextRequest) {
  const auth = await getOptionalUserFromRequest(request);
  if (!auth)
    return NextResponse.json(
      { ok: false, message: "Unauthorized" },
      { status: 401 },
    );
  if (
    auth.user.activeRole !== UserRole.User ||
    !auth.user.roles.includes(UserRole.User)
  ) {
    return NextResponse.json(
      { ok: false, message: "Only User accounts can place direct orders" },
      { status: 403 },
    );
  }
  const body = await readJsonBody<{
    supplierPartId?: unknown;
    quantity?: unknown;
    items?: unknown;
    services?: unknown;
    addressId?: unknown;
    paymentSuccessUrl?: unknown;
    paymentCancelUrl?: unknown;
  }>(request);
  if (!body.ok)
    return NextResponse.json(
      { ok: false, message: body.message },
      { status: 400 },
    );
  try {
    const requestOrigin = request.headers.get("origin") ?? "";
    const fallbackSuccessUrl = requestOrigin
      ? `${requestOrigin}/cart?payment=success&session_id={CHECKOUT_SESSION_ID}`
      : undefined;
    const fallbackCancelUrl = requestOrigin
      ? `${requestOrigin}/cart?payment=cancelled`
      : undefined;
    const checkout = await createDirectOrders(auth.user.id, {
      ...body.body,
      idempotencyKey: request.headers.get("idempotency-key") ?? undefined,
      paymentSuccessUrl: body.body.paymentSuccessUrl ?? fallbackSuccessUrl,
      paymentCancelUrl: body.body.paymentCancelUrl ?? fallbackCancelUrl,
    });
    return NextResponse.json(
      {
        ok: true,
        ...checkout,
        order: checkout.orders[0] ?? null,
      },
      { status: 201 },
    );
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message:
          error instanceof Error ? error.message : "Unable to create order",
      },
      { status: 400 },
    );
  }
}
