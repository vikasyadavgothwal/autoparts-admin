import { NextRequest, NextResponse } from "next/server";

import {
  readJsonBody,
  requireCustomerUserFromRequest,
} from "@/lib/parts-mapping/auth";
import { verifyUserMobileWithFirebase } from "@/services/user/user-settings-service";

type VerifyOtpBody = {
  firebaseIdToken?: unknown;
};

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const auth = await requireCustomerUserFromRequest(request);
  if (!auth.ok) return auth.response;

  const parsed = await readJsonBody<VerifyOtpBody>(request);
  if (!parsed.ok) {
    return NextResponse.json(
      { ok: false, message: parsed.message },
      { status: 400 },
    );
  }

  try {
    const firebaseIdToken =
      typeof parsed.body.firebaseIdToken === "string"
        ? parsed.body.firebaseIdToken
        : "";
    if (!firebaseIdToken) {
      return NextResponse.json(
        { ok: false, message: "Firebase ID token is required" },
        { status: 400 },
      );
    }

    return NextResponse.json({
      ok: true,
      profile: await verifyUserMobileWithFirebase(
        auth.user.id,
        firebaseIdToken,
      ),
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message:
          error instanceof Error ? error.message : "Unable to verify OTP",
      },
      { status: 400 },
    );
  }
}
