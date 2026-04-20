-- AlterTable
ALTER TABLE "RecipeIngredient" ADD COLUMN     "fromStock" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "stockRecipeId" TEXT;

-- AddForeignKey
ALTER TABLE "RecipeIngredient" ADD CONSTRAINT "RecipeIngredient_stockRecipeId_fkey" FOREIGN KEY ("stockRecipeId") REFERENCES "Recipe"("id") ON DELETE SET NULL ON UPDATE CASCADE;
