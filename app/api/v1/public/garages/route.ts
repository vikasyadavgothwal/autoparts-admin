import { NextRequest, NextResponse } from "next/server"

import { listPublicGarages } from "@/services/garage/public-garage-service"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  try {
    return NextResponse.json(
      await listPublicGarages({
        q: request.nextUrl.searchParams.get("q"),
        service: request.nextUrl.searchParams.get("service"),
        location: request.nextUrl.searchParams.get("location"),
        page: request.nextUrl.searchParams.get("page"),
        pageSize: request.nextUrl.searchParams.get("pageSize"),
      }),
    )
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: error instanceof Error ? error.message : "Unable to load garages",
      },
      { status: 500 },
    )
  }
}
