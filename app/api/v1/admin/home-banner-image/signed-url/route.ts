import { NextRequest, NextResponse } from "next/server"
import { getHomeBannerImageSignedUrl } from "@/actions/admin-dashboard/public-pages/home-banner-image"
import type { HomeBannerImageSignedUrlApiResponse } from "@/types/admin-dashboard/public-pages/home-banner-image"

export const dynamic = "force-dynamic"

const toErrorResponse = (
  error: string,
): HomeBannerImageSignedUrlApiResponse => ({
  ok: false,
  error,
})

const getStatusCode = (error: string): number => {
  if (error === "Unauthorized") {
    return 401
  }

  if (error === "Admin is deactivated") {
    return 403
  }

  if (error === "Image key is required.") {
    return 400
  }

  return 500
}

export async function GET(
  request: NextRequest,
): Promise<NextResponse<HomeBannerImageSignedUrlApiResponse>> {
  const key = request.nextUrl.searchParams.get("key")
  const result = await getHomeBannerImageSignedUrl(key)

  if (!result.ok) {
    return NextResponse.json(toErrorResponse(result.error), {
      status: getStatusCode(result.error),
    })
  }

  return NextResponse.json({
    ok: true,
    key: result.key,
    url: result.url,
  })
}
