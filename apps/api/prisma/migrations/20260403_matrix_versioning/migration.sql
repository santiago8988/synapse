-- DropIndex
DROP INDEX "Matrix_organizationId_code_key";

-- AlterTable
ALTER TABLE "Matrix" ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true;
