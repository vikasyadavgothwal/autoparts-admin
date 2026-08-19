import { NextRequest, NextResponse } from "next/server";

import { requireAdminFromRequest, readJsonBody } from "@/lib/auth/api-guards";
import {
  readAdminSupportNotificationEmails,
  readGarageBookingAdvanceSetting,
  readMainWebsiteSiteSettings,
  updateAdminSupportNotificationEmails,
  updateGarageBookingAdvanceSetting,
  updateMainWebsiteSiteSettings,
} from "@/actions/platform-settings/platform-settings";

export async function GET() {
  const auth = await requireAdminFromRequest();
  if (!auth.ok) return auth.response;
  return NextResponse.json({
    ok: true,
    garageBookingAdvance: await readGarageBookingAdvanceSetting(),
    adminSupportNotificationEmails: await readAdminSupportNotificationEmails(),
    siteSettings: await readMainWebsiteSiteSettings(),
  });
}

export async function PATCH(request: NextRequest) {
  const auth = await requireAdminFromRequest();
  if (!auth.ok) return auth.response;
  const body = await readJsonBody<{
    garageBookingAdvance?: { mode?: unknown; value?: unknown };
    garageBookingAdvancePercentage?: unknown;
    adminSupportNotificationEmails?: unknown;
    siteSettings?: unknown;
  }>(request);
  if (!body.ok) return NextResponse.json({ ok: false, message: body.message }, { status: 400 });
  try {
    const input = body.body.garageBookingAdvance ?? {
      mode: "percentage",
      value: body.body.garageBookingAdvancePercentage,
    };
    const response: {
      ok: true;
      garageBookingAdvance?: Awaited<ReturnType<typeof updateGarageBookingAdvanceSetting>>;
      adminSupportNotificationEmails?: string[];
      siteSettings?: Awaited<ReturnType<typeof updateMainWebsiteSiteSettings>>;
    } = { ok: true };
    if (
      body.body.garageBookingAdvance !== undefined ||
      body.body.garageBookingAdvancePercentage !== undefined
    ) {
      response.garageBookingAdvance = await updateGarageBookingAdvanceSetting(input);
    }
    if (body.body.adminSupportNotificationEmails !== undefined) {
      response.adminSupportNotificationEmails =
        await updateAdminSupportNotificationEmails(body.body.adminSupportNotificationEmails);
    }
    if (body.body.siteSettings !== undefined) {
      response.siteSettings = await updateMainWebsiteSiteSettings(body.body.siteSettings);
    }
    return NextResponse.json(response);
  } catch (error) {
    return NextResponse.json({ ok: false, message: error instanceof Error ? error.message : "Unable to save setting" }, { status: 400 });
  }
}
