import { NextRequest, NextResponse } from "next/server"

import { requestUserPasswordResetLink } from "@/services/user-auth/password-reset-service"

type RequestBody = {
  email?: unknown
}

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  let body: RequestBody
  try {
    body = (await request.json()) as RequestBody
  } catch {
    return NextResponse.json(
      { ok: false, success: false, message: "Invalid JSON body" },
      { status: 400 },
    )
  }

  try {
    const result = await requestUserPasswordResetLink(
      typeof body.email === "string" ? body.email : "",
      request.headers.get("origin"),
    )
    return NextResponse.json({ ...result, success: true })
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        success: false,
        message:
          error instanceof Error ? error.message : "Unable to send reset link",
      },
      { status: 400 },
    )
  }
}
