import { Buffer } from "node:buffer"
import { NextRequest, NextResponse } from "next/server"

import { requireSupplierFromRequest } from "@/lib/auth/api-guards";
import { db } from "@/lib/database/prisma"
import { uploadSupplierDocument } from "@/services/supplier/supplier-settings-service";
import {
  createSignedS3ObjectUrl,
  getS3ObjectKeyFromUrl,
} from "@/lib/storage/s3"

type SupplierDocumentField =
  | "tradeLicenseImageUrl"
  | "vatTrnImageUrl"
  | "emiratesIdPassportUrl"
  | "emiratesIdBackUrl"
  | "passportAddressUrl"
  | "passportVisaFrontUrl"
  | "bankAccountProofUrl"

const documentUnavailableResponse = (message: string, status = 404) =>
  new NextResponse(
    `<!doctype html><html><head><title>Document unavailable</title><style>body{font-family:Arial,sans-serif;margin:40px;color:#111827}main{max-width:560px}h1{font-size:22px}p{line-height:1.5;color:#4b5563}</style></head><body><main><h1>Document unavailable</h1><p>${message}</p></main></body></html>`,
    {
      status,
      headers: { "content-type": "text/html; charset=utf-8" },
    },
  )

const isSupplierDocumentField = (value: string): value is SupplierDocumentField =>
  [
    "tradeLicenseImageUrl",
    "vatTrnImageUrl",
    "emiratesIdPassportUrl",
    "emiratesIdBackUrl",
    "passportAddressUrl",
    "passportVisaFrontUrl",
    "bankAccountProofUrl",
  ].includes(value)

export async function GET(request: NextRequest) {
  const auth = await requireSupplierFromRequest(request)
  if (!auth.ok) return auth.response

  const field = request.nextUrl.searchParams.get("field") ?? ""
  if (!isSupplierDocumentField(field)) {
    return documentUnavailableResponse(
      "The requested supplier document field is invalid.",
      400,
    )
  }

  const supplier = await db.user.findUnique({
    where: { id: auth.user.id },
    select: {
      tradeLicenseImageUrl: true,
      vatTrnImageUrl: true,
      emiratesIdPassportUrl: true,
      emiratesIdBackUrl: true,
      passportAddressUrl: true,
      passportVisaFrontUrl: true,
      bankAccountProofUrl: true,
    },
  })
  const documentUrl = supplier?.[field]
  if (!documentUrl) {
    return documentUnavailableResponse("No document has been uploaded for this field.")
  }

  const key = getS3ObjectKeyFromUrl(documentUrl)
  if (!key) {
    return NextResponse.redirect(documentUrl)
  }

  const signedUrl = await createSignedS3ObjectUrl(key, 5 * 60)
  const response = await fetch(signedUrl)
  if (!response.ok || !response.body) {
    return documentUnavailableResponse(
      "The saved document file was not found in storage. Ask the supplier to upload this document again and save documents.",
      response.status === 404 ? 404 : 502,
    )
  }

  const headers = new Headers()
  headers.set(
    "content-type",
    response.headers.get("content-type") ?? "application/octet-stream",
  )
  headers.set(
    "content-disposition",
    `inline; filename="${key.split("/").pop() ?? "supplier-document"}"`,
  )
  return new NextResponse(response.body, { headers })
}

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const auth = await requireSupplierFromRequest(request);
  if (!auth.ok) return auth.response;

  const formData = await request.formData();
  const document = formData.get("document");
  const kind = String(formData.get("kind") ?? "");
  if (!(document instanceof File)) {
    return NextResponse.json(
      { ok: false, message: "Upload a document file" },
      { status: 400 },
    );
  }

  try {
    return NextResponse.json(
      {
        ok: true,
        ...(await uploadSupplierDocument(auth.user.id, {
          kind,
          contentType: document.type,
          body: Buffer.from(await document.arrayBuffer()),
        })),
      },
      { status: 201 },
    );
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message:
          error instanceof Error ? error.message : "Unable to upload document",
      },
      { status: 400 },
    );
  }
}
