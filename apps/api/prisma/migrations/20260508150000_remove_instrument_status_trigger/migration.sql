-- Visual Flow Editor — eliminar trigger INSTRUMENT_STATUS_CHANGED del enum
--
-- El trigger no tenía consumers reales (auditado en Fase 2). Lo eliminamos
-- del enum para limpiar la API del editor visual de flujos. Mismo patrón
-- que 20260507120000_revert_state_machine_columns.
--
-- Cualquier RecordAction.trigger con valor 'INSTRUMENT_STATUS_CHANGED'
-- (no debe haber ninguno en la DB) se castea a 'ENTRY_COMPLETED' (default).

CREATE TYPE "TriggerType_new" AS ENUM (
  'ENTRY_CREATED',
  'ENTRY_COMPLETED',
  'FIELD_VALUE_CHANGED',
  'COMPARISON_FAILED'
);

ALTER TABLE "RecordAction"
  ALTER COLUMN "trigger" DROP DEFAULT,
  ALTER COLUMN "trigger" TYPE "TriggerType_new" USING (
    CASE "trigger"::text
      WHEN 'INSTRUMENT_STATUS_CHANGED' THEN 'ENTRY_COMPLETED'::text
      ELSE "trigger"::text
    END
  )::"TriggerType_new",
  ALTER COLUMN "trigger" SET DEFAULT 'ENTRY_COMPLETED';

ALTER TYPE "TriggerType" RENAME TO "TriggerType_old";
ALTER TYPE "TriggerType_new" RENAME TO "TriggerType";
DROP TYPE "TriggerType_old";
