import { NextRequest, NextResponse } from "next/server";

import { verifySupplierEmail } from "@/services/supplier/supplier-settings-service";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token") ?? "";
  try {
    return NextResponse.json(await verifySupplierEmail(token));
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message:
          error instanceof Error ? error.message : "Unable to verify email",
      },
      { status: 400 },
    );
  }
}
