import { NextRequest, NextResponse } from "next/server"

import { requireAdminFromRequest } from "@/lib/auth/api-guards"
import {
  removeMainWebsiteAsset,
  uploadMainWebsiteAsset,
  type MainWebsiteAssetKind,
} from "@/services/platform-settings/main-website-site-settings"

const getAssetKind = (value: string | null): MainWebsiteAssetKind | null =>
  value === "logo" || value === "favicon" ? value : null

export async function POST(request: NextRequest) {
  const auth = await requireAdminFromRequest()
  if (!auth.ok) return auth.response

  const formData = await request.formData()
  const file = formData.get("file")
  const kind = getAssetKind(String(formData.get("kind") ?? ""))
  if (!(file instanceof File) || !kind) {
    return NextResponse.json({ ok: false, message: "A valid logo or favicon file is required." }, { status: 400 })
  }

  try {
    return NextResponse.json({ ok: true, ...(await uploadMainWebsiteAsset(file, kind)) })
  } catch (error) {
    return NextResponse.json({ ok: false, message: error instanceof Error ? error.message : "Unable to upload website asset" }, { status: 400 })
  }
}

export async function DELETE(request: NextRequest) {
  const auth = await requireAdminFromRequest()
  if (!auth.ok) return auth.response

  const kind = getAssetKind(request.nextUrl.searchParams.get("kind"))
  if (!kind) {
    return NextResponse.json({ ok: false, message: "A valid logo or favicon is required." }, { status: 400 })
  }

  try {
    return NextResponse.json({ ok: true, ...(await removeMainWebsiteAsset(kind)) })
  } catch (error) {
    return NextResponse.json({ ok: false, message: error instanceof Error ? error.message : "Unable to remove website asset" }, { status: 400 })
  }
}
