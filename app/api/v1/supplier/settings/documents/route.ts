import { Buffer } from "node:buffer";
import { NextRequest, NextResponse } from "next/server";

import { requireSupplierFromRequest } from "@/lib/auth/api-guards";
import { uploadSupplierDocument } from "@/services/supplier/supplier-settings-service";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const auth = await requireSupplierFromRequest(request);
  if (!auth.ok) return auth.response;

  const formData = await request.formData();
  const document = formData.get("document");
  const kind = String(formData.get("kind") ?? "");
  if (!(document instanceof File)) {
    return NextResponse.json(
      { ok: false, message: "Upload a document file" },
      { status: 400 },
    );
  }

  try {
    return NextResponse.json(
      {
        ok: true,
        ...(await uploadSupplierDocument(auth.user.id, {
          kind,
          contentType: document.type,
          body: Buffer.from(await document.arrayBuffer()),
        })),
      },
      { status: 201 },
    );
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message:
          error instanceof Error ? error.message : "Unable to upload document",
      },
      { status: 400 },
    );
  }
}
