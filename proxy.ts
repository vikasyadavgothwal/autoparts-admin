import { NextResponse, type NextRequest } from "next/server"
import { isApiOriginAllowed, setApiCorsHeaders } from "@/lib/api-cors"

export function proxy(request: NextRequest) {
  if (!isApiOriginAllowed(request)) {
    return NextResponse.json(
      { ok: false, message: "Origin is not allowed" },
      { status: 403 },
    )
  }

  if (request.method === "OPTIONS") {
    const response = new NextResponse(null, { status: 204 })
    setApiCorsHeaders(request, response)
    return response
  }

  const response = NextResponse.next()
  setApiCorsHeaders(request, response)
  return response
}

export const config = {
  matcher: "/api/:path*",
}
