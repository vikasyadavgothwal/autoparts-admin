import { NextRequest, NextResponse } from "next/server";

import { db } from "@/lib/database/prisma";
import { getOptionalUserFromRequest } from "@/lib/parts-mapping/auth";
import { createSignedS3ObjectUrl } from "@/lib/storage/s3";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  const auth = await getOptionalUserFromRequest(request);
  if (!auth) return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });
  const { id } = await context.params;
  const order = await db.order.findFirst({
    where: {
      OR: [{ id }, { publicId: id }],
      AND: [{ OR: [{ buyerId: auth.user.id }, { supplierId: auth.user.id }] }],
    },
    select: { proofOfDeliveryKey: true },
  });
  if (!order?.proofOfDeliveryKey) {
    return NextResponse.json({ ok: false, message: "Proof of delivery not found" }, { status: 404 });
  }
  return NextResponse.redirect(await createSignedS3ObjectUrl(order.proofOfDeliveryKey, 300));
}
