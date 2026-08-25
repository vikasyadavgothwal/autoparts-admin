import { NextRequest, NextResponse } from "next/server";

import { getOptionalUserFromRequest } from "@/lib/auth/api-guards";
import { BusinessAccountType, UserRole } from "@/lib/generated/prisma/client";
import { getS3ImageDisplayUrlFromKey } from "@/lib/storage/s3";
import { getBusinessAccountOwnerId } from "@/services/business/business-platform-service";
import { findOrderProofKeyForUser } from "@/services/order/order-proof-service";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  const auth = await getOptionalUserFromRequest(request);
  if (!auth) return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });
  const { id } = await context.params;
  const dataOwnerId = auth.user.activeRole === UserRole.Supplier
    ? await getBusinessAccountOwnerId(auth.user.id, BusinessAccountType.Supplier)
    : auth.user.activeRole === UserRole.Fleet
      ? await getBusinessAccountOwnerId(auth.user.id, BusinessAccountType.Fleet)
      : auth.user.id;
  const proofOfDeliveryKey = await findOrderProofKeyForUser({
    orderId: id,
    itemId: request.nextUrl.searchParams.get("itemId"),
    userId: dataOwnerId,
  });
  if (!proofOfDeliveryKey) {
    return NextResponse.json({ ok: false, message: "Proof of delivery not found" }, { status: 404 });
  }
  return NextResponse.redirect(getS3ImageDisplayUrlFromKey(proofOfDeliveryKey));
}
