import crypto from "node:crypto"
import { Buffer } from "node:buffer"
import { NextRequest, NextResponse } from "next/server"

import { requireGarageFromRequest } from "@/lib/auth/api-guards"
import { uploadObjectToS3 } from "@/lib/storage/s3"

export const dynamic = "force-dynamic"

const MAX_GALLERY_IMAGES = 12
const MAX_IMAGE_SIZE = 10 * 1024 * 1024
const IMAGE_EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
}

const validImage = (file: File) =>
  Boolean(IMAGE_EXTENSIONS[file.type]) && file.size <= MAX_IMAGE_SIZE

async function uploadGarageImage(file: File, garageId: string, folder: string) {
  const key = `garage-profiles/${garageId}/${folder}/${Date.now()}-${crypto.randomUUID()}.${IMAGE_EXTENSIONS[file.type]}`
  const uploaded = await uploadObjectToS3({
    key,
    body: Buffer.from(await file.arrayBuffer()),
    contentType: file.type,
  })
  return { key: uploaded.key, url: uploaded.objectUrl }
}

export async function POST(request: NextRequest) {
  const auth = await requireGarageFromRequest(request)
  if (!auth.ok) return auth.response

  const formData = await request.formData()
  const garageImage = formData.get("garageImage")
  const galleryImages = formData
    .getAll("galleryImages")
    .filter((value): value is File => value instanceof File)

  if (!(garageImage instanceof File) && galleryImages.length === 0) {
    return NextResponse.json(
      { ok: false, message: "Upload at least one garage or gallery image" },
      { status: 400 },
    )
  }
  if (galleryImages.length > MAX_GALLERY_IMAGES) {
    return NextResponse.json(
      { ok: false, message: `Upload at most ${MAX_GALLERY_IMAGES} gallery images` },
      { status: 400 },
    )
  }
  if (
    (garageImage instanceof File && !validImage(garageImage)) ||
    galleryImages.some((file) => !validImage(file))
  ) {
    return NextResponse.json(
      {
        ok: false,
        message: "Images must be JPG, PNG, or WebP and no larger than 10 MB each",
      },
      { status: 400 },
    )
  }

  try {
    const uploadedGarageImage =
      garageImage instanceof File
        ? await uploadGarageImage(garageImage, auth.user.id, "main")
        : null
    const uploadedGalleryImages = await Promise.all(
      galleryImages.map((file) => uploadGarageImage(file, auth.user.id, "gallery")),
    )
    return NextResponse.json(
      {
        ok: true,
        garageImage: uploadedGarageImage,
        galleryImages: uploadedGalleryImages,
      },
      { status: 201 },
    )
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
