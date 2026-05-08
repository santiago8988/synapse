# Instrument Collapse — Sub-spec Records-as-Lists

> **Branch**: `worktree-workflow-engine-kanban`
> **Target**: `main`
> **Nivel de cumplimiento**: ISO 9001 §8.5 (control de la prestación), ISO/IEC 17025 §6.4 (instrumental, control metrológico) y §7.5 (registros técnicos).
> **Estado**: spec emitida — implementación en curso (commits `feat(instrument):*`).

---

## 1. Contexto

`Instrument` fue la primer companion-table en Synapse: una entidad creada automáticamente al guardar la primer Entry de un Record `type=INSTRUMENTAL`, con su propio `status` enum y su propio `InstrumentStatusLog`. La decisión arquitectónica del 2026-05-08 ("Records-as-Lists") apunta a colapsar esta y todas las companions de seguimiento (Sample, Batch, Stock) — el "estado" es un OWN field configurable del Record, no una columna fija.

Después del greping del schema confirmamos que `Instrument` es la **companion más aislada** del modelo:

- `Entry.instrument 1:1` (`schema.prisma:380`) — relación inversa que se elimina con la tabla.
- `InstrumentStatusLog.instrumentId` (`schema.prisma:416`) — el contenido se backfillea a `EntryStatusLog`.
- `Calibration.entryId` (`schema.prisma:734`) — **ya apunta a `Entry`, no a `Instrument`**. Sin cambio.
- `CalibrationPattern.patternEntryId` (`schema.prisma:757`) — el "instrumento patrón" ya es una Entry. Sin cambio.
- Assignments en otros dominios (Sample/Batch/Recipe/Matrix) — viven en JSON, no en FK. Sin cambio.

Auditoría adicional: el `InstrumentStatusChangedEvent` se emite en `instruments.service.changeStatus` y **no tiene consumers** — descartar la emisión es seguro.

Esto convierte el colapso en una operación quirúrgica que toca solo 2 tablas y un puñado de archivos, sin reescritura de FKs masiva.

---

## 2. Alcance

### Dentro
- Auto-agregado del field `ESTADO` (DROPDOWN, isStatus, transitions canónicas) al crear un Record `type=INSTRUMENTAL` (ya implementado, commit `5500725`).
- Listener genérico `entry-completion.listener` que reproduce los side-effects del legacy `instruments.service.changeStatus`:
  - Marcar `entry.status=COMPLETED + entry.completedAt` cuando el value destino tiene `option.isFinal === true`. Aplica para cualquier Record con field `isStatus`, no solo INSTRUMENTAL.
  - Recalcular `Entry.data.nextCalibrationAt = now() + record.periodicity` cuando un Record `type=INSTRUMENTAL` transiciona `IN_CALIBRATION → ACTIVE`.
- Migración SQL `<ts>_collapse_instrument` con backfill:
  1. Para cada Record `type=INSTRUMENTAL` sin field `isStatus`, crear el field con la config canónica.
  2. Backfill de `Entry.data[<statusFieldId>] = Instrument.status` para cada Sample/Instrument vinculado.
  3. Backfill de `Entry.data.nextCalibrationAt = Instrument.nextCalibrationAt` cuando aplique.
  4. Migrar `InstrumentStatusLog` rows a `EntryStatusLog` resolviendo el `statusFieldId` por record.
  5. `DROP TABLE InstrumentStatusLog`.
  6. `DROP TABLE Instrument`.
  7. `DROP TYPE InstrumentStatus`.
  8. Eliminar relaciones inversas (`Organization.instruments`, `Record.instruments`, `Entry.instrument`) del schema.
- Refactor de `instruments.service` y `instruments.controller` como wrappers sobre `entries.service` y `entryStatusLog`. Mantiene los endpoints públicos (`GET /instruments`, `GET /instruments/:id`, `POST /instruments/:id/status`, `GET /instruments/:id/history`) para no romper el frontend legacy. Eliminar la emisión del `InstrumentStatusChangedEvent` (auditoría confirmó: sin consumers).
- Eliminación del bloque que crea `Instrument` companion en `entries.service.create` y en `record-action.listener`. La Entry guarda `CODIGO` + `ESTADO` + `nextCalibrationAt` directamente en `data`.
- Seed: Record sistema "Instrumentos" (type INSTRUMENTAL, isSystem) creado por seed con periodicity por defecto.
- Frontend: la página `/instruments` y `/instruments/:id` redirigen al Record sistema. El historial se lee de `EntryStatusLog`. El modal de cambio de estado se reemplaza por el flujo Kanban del Record (drag-drop + modal de motivo cuando hay `requireReason`).

### Fuera de alcance (diferido)
- Eliminar `Calibration` o `CalibrationTemplate` (entidades propias con lifecycle ISO 17025 §6.4 — permanecen).
- Snapshot fields para `BatchInstrumentAssignment` / `SampleInstrumentAssignment` (Opción D del NEXT_SESSION.md).
- Migración de Records INSTRUMENTAL muy customizados sin field `isStatus`: el backfill agrega el field automáticamente, pero options/transitions custom requieren intervención manual del admin.

---

## 3. Modelo target

```
ANTES (en main + worktree pre-Fase 2)         DESPUÉS (post-Fase 2)
──────────────────────────────────────────────────────────────────
Record (type=INSTRUMENTAL)                    Record (type=INSTRUMENTAL)
  └─ Entry                                       └─ Entry
       └─ Instrument (1:1)                            └─ data: JSON {
            ├─ status: InstrumentStatus                    CODIGO: "...",
            ├─ nextCalibrationAt                           ESTADO: "ACTIVE",
            └─ statusLogs: InstrumentStatusLog[]           nextCalibrationAt: "..."
                                                        }

InstrumentStatusLog                           EntryStatusLog (único, append-only)
  ├─ instrumentId                                ├─ entryId, recordId, organizationId
  ├─ fromStatus, toStatus                        ├─ fieldId  ← id del DROPDOWN ESTADO
  ├─ reason                                      ├─ fromValue, toValue
  ├─ changedById                                 ├─ changedById
  └─ changedAt                                   ├─ triggeredByCascade
                                                 ├─ reason (nullable)
                                                 └─ createdAt

Calibration.entryId   → sin cambio (ya apunta a Entry directamente)
CalibrationPattern.patternEntryId → sin cambio
```

---

## 4. Schema

### 4.1 Cambios aplicados (Fase 1, ya en producción del worktree)

Migración `20260508120000_records_as_lists_foundation`:
- `RecordAction.actionType` (default `CREATE_ENTRY`) + `actionConfig`.
- Modelo `EntryStatusLog` append-only.
- Sin cambios sobre `Instrument` o `InstrumentStatusLog` aún.

### 4.2 Cambios pendientes (Fase 2)

Migración `<ts>_collapse_instrument`:
1. **Backfill**:
   - `INSERT INTO RecordField` (DROPDOWN ESTADO) en cada Record INSTRUMENTAL que no lo tenga.
   - `UPDATE Entry SET data = ...` con merge del status + nextCalibrationAt desde `Instrument`.
   - `INSERT INTO EntryStatusLog SELECT ... FROM InstrumentStatusLog JOIN ...`.
2. **DROPs**:
   - `DROP TABLE InstrumentStatusLog`.
   - `DROP TABLE Instrument`.
   - `DROP TYPE InstrumentStatus`.

### 4.3 Excepción append-only justificada

`InstrumentStatusLog` es append-only (regla NUNCA-HACER #4). El DROP se justifica porque **el contenido completo se preserva en `EntryStatusLog`** (también append-only). El paper trail ISO no se pierde — cambia de tabla destino. La excepción está documentada en este spec y debe revisarse con el agente `iso-compliance-auditor` antes de mergear.

---

## 5. Backend

### 5.1 `entry-completion.listener`

Listener genérico nuevo en `apps/api/src/modules/entries/listeners/entry-completion.listener.ts`. Escucha `EntryFieldValueChangedEvent`, carga el RecordField + Record, y aplica side-effects:

| Condición | Side-effect |
|---|---|
| `field.isStatus === true` y option destino tiene `isFinal === true` | `entry.status = COMPLETED`, `entry.completedAt = now()` |
| `record.type === 'INSTRUMENTAL'` y transición es `IN_CALIBRATION → ACTIVE` y `record.periodicity` definido | `entry.data.nextCalibrationAt = now() + periodicity` |

Errores logueados sin re-throw (patrón listener). El listener es idempotente — múltiples llamadas con el mismo evento producen el mismo resultado.

### 5.2 `instruments.service` refactor

| Método | Antes | Después |
|---|---|---|
| `findAll` | `prisma.instrument.findMany(...)` | `prisma.entry.findMany({ record: { type: 'INSTRUMENTAL', organizationId } })` con resolved fields |
| `findById` | `prisma.instrument.findFirst(...)` | `prisma.entry.findFirst(...)` por id |
| `findPatterns` | filtra `Instrument` por status `ACTIVE` y record sin CALIBRATION_TEMPLATE | filtra `Entry` por record type INSTRUMENTAL + `data[statusFieldId] === 'ACTIVE'` (resolver el statusFieldId por record) + record sin CALIBRATION_TEMPLATE field |
| `changeStatus` | UPDATE Instrument + INSERT InstrumentStatusLog + emit InstrumentStatusChangedEvent | wrapper que llama `entries.service.update(id, { data: { [statusFieldId]: newStatus }, transitionReason: reason })` y deja que los listeners escriban `EntryStatusLog` y recalculen side-effects |

`InstrumentStatusChangedEvent` queda como código muerto (sin emisores) — eliminar su `EVENT_NAME` y la clase del `domain-events.ts` después del refactor.

### 5.3 `entries.service.create`

El bloque que crea `Instrument` companion (~líneas que joinean `prisma.instrument.create`) se elimina. Para Records INSTRUMENTAL el flujo nuevo:
- El field DROPDOWN `ESTADO` (auto-agregado por `records.service`) tiene `isInitial=true` en `ACTIVE`. El `transition-validator` autocompleta el value inicial (lógica existente del workflow engine v2).
- `nextCalibrationAt` se calcula al COMPLETED de la primer entry — pero como ahora la Entry no auto-completa (lifecycle por field), el cálculo se hace cuando el field cambia a un `isFinal` o al primer movimiento entrante a `ACTIVE` desde `IN_CALIBRATION`. Para preservar la semántica legacy, agregar al listener `entry-completion`: si la Entry recién se crea con `data.nextCalibrationAt` ausente y el record tiene `periodicity`, calcular y patchear con `now() + periodicity`.

### 5.4 `record-action.listener`

El bloque `if (targetType === 'INSTRUMENTAL')` ya no aplica (no hay companion). Mantener el listener funcional para BATCH/SAMPLE/STOCK hasta que esas fases se ejecuten — solo eliminar el branch específico de INSTRUMENT.

---

## 6. Frontend

### 6.1 `/instruments/page.tsx`

Hoy: lista de instrumentos con filtros. Después: redirect a `/records/<instrumentos-record-id>` (el Record sistema creado por seed). La lógica de columnas/filters ya vive en el render de Record entries.

Si por alguna razón se quiere mantener una vista unificada que liste entries de TODOS los Records type INSTRUMENTAL (no solo el sistema), reescribir la página llamando a `api.entries.list({ recordType: 'INSTRUMENTAL' })` con resolved fields. Decisión preliminar: redirect.

### 6.2 `/instruments/[id]/page.tsx`

Hoy: detalle con historial leído de `InstrumentStatusLog`. Después: redirect a `/records/<recordId>/entries/<id>` (o reescribir leyendo `Entry` + `EntryStatusLog`). Modal de cambio de estado se elimina — el flujo Kanban del Record cubre el caso.

### 6.3 API client

`apps/web/src/lib/api.ts`: `samples` namespace (perdón, `instruments` namespace) queda como wrapper de `entries`. Sin breaking changes en imports.

---

## 7. Pilot

Después de aplicar la migración:
- El seed crea Record sistema "Instrumentos" con CODIGO + ESTADO (4 options) + periodicity.
- Crear nueva Entry desde el form: ESTADO autocompleta a `ACTIVE`, CODIGO obligatorio.
- Drag-drop ACTIVE → IN_CALIBRATION en Kanban: persistencia + `EntryStatusLog` row escrito.
- Drag-drop IN_CALIBRATION → ACTIVE: el listener recalcula `nextCalibrationAt` y patchea `Entry.data`.
- Drag-drop hacia DECOMMISSIONED: modal de motivo (transition `requireReason`); persistencia + `entry.status=COMPLETED` + `entry.completedAt`.
- Calibration creada vía `Calibration.entryId` apunta sin problema a la Entry.
- `/instruments` legacy redirige al Record sistema.

**Customización (validación del espíritu Lists)**: el usuario edita el Record sistema y CAMBIA los options del field ESTADO a `EN_USO`, `FUERA_DE_USO`, `EN_REVISION`. Crea nueva Entry → ESTADO autocompleta a la nueva option `isInitial`. Drag-drop entre las nuevas columnas funciona. `EntryStatusLog` refleja los nuevos values. Listener `entry-completion` solo dispara `nextCalibrationAt` si la transición coincide con la regla específica de INSTRUMENTAL (record.type, no value strings).

---

## 8. Checklist de implementación

### Fase 1 (foundational, ya commiteado)
- [x] Schema: `RecordAction.actionType + actionConfig`, `EntryStatusLog`.
- [x] Migración `20260508120000_records_as_lists_foundation`.
- [x] Listener `record-action` refactorizado (dispatcher).
- [x] Listener `entry-status-log` (append-only writer).
- [x] CLAUDE.md actualizados con regla EntryStatusLog.

### Fase 2 (esta sub-spec)
- [x] `records.service`: auto-add field ESTADO al type=INSTRUMENTAL.
- [ ] Listener `entry-completion` con side-effects (`isFinal` → COMPLETED + `IN_CALIBRATION → ACTIVE` recálculo nextCalibrationAt).
- [ ] Migración `<ts>_collapse_instrument` con backfill (Entry.data + EntryStatusLog) y DROPs.
- [ ] Refactor `instruments.service` y `instruments.controller` a wrappers sobre entries.
- [ ] Eliminar bloque `Instrument` companion en `entries.service.create` y `record-action.listener`.
- [ ] Eliminar `InstrumentStatusChangedEvent` del `domain-events.ts` (sin consumers).
- [ ] Seed: Record sistema "Instrumentos".
- [ ] Frontend `/instruments`: redirect / wrapper sobre entries.
- [ ] `iso-compliance-auditor` valida el reemplazo `InstrumentStatusLog → EntryStatusLog`.
- [ ] Pilot manual end-to-end.

---

## 9. Mapa de archivos

### Crear
```
apps/api/prisma/migrations/<ts>_collapse_instrument/migration.sql
apps/api/src/modules/entries/listeners/entry-completion.listener.ts
INSTRUMENT_COLLAPSE_SPEC.md (este archivo)
```

### Modificar
```
apps/api/prisma/schema.prisma                              (drop Instrument, drop InstrumentStatusLog, drop enum)
apps/api/src/modules/instruments/instruments.service.ts    (wrapper sobre entries.service)
apps/api/src/modules/instruments/instruments.controller.ts (endpoints como wrappers)
apps/api/src/modules/entries/entries.service.ts            (eliminar bloque Instrument companion)
apps/api/src/modules/entries/listeners/record-action.listener.ts (eliminar branch INSTRUMENTAL)
apps/api/src/modules/entries/entries.module.ts             (registrar entry-completion.listener)
apps/api/src/common/events/domain-events.ts                (eliminar InstrumentStatusChangedEvent)
apps/api/prisma/seed.ts                                    (Record sistema Instrumentos)
apps/web/src/app/(app)/instruments/page.tsx                (redirect / wrapper)
apps/web/src/app/(app)/instruments/[id]/page.tsx           (idem)
apps/web/src/lib/api.ts                                    (instruments namespace wrapper)
```

---

## 10. Criterios de aceptación

1. ✅ `pnpm --filter @synapse/api db:generate` clean.
2. ✅ `pnpm --filter @synapse/api exec tsc --noEmit` 0 nuevos errores.
3. ✅ `pnpm --filter @synapse/api exec prisma migrate reset --force` aplica todas las migraciones (incluyendo `<ts>_collapse_instrument`) + corre seed.
4. ✅ Tabla `Instrument`, tabla `InstrumentStatusLog` y enum `InstrumentStatus` ya no existen en la DB.
5. ✅ `EntryStatusLog` contiene los rows backfilleados desde `InstrumentStatusLog` (verificar con count antes/después en testing con datos representativos).
6. ✅ Crear nueva Entry INSTRUMENTAL desde la UI → `Entry.data` contiene `CODIGO`, `ESTADO=ACTIVE`, `nextCalibrationAt` calculado.
7. ✅ Drag-drop Kanban en Records INSTRUMENTAL persiste, escribe `EntryStatusLog`, marca `entry.completedAt` cuando target es `isFinal`.
8. ✅ Listener recalcula `nextCalibrationAt` cuando `IN_CALIBRATION → ACTIVE`.
9. ✅ Usuario customiza options del field ESTADO → motor genérico se adapta sin tocar código.
10. ✅ Endpoints `/instruments/*` siguen respondiendo (wrappers) — frontend legacy no rompe.
11. ✅ Calibration sigue funcionando — `Calibration.entryId` no requiere cambios.
12. ✅ AuditLog + EntryStatusLog reflejan toda la trazabilidad ISO.
13. ✅ `iso-compliance-auditor` da OK al reemplazo `InstrumentStatusLog → EntryStatusLog`.

---

## 11. Riesgos y rollback

### Riesgos
1. **DROP de `InstrumentStatusLog`** — append-only ISO. Mitigación: backfill exhaustivo a `EntryStatusLog` (también append-only) y validación con `iso-compliance-auditor`. La excepción está justificada y documentada.
2. **Records INSTRUMENTAL custom** sin field `isStatus`: el backfill auto-agrega el field. Si un admin tiene un Record con un DROPDOWN diferente que pretende ser status pero sin `isStatus: true`, no se detecta — keda con flow legacy degradado. Documentar al usuario.
3. **`prisma migrate reset --force`** descarta data de testing. Avisar antes de ejecutar.
4. **Performance** — queries por status pasan de columna indexada a JSON path. Aceptable para volumen actual; si sale doloroso, agregar índice GIN en `Entry.data`.
5. **Calibration cross-references**: ya apuntan a `Entry.id`, no a `Instrument.id`. Verificado en el grep, sin riesgo.

### Rollback
La migración es destructiva. Rollback requiere:
1. Restore de DB desde snapshot pre-migración.
2. `git revert -m 1 <merge_commit_sha>` y push.
3. `prisma migrate deploy` aplica las migraciones del state restaurado.

Antes de aplicar en producción: snapshot de DB obligatorio.

---

## 12. Referencias
- `WORKFLOW_ENGINE_SPEC.md` — motor v2 (Fase 1 base).
- `C:\Users\santi\.claude\plans\en-la-sesion-de-vectorized-dongarra.md` — plan macro Records-as-Lists.
- ISO 9001:2015 §8.5.1 — Control de la producción y prestación del servicio.
- ISO/IEC 17025:2017 §6.4 — Equipamiento (incluye control metrológico).
- ISO/IEC 17025:2017 §7.5 — Control de los registros técnicos.
- Microsoft Lists + Power Automate — referencia conceptual del paradigma.
