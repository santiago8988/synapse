-- No-op en DBs frescas: calibration_templates ya crea Calibration con entryId.
-- Solo corre si la DB viene del estado legacy donde Calibration tenía instrumentId.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'Calibration' AND column_name = 'instrumentId'
  ) THEN
    DELETE FROM "Calibration";
    ALTER TABLE "Calibration" DROP CONSTRAINT IF EXISTS "Calibration_instrumentId_fkey";
    DROP INDEX IF EXISTS "Calibration_instrumentId_idx";
    ALTER TABLE "Calibration" DROP COLUMN "instrumentId";
    ALTER TABLE "Calibration" ADD COLUMN "entryId" TEXT NOT NULL DEFAULT '';
    ALTER TABLE "Calibration" ALTER COLUMN "entryId" DROP DEFAULT;
    CREATE INDEX IF NOT EXISTS "Calibration_entryId_idx" ON "Calibration"("entryId");
    ALTER TABLE "Calibration" ADD CONSTRAINT "Calibration_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "Entry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
