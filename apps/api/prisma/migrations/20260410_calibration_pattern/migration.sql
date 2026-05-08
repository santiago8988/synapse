-- No-op en DBs frescas: calibration_templates ya gestiona CalibrationPattern.
-- Solo corre si la DB viene de un estado anterior donde Calibration tenía
-- patternEntryId pero no existía la tabla CalibrationPattern todavía.
-- Esta migración originalmente: removía CALIBRATION del enum RecordType y
-- agregaba patternEntryId a Calibration. La parte del enum solo aplica si
-- todavía está presente.
DO $$
BEGIN
  -- Quitar CALIBRATION del enum RecordType si está
  IF EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'RecordType' AND e.enumlabel = 'CALIBRATION'
  ) THEN
    CREATE TYPE "RecordType_new" AS ENUM ('PERIODIC', 'NOT_PERIODIC', 'NOT_PERIODIC_WITH_REVISION', 'INSTRUMENTAL', 'BATCH', 'SAMPLE', 'STOCK');
    ALTER TABLE "Record" ALTER COLUMN "type" TYPE "RecordType_new" USING ("type"::text::"RecordType_new");
    ALTER TYPE "RecordType" RENAME TO "RecordType_old";
    ALTER TYPE "RecordType_new" RENAME TO "RecordType";
    DROP TYPE "RecordType_old";
  END IF;

  -- Agregar patternEntryId solo si Calibration aún no tiene la columna y CalibrationPattern no existe
  -- (en DBs frescas templates ya hizo el trabajo, así que esta rama no entra)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'Calibration' AND column_name = 'patternEntryId'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'CalibrationPattern'
  ) THEN
    ALTER TABLE "Calibration" ADD COLUMN "patternEntryId" TEXT;
    CREATE INDEX "Calibration_patternEntryId_idx" ON "Calibration"("patternEntryId");
    ALTER TABLE "Calibration" ADD CONSTRAINT "Calibration_patternEntryId_fkey" FOREIGN KEY ("patternEntryId") REFERENCES "Entry"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
