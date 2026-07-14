import { NextRequest, NextResponse } from "next/server";

import {
  readJsonBody,
  requireSupplierFromRequest,
} from "@/lib/parts-mapping/auth";
import { requestSupplierEmailVerification } from "@/services/supplier/supplier-settings-service";

type EmailVerificationBody = {
  email?: unknown;
  verificationBaseUrl?: unknown;
};

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const auth = await requireSupplierFromRequest(request);
  if (!auth.ok) return auth.response;

  const parsed = await readJsonBody<EmailVerificationBody>(request);
  if (!parsed.ok) {
    return NextResponse.json(
      { ok: false, message: parsed.message },
      { status: 400 },
    );
  }

  try {
    const origin = new URL(request.url).origin;
    return NextResponse.json(
      await requestSupplierEmailVerification(
        auth.user.id,
        parsed.body.email,
        origin,
        typeof parsed.body.verificationBaseUrl === "string"
          ? parsed.body.verificationBaseUrl
          : null,
      ),
    );
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message:
          error instanceof Error
            ? error.message
            : "Unable to send verification link",
      },
      { status: 400 },
    );
  }
}
