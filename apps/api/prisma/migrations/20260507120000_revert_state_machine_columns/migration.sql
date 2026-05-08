-- Revert de los campos del spec original del workflow engine que ya no aplican
-- en la arquitectura v2 (DROPDOWN-as-status). Ver plan en
-- C:\Users\santi\.claude\plans\necesito-q-analices-synapse-elegant-honey.md
--
-- Los campos eliminados nunca llegaron a usarse en código de producción —
-- solo están en la DB del worktree porque aplicamos la migración previa
-- (20260507_workflow_engine) durante el diseño.
--
-- Lo que se MANTIENE de la migración previa:
--   - RecordAction.trigger (TriggerType enum)
--   - RecordAction.condition (Json?)
--   - RecordAction.allowCascade (Boolean)
--
-- Lo que se REVIERTE acá:
--   - Record.stateMachine
--   - Entry.state
--   - Tabla EntryStateLog
--   - Valor 'ENTRY_STATE_CHANGED' del enum TriggerType, reemplazado por 'FIELD_VALUE_CHANGED'

-- 1. Drop tabla append-only EntryStateLog (incluye sus FKs e índices automáticamente)
DROP TABLE IF EXISTS "EntryStateLog";

-- 2. Drop columnas Record.stateMachine y Entry.state
ALTER TABLE "Record" DROP COLUMN IF EXISTS "stateMachine";
ALTER TABLE "Entry" DROP COLUMN IF EXISTS "state";

-- 3. Recrear el enum TriggerType: PostgreSQL no permite DROP VALUE de un enum,
--    así que creamos un nuevo enum con los valores correctos, casteamos la
--    columna RecordAction.trigger, y reemplazamos. Mismo patrón que usamos
--    en 20260410_calibration_pattern.
BEGIN;

CREATE TYPE "TriggerType_new" AS ENUM (
  'ENTRY_CREATED',
  'ENTRY_COMPLETED',
  'FIELD_VALUE_CHANGED',
  'COMPARISON_FAILED',
  'INSTRUMENT_STATUS_CHANGED'
);

-- Migrar los valores existentes: cualquier ENTRY_STATE_CHANGED (que no
-- debería existir en datos reales porque nunca usamos el listener) lo
-- mapeamos a FIELD_VALUE_CHANGED. ENTRY_COMPLETED queda como default.
ALTER TABLE "RecordAction"
  ALTER COLUMN "trigger" DROP DEFAULT,
  ALTER COLUMN "trigger" TYPE "TriggerType_new" USING (
    CASE "trigger"::text
      WHEN 'ENTRY_STATE_CHANGED' THEN 'FIELD_VALUE_CHANGED'::text
      ELSE "trigger"::text
    END
  )::"TriggerType_new",
  ALTER COLUMN "trigger" SET DEFAULT 'ENTRY_COMPLETED';

ALTER TYPE "TriggerType" RENAME TO "TriggerType_old";
ALTER TYPE "TriggerType_new" RENAME TO "TriggerType";
DROP TYPE "TriggerType_old";

COMMIT;
