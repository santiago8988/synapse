-- AlterEnum: remove CALIBRATION from RecordType
BEGIN;
CREATE TYPE "RecordType_new" AS ENUM ('PERIODIC', 'NOT_PERIODIC', 'NOT_PERIODIC_WITH_REVISION', 'INSTRUMENTAL', 'BATCH', 'SAMPLE', 'STOCK');
ALTER TABLE "Record" ALTER COLUMN "type" TYPE "RecordType_new" USING ("type"::text::"RecordType_new");
ALTER TYPE "RecordType" RENAME TO "RecordType_old";
ALTER TYPE "RecordType_new" RENAME TO "RecordType";
DROP TYPE "public"."RecordType_old";
COMMIT;

-- Add patternEntryId to Calibration
ALTER TABLE "Calibration" ADD COLUMN "patternEntryId" TEXT;
CREATE INDEX "Calibration_patternEntryId_idx" ON "Calibration"("patternEntryId");
ALTER TABLE "Calibration" ADD CONSTRAINT "Calibration_patternEntryId_fkey" FOREIGN KEY ("patternEntryId") REFERENCES "Entry"("id") ON DELETE SET NULL ON UPDATE CASCADE;
