import { NextRequest, NextResponse } from "next/server"

import {
  createPublicBusinessQuery,
  getBusinessQueryIpHash,
} from "@/actions/business-queries/business-queries"
import type { BusinessQueryInput } from "@/types/business-queries/business-queries"

export const dynamic = "force-dynamic"

const clientIp = (request: NextRequest) =>
  request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
  request.headers.get("x-real-ip") ||
  null

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as BusinessQueryInput
    const query = await createPublicBusinessQuery({
      ...body,
      userAgent: request.headers.get("user-agent"),
      ipHash: getBusinessQueryIpHash(clientIp(request)),
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
