-- Workflow Engine — máquina de estados configurable + triggers múltiples para RecordAction
-- Ver WORKFLOW_ENGINE_SPEC.md
-- Migración aditiva, sin DROP de datos. Rollback documentado en spec §11.

-- 1. Nuevo enum TriggerType
CREATE TYPE "TriggerType" AS ENUM (
  'ENTRY_CREATED',
  'ENTRY_COMPLETED',
  'ENTRY_STATE_CHANGED',
  'COMPARISON_FAILED',
  'INSTRUMENT_STATUS_CHANGED'
);

-- 2. Nuevo modelo EntryStateLog (append-only)
CREATE TABLE "EntryStateLog" (
  "id"          TEXT         NOT NULL,
  "entryId"     TEXT         NOT NULL,
  "fromState"   TEXT,
  "toState"     TEXT         NOT NULL,
  "reason"      TEXT,
  "changedById" TEXT         NOT NULL,
  "changedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "EntryStateLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "EntryStateLog_entryId_idx"   ON "EntryStateLog"("entryId");
CREATE INDEX "EntryStateLog_changedAt_idx" ON "EntryStateLog"("changedAt");

ALTER TABLE "EntryStateLog"
  ADD CONSTRAINT "EntryStateLog_entryId_fkey"
  FOREIGN KEY ("entryId") REFERENCES "Entry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "EntryStateLog"
  ADD CONSTRAINT "EntryStateLog_changedById_fkey"
  FOREIGN KEY ("changedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- 3. Record.stateMachine — definición opcional de máquina de estados
ALTER TABLE "Record" ADD COLUMN "stateMachine" JSONB;

-- 4. Entry.state — estado actual según el stateMachine del Record (null si Record no tiene)
ALTER TABLE "Entry" ADD COLUMN "state" TEXT;

-- 5. RecordAction — trigger configurable + condition + allowCascade
-- Default ENTRY_COMPLETED garantiza que las acciones existentes siguen funcionando igual.
ALTER TABLE "RecordAction"
  ADD COLUMN "trigger" "TriggerType" NOT NULL DEFAULT 'ENTRY_COMPLETED';

ALTER TABLE "RecordAction" ADD COLUMN "condition" JSONB;

ALTER TABLE "RecordAction"
  ADD COLUMN "allowCascade" BOOLEAN NOT NULL DEFAULT false;
