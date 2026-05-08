-- Records-as-Lists — Collapse Instrument
--
-- Fase 2 del colapso de companions. Migración DESTRUCTIVA con backfill:
--   1) Asegura que cada Record type=INSTRUMENTAL tenga un field DROPDOWN
--      con isStatus=true (auto-creado si falta).
--   2) Migra `Instrument.status` a `Entry.data[<statusFieldId>]` y preserva
--      `nextCalibrationAt` en `Entry.data.nextCalibrationAt`.
--   3) Migra cada `InstrumentStatusLog` row a `EntryStatusLog` resolviendo
--      el statusFieldId por record.
--   4) DROP TABLE InstrumentStatusLog, DROP TABLE Instrument, DROP TYPE
--      InstrumentStatus.
--
-- ROLLBACK: solo via restore de DB. Antes de aplicar en producción → snapshot
-- obligatorio.
--
-- EXCEPCIÓN APPEND-ONLY ISO: la regla NUNCA-HACER #4 prohíbe DROP de
-- InstrumentStatusLog. Se justifica acá porque el contenido se preserva 100%
-- en EntryStatusLog (también append-only). Validar con iso-compliance-auditor.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. Auto-add field ESTADO (DROPDOWN, isStatus, transitions canónicas) en
--    cada Record INSTRUMENTAL que no tenga uno.
DO $$
DECLARE
  rec RECORD;
  new_field_id TEXT;
  next_order INT;
  canonical_config JSONB := '{
    "isStatus": true,
    "options": [
      { "value": "ACTIVE", "label": "Activo", "color": "green", "isInitial": true },
      { "value": "IN_CALIBRATION", "label": "En calibración", "color": "blue" },
      { "value": "IN_REPAIR", "label": "En reparación", "color": "amber" },
      { "value": "DECOMMISSIONED", "label": "Dado de baja", "color": "red", "isFinal": true }
    ],
    "transitions": [
      { "from": "ACTIVE", "to": "IN_CALIBRATION" },
      { "from": "ACTIVE", "to": "IN_REPAIR" },
      { "from": "ACTIVE", "to": "DECOMMISSIONED", "requireReason": true },
      { "from": "IN_CALIBRATION", "to": "ACTIVE" },
      { "from": "IN_CALIBRATION", "to": "IN_REPAIR" },
      { "from": "IN_REPAIR", "to": "ACTIVE" },
      { "from": "IN_REPAIR", "to": "DECOMMISSIONED", "requireReason": true }
    ]
  }'::jsonb;
BEGIN
  FOR rec IN
    SELECT r.id
    FROM "Record" r
    WHERE r.type = 'INSTRUMENTAL'
      AND NOT EXISTS (
        SELECT 1
        FROM "RecordField" f
        WHERE f."recordId" = r.id
          AND f."fieldType" = 'DROPDOWN'
          AND f."isActive" = true
          AND (f."comparisonConfig"::jsonb @> '{"isStatus": true}'::jsonb)
      )
  LOOP
    SELECT COALESCE(MAX("order"), -1) + 1 INTO next_order
    FROM "RecordField"
    WHERE "recordId" = rec.id;

    new_field_id := gen_random_uuid()::text;

    INSERT INTO "RecordField" (
      id, "recordId", label, "fieldType", "order",
      "isIdentifier", "isRequired", "isActive", "addedInVersion",
      "comparisonConfig"
    ) VALUES (
      new_field_id, rec.id, 'ESTADO', 'DROPDOWN', next_order,
      false, true, true, 1,
      canonical_config
    );
  END LOOP;
END $$;

-- 2. Backfill Entry.data con el status legacy (resolved al statusFieldId del
--    record correspondiente) + nextCalibrationAt.
DO $$
DECLARE
  inst RECORD;
  status_field_id TEXT;
BEGIN
  FOR inst IN
    SELECT i.id, i."entryId", i."recordId", i.status::text AS status_text, i."nextCalibrationAt"
    FROM "Instrument" i
  LOOP
    SELECT f.id INTO status_field_id
    FROM "RecordField" f
    WHERE f."recordId" = inst."recordId"
      AND f."isActive" = true
      AND f."fieldType" = 'DROPDOWN'
      AND f."comparisonConfig"::jsonb @> '{"isStatus": true}'::jsonb
    LIMIT 1;

    IF status_field_id IS NOT NULL THEN
      UPDATE "Entry"
      SET data = COALESCE(data, '{}'::jsonb)
                 || jsonb_build_object(status_field_id, inst.status_text)
                 || CASE WHEN inst."nextCalibrationAt" IS NOT NULL
                         THEN jsonb_build_object('nextCalibrationAt', inst."nextCalibrationAt")
                         ELSE '{}'::jsonb
                    END
      WHERE id = inst."entryId";
    END IF;
  END LOOP;
END $$;

-- 3. Backfill EntryStatusLog desde InstrumentStatusLog. El paper trail ISO se
--    preserva — solo cambia de tabla destino.
DO $$
DECLARE
  log RECORD;
  status_field_id TEXT;
BEGIN
  FOR log IN
    SELECT l.id, l."instrumentId",
           l."fromStatus"::text AS from_text,
           l."toStatus"::text   AS to_text,
           l.reason, l."changedById", l."changedAt",
           i."entryId", i."recordId", i."organizationId"
    FROM "InstrumentStatusLog" l
    JOIN "Instrument" i ON i.id = l."instrumentId"
  LOOP
    SELECT f.id INTO status_field_id
    FROM "RecordField" f
    WHERE f."recordId" = log."recordId"
      AND f."isActive" = true
      AND f."fieldType" = 'DROPDOWN'
      AND f."comparisonConfig"::jsonb @> '{"isStatus": true}'::jsonb
    LIMIT 1;

    IF status_field_id IS NOT NULL THEN
      INSERT INTO "EntryStatusLog" (
        id, "entryId", "recordId", "organizationId",
        "fieldId", "fromValue", "toValue",
        "changedById", "triggeredByCascade", reason, "createdAt"
      ) VALUES (
        gen_random_uuid()::text,
        log."entryId", log."recordId", log."organizationId",
        status_field_id, log.from_text, log.to_text,
        log."changedById", false, log.reason, log."changedAt"
      );
    END IF;
  END LOOP;
END $$;

-- 4. DROP destructivo (orden importa: log primero por las FKs).
DROP TABLE "InstrumentStatusLog";
DROP TABLE "Instrument";
DROP TYPE "InstrumentStatus";
