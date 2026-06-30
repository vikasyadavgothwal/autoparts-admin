import crypto from "node:crypto"
import { Buffer } from "node:buffer"
import { NextRequest, NextResponse } from "next/server"

import { requireAdminFromRequest } from "@/lib/parts-mapping/auth"
import { uploadObjectToS3 } from "@/lib/storage/s3"

export const dynamic = "force-dynamic"

const MAX_IMAGES = 8
const MAX_IMAGE_SIZE = 5 * 1024 * 1024
const IMAGE_EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
}

export async function POST(request: NextRequest) {
  const auth = await requireAdminFromRequest()
  if (!auth.ok) {
    return auth.response
  }

  const formData = await request.formData()
  const files = formData
    .getAll("images")
    .filter((value): value is File => value instanceof File)

  if (files.length === 0 || files.length > MAX_IMAGES) {
    return NextResponse.json(
      { ok: false, message: "Upload between 1 and 8 product images" },
      { status: 400 },
    )
  }
  if (
    files.some(
      (file) => !IMAGE_EXTENSIONS[file.type] || file.size > MAX_IMAGE_SIZE,
    )
  ) {
    return NextResponse.json(
      {
        ok: false,
        message: "Images must be JPG, PNG, or WebP and no larger than 5 MB each",
      },
      { status: 400 },
    )
  }

  try {
    const images = await Promise.all(
      files.map(async (file) => {
        const key = `product-images/admin/${auth.admin.id}/${Date.now()}-${crypto.randomUUID()}.${IMAGE_EXTENSIONS[file.type]}`
        const uploaded = await uploadObjectToS3({
          key,
          body: Buffer.from(await file.arrayBuffer()),
          contentType: file.type,
        })
        return { key: uploaded.key, url: uploaded.objectUrl }
      }),
    )
    return NextResponse.json({ ok: true, images }, { status: 201 })
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: error instanceof Error ? error.message : "Unable to upload images",
      },
      { status: 500 },
    )
  }
}
