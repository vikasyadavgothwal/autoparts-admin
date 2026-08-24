"use client"

const WEBP_MIME_TYPE = "image/webp"
const OPTIMIZABLE_IMAGE_TYPES = new Set(["image/jpeg", "image/png"])

type PublicImageOptimizationOptions = {
  maxWidth: number
  maxHeight: number
  quality: number
}

const withoutExtension = (fileName: string) =>
  fileName.replace(/\.[^.]+$/, "") || "image"

const canvasToWebpBlob = (
  canvas: HTMLCanvasElement,
  quality: number,
): Promise<Blob | null> =>
  new Promise((resolve) => {
    canvas.toBlob(resolve, WEBP_MIME_TYPE, quality)
  })

export async function optimizePublicImageUpload(
  file: File,
  options: PublicImageOptimizationOptions,
) {
  if (!OPTIMIZABLE_IMAGE_TYPES.has(file.type) || typeof createImageBitmap !== "function") {
    return file
  }

  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, options.maxWidth / bitmap.width, options.maxHeight / bitmap.height)
  const width = Math.max(1, Math.round(bitmap.width * scale))
  const height = Math.max(1, Math.round(bitmap.height * scale))
  const canvas = document.createElement("canvas")
  canvas.width = width
  canvas.height = height

  const context = canvas.getContext("2d")
  if (!context) {
    bitmap.close()
    return file
  }

  context.drawImage(bitmap, 0, 0, width, height)
  bitmap.close()

  const blob = await canvasToWebpBlob(canvas, options.quality)
  if (!blob || (scale === 1 && blob.size >= file.size)) {
    return file
  }

  return new File([blob], `${withoutExtension(file.name)}.webp`, {
    type: WEBP_MIME_TYPE,
    lastModified: file.lastModified,
  })
}
