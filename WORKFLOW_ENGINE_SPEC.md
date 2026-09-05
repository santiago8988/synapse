# Workflow Engine v2 — DROPDOWN-as-status

> **Branch**: `worktree-workflow-engine-kanban`
> **Target**: `main`
> **Nivel de cumplimiento**: ISO 9001 §8.5 (control de la prestación), ISO/IEC 17025 §7.5 (registros técnicos)
> **Estado**: **Implementado en worktree** (commits `0f4b097`, `7f406fa`, `03a90f7`, `00717b8`). Pilot validado end-to-end con NCs.

---

## 1. Contexto

Synapse necesitaba un mecanismo configurable para definir **estados de entrada** y **transiciones controladas** entre ellos, sin obligar a crear una entidad companion (`Sample`, `Batch`, etc.) cada vez que un nuevo dominio quiere lifecycle. La spec original (v1) modelaba la state machine como una columna `Record.stateMachine` separada con su propia tabla `EntryStateLog`.

Conversación con el usuario derivó hacia un enfoque más cercano a Microsoft Lists: **el estado vive como un campo OWN del Record (DROPDOWN), y las transiciones se declaran inline en el `comparisonConfig`**. Esto reusa toda la infraestructura existente (FieldType, render, validación), permite múltiples DROPDOWNs con semántica de status sobre el mismo Record, y elimina la state machine como concepto separado.

Análisis de costos confirmó la viabilidad:
- FieldTypes especiales (`MATRIX_METHOD`, `RECIPE_SELECT`, `CALIBRATION_TEMPLATE`) ya cubren las relaciones tipadas.
- `Sample.results`, `Calibration.results` son JSON libre, migrables a `Entry.data` sin pérdida.
- ~15-20 queries por status indexed → JSON path queries (2-5x más lento sin GIN). Aceptable para volúmenes esperados.
- Side-effects de `changeStatus` (recálculo de `nextCalibrationAt`, creación de siguiente Calibration, cierre de Entry de Batch) tienen refugio en listeners de un nuevo trigger genérico.

Este spec **solo cubre el motor**. La migración de companions (`Sample`, `Calibration`, `Batch`, `Instrument`) a DROPDOWN-as-status se hace en specs separadas posteriores, una por dominio.

---

## 2. Alcance

### Dentro del alcance (implementado)

- **Schema**: extensión de `RecordAction` con `trigger` (enum `TriggerType`), `condition` (JSON), `allowCascade` (bool). Sin nuevas tablas append-only.
- **Tipos compartidos** (`@synapse/types`): `DropdownStateOption`, `FieldTransition`, `DropdownStatusConfig`, `ActionCondition`, `TriggerType`.
- **Validador Zod** (`@synapse/validators/record-field`): `dropdownStatusConfigSchema` con `superRefine` que verifica options únicas, exactamente un `isInitial` cuando `isStatus`, transitions referenciando options válidas.
- **Backend service** `TransitionValidatorService`: valida transiciones de DROPDOWN-as-status fields al actualizar entries. Lanza `BadRequestException`/`ForbiddenException` con mensajes en español.
- **Backend integración**: `entries.service.update` valida transitions antes de persistir y emite `EntryFieldValueChangedEvent` por cada field cambiado. `entries.service.create` autocompleta el value inicial. Si el Record tiene field `isStatus`, las entries no se auto-completan al crear (lifecycle vía field).
- **Listener generalizado**: `record-action.listener` agrega handler `@OnEvent(EntryFieldValueChangedEvent)` que filtra actions por `trigger = FIELD_VALUE_CHANGED`, evalúa `condition` (EQUALS / NOT_EQUALS / IN / NOT_IN sobre `fieldId` / `toValue` / `fromValue`), y respeta `allowCascade` para anti-loop.
- **Frontend `KanbanBoard`** (`@/components/kanban`): drag & drop con `@dnd-kit/core`, update optimista con cleanup automático cuando la data real refleja el cambio, modal de motivo cuando la transition declara `requireReason`, soporte de transitions con wildcard `"*"`, 6 colores semánticos, mobile horizontal scroll.
- **Pilot NCs**: el seed crea un Record sistema "No Conformidades" (`NOT_PERIODIC`) con field DROPDOWN `ESTADO` + `isStatus: true` + transitions OPEN→IN_PROGRESS→RESOLVED→CLOSED.
- **Integración en `records/[id]`**: pestaña "Kanban" visible cuando el Record tiene `isStatus` field, con drag-drop funcional. Botones del form de entry adaptados (`Guardar` en vez de `Guardar y completar` cuando hay isStatus).
- **`DropdownField` actualizado** para soportar tanto options legacy (`string[]`) como ricas (`DropdownStateOption[]`).

### Fuera del alcance (diferido)

- Migración de companions específicos. Cada uno requiere su spec:
  - `SAMPLE_DROPDOWN_STATUS_SPEC.md`
  - `CALIBRATION_DROPDOWN_STATUS_SPEC.md`
  - `BATCH_DROPDOWN_STATUS_SPEC.md`
  - `INSTRUMENT_DROPDOWN_STATUS_SPEC.md`
- Snapshot fields para assignments (`BatchInstrumentAssignment`, etc.). Patrón documentado en §12 como evolución futura.
- Reescritura de la página `/non-conformities` legacy: coexisten dos flujos (enum `NonConformityStatus` + Record "No Conformidades"). Ver `TO_DO.md` §8.
- Editor visual de transitions y options ricas en el Record Builder. Hoy el config rico se edita modificando el seed o vía JSON directo en DB; el editor existente bloquea la edición con un mensaje cuando detecta `isStatus`.
- Trigger `DUE_DATE_APPROACHING` (necesita BullMQ programado).
- Trigger `DOCUMENT_VERSIONED` (sin caso de uso identificado).
- Conditions compuestas (AND / OR). Hoy una sola condition por action.

---

## 3. Modelo de Dominio

### 3.1 Forma del `comparisonConfig` para DROPDOWN-as-status

Stored como `Json` en `RecordField.comparisonConfig`. Estructura:

```typescript
interface DropdownStatusConfig {
  options: string[] | DropdownStateOption[]   // legacy o rica
  isStatus?: boolean                          // marca el field como status canónico
  transitions?: FieldTransition[]             // si vacío/ausente: free movement
  units?: string[]                            // legacy compat (QUANTITY usa este key)
}

interface DropdownStateOption {
  value: string                               // identificador, MAYÚSCULAS por convención
  label?: string                              // si falta, se usa value
  color?: 'gray' | 'slate' | 'blue' | 'green' | 'amber' | 'red'
  isInitial?: boolean                         // exactamente uno cuando isStatus
  isFinal?: boolean                           // bloquea transiciones salientes (futuro)
  description?: string
}

interface FieldTransition {
  from: string                                // option.value origen, o "*" para cualquiera
  to: string                                  // option.value destino
  requiredRoles?: UserRole[]                  // gate de rol; vacío = cualquier rol con edit
  requireReason?: boolean                     // exige `transitionReason` no vacío en el body
}
```

### 3.2 Tipos de trigger para `RecordAction`

Enum `TriggerType` en Prisma + sincronizado en `@synapse/types`:

| Valor | Evento subyacente | Payload disponible para condition |
|---|---|---|
| `ENTRY_CREATED` | `entry.created` | `entryId`, `data` (campos OWN) |
| `ENTRY_COMPLETED` | `entry.completed` | `entryId` |
| `FIELD_VALUE_CHANGED` | `entry.fieldValueChanged` (nuevo) | `entryId`, `fieldId`, `fromValue`, `toValue` |
| `COMPARISON_FAILED` | `comparison.failed` (existente, no consumido todavía) | `entryId`, `fieldId`, `value`, `expected` |
| `INSTRUMENT_STATUS_CHANGED` | `instrument.statusChanged` (existente) | `instrumentId`, `fromStatus`, `toStatus` |

### 3.3 Forma de la `condition`

```typescript
interface ActionCondition {
  type: 'EQUALS' | 'NOT_EQUALS' | 'IN' | 'NOT_IN'
  field: 'fieldId' | 'toValue' | 'fromValue'  // path en el payload
  value: string | number | boolean | string[] | number[]
}
```

Si `condition` es `null`, el action dispara siempre que el trigger ocurra. Solo una condición por action en esta iteración.

### 3.4 Reglas de validación

`TransitionValidatorService.validate()` aplica las siguientes reglas en orden, lanzando excepción en la primera violación:

1. **Solo aplican a fields DROPDOWN con `isStatus = true`**. Otros DROPDOWN (sin isStatus) son free movement.
2. **No-op si el field no cambia** (`oldValue === newValue`) o si el caller no provee newValue.
3. **Set inicial implícito**: si `oldValue === undefined` y `newValue === initialValue`, dejar pasar sin chequear transitions.
4. **`newValue` debe ser una option declarada**. Si no, `BadRequestException("El valor X no es una opción válida...")`.
5. **Transición debe estar en la lista** (match exacto from/to, o wildcard `from === "*"`). Si no, `BadRequestException("Transición no permitida...")`.
6. **Si la transition declara `requiredRoles`**, el rol del usuario en JWT debe estar en la lista. Si no, `ForbiddenException`.
7. **Si la transition declara `requireReason`**, el body debe traer `transitionReason` no vacío. Si no, `BadRequestException`.
8. **Free movement** cuando `transitions` está vacío o ausente: solo se valida que el value sea una option declarada (regla 4).

Nota: `isFinal: true` bloquea transitions salientes únicamente porque las transitions del config no las declaran. Validación explícita de "estado terminal" se difiere.

### 3.5 Anti-loop

`EntryFieldValueChangedEvent` lleva flag `triggeredByCascade: boolean`. El listener filtra: si la action no declara `allowCascade: true` y el evento viene de cascada, omite. **Hoy** el flag siempre se emite como `false` desde `entries.service.update` — la propagación de "viene-de-cascada" desde el listener al `entries.service.create` cascadeado se difiere a una iteración posterior.

---

## 4. Schema de Base de Datos

### 4.1 Cambios aplicados

Migración **`20260507_workflow_engine`** (commit `7f406fa`):
- Agregar enum `TriggerType` con valores `ENTRY_CREATED`, `ENTRY_COMPLETED`, `ENTRY_STATE_CHANGED`, `COMPARISON_FAILED`, `INSTRUMENT_STATUS_CHANGED`.
- Agregar `Record.stateMachine` (JSONB) — *temporalmente; revertido en migración siguiente*.
- Agregar `Entry.state` (TEXT) — *temporalmente; revertido*.
- Crear tabla `EntryStateLog` (append-only) — *temporalmente; revertida*.
- Agregar `RecordAction.trigger` (enum, default `ENTRY_COMPLETED`).
- Agregar `RecordAction.condition` (JSONB).
- Agregar `RecordAction.allowCascade` (BOOLEAN, default false).

Migración **`20260507120000_revert_state_machine_columns`**:
- `DROP TABLE EntryStateLog`.
- `ALTER TABLE Record DROP COLUMN stateMachine`.
- `ALTER TABLE Entry DROP COLUMN state`.
- Recrear `TriggerType`: tipo nuevo con `FIELD_VALUE_CHANGED` reemplazando `ENTRY_STATE_CHANGED`. CAST de `RecordAction.trigger` con `WHEN 'ENTRY_STATE_CHANGED' THEN 'FIELD_VALUE_CHANGED'`. DROP del tipo viejo, RENAME del nuevo.

**Estado final del schema** después de las dos migraciones:
- `TriggerType`: `ENTRY_CREATED | ENTRY_COMPLETED | FIELD_VALUE_CHANGED | COMPARISON_FAILED | INSTRUMENT_STATUS_CHANGED`.
- `RecordAction`: campos `trigger`, `condition`, `allowCascade`.
- `Record`, `Entry`: sin cambios respecto a antes de v1.

### 4.2 Sincronización con `packages/types`

`packages/types/src/enums.ts`:
- `TriggerType` enum con los 5 valores arriba.

`packages/types/src/field-types.ts`:
- `StateColor`, `DropdownStateOption`, `FieldTransition`, `DropdownStatusConfig`.
- `ActionCondition`.
- Helper `isRichOptions()` para distinguir options legacy vs ricas.

---

## 5. Backend (NestJS)

### 5.1 Servicios

`apps/api/src/modules/entries/services/transition-validator.service.ts`:

| Método | Firma | Propósito |
|---|---|---|
| `validate` | `(fields, oldData, newData, userRole, transitionReason?) → void` | Aplica las reglas del §3.4. Lanza Bad/Forbidden en violaciones. |
| `getInitialValueForField` | `(field) → string \| null` | Devuelve el value inicial de un DROPDOWN-as-status, o null si no aplica. |

El service usa un parser inline con type guards (no Zod) para evitar runtime dep sobre `@synapse/validators` que es TS-source no compilado. La validación rica con Zod queda reservada para el flujo de creación/edición de RecordFields.

### 5.2 Endpoints modificados

`PATCH /records/:recordId/entries/:id` (`entries.controller.ts`):
- Body extendido: `{ data: Record<string, unknown>, transitionReason?: string }`.
- Propaga `user.sub` (changedById), `user.role` y `transitionReason` al service.

`entries.service.update`:
1. Carga el record con sus fields activos.
2. Valida identifiers en COMPLETED (regla existente).
3. Llama `transitionValidator.validate(...)`.
4. Persiste `Entry.data`.
5. Por cada field cambiado, emite `EntryFieldValueChangedEvent`.

`entries.service.create`:
- Antes de validar required fields, autocompleta value inicial de DROPDOWN-as-status fields que no vinieron en el body.
- Si el Record tiene field `isStatus`, override `autoComplete = false` (lifecycle por field, no por enum legacy).

### 5.3 Domain events

`apps/api/src/common/events/domain-events.ts`:

```typescript
export class EntryFieldValueChangedEvent {
  static readonly EVENT_NAME = 'entry.fieldValueChanged'
  constructor(
    public readonly entryId: string,
    public readonly recordId: string,
    public readonly organizationId: string,
    public readonly fieldId: string,
    public readonly fromValue: unknown,
    public readonly toValue: unknown,
    public readonly changedById: string,
    public readonly triggeredByCascade: boolean,
  ) {}
}
```

### 5.4 RecordAction listener

`apps/api/src/modules/entries/listeners/record-action.listener.ts` agrega:

```typescript
@OnEvent(EntryFieldValueChangedEvent.EVENT_NAME)
async handleFieldValueChanged(event) {
  // 1. Buscar RecordActions con sourceRecordId = event.recordId AND trigger = 'FIELD_VALUE_CHANGED'
  // 2. Por cada action:
  //    - if (event.triggeredByCascade && !action.allowCascade) skip
  //    - if (!matchesCondition(action.condition, event)) skip
  //    - executeFieldValueChangedAction(action, event)
  //      → carga sourceEntry.data, aplica fieldMapping, crea entry en target
  // 3. Errores se loggean sin re-throwear.
}
```

`matchesCondition` evalúa los 4 tipos (EQUALS, NOT_EQUALS, IN, NOT_IN) sobre `fieldId`, `toValue`, `fromValue`. Path desconocido → no matchea (fail-closed).

---

## 6. Frontend (Next.js)

### 6.1 Componente `KanbanBoard` (`apps/web/src/components/kanban/`)

Props:

```typescript
interface KanbanBoardProps {
  columns: KanbanColumn[]            // { id, label, color }
  cards: KanbanCard[]                 // { id, columnId, title, subtitle?, metadata?, href? }
  allowedTransitions?: KanbanTransition[]  // si vacío, free movement
  onCardMove: (cardId, fromColumnId, toColumnId, reason?) => Promise<void>
  isLoading?: boolean
  emptyState?: ReactNode
}
```

Comportamiento:
- Drag & drop con `@dnd-kit/core`, sensores Pointer + Touch + Keyboard.
- Update optimista: la card se mueve apenas se suelta, el override se limpia automáticamente cuando la data real refleja el cambio (vía `useEffect` que compara cards.columnId con el override).
- Si la transition declara `requireReason`, abre modal pidiendo motivo antes de invocar `onCardMove`.
- Errores en `onCardMove` (rejected promise) revierten la card a su columna origen.

### 6.2 Pestaña Kanban en `records/[id]`

`SynEntriesTabbedCard` (componente interno de `apps/web/src/app/(app)/records/[id]/page.tsx`) detecta `statusField` y, si existe, agrega:
- Botón "Kanban" en `syn-tabs` (con icono `LayoutGrid`).
- Default tab = `'kanban'` cuando hay `statusField`, sino `'entries'`.
- Render del `KanbanBoard` cuando `tab === 'kanban'`. Columns y transitions derivados del `comparisonConfig`. Cards mapeadas: `columnId = data[statusField.id]`, `title = data[identifierField.id]`, `subtitle = primer field TEXT no identifier no status con valor`.
- `handleKanbanCardMove` llama `api.entries.update(record.id, cardId, newData, reason?)` e invalida `['entries', record.id]` para refetch.

### 6.3 Form de entry — adaptación a hasStatusField

`records/[id]/page.tsx` deriva `hasStatusField` del Record. Modificaciones al form:
- `handleSaveAndComplete`: si `hasStatusField`, ruta a `updateEntryMutation` (solo guardar) en vez de `updateAndCompleteEntryMutation`. La entry queda en DRAFT permanentemente; el "estado real" vive en el field DROPDOWN.
- Botón primario muestra `"Guardar"` en lugar de `"Guardar y completar"` cuando `hasStatusField`.
- Botón secundario `"Guardar borrador"` se oculta cuando `hasStatusField` (el primario ya hace eso).

### 6.4 `DropdownField` con soporte rico

`apps/web/src/components/forms/dynamic-record-form/fields.tsx` actualizado: detecta si `comparisonConfig.options` viene como `string[]` (legacy) o `DropdownStateOption[]` (rica) y renderiza el `<select>` correspondiente con value/label correctos.

### 6.5 API client

`apps/web/src/lib/api.ts`: `entries.update(recordId, entryId, data, transitionReason?)` agrega el reason al body cuando se provee.

---

## 7. Pilot — Record "No Conformidades"

El seed (`apps/api/prisma/seed.ts`) crea un Record sistema con esta forma exacta:

```typescript
{
  name: 'No Conformidades',
  type: 'NOT_PERIODIC',
  status: 'ACTIVE',
  isSystem: true,
  fields: [
    { label: 'TÍTULO', fieldType: 'TEXT', isIdentifier: true, isRequired: true },
    { label: 'DESCRIPCIÓN', fieldType: 'TEXT', isRequired: true },
    {
      label: 'ESTADO',
      fieldType: 'DROPDOWN',
      isRequired: true,
      comparisonConfig: {
        isStatus: true,
        options: [
          { value: 'OPEN', label: 'Abierta', color: 'red', isInitial: true },
          { value: 'IN_PROGRESS', label: 'En progreso', color: 'amber' },
          { value: 'RESOLVED', label: 'Resuelta', color: 'blue' },
          { value: 'CLOSED', label: 'Cerrada', color: 'green', isFinal: true },
        ],
        transitions: [
          { from: 'OPEN', to: 'IN_PROGRESS' },
          { from: 'IN_PROGRESS', to: 'RESOLVED' },
          { from: 'IN_PROGRESS', to: 'OPEN' },
          { from: 'RESOLVED', to: 'IN_PROGRESS' },
          { from: 'RESOLVED', to: 'CLOSED', requireReason: true },
          { from: 'CLOSED', to: 'OPEN', requireReason: true },
        ],
      },
    },
    { label: 'DETECTADA', fieldType: 'DATE', isRequired: true },
  ],
}
```

Este Record convive con el flujo legacy (`/non-conformities` page + entidad `NonConformity`). Consolidar es una decisión a tomar en una iteración separada.

---

## 8. Checklist de implementación

Marcar `[x]` significa implementado en este worktree.

### Schema y migraciones
- [x] Migración `20260507_workflow_engine` con TriggerType + RecordAction.trigger/condition/allowCascade.
- [x] Migración `20260507120000_revert_state_machine_columns` que limpia stateMachine/Entry.state/EntryStateLog y renombra el valor del enum a FIELD_VALUE_CHANGED.
- [x] Sincronización de `packages/types/src/enums.ts` con `TriggerType`.
- [x] Tipos en `packages/types/src/field-types.ts`: `DropdownStateOption`, `FieldTransition`, `DropdownStatusConfig`, `ActionCondition`.
- [x] Schemas Zod en `packages/validators/src/record-field.ts`.
- [x] `db:generate` corre limpio. `tsc --noEmit` 0 errores en api.

### Backend
- [x] `TransitionValidatorService` con `validate()` y `getInitialValueForField()`.
- [x] `entries.service.update`: validar transitions + emitir `EntryFieldValueChangedEvent` por field cambiado.
- [x] `entries.service.create`: autocompletar value inicial; no auto-completar enum legacy si hay isStatus field.
- [x] `entries.controller.update`: propagar `user.role` y `transitionReason`.
- [x] `EntryFieldValueChangedEvent` definido en `domain-events.ts`.
- [x] `RecordActionListener.handleFieldValueChanged` con condition matching y anti-loop.

### Frontend
- [x] Componente `KanbanBoard` (`apps/web/src/components/kanban/`).
- [x] `api.entries.update` acepta opcional `transitionReason`.
- [x] Pestaña "Kanban" en `records/[id]/page.tsx` (`SynEntriesTabbedCard`).
- [x] Form adaptado para Records con `isStatus`: botón "Guardar" en vez de "Guardar y completar", oculta "Guardar borrador".
- [x] `DropdownField` soporta options legacy y ricas.

### Pilot y verificación
- [x] Seed crea Record "No Conformidades" con field DROPDOWN ESTADO + isStatus + transitions.
- [x] Login con `santiago@gmail.com` / `santiago.mdp@gmail.com` (whitelist en seed).
- [x] Crear entry → ESTADO autocompleta a OPEN. Entry queda en DRAFT (no auto-COMPLETED).
- [x] Drag-drop OPEN → IN_PROGRESS persiste.
- [x] Drag-drop RESOLVED → CLOSED abre modal de motivo.
- [x] Drag-drop IN_PROGRESS → CLOSED rechazado (transición no declarada).
- [x] AuditLog refleja los cambios.

---

## 9. Mapa de archivos

### Creados

```
apps/api/prisma/migrations/20260507_workflow_engine/migration.sql
apps/api/prisma/migrations/20260507120000_revert_state_machine_columns/migration.sql
apps/api/src/modules/entries/services/transition-validator.service.ts
packages/validators/src/record-field.ts
apps/web/src/components/kanban/index.ts
apps/web/src/components/kanban/kanban-board.tsx
apps/web/src/components/kanban/types.ts
WORKFLOW_ENGINE_SPEC.md (este archivo)
```

### Modificados

```
apps/api/prisma/schema.prisma                                (TriggerType + RecordAction extension)
apps/api/prisma/seed.ts                                      (Record No Conformidades + whitelist)
apps/api/src/common/events/domain-events.ts                  (EntryFieldValueChangedEvent)
apps/api/src/modules/entries/entries.controller.ts           (propagar role + reason)
apps/api/src/modules/entries/entries.module.ts               (registrar TransitionValidatorService)
apps/api/src/modules/entries/entries.service.ts              (validar, emitir events, autocomplete)
apps/api/src/modules/entries/listeners/record-action.listener.ts (handler FIELD_VALUE_CHANGED)
packages/types/src/enums.ts                                  (TriggerType)
packages/types/src/field-types.ts                            (DropdownStatusConfig + ActionCondition)
packages/validators/src/index.ts                             (re-export record-field)
apps/web/src/lib/api.ts                                      (entries.update transitionReason)
apps/web/src/components/forms/dynamic-record-form/fields.tsx (DropdownField rich support)
apps/web/src/app/(app)/records/[id]/page.tsx                 (Kanban tab + isStatus handling)
apps/web/package.json + pnpm-lock.yaml                       (@dnd-kit/core)
```

### Migraciones de orden corregidas (commit `0f4b097`)

```
apps/api/prisma/migrations/20260403_matrix_versioning → 20260403170633_matrix_versioning
apps/api/prisma/migrations/20260403_redesign_sample_flow → 20260403170634_redesign_sample_flow
apps/api/prisma/migrations/20260407_stock_type → 20260406235959_stock_type
apps/api/prisma/migrations/20260408_calibration_templates → 20260407235959_calibration_templates
                                                            (contenido reescrito al estado final)
apps/api/prisma/migrations/20260408_calibration_entryid/migration.sql        (DO block conditional)
apps/api/prisma/migrations/20260408_calibration_refactor/migration.sql       (DO block conditional)
apps/api/prisma/migrations/20260410_calibration_pattern/migration.sql        (DO block conditional)
apps/api/prisma/migrations/20260410_calibration_multipattern/migration.sql   (DO block conditional)
```

---

## 10. Criterios de aceptación

Todos satisfechos en este worktree:

1. ✅ `pnpm --filter @synapse/api db:generate` sin errores.
2. ✅ `pnpm --filter @synapse/api exec tsc --noEmit` 0 errores.
3. ✅ `pnpm --filter @synapse/web exec tsc --noEmit` no agrega errores nuevos respecto al baseline (de hecho bajó de 36 a 20 con la copia de UI de main).
4. ✅ `prisma migrate reset --force` aplica las 27 migraciones limpias (incluye las 4 de calibración consolidadas vía DO blocks).
5. ✅ Seed crea Record "No Conformidades" con field DROPDOWN configurado.
6. ✅ Las 8 reglas de validación del §3.4 están implementadas y verificadas con casos manuales.
7. ✅ Records sin `isStatus` field siguen funcionando con el flujo legacy DRAFT/COMPLETED y los `RecordActions` con default `trigger = ENTRY_COMPLETED`.
8. ✅ Records con `isStatus` field usan el nuevo flow: Kanban tab, autocompletado de estado inicial, validación de transitions, modal de motivo cuando aplica.
9. ✅ `EntryFieldValueChangedEvent` se emite por cada field cambiado en Entry.update.
10. ✅ `RecordActionListener` despacha actions con `trigger = FIELD_VALUE_CHANGED` filtrando por condition y respetando `allowCascade`.

---

## 11. Riesgos y rollback

### Riesgos conocidos

- **Performance de queries por status**: queries que filtran por status pasan de enum indexado a JSON path. Para los volúmenes esperados de NCs (cientos por org) es aceptable. Si un dominio futuro lo necesita (samples con miles), se mitiga con índice GIN sobre el path o columna proyectada cacheada.
- **Doble fuente de verdad temporal**: NCs legacy y Record "No Conformidades" coexisten. Usuarios pueden confundirse. Mitigación: spec de consolidación (decidir si redirigir `/non-conformities` al Record o migrar data).
- **Loops de cascada**: `allowCascade` por default en `false` previene la mayoría. El flag `triggeredByCascade` **no se propaga** al `entries.service.create` cascadeado, así que el anti-loop no protege más allá del primer salto. Ver `TO_DO.md` §7.
- **Editor de DROPDOWN-as-status no disponible en UI**: editar el `comparisonConfig` rico hoy requiere modificar el seed o JSON manual en DB. Editor visual diferido.

### Rollback

Si después de mergear a main aparece un bug crítico:

1. `git revert -m 1 <merge_commit_sha>` y push.
2. Para revertir las migraciones aplicadas en producción:
   - `20260507120000_revert_state_machine_columns` no toca tablas con datos del usuario; revert es seguro pero innecesario si solo el código se revierte (las columnas `RecordAction.trigger/condition/allowCascade` quedan con valores default).
   - `20260507_workflow_engine` agrega columnas con default. Mantenerlas no rompe nada incluso con código viejo.
3. El seed nuevo crea un Record "No Conformidades" — borrarlo manualmente si no querés que aparezca: `DELETE FROM "RecordField" WHERE "recordId" = (SELECT id FROM "Record" WHERE name = 'No Conformidades' AND "isSystem" = true); DELETE FROM "Record" WHERE name = 'No Conformidades' AND "isSystem" = true;`

El cambio es **mayormente aditivo al schema** — el rollback es de bajo riesgo.

---

## 12. Evolución futura

### 12.1 Snapshot fields para assignments

Patrón propuesto por el usuario y documentado para futuras specs. Las tablas `BatchInstrumentAssignment` y `SampleInstrumentAssignment` pueden reemplazarse por OWN fields tipo `INSTRUMENT_ASSIGNMENT_LIST` que guardan snapshots inmutables:

```json
{
  "recordId": "rec_xxx",
  "entryId": "ent_yyy",
  "label": "Balanza analítica",
  "order": 0,
  "statusSnapshot": "ACTIVE",
  "nextCalibrationSnapshot": "2026-09-15",
  "assignedAt": "2026-05-07T14:23:00Z"
}
```

**Ventaja ISO**: el batch terminado siempre muestra qué status tenía el instrumento al momento de la asignación, no el actual. Es la representación correcta de "qué creía el sistema cuando se hizo el ensayo". Aplica análogamente a `RecipeRequiredInstrument` y `MatrixRequiredInstrument`.

### 12.2 Migración de companions

Cada companion atravesará 4 fases en su spec dedicada:
1. Agregar al Record correspondiente un field DROPDOWN `Estado` con `isStatus: true` + transitions equivalentes al enum legacy.
2. Migrar listeners del side-effect de `changeStatus` (recálculo de `nextCalibrationAt`, creación de siguiente Calibration, etc.) al trigger `FIELD_VALUE_CHANGED` con condition por `fieldId` y/o `toValue`.
3. Deprecar `/changeStatus` endpoint (mantenerlo como wrapper que llama al update normal).
4. Eventualmente: dropear el enum status del companion cuando ningún consumer lo lea.

Orden sugerido: NonConformity (más simple, ya tiene UI) → Sample → Calibration → Batch → Instrument.

### 12.3 Editor visual de transitions

Reemplaza el bloqueo actual del editor con un panel rico:
- Drag & drop de options con color picker.
- Tabla de transitions con select de from/to (autocompleta con options declaradas).
- Checkboxes de `requireReason` y multi-select de `requiredRoles`.

### 12.4 Conditions compuestas

Extender `ActionCondition` con un wrapper:

```typescript
type ActionCondition =
  | { type: 'EQUALS' | 'NOT_EQUALS' | 'IN' | 'NOT_IN', field: string, value: unknown }
  | { type: 'AND' | 'OR', conditions: ActionCondition[] }
```

Recursivo. Habilita reglas tipo "(toValue = COMPLETED) AND (fieldId = ESTADO)".

### 12.5 Acciones que no son "crear entry"

Hoy `RecordAction` solo crea entries en target. Extensible a:
- "Crear NonConformity con título derivado del payload".
- "Notificar usuario X via BullMQ + email".
- "Cambiar estado de entry existente (sin crear una nueva)".

Cada tipo nuevo es una columna `actionType` en `RecordAction` con su propio shape de payload.

---

## 13. Referencias

- ISO 9001:2015 §8.5.1 — Control de la producción y prestación del servicio.
- ISO/IEC 17025:2017 §7.5 — Control de los registros técnicos.
- `SAMPLE_CUSTODY_SPEC.md` — patrón de spec ISO seguido aquí.
- `C:\Users\santi\.claude\plans\necesito-q-analices-synapse-elegant-honey.md` — plan original que motivó el pivot v1 → v2 con la conversación arquitectónica.
- Microsoft Lists + Power Automate — referencia conceptual del modelo "DROPDOWN driving Kanban + flow trigger + condition + action".
