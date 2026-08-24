import { NextRequest, NextResponse } from "next/server"

import { fetchPublicAssetByKey } from "@/services/public-assets/public-asset-service"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  try {
    const key = request.nextUrl.searchParams.get("key")?.trim() ?? ""
    const asset = await fetchPublicAssetByKey(key)

    if (!asset.ok) {
      return NextResponse.json(
        { ok: false, message: asset.message },
        { status: asset.status },
      )
    }

    const headers = new Headers({
      "content-type": asset.contentType,
      "cache-control": asset.cacheControl,
    })

    if (asset.contentLength) {
      headers.set("content-length", asset.contentLength)
    }

    return new Response(asset.body, { status: 200, headers })
  } catch {
    return NextResponse.json(
      { ok: false, message: "Unable to load asset." },
      { status: 500 },
    )
  }
}
