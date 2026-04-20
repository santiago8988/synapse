-- AlterEnum
ALTER TYPE "FieldType" ADD VALUE 'RECIPE_SELECT';

-- DropForeignKey
ALTER TABLE "Record" DROP CONSTRAINT "Record_recipeId_fkey";

-- AlterTable
ALTER TABLE "Record" DROP COLUMN "recipeId";
