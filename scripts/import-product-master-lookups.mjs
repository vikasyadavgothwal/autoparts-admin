import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"

import pg from "pg"
import * as XLSX from "xlsx"

const workbookPath = process.argv[2]
if (!workbookPath) {
  throw new Error("Usage: node --env-file=.env scripts/import-product-master-lookups.mjs <workbook.xlsx>")
}
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required")

const clean = (value) => String(value ?? "").trim().replace(/\s+/g, " ")
const stableId = (prefix, value) =>
  `${prefix}_${createHash("sha256").update(value.toLowerCase()).digest("hex").slice(0, 20)}`
const normalizeId = (value) => {
  const normalized = clean(value)
  if (!/^\d+\.\d{8,}$/.test(normalized)) return normalized
  return Number(normalized).toFixed(10).replace(/0+$/, "").replace(/\.$/, "")
}
const splitValues = (value) =>
  [...new Set(clean(value).split(/[,;|\n]+/).map(clean).filter(Boolean))]
const rows = (workbook, sheetName) => {
  const sheet = workbook.Sheets[sheetName]
  if (!sheet) throw new Error(`Workbook is missing ${sheetName}`)
  return XLSX.utils.sheet_to_json(sheet, { defval: "", raw: false })
}

const workbook = XLSX.read(readFileSync(resolve(workbookPath)), {
  type: "buffer",
  cellDates: false,
})
const categories = rows(workbook, "Lookup_Categories")
const vehicles = rows(workbook, "Lookup_Vehicles")
const brands = rows(workbook, "Lookup_Brands")
const grades = rows(workbook, "Lookup_Grades")
const client = new pg.Client({ connectionString: process.env.DATABASE_URL })

await client.connect()
try {
  await client.query("BEGIN")

  for (const row of categories) {
    const id = normalizeId(row["Category ID"])
    const name = clean(row["Category Name"])
    if (!id || !name) continue
    await client.query(
      `INSERT INTO product_categories (id, name, "updatedAt") VALUES ($1, $2, NOW())
       ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, "updatedAt" = NOW()`,
      [id, name],
    )
  }
  for (const row of categories) {
    const id = normalizeId(row["Category ID"])
    const parentId = normalizeId(row["Parent Category"])
    if (!id || !parentId || id === parentId) continue
    await client.query(
      `UPDATE product_categories SET "parentId" = $2, "updatedAt" = NOW()
       WHERE id = $1 AND EXISTS (SELECT 1 FROM product_categories WHERE id = $2)`,
      [id, parentId],
    )
  }

  const ensureTier = async (labelValue) => {
    const label = clean(labelValue)
    if (!label) return null
    const id = stableId("tier", label)
    const result = await client.query(
      `INSERT INTO tier_lookups (id, "customerFacingLabel", "updatedAt") VALUES ($1, $2, NOW())
       ON CONFLICT ("customerFacingLabel") DO UPDATE SET "updatedAt" = NOW()
       RETURNING id`,
      [id, label],
    )
    return result.rows[0].id
  }

  for (const row of vehicles) {
    const id = clean(row["Vehicle ID"])
    const make = clean(row.Make)
    const model = clean(row.Model)
    if (!id || !make || !model) continue
    const tierId = await ensureTier(row.Tier)
    await client.query(
      `INSERT INTO vehicle_lookups (id, make, model, "tierId", "updatedAt") VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (id) DO UPDATE SET make = EXCLUDED.make, model = EXCLUDED.model,
       "tierId" = EXCLUDED."tierId", "updatedAt" = NOW()`,
      [id, make, model, tierId],
    )
  }

  for (const row of brands) {
    const id = clean(row["Brand ID"])
    const brandName = clean(row["Brand Name"])
    if (!id || !brandName) continue
    const tierId = await ensureTier(row.Tier)
    const brandResult = await client.query(
      `INSERT INTO brand_lookups (id, "brandName", "tierId", "updatedAt") VALUES ($1, $2, $3, NOW())
       ON CONFLICT ("brandName") DO UPDATE SET "tierId" = EXCLUDED."tierId", "updatedAt" = NOW()
       RETURNING id`,
      [id, brandName, tierId],
    )
    const brandId = brandResult.rows[0].id
    for (const categoryName of splitValues(row["Product Categories"])) {
      let categoryResult = await client.query(
        `SELECT id FROM product_categories WHERE LOWER(name) = LOWER($1) ORDER BY id LIMIT 1`,
        [categoryName],
      )
      if (!categoryResult.rowCount) {
        categoryResult = await client.query(
          `INSERT INTO product_categories (id, name, "updatedAt") VALUES ($1, $2, NOW())
           ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name RETURNING id`,
          [stableId("category", categoryName), categoryName],
        )
      }
      await client.query(
        `INSERT INTO brand_lookup_categories ("brandId", "categoryId") VALUES ($1, $2)
         ON CONFLICT ("brandId", "categoryId") DO NOTHING`,
        [brandId, categoryResult.rows[0].id],
      )
    }
  }

  for (const row of grades) {
    const label = clean(row["Customer-Facing Label"])
    if (!label) continue
    const description = clean(row.Description) || null
    await client.query(
      `INSERT INTO grade_lookups (id, "customerFacingLabel", description, "updatedAt") VALUES ($1, $2, $3, NOW())
       ON CONFLICT ("customerFacingLabel") DO UPDATE SET description = EXCLUDED.description, "updatedAt" = NOW()`,
      [stableId("grade", label), label, description],
    )
  }

  await client.query("COMMIT")
  process.stdout.write(
    `Imported ${categories.length} categories, ${vehicles.length} vehicles, ${brands.length} brands, and ${grades.length} grades.\n`,
  )
} catch (error) {
  await client.query("ROLLBACK")
  throw error
} finally {
  await client.end()
}
