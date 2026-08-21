import { NextRequest, NextResponse } from "next/server";

import { processStripeWebhook } from "@/services/payments/stripe-payment-service";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  try {
    await processStripeWebhook(rawBody, request.headers.get("stripe-signature"));
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message:
          error instanceof Error ? error.message : "Unable to process webhook",
      },
      { status: 400 },
    );
  }
}
