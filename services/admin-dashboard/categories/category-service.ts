import { db } from "@/lib/database/prisma"
import { CategoryStatus } from "@/lib/generated/prisma/client"
import type { Prisma } from "@/lib/generated/prisma/client"
import type {
  CategoryInput,
  CategoryPageResult,
  CategoryRecord,
  CategorySearchInput,
} from "@/types/admin-dashboard/categories/categories"

const DEFAULT_PAGE_SIZE = 10
const MAX_PAGE_SIZE = 100

const normalizeText = (value: string): string => value.trim().replace(/\s+/g, " ")

const slugify = (value: string): string =>
  value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-")

const mapCategory = (category: {
  id: string
  name: string
  slug: string
  status: CategoryStatus
  createdAt: Date
  updatedAt: Date
  _count: { parts: number }
}): CategoryRecord => ({
  id: category.id,
  name: category.name,
  slug: category.slug,
  status: category.status,
  linkedPartsCount: category._count.parts,
  createdAt: category.createdAt.toISOString(),
  updatedAt: category.updatedAt.toISOString(),
})

async function resolveUniqueCategorySlug(
  name: string,
  excludeId?: string,
): Promise<string> {
  const baseSlug = slugify(name)

  if (!baseSlug) {
    throw new Error("Category name is required")
  }

  const existingCategories = await db.category.findMany({
    where: {
      slug: {
        startsWith: baseSlug,
      },
      ...(excludeId ? { NOT: { id: excludeId } } : {}),
    },
    select: {
      slug: true,
    },
  })
  const existingSlugs = new Set(existingCategories.map((category) => category.slug))

  if (!existingSlugs.has(baseSlug)) {
    return baseSlug
  }

  let suffix = 2

  while (existingSlugs.has(`${baseSlug}-${suffix}`)) {
    suffix += 1
  }

  return `${baseSlug}-${suffix}`
}

async function normalizeCategoryInput(
  input: CategoryInput,
  excludeId?: string,
): Promise<{
  name: string
  slug: string
  status: CategoryStatus
}> {
  const name = normalizeText(input.name ?? "")

  if (!name) {
    throw new Error("Category name is required")
  }

  return {
    name,
    slug: await resolveUniqueCategorySlug(name, excludeId),
    status: input.status === "INACTIVE" ? CategoryStatus.INACTIVE : CategoryStatus.ACTIVE,
  }
}

export async function getCategoryCatalog(
  input: CategorySearchInput = {},
): Promise<CategoryPageResult> {
  const query = normalizeText(input.query ?? "")
  const requestedPage = Number.isInteger(input.page) && (input.page ?? 0) > 0
    ? input.page ?? 1
    : 1
  const pageSize = Number.isInteger(input.pageSize) && (input.pageSize ?? 0) > 0
    ? Math.min(input.pageSize ?? DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE)
    : DEFAULT_PAGE_SIZE
  const where: Prisma.CategoryWhereInput | undefined = query
    ? {
        OR: [
          { name: { contains: query, mode: "insensitive" } },
          { slug: { contains: query, mode: "insensitive" } },
        ],
      }
    : undefined
  const totalItems = await db.category.count({ where })
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize))
  const page = Math.min(requestedPage, totalPages)

  const categories = await db.category.findMany({
    where,
    skip: (page - 1) * pageSize,
    take: pageSize,
    orderBy: [{ name: "asc" }, { createdAt: "desc" }],
    include: {
      _count: {
        select: { parts: true },
      },
    },
  })

  return {
    categories: categories.map(mapCategory),
    query,
    pagination: {
      page,
      pageSize,
      totalItems,
      totalPages,
    },
  }
}

export async function getCategoryById(id: string): Promise<CategoryRecord> {
  const categoryId = id.trim()

  if (!categoryId) {
    throw new Error("Category ID is required")
  }

  const category = await db.category.findUnique({
    where: { id: categoryId },
    include: {
      _count: {
        select: { parts: true },
      },
    },
  })

  if (!category) {
    throw new Error("Category not found")
  }

  return mapCategory(category)
}

export async function createCategory(input: CategoryInput): Promise<CategoryRecord> {
  const category = await db.category.create({
    data: await normalizeCategoryInput(input),
    include: {
      _count: {
        select: { parts: true },
      },
    },
  })

  return mapCategory(category)
}

export async function updateCategory(
  id: string,
  input: CategoryInput,
): Promise<CategoryRecord> {
  const categoryId = id.trim()

  if (!categoryId) {
    throw new Error("Category ID is required")
  }

  const category = await db.category.update({
    where: { id: categoryId },
    data: await normalizeCategoryInput(input, categoryId),
    include: {
      _count: {
        select: { parts: true },
      },
    },
  })

  return mapCategory(category)
}

export async function deleteCategory(id: string): Promise<void> {
  const categoryId = id.trim()

  if (!categoryId) {
    throw new Error("Category ID is required")
  }

  const linkedPartsCount = await db.part.count({
    where: {
      categoryId,
    },
  })

  if (linkedPartsCount > 0) {
    throw new Error(
      `This category is linked to ${linkedPartsCount} part${linkedPartsCount === 1 ? "" : "s"}. Reassign those parts before deleting it.`,
    )
  }

  await db.category.delete({
    where: { id: categoryId },
  })
}
