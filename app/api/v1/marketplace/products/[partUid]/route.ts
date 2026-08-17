import { NextRequest, NextResponse } from "next/server"
import { getMarketplaceProduct } from "@/services/marketplace/marketplace-service"
export const dynamic = "force-dynamic"
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ partUid: string }> },
) {
  const { partUid } = await params
  const result = await getMarketplaceProduct(partUid, {
    city: request.nextUrl.searchParams.get("deliveryCity"),
    state: request.nextUrl.searchParams.get("deliveryState"),
    country: request.nextUrl.searchParams.get("deliveryCountry"),
  })
  return NextResponse.json(result, {
    status: result.ok ? 200 : 404,
  })
}
