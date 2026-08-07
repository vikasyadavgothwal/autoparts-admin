import { NextRequest, NextResponse } from "next/server";

import { getOptionalUserFromRequest } from "@/lib/auth/api-guards";
import { UserRole } from "@/lib/generated/prisma/client";
import { confirmOrderItemReceipt } from "@/services/orders/order-service";

type RouteContext = { params: Promise<{ id: string; itemId: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  const auth = await getOptionalUserFromRequest(request);
  if (!auth) {
    return NextResponse.json(
      { ok: false, message: "Unauthorized" },
      { status: 401 },
    );
  }
  if (
    auth.user.activeRole !== UserRole.User ||
    !auth.user.roles.includes(UserRole.User)
  ) {
    return NextResponse.json(
      { ok: false, message: "Only User accounts can confirm receipt" },
      { status: 403 },
    );
  }

  const { id, itemId } = await context.params;
  try {
    const order = await confirmOrderItemReceipt(auth.user.id, id, itemId);
    return NextResponse.json({ ok: true, order });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message:
          error instanceof Error ? error.message : "Unable to confirm receipt",
      },
      { status: 400 },
    );
  }
}
