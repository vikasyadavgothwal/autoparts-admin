
import { NextRequest, NextResponse } from "next/server"

import { createFirstAdminViaApi } from "@/actions/admin-auth/create-first-admin"
import type {
  CreateFirstAdminApiBody,
  CreateFirstAdminApiResponse,
  CreateFirstAdminApiResult,
} from "@/types/admin-auth/admin-first-admin-api"

export const dynamic = "force-dynamic"

type ParsedBodyResult =
  | { ok: true; body: CreateFirstAdminApiBody }
  | { ok: false; message: string }

const readBody = async (request: NextRequest): Promise<ParsedBodyResult> => {
  let body: CreateFirstAdminApiBody

  try {
    body = await request.json()
  } catch {
    return {
      ok: false,
      message: "Invalid JSON body",
    }
  }

  if (!body || typeof body !== "object") {
    return {
      ok: false,
      message: "Invalid request body",
    }
  }

  return {
    ok: true,
    body,
  }
}

const toErrorResponse = (
  result: Exclude<CreateFirstAdminApiResult, { ok: true }>,
): CreateFirstAdminApiResponse => ({
  ok: false,
  message: result.message,
})

export async function POST(
  request: NextRequest,
): Promise<NextResponse<CreateFirstAdminApiResponse>> {
  const parsedBody = await readBody(request)

  if (!parsedBody.ok) {
    return NextResponse.json(toErrorResponse({ ok: false, message: parsedBody.message, statusCode: 400 }), {
      status: 400,
    })
  }

  const firstAdminToken = request.headers.get("x-admin-first-admin-token")?.trim() ?? null
  const result = await createFirstAdminViaApi(parsedBody.body, firstAdminToken)

  if (!result.ok) {
    const statusCode = result.statusCode ?? 400
    return NextResponse.json(toErrorResponse(result), { status: statusCode })
  }

  return NextResponse.json(
    {
      ok: true,
      admin: result.admin,
    },
    { status: 201 },
  )
}
