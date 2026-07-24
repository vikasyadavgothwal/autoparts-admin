import { NextRequest, NextResponse } from "next/server"

import { resetUserPasswordWithOtp } from "@/services/user-auth/password-reset-service"

type VerifyBody = {
  email?: unknown
  otp?: unknown
  password?: unknown
}

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  let body: VerifyBody
  try {
    body = (await request.json()) as VerifyBody
  } catch {
    return NextResponse.json(
      { ok: false, success: false, message: "Invalid JSON body" },
      { status: 400 },
    )
  }

  try {
    const result = await resetUserPasswordWithOtp(body)
    return NextResponse.json({ ...result, success: true })
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        success: false,
        message:
          error instanceof Error ? error.message : "Unable to reset password",
      },
      { status: 400 },
    )
  }
}
