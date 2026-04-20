/*
  Warnings:

  - You are about to drop the column `matrix` on the `Sample` table. All the data in the column will be lost.

*/
-- AlterEnum
ALTER TYPE "ApprovableEntity" ADD VALUE 'MATRIX';

-- AlterTable
ALTER TABLE "Record" ADD COLUMN     "matrixId" TEXT;

-- AlterTable
ALTER TABLE "Sample" DROP COLUMN "matrix",
ADD COLUMN     "matrixId" TEXT;

-- CreateTable
CREATE TABLE "Matrix" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "description" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" "RecordStatus" NOT NULL DEFAULT 'DRAFT',
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Matrix_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MatrixParameter" (
    "id" TEXT NOT NULL,
    "matrixId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "method" TEXT,
    "unit" TEXT,
    "minValue" DOUBLE PRECISION,
    "maxValue" DOUBLE PRECISION,
    "order" INTEGER NOT NULL,

    CONSTRAINT "MatrixParameter_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Matrix_organizationId_idx" ON "Matrix"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "Matrix_organizationId_code_key" ON "Matrix"("organizationId", "code");

-- CreateIndex
CREATE INDEX "MatrixParameter_matrixId_idx" ON "MatrixParameter"("matrixId");

-- AddForeignKey
ALTER TABLE "Record" ADD CONSTRAINT "Record_matrixId_fkey" FOREIGN KEY ("matrixId") REFERENCES "Matrix"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sample" ADD CONSTRAINT "Sample_matrixId_fkey" FOREIGN KEY ("matrixId") REFERENCES "Matrix"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Matrix" ADD CONSTRAINT "Matrix_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatrixParameter" ADD CONSTRAINT "MatrixParameter_matrixId_fkey" FOREIGN KEY ("matrixId") REFERENCES "Matrix"("id") ON DELETE CASCADE ON UPDATE CASCADE;
