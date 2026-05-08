-- No-op en DBs frescas: CalibrationPattern ya fue creada por calibration_templates.
-- Solo corre si la DB viene del estado legacy donde Calibration tenía patternEntryId
-- y la tabla CalibrationPattern aún no existía.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'Calibration' AND column_name = 'patternEntryId'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'CalibrationPattern'
  ) THEN
    -- CreateTable
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
    CREATE UNIQUE INDEX "CalibrationPattern_calibrationId_patternEntryId_key" ON "CalibrationPattern"("calibrationId", "patternEntryId");
    CREATE INDEX "CalibrationPattern_calibrationId_idx" ON "CalibrationPattern"("calibrationId");
    CREATE INDEX "CalibrationPattern_patternEntryId_idx" ON "CalibrationPattern"("patternEntryId");

    -- AddForeignKey
    ALTER TABLE "CalibrationPattern" ADD CONSTRAINT "CalibrationPattern_calibrationId_fkey" FOREIGN KEY ("calibrationId") REFERENCES "Calibration"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    ALTER TABLE "CalibrationPattern" ADD CONSTRAINT "CalibrationPattern_patternEntryId_fkey" FOREIGN KEY ("patternEntryId") REFERENCES "Entry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

    -- Migrar datos existentes
    INSERT INTO "CalibrationPattern" ("id", "calibrationId", "patternEntryId", "createdAt")
    SELECT
        'cp_' || substr(md5(random()::text || clock_timestamp()::text), 1, 24),
        "id",
        "patternEntryId",
        NOW()
    FROM "Calibration"
    WHERE "patternEntryId" IS NOT NULL;

    -- Drop old FK, index y columna
    ALTER TABLE "Calibration" DROP CONSTRAINT IF EXISTS "Calibration_patternEntryId_fkey";
    DROP INDEX IF EXISTS "Calibration_patternEntryId_idx";
    ALTER TABLE "Calibration" DROP COLUMN "patternEntryId";
  END IF;
END $$;
