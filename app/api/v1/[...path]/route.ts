import { NextRequest, NextResponse } from "next/server"

export const dynamic = "force-dynamic"

const endpointNotFound = (request: NextRequest) =>
  NextResponse.json(
    {
      ok: false,
      code: "API_ENDPOINT_NOT_FOUND",
      message: `The API endpoint ${request.method} ${request.nextUrl.pathname} does not exist. Check the URL and HTTP method, then try again.`,
      hint: "Developer API URLs start with /api/v1/developer/.",
      documentation: "/developers/api",
    },
    { status: 404 },
  )

export const GET = endpointNotFound
export const POST = endpointNotFound
export const PUT = endpointNotFound
export const PATCH = endpointNotFound
export const DELETE = endpointNotFound
