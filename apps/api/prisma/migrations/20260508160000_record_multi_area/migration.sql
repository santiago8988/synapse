-- Multi-area en Record: pasa de FK simple `Record.areaId` (single area) a
-- junction table `RecordArea` (N areas por record).
--
-- Backfill: cada Record con areaId != null pasa a tener un row en RecordArea.
-- Records sin area (areaId IS NULL) quedan sin areas (consistente con el
-- comportamiento anterior).
--
-- ROLLBACK: solo via restore. Pero el cambio es reversible lógicamente —
-- si alguna vez se quiere volver a single-area, se puede crear una migración
-- inversa que recree areaId y backfille con el primer area de RecordArea.

-- 1. Crear tabla RecordArea
CREATE TABLE "RecordArea" (
  "recordId" TEXT NOT NULL,
  "areaId"   TEXT NOT NULL,

  CONSTRAINT "RecordArea_pkey" PRIMARY KEY ("recordId", "areaId")
);

CREATE INDEX "RecordArea_areaId_idx" ON "RecordArea"("areaId");

ALTER TABLE "RecordArea"
  ADD CONSTRAINT "RecordArea_recordId_fkey"
  FOREIGN KEY ("recordId") REFERENCES "Record"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RecordArea"
  ADD CONSTRAINT "RecordArea_areaId_fkey"
  FOREIGN KEY ("areaId") REFERENCES "Area"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 2. Backfill: cada Record con areaId existente → row en RecordArea.
INSERT INTO "RecordArea" ("recordId", "areaId")
SELECT id, "areaId"
FROM "Record"
WHERE "areaId" IS NOT NULL;

-- 3. Drop columna Record.areaId (ya migrada).
ALTER TABLE "Record" DROP COLUMN "areaId";
