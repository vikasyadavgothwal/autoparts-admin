import { NextRequest, NextResponse } from "next/server";

import { requireAdminFromRequest, readJsonBody } from "@/lib/parts-mapping/auth";
import {
  readGarageBookingAdvancePercentage,
  updateGarageBookingAdvancePercentage,
} from "@/actions/platform-settings/platform-settings";

export async function GET() {
  const auth = await requireAdminFromRequest();
  if (!auth.ok) return auth.response;
  return NextResponse.json({ ok: true, garageBookingAdvancePercentage: await readGarageBookingAdvancePercentage() });
}

export async function PATCH(request: NextRequest) {
  const auth = await requireAdminFromRequest();
  if (!auth.ok) return auth.response;
  const body = await readJsonBody<{ garageBookingAdvancePercentage?: unknown }>(request);
  if (!body.ok) return NextResponse.json({ ok: false, message: body.message }, { status: 400 });
  try {
    return NextResponse.json({
      ok: true,
      garageBookingAdvancePercentage: await updateGarageBookingAdvancePercentage(body.body.garageBookingAdvancePercentage),
    });
  } catch (error) {
    return NextResponse.json({ ok: false, message: error instanceof Error ? error.message : "Unable to save setting" }, { status: 400 });
  }
}
