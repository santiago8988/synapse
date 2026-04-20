-- Llenar codes nulos con el id como fallback
UPDATE "Recipe" SET "code" = id WHERE "code" IS NULL;

-- AlterTable
ALTER TABLE "Recipe" ALTER COLUMN "code" SET NOT NULL;
