-- Crea todo el sistema de calibraciones en su estado FINAL.
-- Consolidación de varias migraciones legacy (entryid, refactor, pattern, multipattern)
-- que se aplicaban incrementalmente sobre un schema en evolución. Para DBs frescas
-- aplicamos directo el estado final aquí; las migraciones siguientes son no-ops
-- excepto cuando la DB viene del estado legacy intermedio.

-- CreateEnum
CREATE TYPE "CalibrationStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED', 'APPROVED', 'REJECTED');

-- AlterEnum
ALTER TYPE "ApprovableEntity" ADD VALUE 'CALIBRATION_TEMPLATE';

-- AlterEnum
ALTER TYPE "FieldType" ADD VALUE 'CALIBRATION_TEMPLATE';

-- AlterEnum (CALIBRATION existió temporalmente como RecordType pero fue removido en una migración posterior;
-- en el estado final NO está, así que NO se agrega aquí).

-- CreateTable CalibrationTemplate (con periodicity y notifyDaysBefore desde el inicio)
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
    "periodicity" INTEGER,
    "notifyDaysBefore" INTEGER,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CalibrationTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable CalibrationTest
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

-- CreateTable CalibrationPoint
CREATE TABLE "CalibrationPoint" (
    "id" TEXT NOT NULL,
    "testId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "load" DOUBLE PRECISION,
    "unit" TEXT,

    CONSTRAINT "CalibrationPoint_pkey" PRIMARY KEY ("id")
);

-- CreateTable Calibration (estado FINAL: con entryId no-único, dueDate, sin recordId,
-- sin instrumentId, sin patternEntryId)
CREATE TABLE "Calibration" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "status" "CalibrationStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "results" JSONB,
    "dueDate" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Calibration_pkey" PRIMARY KEY ("id")
);

-- CreateTable CalibrationPattern (consolidado desde calibration_multipattern)
CREATE TABLE "CalibrationPattern" (
    "id" TEXT NOT NULL,
    "calibrationId" TEXT NOT NULL,
    "patternEntryId" TEXT NOT NULL,
    "testId" TEXT,
    "pointId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CalibrationPattern_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CalibrationTemplate_organizationId_idx" ON "CalibrationTemplate"("organizationId");
CREATE INDEX "CalibrationTest_templateId_idx" ON "CalibrationTest"("templateId");
CREATE INDEX "CalibrationPoint_testId_idx" ON "CalibrationPoint"("testId");

-- entryId NO es único (muchas calibraciones pueden referenciar la misma entry)
CREATE INDEX "Calibration_entryId_idx" ON "Calibration"("entryId");
CREATE INDEX "Calibration_organizationId_idx" ON "Calibration"("organizationId");
CREATE INDEX "Calibration_templateId_idx" ON "Calibration"("templateId");

CREATE UNIQUE INDEX "CalibrationPattern_calibrationId_patternEntryId_key" ON "CalibrationPattern"("calibrationId", "patternEntryId");
CREATE INDEX "CalibrationPattern_calibrationId_idx" ON "CalibrationPattern"("calibrationId");
CREATE INDEX "CalibrationPattern_patternEntryId_idx" ON "CalibrationPattern"("patternEntryId");

-- AddForeignKey
ALTER TABLE "CalibrationTemplate" ADD CONSTRAINT "CalibrationTemplate_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CalibrationTest" ADD CONSTRAINT "CalibrationTest_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "CalibrationTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CalibrationPoint" ADD CONSTRAINT "CalibrationPoint_testId_fkey" FOREIGN KEY ("testId") REFERENCES "CalibrationTest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Calibration" ADD CONSTRAINT "Calibration_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Calibration" ADD CONSTRAINT "Calibration_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "CalibrationTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Calibration" ADD CONSTRAINT "Calibration_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "Entry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CalibrationPattern" ADD CONSTRAINT "CalibrationPattern_calibrationId_fkey" FOREIGN KEY ("calibrationId") REFERENCES "Calibration"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CalibrationPattern" ADD CONSTRAINT "CalibrationPattern_patternEntryId_fkey" FOREIGN KEY ("patternEntryId") REFERENCES "Entry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
