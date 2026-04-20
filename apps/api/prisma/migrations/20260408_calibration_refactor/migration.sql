-- Delete any existing calibrations (none should exist yet)
DELETE FROM "Calibration";

-- DropForeignKey
ALTER TABLE "Calibration" DROP CONSTRAINT IF EXISTS "Calibration_entryId_fkey";
ALTER TABLE "Calibration" DROP CONSTRAINT IF EXISTS "Calibration_recordId_fkey";

-- DropIndex
DROP INDEX IF EXISTS "Calibration_entryId_key";
DROP INDEX IF EXISTS "Calibration_recordId_idx";

-- AlterTable Calibration
ALTER TABLE "Calibration" DROP COLUMN IF EXISTS "entryId",
DROP COLUMN IF EXISTS "recordId",
ADD COLUMN "dueDate" TIMESTAMP(3),
ADD COLUMN "instrumentId" TEXT NOT NULL DEFAULT '';

-- Remove default after adding
ALTER TABLE "Calibration" ALTER COLUMN "instrumentId" DROP DEFAULT;

-- AlterTable CalibrationTemplate
ALTER TABLE "CalibrationTemplate" ADD COLUMN "notifyDaysBefore" INTEGER,
ADD COLUMN "periodicity" INTEGER;

-- CreateIndex
CREATE INDEX "Calibration_instrumentId_idx" ON "Calibration"("instrumentId");

-- AddForeignKey
ALTER TABLE "Calibration" ADD CONSTRAINT "Calibration_instrumentId_fkey" FOREIGN KEY ("instrumentId") REFERENCES "Instrument"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
