import { NextResponse } from "next/server"

import { requireAdminFromRequest } from "@/lib/auth/api-guards"
import { getBusinessAccount } from "@/services/business/business-platform-service"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdminFromRequest()
  if (!auth.ok) return auth.response

  const { id } = await params
  const account = await getBusinessAccount(id)
  if (!account) {
    return NextResponse.json(
      { ok: false, message: "Business account was not found" },
      { status: 404 },
    )
  }

  return NextResponse.json({ ok: true, account })
}
