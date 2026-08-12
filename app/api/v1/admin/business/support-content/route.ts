import { NextRequest, NextResponse } from "next/server"

import { apiError, apiErrorMessage, readJsonBody, requireAdminFromRequest } from "@/lib/auth/api-guards"
import { deleteAdminBusinessSupportContent, listAdminBusinessSupportContent, upsertAdminBusinessSupportContent } from "@/services/business/business-platform-service"

export const dynamic = "force-dynamic"

export async function GET() {
  const auth = await requireAdminFromRequest()
  if (!auth.ok) return auth.response
  return NextResponse.json({ ok: true, supportContent: await listAdminBusinessSupportContent() })
}

export async function POST(request: NextRequest) {
  const auth = await requireAdminFromRequest()
  if (!auth.ok) return auth.response
  const body = await readJsonBody<Record<string, unknown>>(request)
  if (!body.ok) return apiError(body.message)
  try {
    const payload = body.body
    const supportContent = await upsertAdminBusinessSupportContent({
      adminId: auth.admin.id,
      kind: payload.kind,
      id: payload.id,
      accountType: payload.accountType,
      supportTier: payload.supportTier,
      title: payload.title,
      description: payload.description,
      videoUrl: payload.videoUrl,
      question: payload.question,
      answer: payload.answer,
      sortOrder: payload.sortOrder,
      isActive: payload.isActive,
    })
    return NextResponse.json({ ok: true, supportContent })
  } catch (error) {
    return apiError(apiErrorMessage(error, "Unable to save support content"))
  }
}

export async function DELETE(request: NextRequest) {
  const auth = await requireAdminFromRequest()
  if (!auth.ok) return auth.response
  const body = await readJsonBody<Record<string, unknown>>(request)
  if (!body.ok) return apiError(body.message)
  try {
    const deleted = await deleteAdminBusinessSupportContent({
      adminId: auth.admin.id,
      kind: body.body.kind,
      id: body.body.id,
    })
    return NextResponse.json({ ok: true, deleted })
  } catch (error) {
    return apiError(apiErrorMessage(error, "Unable to delete support content"))
  }
}
