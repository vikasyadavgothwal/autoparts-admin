
import { NextRequest, NextResponse } from "next/server"
import { buildSwaggerUiHtml, getSwaggerSpec } from "@/lib/swagger"
export const dynamic = "force-dynamic"
export async function GET(request: NextRequest) {
  const shouldRenderUi = request.nextUrl.searchParams.get("ui") === "1"
  const specUrl = "/api/v1/admin/docs?raw=1"

  if (shouldRenderUi) {
    return new NextResponse(buildSwaggerUiHtml(specUrl), {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
      },
    })
  }

  const showRaw = request.nextUrl.searchParams.get("raw") === "1"

  if (showRaw) {
    return NextResponse.json(getSwaggerSpec(), {
      status: 200,
      headers: {
        "Cache-Control": "no-store",
      },
    })
  }

  return NextResponse.json(
    {
      docs: "/api/v1/admin/docs?ui=1",
      openapi: "/api/v1/admin/docs?raw=1",
      info: "Use ?ui=1 for interactive docs and ?raw=1 for spec JSON.",
    },
    {
      status: 200,
      headers: {
        "Cache-Control": "no-store",
      },
    },
  )
}
