import { Buffer } from "node:buffer";
import { NextRequest, NextResponse } from "next/server";

import { requireSupplierFromRequest } from "@/lib/parts-mapping/auth";
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
    return NextResponse.json(
      {
        ok: true,
        profile: await uploadSupplierAvatar(auth.user.id, {
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
