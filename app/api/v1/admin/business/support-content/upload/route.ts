import crypto from "node:crypto"
import { Buffer } from "node:buffer"
import { NextRequest, NextResponse } from "next/server"

import { requireAdminFromRequest } from "@/lib/auth/api-guards"
import { uploadObjectToS3 } from "@/lib/storage/s3"

export const dynamic = "force-dynamic"

const MAX_VIDEO_SIZE = 250 * 1024 * 1024
const VIDEO_EXTENSIONS: Record<string, string> = {
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/quicktime": "mov",
}

const safeSegment = (value: string) =>
  value.trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "") || "support"

export async function POST(request: NextRequest) {
  const auth = await requireAdminFromRequest()
  if (!auth.ok) return auth.response

  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json(
      { ok: false, message: "Unable to read uploaded video. Try a smaller MP4, WebM, or MOV file." },
      { status: 400 },
    )
  }

  const file = formData.get("video")
  const accountType = safeSegment(String(formData.get("accountType") ?? "business"))

  if (!(file instanceof File)) {
    return NextResponse.json({ ok: false, message: "Upload a video file" }, { status: 400 })
  }
  if (!VIDEO_EXTENSIONS[file.type]) {
    return NextResponse.json({ ok: false, message: "Video must be MP4, WebM, or MOV" }, { status: 400 })
  }
  if (file.size <= 0 || file.size > MAX_VIDEO_SIZE) {
    return NextResponse.json({ ok: false, message: "Video must be no larger than 250 MB" }, { status: 400 })
  }

  try {
    const key = `business-support/videos/${accountType}/common/${Date.now()}-${crypto.randomUUID()}.${VIDEO_EXTENSIONS[file.type]}`
    const uploaded = await uploadObjectToS3({
      key,
      body: Buffer.from(await file.arrayBuffer()),
      contentType: file.type,
    })
    return NextResponse.json({ ok: true, video: { key: uploaded.key, url: uploaded.objectUrl } }, { status: 201 })
  } catch (error) {
    return NextResponse.json({ ok: false, message: error instanceof Error ? error.message : "Unable to upload video" }, { status: 500 })
  }
}
