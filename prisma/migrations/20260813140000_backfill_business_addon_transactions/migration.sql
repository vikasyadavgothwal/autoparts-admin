INSERT INTO "business_payment_transactions" (
  "id",
  "businessAccountId",
  "payerUserId",
  "type",
  "sourceId",
  "sourceKey",
  "description",
  "amount",
  "currency",
  "status",
  "metadata",
  "createdAt"
)
SELECT
  'bpt-' || substr(md5(random()::text || clock_timestamp()::text || bar."id"), 1, 24),
  bar."businessAccountId",
  bar."requestedByUserId",
  'add_on',
  bar."id",
  bar."featureKey",
  'Add-on enabled: ' || bar."label",
  COALESCE(bar."priceAmount", 0),
  COALESCE(bar."priceCurrency", 'AED'),
  'Paid',
  jsonb_build_object(
    'featureKey', bar."featureKey",
    'label', bar."label",
    'priceQuantity', bar."priceQuantity",
    'unitPriceAmount', bar."unitPriceAmount",
    'validFrom', bar."validFrom",
    'validUntil', bar."validUntil",
    'renewalAt', bar."renewalAt",
    'backfilled', true
  ),
  COALESCE(bar."decidedAt", bar."createdAt")
FROM "business_add_on_requests" bar
WHERE bar."status" IN ('Approved', 'Enabled')
  AND NOT EXISTS (
    SELECT 1
    FROM "business_payment_transactions" bpt
    WHERE bpt."type" = 'add_on'
      AND bpt."sourceId" = bar."id"
  );
