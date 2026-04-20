-- AlterTable Record
ALTER TABLE "Record" ADD COLUMN "isSystem" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable RecordField
ALTER TABLE "RecordField" ADD COLUMN "isProtected" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "systemKey" TEXT;

-- AlterTable StockMovement: add product column, migrate data, drop recipeId
ALTER TABLE "StockMovement" ADD COLUMN "product" TEXT;
UPDATE "StockMovement" sm SET "product" = COALESCE(
  (SELECT r."code" FROM "Recipe" r WHERE r.id = sm."recipeId"),
  sm."lotNumber"
) WHERE sm."product" IS NULL;
UPDATE "StockMovement" SET "product" = "lotNumber" WHERE "product" IS NULL;
ALTER TABLE "StockMovement" ALTER COLUMN "product" SET NOT NULL;

-- DropForeignKey
ALTER TABLE "StockMovement" DROP CONSTRAINT "StockMovement_recipeId_fkey";

-- DropIndex
DROP INDEX "StockMovement_recipeId_idx";

-- Drop old column
ALTER TABLE "StockMovement" DROP COLUMN "recipeId";

-- CreateIndex
CREATE INDEX "StockMovement_product_idx" ON "StockMovement"("product");
