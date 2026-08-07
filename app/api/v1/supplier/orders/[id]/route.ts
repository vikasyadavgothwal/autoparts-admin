import crypto from "node:crypto";
import { Buffer } from "node:buffer";
import { NextRequest, NextResponse } from "next/server";

import { requireSupplierFromRequest } from "@/lib/auth/api-guards";
import { uploadObjectToS3 } from "@/lib/storage/s3";
import {
  confirmSupplierOrder,
  submitOrderProofOfDelivery,
} from "@/services/orders/order-service";

type RouteContext = { params: Promise<{ id: string }> };
const MAX_PROOF_SIZE = 5 * 1024 * 1024;
const PROOF_EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export async function PATCH(request: NextRequest, context: RouteContext) {
  const auth = await requireSupplierFromRequest(request);
  if (!auth.ok) return auth.response;
  const { id } = await context.params;
  try {
    return NextResponse.json({
      ok: true,
      order: await confirmSupplierOrder(auth.user.id, id),
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : "Unable to confirm order" },
      { status: 400 },
    );
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  const auth = await requireSupplierFromRequest(request);
  if (!auth.ok) return auth.response;
  const { id } = await context.params;
  const formData = await request.formData();
  const proof = formData.get("proof");
  const rawItemIds = formData.get("itemIds");
  if (!(proof instanceof File) || !PROOF_EXTENSIONS[proof.type] || proof.size > MAX_PROOF_SIZE) {
    return NextResponse.json(
      { ok: false, message: "Proof must be a JPG, PNG, or WebP image no larger than 5 MB" },
      { status: 400 },
    );
  }
  try {
    const itemIds = typeof rawItemIds === "string"
      ? JSON.parse(rawItemIds)
      : [];
    if (!Array.isArray(itemIds) || itemIds.some((itemId) => typeof itemId !== "string")) {
      return NextResponse.json(
        { ok: false, message: "Select valid order items for this delivery batch" },
        { status: 400 },
      );
    }
    const extension = PROOF_EXTENSIONS[proof.type];
    const uploaded = await uploadObjectToS3({
      key: `order-delivery-proofs/${auth.user.id}/${id}/${Date.now()}-${crypto.randomUUID()}.${extension}`,
      body: Buffer.from(await proof.arrayBuffer()),
      contentType: proof.type,
      cacheControl: "private, no-store",
    });
    return NextResponse.json({
      ok: true,
      order: await submitOrderProofOfDelivery(auth.user.id, id, {
        itemIds,
        proofUrl: uploaded.objectUrl,
        proofKey: uploaded.key,
        recipientName: String(formData.get("recipientName") ?? ""),
        note: String(formData.get("note") ?? ""),
      }),
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : "Unable to submit proof" },
      { status: 400 },
    );
  }
}
