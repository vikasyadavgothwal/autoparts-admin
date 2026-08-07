import { NextRequest } from "next/server";

import {
  apiError,
  apiErrorMessage,
  readJsonBody,
  withSupplierApiRoute,
} from "@/lib/auth/api-guards";
import { requestSupplierEmailVerification } from "@/services/supplier/supplier-settings-service";

type EmailVerificationBody = {
  email?: unknown;
  verificationBaseUrl?: unknown;
};

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  return withSupplierApiRoute(request, async (user) => {
    const parsed = await readJsonBody<EmailVerificationBody>(request);
    if (!parsed.ok) return apiError(parsed.message);

    try {
      const origin = new URL(request.url).origin;
      return Response.json(
        await requestSupplierEmailVerification(
          user.id,
          parsed.body.email,
          origin,
          typeof parsed.body.verificationBaseUrl === "string"
            ? parsed.body.verificationBaseUrl
            : null,
        ),
      );
    } catch (error) {
      return apiError(apiErrorMessage(error, "Unable to send verification link"));
    }
  });
}
