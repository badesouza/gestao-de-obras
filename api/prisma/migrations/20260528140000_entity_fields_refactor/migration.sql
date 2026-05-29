-- Drop slug and city; add legal representative and IBGE locality fields
DROP INDEX IF EXISTS "entities_slug_key";

ALTER TABLE "entities" DROP COLUMN "slug";
ALTER TABLE "entities" DROP COLUMN "city";

ALTER TABLE "entities" ADD COLUMN "legal_representative_name" TEXT;
ALTER TABLE "entities" ADD COLUMN "uf" CHAR(2);
ALTER TABLE "entities" ADD COLUMN "municipality_id" INTEGER;
ALTER TABLE "entities" ADD COLUMN "municipality_name" TEXT;
