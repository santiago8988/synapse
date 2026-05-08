-- AlterEnum
ALTER TYPE "FieldType" ADD VALUE 'MATRIX_METHOD';

-- DropForeignKey
ALTER TABLE "Record" DROP CONSTRAINT "Record_matrixId_fkey";

-- AlterTable
ALTER TABLE "Record" DROP COLUMN "matrixId";

-- AlterTable
ALTER TABLE "Sample" ADD COLUMN     "conditions" JSONB,
ADD COLUMN     "methodIds" TEXT[];

-- CreateTable
CREATE TABLE "MatrixCondition" (
    "id" TEXT NOT NULL,
    "matrixId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "fieldType" TEXT NOT NULL,
    "unit" TEXT,
    "options" TEXT[],
    "order" INTEGER NOT NULL,

    CONSTRAINT "MatrixCondition_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MatrixCondition_matrixId_idx" ON "MatrixCondition"("matrixId");

-- AddForeignKey
ALTER TABLE "MatrixCondition" ADD CONSTRAINT "MatrixCondition_matrixId_fkey" FOREIGN KEY ("matrixId") REFERENCES "Matrix"("id") ON DELETE CASCADE ON UPDATE CASCADE;
