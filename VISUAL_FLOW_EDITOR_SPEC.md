# Visual Flow Editor — Sub-spec Records-as-Lists

> **Branch**: `worktree-workflow-engine-kanban`
> **Target**: `main`
> **Predecesor**: Fase 1 (RecordAction generalizado + EntryStatusLog) está pusheada y mergeada lógicamente.
> **Estado**: spec emitida — implementación en curso.

---

## 1. Contexto

Decisión del usuario el 2026-05-08 después del revert de Fase 2: las companions vuelven (Instrument, Batch, Sample, Stock) pero el motor `RecordAction` generalizado de Fase 1 se preserva y se enriquece con un editor visual estilo Power Automate. La motivación es habilitar configuración de flujos arbitrarios sin tocar código:

- "Cuando una NC se cierra → marcar el field REVISADA del Record padre como true."
- "Cuando una entry de stock se guarda con cantidad < 100 → crear NC."
- "Cuando un instrumento pasa a IN_REPAIR → notificar al supervisor del área." (futuro, requiere NOTIFY action funcional).

El user-flow target es: el admin entra al detalle de un Record, ve la pestaña "Flujos", arrastra un nodo Trigger, lo conecta a un Condition, lo conecta a un Action, define los pickers (qué field, qué valor, qué record target), y guarda. Cada flow es una `RecordAction` row (lo que ya existe en la DB).

---

## 2. Alcance

### Dentro
- Eliminación del trigger legacy `INSTRUMENT_STATUS_CHANGED` del enum (sin consumers reales — auditado).
- Operadores numéricos en `ActionConditionPrimitive`: `LT`, `LTE`, `GT`, `GTE`, `BETWEEN`. Habilita "stock < threshold".
- `RecordActionListener.executeUpdateField` funcional (no stub).
- Soporte de `$entry.id` y `$entry.<fieldId>` como `sourceFieldId` en fieldMapping. Permite que la action escriba referencias al entry padre.
- Propagación correcta de `triggeredByCascade` desde el listener al sub-evento (anti-loop real).
- Frontend: editor visual con `@xyflow/react` (canvas drag-drop con custom nodes: TriggerNode, ConditionNode, ActionNode).
- Tab "Flujos" en `/records/[id]/page.tsx` con la lista de flows del Record + acceso al canvas.
- Persistencia: el grafo serializa a una `RecordAction` row con shape ya existente (`trigger`, `condition` recursivo, `actionType`, `actionConfig`, `fieldMapping`, `allowCascade`).
- Pilot manual con NCs: configurar flow `(ESTADO == 'CLOSED') → UPDATE_FIELD('REVISADA', true)` desde la UI y validar end-to-end.

### Fuera de alcance (diferido a iteraciones posteriores)
- Actions: `NOTIFY` (in-app), `EMAIL`, `WEBHOOK`. Quedan stubs.
- Flows con múltiples acciones encadenadas (action1 → action2 con resultado de action1). v1 es lineal: trigger → 0..1 condition → 1 action.
- Triggers a nivel "evento de dominio" (DOCUMENT_VERSIONED, NON_CONFORMITY_CREATED, etc.) — los 4 actuales (ENTRY_CREATED, ENTRY_COMPLETED, FIELD_VALUE_CHANGED, COMPARISON_FAILED) cubren el espacio razonable. El usuario los descartó por redundancia.
- Triggers programados (DUE_DATE_APPROACHING, scheduled) — necesitarían BullMQ; cuando se necesite, otra spec.
- Editor de "test flow" (dry-run). Por ahora se prueba creando entries reales.

---

## 3. Modelo de datos

`RecordAction` ya tiene todo lo que necesita (Fase 1):

```prisma
model RecordAction {
  id             String           @id @default(cuid())
  sourceRecordId String
  targetRecordId String
  fieldMapping   Json
  trigger        TriggerType      @default(ENTRY_COMPLETED)
  condition      Json?
  allowCascade   Boolean          @default(false)
  actionType     RecordActionType @default(CREATE_ENTRY)
  actionConfig   Json?
  createdAt      DateTime         @default(now())
}
```

**Cambios v1**:
- `TriggerType` enum sin `INSTRUMENT_STATUS_CHANGED`. Migración con cast a `ENTRY_COMPLETED` para cualquier row existente (no debe haber).
- `ActionConditionPrimitive.type` extendido con `LT | LTE | GT | GTE | BETWEEN` además de los actuales.

`fieldMapping` shape extendido — sigue siendo un array, pero `sourceFieldId` ahora puede ser:
- Un id de field del Record source (caso histórico).
- `$entry.id` — el id de la entry que disparó.
- `$entry.<fieldId>` — un field específico del entry padre (alias del primer caso, más explícito).
- `$event.fieldId`, `$event.toValue`, `$event.fromValue` — para `FIELD_VALUE_CHANGED`.

`actionConfig` para `UPDATE_FIELD`:
```typescript
{
  entryIdSource: '$entry.id' | '<related-field-id>'  // self o relatedEntry referenciada
  fieldId: string                                     // qué field actualizar
  value: string | number | boolean | null            // valor literal
}
```

---

## 4. Backend

### 4.1 Migración SQL

`apps/api/prisma/migrations/<ts>_remove_instrument_status_trigger/migration.sql`:

```sql
-- Cast del enum TriggerType removiendo INSTRUMENT_STATUS_CHANGED.
-- Mismo patrón que 20260507120000_revert_state_machine_columns.

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
```

### 4.2 Eliminación de `InstrumentStatusChangedEvent`

- Eliminar la clase `InstrumentStatusChangedEvent` de `apps/api/src/common/events/domain-events.ts`.
- Eliminar el `eventEmitter.emit(...)` correspondiente en `instruments.service.changeStatus`.

### 4.3 Operadores numéricos en condiciones

`packages/types/src/field-types.ts`:
```typescript
export interface ActionConditionPrimitive {
  type: 'EQUALS' | 'NOT_EQUALS' | 'IN' | 'NOT_IN'
       | 'LT' | 'LTE' | 'GT' | 'GTE' | 'BETWEEN'
  field: string
  value: string | number | boolean | string[] | number[]
}
```

Para `BETWEEN`: `value` es `[min, max]` (array de 2 numbers). Para `LT/LTE/GT/GTE`: `value` es number escalar.

`packages/validators/src/record-field.ts`: el `actionConditionPrimitiveSchema` extiende el enum y agrega un `superRefine` para validar shape de `value` según `type`.

`apps/api/src/modules/entries/listeners/record-action.listener.ts`: `evalPrimitive` extiende el switch:
```typescript
case 'LT':       return Number(actual) < Number(expected)
case 'LTE':      return Number(actual) <= Number(expected)
case 'GT':       return Number(actual) > Number(expected)
case 'GTE':      return Number(actual) >= Number(expected)
case 'BETWEEN':  return Array.isArray(expected) && expected.length === 2
                 && Number(actual) >= Number(expected[0])
                 && Number(actual) <= Number(expected[1])
```

### 4.4 `executeUpdateField` funcional

```typescript
private async executeUpdateField(action, event) {
  const { entryIdSource, fieldId, value } = action.actionConfig
  const targetEntryId =
    entryIdSource === '$entry.id' ? event.entryId
    : <resolución vía related field, futuro>

  const entry = await this.prisma.entry.findUnique({
    where: { id: targetEntryId },
    select: { data: true, recordId: true }
  })
  if (!entry) return

  const currentData = (entry.data ?? {}) as Record<string, unknown>
  const newData = { ...currentData, [fieldId]: value }

  await this.prisma.entry.update({
    where: { id: targetEntryId },
    data: { data: newData as Prisma.InputJsonValue }
  })

  // Emitir evento con triggeredByCascade=true para anti-loop.
  this.eventEmitter.emit(
    EntryFieldValueChangedEvent.EVENT_NAME,
    new EntryFieldValueChangedEvent(
      targetEntryId, entry.recordId, event.organizationId,
      fieldId, currentData[fieldId], value, event.changedById,
      true,                       // triggeredByCascade
      `Cascada de RecordAction ${action.id}`,
    )
  )
}
```

### 4.5 `$entry.*` en fieldMapping

`executeCreateEntry` y `executeUpdateField` resuelven el `sourceFieldId`:
```typescript
function resolveSource(sourceFieldId: string, event, sourceData) {
  if (sourceFieldId === '$entry.id') return event.entryId
  if (sourceFieldId.startsWith('$entry.')) {
    const fieldId = sourceFieldId.slice('$entry.'.length)
    return sourceData[fieldId]
  }
  if (sourceFieldId === '$event.toValue') return event.toValue
  // ... etc
  return sourceData[sourceFieldId]  // caso histórico
}
```

### 4.6 Anti-loop

El listener al ejecutar `executeUpdateField` (y futuras acciones que escriban entries) emite `EntryFieldValueChangedEvent` con `triggeredByCascade: true`. La RecordAction solo dispara si `allowCascade === true` o si el evento no es cascadeado. Esta lógica ya existe en el handler — solo hay que asegurar que el flag se setea correctamente.

---

## 5. Frontend

### 5.1 Dependencia

`pnpm add @xyflow/react` en `apps/web`. Versión moderna de reactflow, MIT, ~80kb gzip.

### 5.2 Estructura

```
apps/web/src/
  app/(app)/records/[id]/page.tsx        ← agrega tab "Flujos"
  components/
    flow-editor/
      FlowEditor.tsx                     ← canvas + sidebar + properties panel
      nodes/
        TriggerNode.tsx                  ← custom node visual
        ConditionNode.tsx
        ActionNode.tsx
      panels/
        FlowsList.tsx                    ← sidebar izq con flows del Record
        PropertiesPanel.tsx              ← panel der con props del nodo seleccionado
        FieldPicker.tsx                  ← autocompletar fields
        RecordPicker.tsx                 ← autocompletar Records
        ConditionBuilder.tsx             ← AND/OR recursivo
      serialize.ts                       ← grafo ↔ RecordAction
  lib/api.ts                             ← extensión api.records.actions.*
```

### 5.3 Canvas

- 1 canvas por flow. El canvas tiene 3 nodos máximo en v1: trigger → condition (opcional) → action.
- Posiciones libres pero auto-layoutadas al cargar (left → right).
- Edges con flecha. Sin condiciones de validación visual fancy en v1 (solo reglas hard al guardar).

### 5.4 Pickers

- `FieldPicker(recordId)`: lista los fields del Record, autocompleta por label, devuelve `{ id, label, fieldType }`.
- `RecordPicker(orgId, filterByType?)`: lista los Records de la org.
- `ValueInput(field)`: tipo según `fieldType` del field destino.

### 5.5 Persistencia

Un flow en el canvas serializa a una `RecordAction` row:

```typescript
{
  sourceRecordId: <id del Record actual>,
  trigger: TriggerNode.data.trigger,
  condition: ConditionNode ? buildConditionTree(ConditionNode) : null,
  actionType: ActionNode.data.actionType,
  fieldMapping: ActionNode.data.fieldMapping ?? [],
  actionConfig: ActionNode.data.actionConfig ?? null,
  targetRecordId: ActionNode.data.targetRecordId ?? sourceRecordId,
  allowCascade: ActionNode.data.allowCascade ?? false,
}
```

Al cargar un flow existente: la inversa.

### 5.6 API client

`apps/web/src/lib/api.ts` se extiende con:
```typescript
records.actions: {
  list: (recordId) => GET /records/:recordId/actions,
  create: (recordId, payload) => POST /records/:recordId/actions,
  update: (recordId, actionId, payload) => PATCH /records/:recordId/actions/:actionId,
  delete: (recordId, actionId) => DELETE /records/:recordId/actions/:actionId,
}
```

El backend ya tiene parcialmente estos endpoints (POST + DELETE en `records.controller`). Falta GET y PATCH — los agrego.

---

## 6. Migración

`<ts>_remove_instrument_status_trigger/migration.sql` (ver §4.1).

---

## 7. Pilot manual

1. Login en NCs.
2. Abrir `/records/<no-conformidades>`.
3. Click en tab "Flujos". Botón "+ Nuevo flujo".
4. Canvas vacío. Agregar TriggerNode → ENTRY_COMPLETED.
5. Agregar ConditionNode → `data.<estadoFieldId> EQUALS 'CLOSED'`.
6. Agregar ActionNode → UPDATE_FIELD → `entryIdSource: $entry.id`, `fieldId: <revisadaFieldId>`, `value: true`.
7. Guardar. Aparece en la sidebar de flows.
8. Crear una entry NC, llenarla, completarla con ESTADO=CLOSED.
9. Verificar en DB: `Entry.data.<revisadaFieldId> === true`.
10. Verificar `EntryStatusLog`: ningún row nuevo (la action UPDATE_FIELD no toca un field isStatus).
11. Verificar logs del backend: emit del `EntryFieldValueChangedEvent` con `triggeredByCascade: true`.

---

## 8. Mapa de archivos

### Crear
- `VISUAL_FLOW_EDITOR_SPEC.md` (este archivo)
- `apps/api/prisma/migrations/<ts>_remove_instrument_status_trigger/migration.sql`
- `apps/web/src/components/flow-editor/*` (FlowEditor, nodes, panels, serialize)

### Modificar
- `apps/api/prisma/schema.prisma` — enum TriggerType
- `packages/types/src/enums.ts` — TriggerType
- `packages/types/src/field-types.ts` — ActionConditionPrimitive con operadores numéricos
- `packages/validators/src/record-field.ts` — actionConditionPrimitiveSchema
- `apps/api/src/modules/entries/listeners/record-action.listener.ts` — evalPrimitive + executeUpdateField + resolveSource
- `apps/api/src/common/events/domain-events.ts` — eliminar InstrumentStatusChangedEvent
- `apps/api/src/modules/instruments/instruments.service.ts` — quitar emit
- `apps/api/src/modules/records/records.controller.ts` — agregar GET y PATCH para actions
- `apps/api/src/modules/records/records.service.ts` — métodos actions.list/update
- `apps/web/src/app/(app)/records/[id]/page.tsx` — tab Flujos
- `apps/web/src/lib/api.ts` — namespace records.actions
- `apps/web/package.json` — `@xyflow/react`

---

## 9. Criterios de aceptación

1. ✅ `db:generate` + `tsc --noEmit` clean en api y web.
2. ✅ `prisma migrate reset --force` aplica + corre seed sin errores.
3. ✅ Crear un flow en el canvas con drag-drop persiste como RecordAction row con shape correcto.
4. ✅ Flow `(ESTADO == 'CLOSED') → UPDATE_FIELD('REVISADA', true)` ejecuta end-to-end al completar una entry.
5. ✅ Operadores numéricos funcionan: condition con `LT 100` matchea cuando el valor es 50.
6. ✅ Anti-loop: si un UPDATE_FIELD genera otro evento, las RecordAction sin `allowCascade=true` lo ignoran.
7. ✅ La eliminación de `INSTRUMENT_STATUS_CHANGED` no rompe nada existente.

---

## 10. Roadmap futuro (sin spec)

- Actions adicionales funcionales: `NOTIFY` (con bandeja in-app), `WEBHOOK` (POST externo), `EMAIL` (Resend).
- Triggers programados: `DUE_DATE_APPROACHING` (BullMQ scheduled).
- Flows con múltiples acciones encadenadas (action1 → action2).
- "Test flow" con dry-run sin commit.
- Plantillas de flow (preset comunes: "notificar al cerrar NC", "crear NC al fallar comparison").
