import { logError } from "@/lib/logger"
/**
 * @swagger
 * /api/v1/vin-search:
 *   post:
 *     tags:
 *       - VIN Search
 *     summary: Search VIN / part information
 */

import { NextRequest, NextResponse } from "next/server"

import {
  fetchVinSearchResult,
  getVinSearchApiBaseUrl,
  normalizeVinSearchResult,
  parseVinSearchBody,
} from "@/lib/vin-search"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(request: NextRequest): Promise<NextResponse> {
  const parsedBody = await parseVinSearchBody(request)

  if (!parsedBody.ok) {
    return NextResponse.json(parsedBody.payload, { status: parsedBody.status })
  }

  const { vin, partNumber } = parsedBody.body
  const username = process.env.VIN_API_USER
  const password = process.env.VIN_API_PASS

  if (!username || !password) {
    return NextResponse.json(
      { error: "17VIN API credentials are not configured on the server" },
      { status: 500 },
    )
  }

  try {
    const vinSearchResult = await fetchVinSearchResult(
      vin,
      partNumber,
      { username, password },
      getVinSearchApiBaseUrl(),
    )
    if (!vinSearchResult.ok) {
      return NextResponse.json(vinSearchResult.data, {
        status: vinSearchResult.status,
      })
    }

    const normalized = normalizeVinSearchResult(vinSearchResult.data)
    if (!normalized.ok) {
      return NextResponse.json({ error: normalized.error }, {
        status: normalized.status,
      })
    }

    return NextResponse.json(normalized.data, { status: normalized.status })
  } catch (error) {
    logError("vin-search API route failed", error)
    return NextResponse.json(
      { error: "Failed to reach 17VIN API" },
      { status: 500 },
    )
  }
}
