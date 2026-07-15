import { NextRequest, NextResponse } from "next/server"

import { deleteAdminBusinessQuery } from "@/actions/business-queries/business-queries"
import { requireAdminFromRequest } from "@/lib/parts-mapping/auth"

type RouteContext = { params: Promise<{ id: string }> }

export const dynamic = "force-dynamic"

export async function DELETE(_request: NextRequest, context: RouteContext) {
  const auth = await requireAdminFromRequest()
  if (!auth.ok) return auth.response

  try {
    const query = await deleteAdminBusinessQuery((await context.params).id)
    return NextResponse.json({ ok: true, query })
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message:
          error instanceof Error ? error.message : "Unable to delete query",
      },
      { status: 400 },
    )
  }
}
