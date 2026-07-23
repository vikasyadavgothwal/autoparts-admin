import { NextRequest, NextResponse } from "next/server"

import { requireUserAuth } from "@/actions/user-auth/user-auth"
import { UserRole } from "@/lib/generated/prisma/client"
import { readJsonBody } from "@/lib/parts-mapping/auth"
import { USER_AUTH } from "@/lib/user-auth/config"
import { upsertUserSupplierProductReview } from "@/services/supplier-product-reviews/supplier-product-review-service"
import type { SupplierProductReviewInput } from "@/types/supplier-product-reviews/reviews"

export const dynamic = "force-dynamic"

async function handleUpsert(request: NextRequest) {
  const accessToken =
    request.cookies.get(USER_AUTH.accessCookieName)?.value ?? null
  const auth = await requireUserAuth(accessToken)

  if (!auth) {
    return NextResponse.json(
      { ok: false, message: "Unauthorized" },
      { status: 401 },
    )
  }

  if (!auth.user.roles.includes(UserRole.User)) {
    return NextResponse.json(
      { ok: false, message: "User role is required" },
      { status: 403 },
    )
  }

  const parsed = await readJsonBody<SupplierProductReviewInput>(request)
  if (!parsed.ok) {
    return NextResponse.json(
      { ok: false, message: parsed.message },
      { status: 400 },
    )
  }

  try {
    const review = await upsertUserSupplierProductReview(
      auth.user.id,
      parsed.body,
    )
    return NextResponse.json({ ok: true, review })
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message:
          error instanceof Error ? error.message : "Unable to save review",
      },
      { status: 400 },
    )
  }
}

export async function POST(request: NextRequest) {
  return handleUpsert(request)
}

export async function PATCH(request: NextRequest) {
  return handleUpsert(request)
}
