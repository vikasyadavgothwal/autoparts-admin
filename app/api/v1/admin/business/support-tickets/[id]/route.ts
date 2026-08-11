import { NextRequest, NextResponse } from "next/server"

import { apiError, apiErrorMessage, readJsonBody, requireAdminFromRequest } from "@/lib/auth/api-guards"
import { deleteAdminBusinessSupportTicket, updateAdminBusinessSupportTicket } from "@/services/business/business-platform-service"

export const dynamic = "force-dynamic"

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdminFromRequest()
  if (!auth.ok) return auth.response

  const body = await readJsonBody<{ status?: unknown }>(request)
  if (!body.ok) return apiError(body.message)

  try {
    const { id } = await params
    const supportTicket = await updateAdminBusinessSupportTicket({
      adminId: auth.admin.id,
      id,
      status: body.body.status,
    })
    return NextResponse.json({ ok: true, supportTicket })
  } catch (error) {
    return apiError(apiErrorMessage(error, "Unable to update support ticket"))
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdminFromRequest()
  if (!auth.ok) return auth.response

  try {
    const ticket = await deleteAdminBusinessSupportTicket({ adminId: auth.admin.id, id: (await params).id })
    return NextResponse.json({ ok: true, ticket })
  } catch (error) {
    return apiError(apiErrorMessage(error, "Unable to delete support ticket"))
  }
}
