import { NextRequest, NextResponse } from "next/server"

import {
  createPublicBusinessQuery,
  getBusinessQueryIpHash,
} from "@/actions/business-queries/business-queries"
import {
  consumeUserAuthRateLimit,
  getClientIp,
} from "@/lib/user-auth/security"
import type { BusinessQueryInput } from "@/types/business-queries/business-queries"

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request)
    const rateLimit = await consumeUserAuthRateLimit(
      `business-query:${ip ?? "unknown"}`,
      5,
      15 * 60 * 1_000,
    )
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { ok: false, message: "Too many query submissions" },
        {
          status: 429,
          headers: { "Retry-After": String(rateLimit.retryAfterSeconds) },
        },
      )
    }

    const body = (await request.json()) as BusinessQueryInput
    const query = await createPublicBusinessQuery({
      ...body,
      userAgent: request.headers.get("user-agent"),
      ipHash: getBusinessQueryIpHash(ip),
    })

    return NextResponse.json(
      {
        ok: true,
        message: "Query submitted successfully",
        query: {
          id: query.publicId,
          status: query.status,
        },
      },
      { status: 201 },
    )
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to submit query"
    const status = message.startsWith("Unable") ? 500 : 400

    return NextResponse.json({ ok: false, message }, { status })
  }
}
