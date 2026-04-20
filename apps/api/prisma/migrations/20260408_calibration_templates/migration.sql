-- CreateEnum
CREATE TYPE "CalibrationStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED', 'APPROVED', 'REJECTED');

-- AlterEnum
ALTER TYPE "ApprovableEntity" ADD VALUE 'CALIBRATION_TEMPLATE';

-- AlterEnum
ALTER TYPE "FieldType" ADD VALUE 'CALIBRATION_TEMPLATE';

-- AlterEnum
ALTER TYPE "RecordType" ADD VALUE 'CALIBRATION';

-- CreateTable
CREATE TABLE "CalibrationTemplate" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "description" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" "RecordStatus" NOT NULL DEFAULT 'DRAFT',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "unitMain" TEXT,
    "unitTolerance" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CalibrationTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CalibrationTest" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "order" INTEGER NOT NULL,
    "tolerance" DOUBLE PRECISION,
    "toleranceUnit" TEXT,
    "readingsPerPoint" INTEGER NOT NULL DEFAULT 3,
    "formulaError" TEXT,
    "criteriaOperator" TEXT,
    "notes" TEXT,

    CONSTRAINT "CalibrationTest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CalibrationPoint" (
    "id" TEXT NOT NULL,
    "testId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "load" DOUBLE PRECISION,
    "unit" TEXT,

    CONSTRAINT "CalibrationPoint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Calibration" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "recordId" TEXT NOT NULL,
    "status" "CalibrationStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "results" JSONB,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Calibration_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CalibrationTemplate_organizationId_idx" ON "CalibrationTemplate"("organizationId");

-- CreateIndex
CREATE INDEX "CalibrationTest_templateId_idx" ON "CalibrationTest"("templateId");

-- CreateIndex
CREATE INDEX "CalibrationPoint_testId_idx" ON "CalibrationPoint"("testId");

-- CreateIndex
CREATE UNIQUE INDEX "Calibration_entryId_key" ON "Calibration"("entryId");

-- CreateIndex
CREATE INDEX "Calibration_organizationId_idx" ON "Calibration"("organizationId");

-- CreateIndex
CREATE INDEX "Calibration_templateId_idx" ON "Calibration"("templateId");

-- CreateIndex
CREATE INDEX "Calibration_recordId_idx" ON "Calibration"("recordId");

-- AddForeignKey
ALTER TABLE "CalibrationTemplate" ADD CONSTRAINT "CalibrationTemplate_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalibrationTest" ADD CONSTRAINT "CalibrationTest_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "CalibrationTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalibrationPoint" ADD CONSTRAINT "CalibrationPoint_testId_fkey" FOREIGN KEY ("testId") REFERENCES "CalibrationTest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Calibration" ADD CONSTRAINT "Calibration_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Calibration" ADD CONSTRAINT "Calibration_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "CalibrationTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Calibration" ADD CONSTRAINT "Calibration_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "Entry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Calibration" ADD CONSTRAINT "Calibration_recordId_fkey" FOREIGN KEY ("recordId") REFERENCES "Record"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

