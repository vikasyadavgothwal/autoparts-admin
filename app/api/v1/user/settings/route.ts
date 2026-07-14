import { NextRequest, NextResponse } from "next/server";

import {
  readJsonBody,
  requireCustomerUserFromRequest,
} from "@/lib/parts-mapping/auth";
import {
  getUserProfile,
  updateUserProfile,
} from "@/services/user/user-settings-service";
import type { UserProfileInput } from "@/types/user/settings";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await requireCustomerUserFromRequest(request);
  if (!auth.ok) return auth.response;

  return NextResponse.json({
    ok: true,
    profile: await getUserProfile(auth.user.id),
  });
}

export async function PATCH(request: NextRequest) {
  const auth = await requireCustomerUserFromRequest(request);
  if (!auth.ok) return auth.response;

  const parsed = await readJsonBody<UserProfileInput>(request);
  if (!parsed.ok) {
    return NextResponse.json(
      { ok: false, message: parsed.message },
      { status: 400 },
    );
  }

  try {
    return NextResponse.json({
      ok: true,
      profile: await updateUserProfile(auth.user.id, parsed.body),
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message:
          error instanceof Error ? error.message : "Unable to update settings",
      },
      { status: 400 },
    );
  }
}
