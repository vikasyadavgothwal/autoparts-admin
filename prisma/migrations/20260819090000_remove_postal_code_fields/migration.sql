ALTER TABLE "users" DROP COLUMN IF EXISTS "postalCode";

ALTER TABLE "user_addresses" DROP COLUMN IF EXISTS "postalCode";

ALTER TABLE "orders" DROP COLUMN IF EXISTS "deliveryPostalCode";

ALTER TABLE "garage_profiles" DROP COLUMN IF EXISTS "pincode";
