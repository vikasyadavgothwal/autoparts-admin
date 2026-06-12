/**
 * @swagger
 * /api/v1/user/public-content:
 *   get:
 *     tags:
 *       - Public Content
 *     summary: Get public website content by slug
 *     parameters:
 *       - in: query
 *         name: slug
 *         required: true
 *         schema:
 *           type: string
 *           enum:
 *             - home
 *             - for-business
 *             - rfq
 *             - suppliers
 *             - services
 *             - privacy-policy
 *             - terms-of-services
 *             - cookies-settings
 *     responses:
 *       200:
 *         description: Public content returned
 *       400:
 *         description: Missing or invalid slug
 *       500:
 *         description: Content lookup failed
 */

import { NextRequest, NextResponse } from "next/server"

import { getPublicContentBySlug } from "@/actions/admin-dashboard/public-pages/public-content"
import type {
  PublicWebsiteContentError,
  PublicWebsiteContentResponse,
  PublicWebsiteContentSlugInput,
} from "@/types/admin-dashboard/public-pages/public-content-api"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const slug = request.nextUrl.searchParams.get("slug")

  if (slug == null || slug.trim() === "") {
    const errorResponse: PublicWebsiteContentError = {
      ok: false,
      error: "Valid slug is required. Use one of home, for-business, rfq, suppliers, services, privacy-policy, terms-of-services, or cookies-settings.",
    }

    return NextResponse.json(errorResponse, { status: 400 })
  }

  const result = await getPublicContentBySlug(slug as PublicWebsiteContentSlugInput)

  if (!result.ok) {
    const isBadRequest = result.error.includes("Valid slug is required")
      || result.error.startsWith("Valid slug is required")
    const status = isBadRequest ? 400 : 500

    const errorResponse: PublicWebsiteContentError = {
      ok: false,
      error: result.error,
    }

    return NextResponse.json(errorResponse, { status })
  }

  const response: PublicWebsiteContentResponse = {
    ok: true,
    slug: result.slug,
    data: result.data,
    seo: result.seo,
  }

  return NextResponse.json(response, { status: 200 })
}
