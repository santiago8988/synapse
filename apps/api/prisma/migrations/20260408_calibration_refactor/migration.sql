-- No-op en DBs frescas: calibration_templates ya crea Calibration en estado final
-- (con dueDate, sin recordId) y CalibrationTemplate con periodicity/notifyDaysBefore.
-- Solo corre si la DB viene del estado legacy.
DO $$
BEGIN
  -- Refactor legacy: Calibration tenía entryId+recordId sin dueDate.
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'Calibration' AND column_name = 'recordId'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'Calibration' AND column_name = 'dueDate'
  ) THEN
    DELETE FROM "Calibration";
    ALTER TABLE "Calibration" DROP CONSTRAINT IF EXISTS "Calibration_entryId_fkey";
    ALTER TABLE "Calibration" DROP CONSTRAINT IF EXISTS "Calibration_recordId_fkey";
    DROP INDEX IF EXISTS "Calibration_entryId_key";
    DROP INDEX IF EXISTS "Calibration_recordId_idx";
    ALTER TABLE "Calibration"
      DROP COLUMN IF EXISTS "entryId",
      DROP COLUMN IF EXISTS "recordId",
      ADD COLUMN "dueDate" TIMESTAMP(3),
      ADD COLUMN "instrumentId" TEXT NOT NULL DEFAULT '';
    ALTER TABLE "Calibration" ALTER COLUMN "instrumentId" DROP DEFAULT;
    CREATE INDEX IF NOT EXISTS "Calibration_instrumentId_idx" ON "Calibration"("instrumentId");
    ALTER TABLE "Calibration" ADD CONSTRAINT "Calibration_instrumentId_fkey" FOREIGN KEY ("instrumentId") REFERENCES "Instrument"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  -- Agregar periodicity/notifyDaysBefore a CalibrationTemplate si faltan.
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'CalibrationTemplate' AND column_name = 'notifyDaysBefore'
  ) THEN
    ALTER TABLE "CalibrationTemplate" ADD COLUMN "notifyDaysBefore" INTEGER, ADD COLUMN "periodicity" INTEGER;
  END IF;
END $$;
