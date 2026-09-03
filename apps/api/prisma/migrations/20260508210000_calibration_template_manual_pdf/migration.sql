-- Manual de verificación interna (PDF) asociado a la plantilla de
-- calibración. Lo consulta el técnico al ejecutar la calibración.
-- Migración aditiva — sin backfill.

ALTER TABLE "CalibrationTemplate" ADD COLUMN "manualPdfUrl"        TEXT;
ALTER TABLE "CalibrationTemplate" ADD COLUMN "manualPdfKey"        TEXT;
ALTER TABLE "CalibrationTemplate" ADD COLUMN "manualPdfName"       TEXT;
ALTER TABLE "CalibrationTemplate" ADD COLUMN "manualPdfSize"       INTEGER;
ALTER TABLE "CalibrationTemplate" ADD COLUMN "manualPdfUploadedAt" TIMESTAMP(3);
