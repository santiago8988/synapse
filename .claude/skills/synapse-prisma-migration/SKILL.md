---
name: synapse-prisma-migration
description: Workflow guiado para crear una migración de Prisma en Synapse — editar schema, generar migración, revisar SQL, ejecutar checklist ISO (append-only, índices organizationId, sincronización con packages/types). Frena si la migración toca tablas append-only de forma destructiva.
---

# synapse-prisma-migration

Asistencia paso a paso para crear migraciones seguras en `apps/api/prisma/migrations/`. Garantiza que el SQL generado cumpla las reglas ISO y de aislamiento multitenant antes de aplicarlo.

## Workflow

### Paso 1 — Editar schema.prisma

El usuario indica qué cambio quiere (ej. "agregar campo `nextMaintenanceAt` a `Instrument`"). Editar `apps/api/prisma/schema.prisma`:

- Si es campo nuevo nullable → ok directo.
- Si es campo nuevo `NOT NULL` con default → ok directo.
- Si es campo nuevo `NOT NULL` sin default → frenar y proponer estrategia de backfill (ver paso 4).
- Si es modelo nuevo → verificar que tenga `organizationId`, FK a `Organization`, e índice sobre `organizationId`.
- Si es enum nuevo → verificar que se replicará en `packages/types/src/enums.ts`.

### Paso 2 — Generar la migración

```bash
pnpm --filter @synapse/api db:migrate -- --name <descriptive_snake_case>
```

Naming:
- Bien: `add_instrument_next_maintenance`, `recipe_isactive`, `calibration_pattern`.
- Mal: `update`, `fix`, `changes`, `migration_2`.

### Paso 3 — Revisar el SQL generado

Abrir `apps/api/prisma/migrations/<timestamp>_<name>/migration.sql` y verificar:

#### Checklist append-only (BLOQUEANTE)
Frenar si el SQL contiene cualquiera de:
```
DROP TABLE "AuditLog"
DROP TABLE "InstrumentStatusLog"
DROP TABLE "BatchStatusLog"
DROP TABLE "SampleCustodyEvent"
ALTER TABLE "AuditLog" DROP COLUMN ...
ALTER TABLE "InstrumentStatusLog" DROP COLUMN ...
TRUNCATE "AuditLog"
```
Si aparece, abortar y consultar al usuario.

#### Checklist multitenant
Para cada `CREATE TABLE`:
- ¿Tiene `"organizationId" TEXT NOT NULL`? (salvo que sea entidad global como `User`).
- ¿Tiene `FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")`?
- ¿Tiene `CREATE INDEX ... ON "<Table>"("organizationId")`?

#### Checklist de tipos
- Timestamps → `TIMESTAMP(3)`.
- JSON → `JSONB` (no `JSON`).
- IDs → `TEXT NOT NULL`.

#### Checklist de FK
Cada `FOREIGN KEY` debe tener `ON DELETE` explícito (`CASCADE`, `SET NULL`, o `RESTRICT`).

#### Checklist de NOT NULL sin default
Si una columna se agrega `NOT NULL` sin `DEFAULT` en una tabla que ya tiene datos en producción:
- Frenar.
- Proponer al usuario el patrón de tres pasos:
  1. Esta migración: agregar columna `NULL`.
  2. Backfill (script de seed o migración manual con `UPDATE`).
  3. Migración futura: `ALTER TABLE ... ALTER COLUMN ... SET NOT NULL`.

### Paso 4 — Sincronizar packages/types

Si la migración agrega/modifica un enum:
- Abrir `packages/types/src/enums.ts`.
- Agregar/modificar el enum manualmente para que matchee `schema.prisma`.
- Si se agregó un valor a un enum existente (ej. `EntryStatus.INACTIVE`), agregarlo también acá.

Si la migración agrega un nuevo `FieldType`:
- Agregar a `enums.ts`.
- Considerar si necesita config type en `packages/types/src/field-types.ts`.
- Considerar si el frontend necesita un render nuevo en `apps/web/src/components/forms/dynamic-record-form/fields.tsx`.

### Paso 5 — Aplicar la migración

```bash
pnpm --filter @synapse/api db:generate    # regenera Prisma Client
```

Para entornos:
- Local: `pnpm db:migrate` ya la aplica al correrla.
- Supabase/producción: ejecutar el SQL manualmente desde el panel de SQL.

### Paso 6 — Verificar el código que la consume

Si la migración renombró o eliminó una columna:
```bash
grep -rn "<old_column_name>" apps/api/src apps/web/src
```
Cualquier match es un fix pendiente — la migración es incompleta sin esos cambios.

### Paso 7 — Documentar rollback

Si la migración hace algo irreversible (DROP COLUMN con datos, RENAME que no se puede deshacer fácil), agregar al inicio del `migration.sql` un comentario:

```sql
-- ROLLBACK: esta migración drop_old_column_X no es trivialmente reversible.
-- Para revertir: restaurar de backup pre-migración. Backup tomado el YYYY-MM-DD por <usuario>.
```

## Plantilla de output al usuario

```
Migración: 20260507_add_instrument_next_maintenance

Cambios al schema:
- Instrument: + nextMaintenanceAt DateTime?

SQL generado: [path]

Checklist:
✓ Append-only: no toca tablas restringidas
✓ Multitenant: N/A (campo en tabla existente)
✓ Tipos: TIMESTAMP(3) usado
✓ NOT NULL: no aplica (nullable)
✓ Sincronización packages/types: N/A (no hay cambios de enums)

Próximos pasos:
1. pnpm db:generate
2. (opcional) Aplicar a Supabase manualmente
3. Verificar que entries.service o instruments.service usen el nuevo campo
```

## NO hacer

- No correr `pnpm db:push` si la rama va a producción — solo migraciones versionadas.
- No editar manualmente `migration.sql` salvo para agregar comentarios o un backfill controlado.
- No saltear el paso 4 (sincronización) — el frontend rompe en CI si los enums no matchean.
- No combinar múltiples cambios no relacionados en una sola migración — una unidad de cambio = una migración.
