import { NextRequest, NextResponse } from "next/server"

import { searchPartsFromLocalDb } from "@/services/parts-mapping/parts-mapping-service"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const partNumber = request.nextUrl.searchParams.get("partNumber") ?? ""
  const userId = request.nextUrl.searchParams.get("userId")

  try {
    const result = await searchPartsFromLocalDb({ partNumber, userId })
    return NextResponse.json(result, { status: 200 })
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: error instanceof Error ? error.message : "Unable to search part",
      },
      { status: 400 },
    )
  }
}
