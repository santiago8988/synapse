-- Delete any existing calibrations
DELETE FROM "Calibration";

-- Drop old constraints
ALTER TABLE "Calibration" DROP CONSTRAINT IF EXISTS "Calibration_instrumentId_fkey";
DROP INDEX IF EXISTS "Calibration_instrumentId_idx";

-- Replace instrumentId with entryId
ALTER TABLE "Calibration" DROP COLUMN IF EXISTS "instrumentId";
ALTER TABLE "Calibration" ADD COLUMN "entryId" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Calibration" ALTER COLUMN "entryId" DROP DEFAULT;

-- Create index and FK (not unique — many calibrations per entry)
CREATE INDEX "Calibration_entryId_idx" ON "Calibration"("entryId");
ALTER TABLE "Calibration" ADD CONSTRAINT "Calibration_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "Entry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
