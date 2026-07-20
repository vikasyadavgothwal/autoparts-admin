import pg from "pg"

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required")

const parts = [
  {
    partUid: "verified-tata-tiago-542442990107",
    partNumber: "542442990107",
    partName: "Tata Tiago Genuine Front Brake Pad Set",
    category: "Tiago Brake Pads",
    engine: "1.2L Petrol / 1.0L Diesel",
    sourceUrl: "https://mechdeals.com/product-detail/kit-pad-66484",
  },
  {
    partUid: "verified-tata-tiago-571518130101",
    partNumber: "571518130101",
    partName: "Tata Tiago Genuine Engine Oil Filter",
    category: "Tiago Oil Filters",
    engine: "1.2L Revotron Petrol",
    sourceUrl: "https://mechdeals.com/product-detail/oil-filter-assy-37457",
  },
]

const client = new pg.Client({ connectionString: process.env.DATABASE_URL })
await client.connect()
try {
  await client.query("BEGIN")
  for (const part of parts) {
    await client.query(
      `INSERT INTO part_master
        (id, "partUid", source, "sourcePartId", "partNumber", "normalizedPartNumber",
         "partNumberOriginal", "brandName", "partName", category, "createdAt", "updatedAt")
       VALUES ($1, $2, 'verified_tata_catalog', $3, $4, $4, $4, 'Tata Motors', $5, $6, NOW(), NOW())
       ON CONFLICT ("partUid") DO UPDATE SET
         source = EXCLUDED.source, "sourcePartId" = EXCLUDED."sourcePartId",
         "partNumber" = EXCLUDED."partNumber", "normalizedPartNumber" = EXCLUDED."normalizedPartNumber",
         "partNumberOriginal" = EXCLUDED."partNumberOriginal", "brandName" = EXCLUDED."brandName",
         "partName" = EXCLUDED."partName", category = EXCLUDED.category, "updatedAt" = NOW()`,
      [`master-${part.partNumber}`, part.partUid, part.sourceUrl, part.partNumber, part.partName, part.category],
    )
    await client.query(
      `INSERT INTO part_number_index
        (id, "partUid", "numberOriginal", "numberNormalized", "numberType", brand, source, "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $3, 'oem', 'Tata Motors', 'verified_tata_catalog', NOW(), NOW())
       ON CONFLICT ("partUid", "numberNormalized", "numberType") DO UPDATE SET
         brand = EXCLUDED.brand, source = EXCLUDED.source, "updatedAt" = NOW()`,
      [`number-${part.partNumber}`, part.partUid, part.partNumber],
    )
    await client.query(
      `INSERT INTO master_fitment
        (id, "partUid", source, brand, make, model, "yearFrom", "yearTo", engine, "fuelType", "createdAt", "updatedAt")
       VALUES ($1, $2, 'verified_tata_catalog', 'Tata Motors', 'Tata', 'Tiago', 2016, 2026, $3, $4, NOW(), NOW())
       ON CONFLICT (id) DO UPDATE SET
         "yearFrom" = EXCLUDED."yearFrom", "yearTo" = EXCLUDED."yearTo",
         engine = EXCLUDED.engine, "fuelType" = EXCLUDED."fuelType", "updatedAt" = NOW()`,
      [
        `fitment-${part.partNumber}`,
        part.partUid,
        part.engine,
        part.partNumber === "571518130101" ? "Petrol" : null,
      ],
    )
  }
  await client.query("COMMIT")
  process.stdout.write(`Seeded ${parts.length} verified Tata Tiago master products.\n`)
} catch (error) {
  await client.query("ROLLBACK")
  throw error
} finally {
  await client.end()
}
