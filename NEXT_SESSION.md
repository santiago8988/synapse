# Continuación — Workflow Engine v2

> **Para la próxima sesión de Claude Code**: leé este archivo primero, después dejá que el usuario elija dirección.

## Dónde estás

- **Worktree**: `C:\Users\santi\Desktop\Synapse\.claude\worktrees\workflow-engine-kanban`
- **Branch**: `worktree-workflow-engine-kanban` (sincronizada con `origin` en `git@github.com:santiago8988/synapse.git`)
- **Main**: en GitHub solo tiene el commit base `df1cf29`. Local tiene cambios sin commitear (redesign visual). El worktree YA importó esos cambios visuales y los commiteó como parte de su trabajo.

## Lo que se logró (8 commits)

```
19306c3 docs: importar CLAUDE.md por workspace + legacy specs al worktree
64402ab polish(workflow-engine): render badge con color para DROPDOWN ricos en tabla Entries
59b25e7 docs(workflow-engine): WORKFLOW_ENGINE_SPEC.md actualizado a v2
00717b8 feat: import redesigned UI from main + integrate Kanban tab in records/[id]
03a90f7 feat(workflow-engine): KanbanBoard component + entries.update transitionReason
7f406fa feat(workflow-engine): backend v2 — DROPDOWN-as-status + FIELD_VALUE_CHANGED
0f4b097 fix(prisma): orden y idempotencia de migraciones para resets limpios
df1cf29 initial: Synapse by NosisHub
```

**Resumen en una frase**: implementamos un motor de workflows configurables donde el "estado" de una `Entry` vive como un campo `DROPDOWN` con flag `isStatus` en su `comparisonConfig` (en vez de una columna separada), con transiciones declarativas, drag-drop Kanban, y un nuevo trigger `FIELD_VALUE_CHANGED` para `RecordAction`. Pilot validado con un Record "No Conformidades" creado por el seed.

## Archivos clave a leer (en este orden)

1. **`WORKFLOW_ENGINE_SPEC.md`** — spec v2 completa con 13 secciones: arquitectura, schema, backend, frontend, pilot, criterios de aceptación, riesgos, evolución futura. Es la fuente canónica del motor.
2. **`CLAUDE.md`** (raíz) — identidad de Synapse, stack, 10 reglas NUNCA-HACER ISO/seguridad.
3. **`apps/api/CLAUDE.md`** — convenciones backend, patrones obligatorios para controllers/services, eventos de dominio existentes.
4. **`apps/web/CLAUDE.md`** — convenciones frontend, dynamic forms.
5. **`SAMPLE_CUSTODY_SPEC.md`** — spec ISO 17025 §7.4 pendiente, formato canónico que seguimos para nuevas specs.
6. **`docs/legacy/`** — markdowns originales QualitTab. Contexto histórico, no estado actual.

## Estado del pilot validado

Si el usuario reporta dudas sobre si funciona, estos son los caminos verificados:

- Login con `santiago.mdp@gmail.com` o `santiago@gmail.com` (whitelist en seed) ✓
- En `/records` aparece el Record "No Conformidades" sistema ✓
- En `/records/<NCs-id>`: pestaña "Kanban" activa por default, 4 columnas con colores ✓
- Crear entry: ESTADO autocompleta a OPEN, queda en DRAFT ✓
- Drag-drop Kanban OPEN→IN_PROGRESS persiste ✓
- Drag-drop CLOSED→OPEN abre modal de motivo ✓
- Drag-drop IN_PROGRESS→CLOSED rechazado (transición no declarada) ✓
- Tabla "Entries" muestra ESTADO como badge con color ✓

## Decisiones del usuario que ya tomamos (NO re-discutir)

1. **DROPDOWN con transitions opcionales** ganó sobre stateMachine separado o approval-only.
2. **Migración gradual de companions** — empezar por NCs (ya hecho como pilot), después uno por uno.
3. **Side-effects de `changeStatus`** se mueven a listeners de `FIELD_VALUE_CHANGED` cuando cada companion migre.
4. **Companions persisten** para datos estructurales y joins ricos. Solo el manejo de estados migra.
5. **Snapshot fields para assignments** (idea del usuario) — documentado como evolución futura, no implementado.

## Lo que NO está hecho (próximas opciones)

El usuario va a elegir entre estas tres. Esperá que elija — no asumas.

### Opción B — Consolidar `/non-conformities` legacy (2-4 hrs)
Hoy coexisten dos flujos:
- Página `/non-conformities` que usa el enum `NonConformityStatus` y tabla `NonConformity` (legacy).
- Record sistema "No Conformidades" con field DROPDOWN `ESTADO` (nuevo, ya pilot).

Tres caminos:
1. Redirigir `/non-conformities` al detalle del Record. Más simple.
2. Mantener dual-source: la página detecta y muestra ambos.
3. Migrar las NCs viejas como entries del Record (data migration).

### Opción C — Migrar Sample a DROPDOWN-as-status (1-2 días) [**recomendada**]
Primer companion real. Validar el patrón en estructura más rica (matrix + methods + results JSON). Si funciona, los demás (Calibration, Batch, Instrument) son variaciones más simples.

Pasos:
1. Escribir `SAMPLE_DROPDOWN_STATUS_SPEC.md` (~30 min, formato como `SAMPLE_CUSTODY_SPEC.md`).
2. Modificar el Record sistema de Sample (o crear uno nuevo) con field DROPDOWN `ESTADO` + transitions equivalentes a `SampleStatus` legacy.
3. Migrar listeners del side-effect de `samples.changeStatus` (validación de transición + completedAt) al trigger `FIELD_VALUE_CHANGED` con condition por `fieldId === statusFieldId`.
4. Refactor de `samples/[id]/page.tsx` y `samples/page.tsx` para leer del Record + Entry en vez de tabla `Sample` directamente.
5. Deprecar `/samples/:id/status` endpoint (mantenerlo como wrapper).

### Opción D — Snapshot fields para assignments (2-3 días)
Implementar `INSTRUMENT_ASSIGNMENT_LIST` como nuevo `FieldType`. Habilita el colapso real de `BatchInstrumentAssignment` y `SampleInstrumentAssignment`. Idea del usuario, documentada en `WORKFLOW_ENGINE_SPEC.md §12.1`.

## Cómo proceder

1. Saludá al usuario. Confirmá que leíste este brief y los CLAUDE.md.
2. Pediles cuál opción prefieren (B, C o D), o si quieren empezar por otro lado (polish menor, fix bugs si reportaron alguno, etc.).
3. Si eligen C (recomendada), arrancá por escribir `SAMPLE_DROPDOWN_STATUS_SPEC.md` siguiendo el formato de `WORKFLOW_ENGINE_SPEC.md` (13 secciones).
4. Trabajá siempre **dentro del worktree**, no en main. Cada commit pusheá a `origin/worktree-workflow-engine-kanban`.
5. Si necesitás resetear la DB de testing: `pnpm --filter @synapse/api exec prisma migrate reset --force`. Eso aplica las 28 migraciones limpias y corre el seed (incluye Record NCs).

## Gotchas conocidos

- **Geist font**: el `apps/web/src/app/layout.tsx` carga Geist via `<link>` en `<head>` (no via `next/font/google` ni paquete `geist`). No tocar.
- **`apps/api/.env` es local**: apunta a una DB de testing en Supabase. No commitear. Si la DB de testing se descontroló, podés copiarla de main: `cp /c/Users/santi/Desktop/Synapse/apps/api/.env apps/api/.env`.
- **`localStorage` del browser**: si el JWT en localStorage apunta a un User que ya no existe (ej. después de un reset), el frontend tira `auth.getMe` con error. Limpieza: `localStorage.removeItem('synapse_token'); location.href='/login'`.
- **`pnpm dev` en Windows**: Prisma client lockea `.dll.node` cuando el proceso está corriendo. Para regenerar (`db:generate` o `migrate reset`) parar `pnpm dev` primero (Ctrl+C).
- **TypeScript baseline**: hay ~20 errores pre-existentes en `apps/web/` (la mayoría en `records/[id]`, `settings`, `layout`). Tolerables. Solo te preocupes de los nuevos que introduzca tu cambio.
- **Trigger `FIELD_VALUE_CHANGED`**: el flag `triggeredByCascade` siempre se emite como `false` desde `entries.service.update` actualmente. Propagarlo desde el listener cuando se cree una entry cascadeada está pendiente. Anti-loop por ahora se basa en `allowCascade: false` (default).

## Plan original (referencia histórica)

`C:\Users\santi\.claude\plans\necesito-q-analices-synapse-elegant-honey.md` (afuera del worktree, en home del usuario). Tiene el contexto completo de cómo se llegó al pivot v1 → v2, las 4 fases del worktree, y el roadmap diferido.
