-- Records-as-Lists — Foundational
--
-- Fase 1 de la convergencia al modelo Microsoft Lists-like:
--  1) Generaliza RecordAction (actionType + actionConfig) para ser tipo Power Automate.
--     Default CREATE_ENTRY mantiene compat con todas las RecordActions existentes.
--  2) Crea EntryStatusLog append-only que reemplaza progresivamente
--     InstrumentStatusLog / BatchStatusLog / SampleCustodyEvent (ISO 9001 §8.5,
--     ISO/IEC 17025 §7.5 — paper trail unificado).
--
-- REGLA ISO: la tabla EntryStatusLog es append-only. Nunca UPDATE ni DELETE.
-- Migración aditiva, sin DROPs. Rollback no requerido (los defaults conservan
-- el comportamiento histórico).

-- 1. Nuevo enum RecordActionType
CREATE TYPE "RecordActionType" AS ENUM (
  'CREATE_ENTRY',
  'UPDATE_FIELD',
  'NOTIFY',
  'EMAIL',
  'WEBHOOK'
);

-- 2. RecordAction.actionType + actionConfig
-- Default CREATE_ENTRY mantiene back-compat con las acciones existentes que
-- crean entry en target con fieldMapping. Los demás actionType se dispatchean
-- por RecordActionListener.execute<Type>(action, event).
ALTER TABLE "RecordAction"
  ADD COLUMN "actionType" "RecordActionType" NOT NULL DEFAULT 'CREATE_ENTRY';

ALTER TABLE "RecordAction"
  ADD COLUMN "actionConfig" JSONB;

-- 3. EntryStatusLog (append-only) — reemplazo unificado de los *StatusLog específicos
CREATE TABLE "EntryStatusLog" (
  "id"                 TEXT         NOT NULL,
  "entryId"            TEXT         NOT NULL,
  "recordId"           TEXT         NOT NULL,
  "organizationId"     TEXT         NOT NULL,
  "fieldId"            TEXT         NOT NULL,
  "fromValue"          TEXT,
  "toValue"            TEXT         NOT NULL,
  "changedById"        TEXT         NOT NULL,
  "triggeredByCascade" BOOLEAN      NOT NULL DEFAULT false,
  "reason"             TEXT,
  "createdAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "EntryStatusLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "EntryStatusLog_entryId_idx"        ON "EntryStatusLog"("entryId");
CREATE INDEX "EntryStatusLog_recordId_idx"       ON "EntryStatusLog"("recordId");
CREATE INDEX "EntryStatusLog_organizationId_idx" ON "EntryStatusLog"("organizationId");
CREATE INDEX "EntryStatusLog_createdAt_idx"      ON "EntryStatusLog"("createdAt");

ALTER TABLE "EntryStatusLog"
  ADD CONSTRAINT "EntryStatusLog_entryId_fkey"
  FOREIGN KEY ("entryId") REFERENCES "Entry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "EntryStatusLog"
  ADD CONSTRAINT "EntryStatusLog_recordId_fkey"
  FOREIGN KEY ("recordId") REFERENCES "Record"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "EntryStatusLog"
  ADD CONSTRAINT "EntryStatusLog_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
