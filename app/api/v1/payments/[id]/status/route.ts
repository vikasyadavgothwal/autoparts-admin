import { NextRequest, NextResponse } from "next/server";

import { getOptionalUserFromRequest } from "@/lib/auth/api-guards";
import { refreshStripePaymentStatus } from "@/services/payments/stripe-payment-service";

type RouteContext = { params: Promise<{ id: string }> };

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, context: RouteContext) {
  const auth = await getOptionalUserFromRequest(request);
  if (!auth) {
    return NextResponse.json(
      { ok: false, message: "Unauthorized" },
      { status: 401 },
    );
  }

  const { id } = await context.params;
  try {
    const payment = await refreshStripePaymentStatus(id);
    if (!payment) {
      return NextResponse.json(
        { ok: false, message: "Payment not found" },
        { status: 404 },
      );
    }
    if (
      payment.payerUserId &&
      payment.payerUserId !== auth.user.id &&
      payment.businessAccountId === null
    ) {
      return NextResponse.json(
        { ok: false, message: "Payment not found" },
        { status: 404 },
      );
    }
    return NextResponse.json({
      ok: true,
      payment: {
        id: payment.id,
        publicId: payment.publicId,
        purpose: payment.purpose,
        amount: payment.amount,
        currency: payment.currency,
        status: payment.status,
        paidAt: payment.paidAt,
        failedAt: payment.failedAt,
        failureCode: payment.failureCode,
        failureMessage: payment.failureMessage,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message:
          error instanceof Error ? error.message : "Unable to load payment",
      },
      { status: 400 },
    );
  }
}
