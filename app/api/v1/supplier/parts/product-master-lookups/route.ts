import { NextRequest, NextResponse } from "next/server"

import { requireSupplierFromRequest } from "@/lib/auth/api-guards"
import { db } from "@/lib/database/prisma"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const auth = await requireSupplierFromRequest(request)
  if (!auth.ok) {
    return auth.response
  }

  const [categories, brands, vehicles] = await Promise.all([
    db.productCategory.findMany({
      include: { parent: { select: { id: true, name: true } } },
      orderBy: [{ name: "asc" }],
    }),
    db.brandLookup.findMany({
      include: {
        categoryLinks: {
          include: { category: { select: { id: true, name: true } } },
        },
        tier: { select: { id: true, customerFacingLabel: true } },
      },
      orderBy: [{ brandName: "asc" }],
    }),
    db.vehicleLookup.findMany({
      include: { tier: { select: { customerFacingLabel: true } } },
      orderBy: [{ make: "asc" }, { model: "asc" }],
      take: 1000,
    }),
  ])

  return NextResponse.json({
    ok: true,
    categories: categories.map((category) => ({
      id: category.id,
      name: category.name,
      parentId: category.parentId,
      parentName: category.parent?.name ?? null,
    })),
    brands: brands.map((brand) => ({
      id: brand.id,
      name: brand.brandName,
      tier: brand.tier?.customerFacingLabel ?? null,
      categories: brand.categoryLinks.map((link) => ({
        id: link.category.id,
        name: link.category.name,
      })),
    })),
    vehicles: vehicles.map((vehicle) => ({
      id: vehicle.id,
      make: vehicle.make,
      model: vehicle.model,
      tier: vehicle.tier?.customerFacingLabel ?? null,
    })),
  })
}
