import { NextRequest, NextResponse } from "next/server"

import { searchMarketplaceProducts } from "@/services/marketplace/marketplace-service"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl

  const includeRankingMetadata =
    searchParams.get("debugScores") === "1" &&
    process.env.MARKETPLACE_RANKING_DEBUG === "1"

  try {
    const result = await searchMarketplaceProducts({
      partNumber: searchParams.get("partNumber"),
      vin: searchParams.get("vin"),
      modelId: searchParams.get("modelId"),
      year: searchParams.get("year"),
      make: searchParams.get("make"),
      model: searchParams.get("model"),
      q: searchParams.get("q"),
      deliveryCity: searchParams.get("deliveryCity"),
      deliveryState: searchParams.get("deliveryState"),
      deliveryCountry: searchParams.get("deliveryCountry"),
      limit: Number.parseInt(searchParams.get("limit") ?? "", 10) || null,
      includeRankingMetadata,
    })

    return NextResponse.json(result, { status: 200 })
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message:
          error instanceof Error
            ? error.message
            : "Unable to search marketplace products",
      },
      { status: 400 },
    )
  }
}
