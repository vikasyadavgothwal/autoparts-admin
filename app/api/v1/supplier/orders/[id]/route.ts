import crypto from "node:crypto";
import { Buffer } from "node:buffer";
import { NextRequest, NextResponse } from "next/server";

import { requireSupplierFromRequest } from "@/lib/auth/api-guards";
import { uploadObjectToS3 } from "@/lib/storage/s3";
import { BusinessAccountType } from "@/lib/generated/prisma/client";
import { assertBusinessAction, getBusinessAccountOwnerId } from "@/services/business/business-platform-service";
import {
  confirmSupplierOrder,
  submitOrderProofOfDelivery,
} from "@/services/orders/order-service";

type RouteContext = { params: Promise<{ id: string }> };
const MAX_PROOF_SIZE = 5 * 1024 * 1024;
const MAX_PROOF_RECIPIENT_NAME_LENGTH = 80;
const MAX_PROOF_NOTE_LENGTH = 500;
const PROOF_EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export async function PATCH(request: NextRequest, context: RouteContext) {
  const auth = await requireSupplierFromRequest(request);
  if (!auth.ok) return auth.response;
  const supplierId = await getBusinessAccountOwnerId(auth.user.id, BusinessAccountType.Supplier);
  const { id } = await context.params;
  try {
    await assertBusinessAction({
      userId: auth.user.id,
      accountType: BusinessAccountType.Supplier,
      action: "orders.manage",
    });
    return NextResponse.json({
      ok: true,
      order: await confirmSupplierOrder(supplierId, id),
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
  const supplierId = await getBusinessAccountOwnerId(auth.user.id, BusinessAccountType.Supplier);
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
    await assertBusinessAction({
      userId: auth.user.id,
      accountType: BusinessAccountType.Supplier,
      action: "orders.manage",
    });
    const itemIds = typeof rawItemIds === "string"
      ? JSON.parse(rawItemIds)
      : [];
    if (!Array.isArray(itemIds) || itemIds.some((itemId) => typeof itemId !== "string")) {
      return NextResponse.json(
        { ok: false, message: "Select valid order items for this delivery batch" },
        { status: 400 },
      );
    }
    const recipientName = String(formData.get("recipientName") ?? "").trim().replace(/\s+/g, " ");
    const note = String(formData.get("note") ?? "").trim().replace(/\s+/g, " ");
    if (recipientName.length > MAX_PROOF_RECIPIENT_NAME_LENGTH) {
      return NextResponse.json(
        { ok: false, message: `Recipient name cannot exceed ${MAX_PROOF_RECIPIENT_NAME_LENGTH} characters` },
        { status: 400 },
      );
    }
    if (note.length > MAX_PROOF_NOTE_LENGTH) {
      return NextResponse.json(
        { ok: false, message: `Delivery note cannot exceed ${MAX_PROOF_NOTE_LENGTH} characters` },
        { status: 400 },
      );
    }
    const extension = PROOF_EXTENSIONS[proof.type];
    const uploaded = await uploadObjectToS3({
      key: `order-delivery-proofs/${supplierId}/${id}/${Date.now()}-${crypto.randomUUID()}.${extension}`,
      body: Buffer.from(await proof.arrayBuffer()),
      contentType: proof.type,
      cacheControl: "private, no-store",
    });
    return NextResponse.json({
      ok: true,
      order: await submitOrderProofOfDelivery(supplierId, id, {
        itemIds,
        proofUrl: uploaded.objectUrl,
        proofKey: uploaded.key,
        recipientName,
        note,
      }),
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : "Unable to submit proof" },
      { status: 400 },
    );
  }
}
