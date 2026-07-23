/**
 * @swagger
 * /api/vin-search:
 *   post:
 *     tags:
 *       - VIN Search
 *     summary: Search VIN / part information
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             oneOf:
 *               - type: object
 *                 required:
 *                   - vin
 *                 properties:
 *                   vin:
 *                     type: string
 *                     description: Vehicle Identification Number
 *                   partNumber:
 *                     type: string
 *                     description: Optional part number
 *               - type: object
 *                 required:
 *                   - partNumber
 *                 properties:
 *                   vin:
 *                     type: string
 *                     description: Optional VIN
 *                   partNumber:
 *                     type: string
 *                     description: Part number lookup when VIN is omitted
 *     responses:
 *       200:
 *         description: Search result from 17VIN API
 *       400:
 *         description: Invalid payload
 *       500:
 *         description: Internal failure or missing credentials
 */

import { NextRequest, NextResponse } from "next/server"
import {
  fetchVinSearchResult,
  getVinSearchApiBaseUrl,
  parseVinSearchBody,
  normalizeVinSearchResult,
} from "@/lib/vin-search"
export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export async function POST(request: NextRequest): Promise<NextResponse> {
  // 1) Parse and validate body in lib (server side).
  const parsedBody = await parseVinSearchBody(request)

  if (!parsedBody.ok) {
    return NextResponse.json(parsedBody.payload, { status: parsedBody.status })
  }
  const { vin, partNumber } = parsedBody.body

  const username = process.env.VIN_API_USER
  const password = process.env.VIN_API_PASS

  // 2) Credentials are server-only env vars and never sent to client.
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

    return NextResponse.json(normalized.data, {
      status: normalized.status,
    })
  } catch (error) {
    // 3) Handle unexpected server-level issues.
    console.error("vin-search API route failed", error)
    return NextResponse.json(
      { error: "Failed to reach 17VIN API" },
      { status: 500 },
    )
  }
}
