import { NextRequest, NextResponse } from "next/server";

import { requireAdminFromRequest, readJsonBody } from "@/lib/auth/api-guards";
import {
  readGarageBookingAdvanceSetting,
  updateGarageBookingAdvanceSetting,
} from "@/actions/platform-settings/platform-settings";

export async function GET() {
  const auth = await requireAdminFromRequest();
  if (!auth.ok) return auth.response;
  return NextResponse.json({
    ok: true,
    garageBookingAdvance: await readGarageBookingAdvanceSetting(),
  });
}

export async function PATCH(request: NextRequest) {
  const auth = await requireAdminFromRequest();
  if (!auth.ok) return auth.response;
  const body = await readJsonBody<{
    garageBookingAdvance?: { mode?: unknown; value?: unknown };
    garageBookingAdvancePercentage?: unknown;
  }>(request);
  if (!body.ok) return NextResponse.json({ ok: false, message: body.message }, { status: 400 });
  try {
    const input = body.body.garageBookingAdvance ?? {
      mode: "percentage",
      value: body.body.garageBookingAdvancePercentage,
    };
    return NextResponse.json({
      ok: true,
      garageBookingAdvance: await updateGarageBookingAdvanceSetting(input),
    });
  } catch (error) {
    return NextResponse.json({ ok: false, message: error instanceof Error ? error.message : "Unable to save setting" }, { status: 400 });
  }
}
