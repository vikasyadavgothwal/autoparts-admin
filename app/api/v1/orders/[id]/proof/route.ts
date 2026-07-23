import { NextRequest, NextResponse } from "next/server";

import { getOptionalUserFromRequest } from "@/lib/parts-mapping/auth";
import { createSignedS3ObjectUrl } from "@/lib/storage/s3";
import { findOrderProofKeyForUser } from "@/services/order/order-proof-service";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  const auth = await getOptionalUserFromRequest(request);
  if (!auth) return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });
  const { id } = await context.params;
  const proofOfDeliveryKey = await findOrderProofKeyForUser({
    orderId: id,
    itemId: request.nextUrl.searchParams.get("itemId"),
    userId: auth.user.id,
  });
  if (!proofOfDeliveryKey) {
    return NextResponse.json({ ok: false, message: "Proof of delivery not found" }, { status: 404 });
  }
  return NextResponse.redirect(await createSignedS3ObjectUrl(proofOfDeliveryKey, 300));
}
