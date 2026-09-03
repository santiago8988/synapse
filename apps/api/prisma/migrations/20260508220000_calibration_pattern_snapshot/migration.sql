-- Snapshot de datos descriptivos del patrón en CalibrationPattern.
-- Preserva la evidencia ISO: una calibración cerrada NO debe reflejar
-- cambios posteriores al instrumento patrón (renombre, status, etc.).
-- Migración aditiva — todas las columnas son nullable.

ALTER TABLE "CalibrationPattern" ADD COLUMN "snapshotIdentifier"        TEXT;
ALTER TABLE "CalibrationPattern" ADD COLUMN "snapshotRecordName"        TEXT;
ALTER TABLE "CalibrationPattern" ADD COLUMN "snapshotInstrumentStatus"  TEXT;
ALTER TABLE "CalibrationPattern" ADD COLUMN "snapshotNextCalibrationAt" TIMESTAMP(3);

-- Backfill best-effort de los rows preexistentes con la realidad actual.
-- Se acepta que esto NO refleja el estado del momento de selección original
-- (esa info se perdió porque no se guardaba). Es la mejor aproximación para
-- que el frontend tenga algo que mostrar en patterns viejos.
--
-- Identifier: tomamos el primer field con isIdentifier=true del record, y
-- buscamos el valor en Entry.data por su id.
UPDATE "CalibrationPattern" cp
SET
  "snapshotInstrumentStatus" = i."status"::text,
  "snapshotNextCalibrationAt" = i."nextCalibrationAt",
  "snapshotRecordName" = r."name"
FROM "Entry" e
JOIN "Record" r ON r."id" = e."recordId"
LEFT JOIN "Instrument" i ON i."entryId" = e."id"
WHERE cp."patternEntryId" = e."id";

-- Identifier: buscar el field isIdentifier del record y extraer su valor de Entry.data.
UPDATE "CalibrationPattern" cp
SET "snapshotIdentifier" = e."data" ->> rf."id"
FROM "Entry" e
JOIN "RecordField" rf ON rf."recordId" = e."recordId" AND rf."isIdentifier" = TRUE AND rf."isActive" = TRUE
WHERE cp."patternEntryId" = e."id"
  AND cp."snapshotIdentifier" IS NULL;
