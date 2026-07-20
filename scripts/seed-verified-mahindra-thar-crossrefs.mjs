import pg from "pg"

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required")

const client = new pg.Client({ connectionString: process.env.DATABASE_URL })
const partUid = "verified-mahindra-thar-air-filter-f002h23584"
await client.connect()
try {
  await client.query("BEGIN")
  await client.query(
    `INSERT INTO part_master
      (id, "partUid", source, "sourcePartId", "partNumber", "normalizedPartNumber",
       "partNumberOriginal", "brandName", "partName", category, "groupId", "groupName",
       "createdAt", "updatedAt")
     VALUES
      ('master-mahindra-thar-f002h23584', $1, 'verified_bosch_catalog', $2,
       'F002H23584', 'F002H23584', 'F 002 H23 584', 'Bosch',
       'Mahindra Thar Bosch Engine Air Filter', 'Thar Air Filters', '185', 'Filters', NOW(), NOW())
     ON CONFLICT ("partUid") DO UPDATE SET
       source=EXCLUDED.source, "sourcePartId"=EXCLUDED."sourcePartId",
       "partNumber"=EXCLUDED."partNumber", "normalizedPartNumber"=EXCLUDED."normalizedPartNumber",
       "partNumberOriginal"=EXCLUDED."partNumberOriginal", "brandName"=EXCLUDED."brandName",
       "partName"=EXCLUDED."partName", category=EXCLUDED.category,
       "groupId"=EXCLUDED."groupId", "groupName"=EXCLUDED."groupName", "updatedAt"=NOW()`,
    [
      partUid,
      "https://www.boschaftermarket.com/xrm/media/images/country_specific/in/services_and_support_1/downloads_10/pdf_5/pc_filter_catalogue.pdf",
    ],
  )
  for (const number of [
    { value: "F002H23584", original: "F 002 H23 584", type: "brand_part_number", brand: "Bosch" },
    { value: "0313AC0280N", original: "0313AC0280N", type: "oem", brand: "Mahindra" },
    { value: "0313AAM01480N", original: "0313AAM01480N", type: "oem", brand: "Mahindra" },
  ]) {
    await client.query(
      `INSERT INTO part_number_index
        (id, "partUid", "numberOriginal", "numberNormalized", "numberType", brand, source, "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6, 'verified_bosch_catalog', NOW(), NOW())
       ON CONFLICT ("partUid", "numberNormalized", "numberType") DO UPDATE SET
         "numberOriginal"=EXCLUDED."numberOriginal", brand=EXCLUDED.brand,
         source=EXCLUDED.source, "updatedAt"=NOW()`,
      [`number-thar-${number.value.toLowerCase()}`, partUid, number.original, number.value, number.type, number.brand],
    )
  }
  await client.query(
    `INSERT INTO master_fitment
      (id, "partUid", source, brand, make, model, series, "yearFrom", "yearTo", engine,
       "fuelType", "bodyType", "createdAt", "updatedAt")
     VALUES
      ('fitment-mahindra-thar-f002h23584', $1, 'verified_bosch_catalog', 'Mahindra',
       'Mahindra', 'Thar', '2.5D 4x4 / 2.5 TD', 2010, 2019,
       '2.5L Diesel', 'Diesel', 'SUV', NOW(), NOW())
     ON CONFLICT (id) DO UPDATE SET
       "yearFrom"=EXCLUDED."yearFrom", "yearTo"=EXCLUDED."yearTo",
       engine=EXCLUDED.engine, "fuelType"=EXCLUDED."fuelType", "updatedAt"=NOW()`,
    [partUid],
  )
  await client.query("COMMIT")
  process.stdout.write("Seeded verified Mahindra Thar Bosch/OEM cross-references.\n")
} catch (error) {
  await client.query("ROLLBACK")
  throw error
} finally {
  await client.end()
}
