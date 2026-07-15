import { NextRequest, NextResponse } from "next/server"

import { readJsonBody, requireGarageFromRequest } from "@/lib/parts-mapping/auth"
import { updateGarageServiceReviewReply } from "@/services/garage/garage-review-service"
import type { GarageReviewReplyInput } from "@/types/garage/reviews"

type RouteContext = { params: Promise<{ id: string }> }

export const dynamic = "force-dynamic"

export async function PATCH(request: NextRequest, context: RouteContext) {
  const auth = await requireGarageFromRequest(request)
  if (!auth.ok) return auth.response

  const parsed = await readJsonBody<GarageReviewReplyInput>(request)
  if (!parsed.ok) {
    return NextResponse.json(
      { ok: false, message: parsed.message },
      { status: 400 },
    )
  }

  try {
    const review = await updateGarageServiceReviewReply(
      auth.user.id,
      (await context.params).id,
      parsed.body,
    )
    return NextResponse.json({ ok: true, review })
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message:
          error instanceof Error ? error.message : "Unable to update reply",
      },
      { status: 400 },
    )
  }
}
