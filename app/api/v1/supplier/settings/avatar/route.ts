import { Buffer } from "node:buffer";
import { NextRequest, NextResponse } from "next/server";

import { requireSupplierFromRequest } from "@/lib/auth/api-guards";
import { BusinessAccountType } from "@/lib/generated/prisma/client";
import { getBusinessAccountOwnerId } from "@/services/business/business-platform-service";
import { uploadSupplierAvatar } from "@/services/supplier/supplier-settings-service";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const auth = await requireSupplierFromRequest(request);
  if (!auth.ok) return auth.response;
  const formData = await request.formData();
  const avatar = formData.get("avatar");
  if (!(avatar instanceof File)) {
    return NextResponse.json(
      { ok: false, message: "Upload a supplier image" },
      { status: 400 },
    );
  }
  try {
    const supplierId = await getBusinessAccountOwnerId(auth.user.id, BusinessAccountType.Supplier);
    if (supplierId !== auth.user.id) {
      return NextResponse.json(
        { ok: false, message: "Only the supplier owner can update workspace settings" },
        { status: 403 },
      );
    }
    return NextResponse.json(
      {
        ok: true,
        profile: await uploadSupplierAvatar(supplierId, {
          contentType: avatar.type,
          body: Buffer.from(await avatar.arrayBuffer()),
        }),
      },
      { status: 201 },
    );
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message:
          error instanceof Error ? error.message : "Unable to upload image",
      },
      { status: 400 },
    );
  }
}
