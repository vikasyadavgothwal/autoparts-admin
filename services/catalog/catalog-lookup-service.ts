import { db } from "@/lib/database/prisma";
import { mapWithConcurrency } from "@/services/parts-mapping/internal-helpers";
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

type TierLookup = Awaited<ReturnType<typeof ensureTier>>;
type CategoryLookup = Awaited<ReturnType<typeof findCategoryByName>>;
type LookupSyncContext = {
  tierCache: Map<string, Promise<TierLookup>>;
  categoryCache: Map<string, Promise<CategoryLookup>>;
};

const getCachedTier = (label: string | null, context: LookupSyncContext) => {
  const normalized = clean(label);
  if (!normalized) return Promise.resolve(null);

  const cached = context.tierCache.get(normalized);
  if (cached) return cached;

  const promise = ensureTier(normalized);
  context.tierCache.set(normalized, promise);
  return promise;
};

const getCachedCategory = (name: string, context: LookupSyncContext) => {
  const normalized = clean(name);
  if (!normalized) return Promise.resolve(null);

  const cached = context.categoryCache.get(normalized);
  if (cached) return cached;

  const promise = findCategoryByName(normalized);
  context.categoryCache.set(normalized, promise);
  return promise;
};

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

async function upsertVehicle(row: VehicleLookupRow, context: LookupSyncContext) {
  const id = clean(row.id);
  const make = clean(row.make);
  const model = clean(row.model);
  if (!id || !make || !model) return;
  const tier = await getCachedTier(row.tierLabel, context);
  await db.vehicleLookup.upsert({
    where: { id },
    update: { make, model, tierId: tier?.id ?? null },
    create: { id, make, model, tierId: tier?.id ?? null },
  });
}

async function upsertBrand(row: BrandLookupRow, context: LookupSyncContext) {
  const id = clean(row.id);
  const brandName = clean(row.brandName);
  if (!id || !brandName) return;
  const tier = await getCachedTier(row.tierLabel, context);
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

  const categories = await Promise.all(
    row.categoryNames.map(async (rawName) => {
      const name = clean(rawName);
      if (!name) return null;
      return (
        (await getCachedCategory(name, context)) ??
        (await db.productCategory.create({ data: { name } }))
      );
    }),
  );

  await Promise.all(
    categories
      .filter((category): category is NonNullable<typeof category> => Boolean(category))
      .map((category) =>
        db.brandLookupCategory.upsert({
          where: {
            brandId_categoryId: { brandId: brand.id, categoryId: category.id },
          },
          update: {},
          create: { brandId: brand.id, categoryId: category.id },
        }),
      ),
  );
}

export async function syncCatalogLookups(data: CatalogLookupWorkbookData) {
  const context: LookupSyncContext = {
    tierCache: new Map(),
    categoryCache: new Map(),
  };
  const concurrency = 12;

  await mapWithConcurrency(data.categories, concurrency, upsertCategory);

  await mapWithConcurrency(data.categories, concurrency, async (row) => {
    const id = clean(row.id);
    const parentId = clean(row.parentId);
    if (!id || !parentId || id === parentId) return;
    const parent = await db.productCategory.findUnique({ where: { id: parentId } });
    if (parent) {
      await db.productCategory.update({ where: { id }, data: { parentId } });
    }
  });

  await mapWithConcurrency(data.vehicles, concurrency, (row) =>
    upsertVehicle(row, context),
  );
  await mapWithConcurrency(data.brands, concurrency, (row) =>
    upsertBrand(row, context),
  );
  await mapWithConcurrency(data.grades, concurrency, async (row) => {
    const customerFacingLabel = clean(row.customerFacingLabel);
    if (!customerFacingLabel) return;
    await db.gradeLookup.upsert({
      where: { customerFacingLabel },
      update: { description: clean(row.description) || null },
      create: {
        customerFacingLabel,
        description: clean(row.description) || null,
      },
    });
  });

  return {
    categories: data.categories.length,
    vehicles: data.vehicles.length,
    brands: data.brands.length,
    grades: data.grades.length,
  };
}
