import crypto from "node:crypto"
import { Buffer } from "node:buffer"
import { NextRequest, NextResponse } from "next/server"

import {
  getOptionalUserFromRequest,
} from "@/lib/parts-mapping/auth"
import { deleteObjectFromS3, uploadObjectToS3 } from "@/lib/storage/s3"
import { createRfq, listFleetRfqs, listSupplierRfqs, listUserRfqs } from "@/services/fleet/fleet-service"
import type { CreateRfqInput, RfqAttachment } from "@/types/rfq/rfq"

export const dynamic = "force-dynamic"
export const maxDuration = 60

const allowedAttachmentTypes = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
])

export async function GET(request: NextRequest) {
  const auth = await getOptionalUserFromRequest(request)
  if (!auth) return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 })
  const page = Number.parseInt(request.nextUrl.searchParams.get("page") ?? "1", 10)
  const pageSize = Number.parseInt(request.nextUrl.searchParams.get("pageSize") ?? "20", 10)
  const search = request.nextUrl.searchParams.get("search") ?? ""
  if (auth.user.activeRole === "Fleet" && auth.user.roles.includes("Fleet")) {
    return NextResponse.json({ ok: true, ...(await listFleetRfqs(auth.user.id, page, pageSize, search)) })
  }
  if (auth.user.activeRole === "User" && auth.user.roles.includes("User")) {
    return NextResponse.json({ ok: true, ...(await listUserRfqs(auth.user.id, page, pageSize, search)) })
  }
  if (auth.user.activeRole === "Supplier" && auth.user.roles.includes("Supplier")) {
    return NextResponse.json({ ok: true, ...(await listSupplierRfqs(auth.user.id, page, pageSize, search)) })
  }
  return NextResponse.json({ ok: false, message: "User, Supplier, or Fleet role is required" }, { status: 403 })
}

export async function POST(request: NextRequest) {
  let uploadedKey: string | null = null
  try {
    const formData = await request.formData()
    const rawPayload = String(formData.get("payload") ?? "")
    const input = JSON.parse(rawPayload) as CreateRfqInput
    const auth = await getOptionalUserFromRequest(request)
    if (input.source === "fleet" && (!auth || !auth.user.roles.includes("Fleet"))) {
      return NextResponse.json({ ok: false, message: "Fleet authentication is required" }, { status: 403 })
    }

    const fileValue = formData.get("attachment")
    let attachment: RfqAttachment | null = null
    if (fileValue instanceof File && fileValue.size > 0) {
      if (fileValue.size > 10 * 1024 * 1024) throw new Error("Attachment must be 10 MB or smaller")
      if (!allowedAttachmentTypes.has(fileValue.type)) throw new Error("Attachment must be PDF, PNG, or JPG")
      const safeName = fileValue.name.replace(/[^a-zA-Z0-9._-]+/g, "-").slice(-120)
      const owner = auth?.user.id ?? "public"
      const key = `rfq-attachments/${owner}/${crypto.randomUUID()}-${safeName}`
      const uploaded = await uploadObjectToS3({
        key,
        body: Buffer.from(await fileValue.arrayBuffer()),
        contentType: fileValue.type,
        cacheControl: "private, max-age=0, no-cache",
      })
      attachment = {
        key: uploaded.key,
        url: uploaded.objectUrl,
        name: fileValue.name,
        mimeType: fileValue.type,
        size: fileValue.size,
      }
      uploadedKey = uploaded.key
    }

    const rfq = await createRfq(input, auth?.user.id ?? null, attachment)
    return NextResponse.json({ ok: true, rfq }, { status: 201 })
  } catch (error) {
    if (uploadedKey) {
      await deleteObjectFromS3(uploadedKey).catch(() => undefined)
    }
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : "Unable to submit RFQ" },
      { status: 400 },
    )
  }
}
