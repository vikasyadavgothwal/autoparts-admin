import { NextRequest, NextResponse } from "next/server"

import { getOptionalUserFromRequest } from "@/lib/parts-mapping/auth"
import { importRfqWorkbook } from "@/services/fleet/rfq-import-service"

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  const auth = await getOptionalUserFromRequest(request)
  if (!auth || !["User", "Fleet"].includes(auth.user.activeRole)) return NextResponse.json({ ok: false, message: "User or Fleet authentication is required" }, { status: 403 })
  try {
    const file = (await request.formData()).get("file")
    if (!(file instanceof File) || !file.size) throw new Error("Select a CSV, XLSX, or XLS file")
    if (file.size > 2 * 1024 * 1024) throw new Error("RFQ file must be 2 MB or smaller")
    if (!/\.(csv|xlsx|xls)$/i.test(file.name)) throw new Error("Only CSV, XLSX, and XLS files are supported")
    return NextResponse.json({ ok: true, ...(await importRfqWorkbook(Buffer.from(await file.arrayBuffer()))) })
  } catch (error) {
    return NextResponse.json({ ok: false, message: error instanceof Error ? error.message : "Unable to import RFQ file" }, { status: 400 })
  }
}
