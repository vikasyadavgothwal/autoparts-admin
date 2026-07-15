import { NextRequest, NextResponse } from "next/server";

import { verifyUserEmail } from "@/services/user/user-settings-service";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token") ?? "";
  try {
    return NextResponse.json(await verifyUserEmail(token));
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
