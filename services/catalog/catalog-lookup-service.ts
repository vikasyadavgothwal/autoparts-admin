import { db } from "@/lib/database/prisma";
import type {
  BrandLookupRow,
  CatalogLookupWorkbookData,
  CategoryLookupRow,
  VehicleLookupRow,
} from "@/types/catalog/lookups";

const clean = (value: string | null | undefined) =>
  value?.trim().replace(/\s+/g, " ") ?? "";

async function ensureTier(label: string | null) {
  const normalized = clean(label);
  if (!normalized) return null;
  return db.tierLookup.upsert({
    where: { customerFacingLabel: normalized },
    update: {},
    create: { customerFacingLabel: normalized },
  });
}

async function findCategoryByName(name: string) {
  return db.productCategory.findFirst({
    where: { name: { equals: clean(name), mode: "insensitive" } },
  });
}

async function upsertCategory(row: CategoryLookupRow) {
  const id = clean(row.id);
  const name = clean(row.name);
  if (!id || !name) return null;
  return db.productCategory.upsert({
    where: { id },
    update: { name },
    create: { id, name },
  });
}

async function upsertVehicle(row: VehicleLookupRow) {
  const id = clean(row.id);
  const make = clean(row.make);
  const model = clean(row.model);
  if (!id || !make || !model) return;
  const tier = await ensureTier(row.tierLabel);
  await db.vehicleLookup.upsert({
    where: { id },
    update: { make, model, tierId: tier?.id ?? null },
    create: { id, make, model, tierId: tier?.id ?? null },
  });
}

async function upsertBrand(row: BrandLookupRow) {
  const id = clean(row.id);
  const brandName = clean(row.brandName);
  if (!id || !brandName) return;
  const tier = await ensureTier(row.tierLabel);
  const existing =
    (await db.brandLookup.findUnique({ where: { id } })) ??
    (await db.brandLookup.findFirst({
      where: { brandName: { equals: brandName, mode: "insensitive" } },
    }));
  const brand = existing
    ? await db.brandLookup.update({
        where: { id: existing.id },
        data: { brandName, tierId: tier?.id ?? null },
      })
    : await db.brandLookup.create({
        data: { id, brandName, tierId: tier?.id ?? null },
      });

  for (const rawName of row.categoryNames) {
    const name = clean(rawName);
    if (!name) continue;
    const category =
      (await findCategoryByName(name)) ??
      (await db.productCategory.create({ data: { name } }));
    await db.brandLookupCategory.upsert({
      where: {
        brandId_categoryId: { brandId: brand.id, categoryId: category.id },
      },
      update: {},
      create: { brandId: brand.id, categoryId: category.id },
    });
  }
}

export async function syncCatalogLookups(data: CatalogLookupWorkbookData) {
  for (const row of data.categories) await upsertCategory(row);

  for (const row of data.categories) {
    const id = clean(row.id);
    const parentId = clean(row.parentId);
    if (!id || !parentId || id === parentId) continue;
    const parent = await db.productCategory.findUnique({ where: { id: parentId } });
    if (parent) {
      await db.productCategory.update({ where: { id }, data: { parentId } });
    }
  }

  for (const row of data.vehicles) await upsertVehicle(row);
  for (const row of data.brands) await upsertBrand(row);
  for (const row of data.grades) {
    const customerFacingLabel = clean(row.customerFacingLabel);
    if (!customerFacingLabel) continue;
    await db.gradeLookup.upsert({
      where: { customerFacingLabel },
      update: { description: clean(row.description) || null },
      create: {
        customerFacingLabel,
        description: clean(row.description) || null,
      },
    });
  }

  return {
    categories: data.categories.length,
    vehicles: data.vehicles.length,
    brands: data.brands.length,
    grades: data.grades.length,
  };
}
