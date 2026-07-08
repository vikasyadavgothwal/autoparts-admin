import { NextResponse } from "next/server"

import { getMarketplaceProduct } from "@/services/marketplace/marketplace-service"

export const dynamic = "force-dynamic"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ partUid: string }> },
) {
  const { partUid } = await params
  const result = await getMarketplaceProduct(partUid)

  return NextResponse.json(result, {
    status: result.ok ? 200 : 404,
  })
}
