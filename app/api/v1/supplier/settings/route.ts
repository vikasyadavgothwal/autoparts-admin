import { NextRequest, NextResponse } from "next/server";

import {
  readJsonBody,
  requireSupplierFromRequest,
} from "@/lib/parts-mapping/auth";
import {
  getSupplierProfile,
  updateSupplierProfile,
} from "@/services/supplier/supplier-settings-service";
import type { SupplierProfileInput } from "@/types/supplier/settings";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await requireSupplierFromRequest(request);
  if (!auth.ok) return auth.response;

  return NextResponse.json({
    ok: true,
    profile: await getSupplierProfile(auth.user.id),
  });
}

export async function PATCH(request: NextRequest) {
  const auth = await requireSupplierFromRequest(request);
  if (!auth.ok) return auth.response;

  const parsed = await readJsonBody<SupplierProfileInput>(request);
  if (!parsed.ok) {
    return NextResponse.json(
      { ok: false, message: parsed.message },
      { status: 400 },
    );
  }

  try {
    return NextResponse.json({
      ok: true,
      profile: await updateSupplierProfile(auth.user.id, parsed.body),
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message:
          error instanceof Error
            ? error.message
            : "Unable to update supplier settings",
      },
      { status: 400 },
    );
  }
}
