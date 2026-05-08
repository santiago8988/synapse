# @synapse/types

Tipos TypeScript, enums y DTOs compartidos entre `apps/api` y `apps/web`. **Sin lógica de negocio** — solo declaraciones.

## Estructura

```
packages/types/src/
  index.ts          ← re-exporta todo
  enums.ts          ← UserRole, RecordType, FieldType, ComparisonOperator, InstrumentStatus, etc.
  entities.ts       ← interfaces de entidades base
  dtos.ts           ← DTOs de request/response
  field-types.ts    ← ComparisonConfig, FormulaConfig, RelatedEntryConfig, FieldValue
```

## Reglas

1. **No importar de `@prisma/client`**. Estos tipos son la API pública del monorepo y deben poder consumirse sin generar el Prisma client.
2. **DTOs de request**: sufijo `Dto` (ej. `CreateRecordDto`).
3. **DTOs de response**: sufijo `Response` (ej. `RecordResponse`).
4. **Enums sincronizados con Prisma**: cada vez que se agrega/modifica un enum en `apps/api/prisma/schema.prisma`, replicarlo aquí. La fuente de verdad es Prisma; este archivo lo refleja para que el frontend lo consuma sin instalar `@prisma/client`.
5. **Sin tipos `any`**. Usar `unknown` cuando el shape es genuinamente dinámico (ej. `Entry.data` para campos OWN).

## Enums clave

Los siguientes enums son críticos para la lógica de negocio y deben mantenerse exactamente alineados con `schema.prisma`:

- `UserRole` — ADMIN, QUALITY_MANAGER, TECHNICIAN, AUDITOR
- `RecordType` — PERIODIC, NOT_PERIODIC, NOT_PERIODIC_WITH_REVISION, INSTRUMENTAL, BATCH, SAMPLE, STOCK, CALIBRATION
- `FieldType` — NUMBER, TEXT, DATE, DROPDOWN, RELATED_ENTRY, MULTIPLE_RELATED_ENTRY, COMPARISON, FORMULA, RECIPE_SELECT, MATRIX_METHOD, QUANTITY, CALIBRATION_TEMPLATE
- `EntryStatus` — DRAFT, COMPLETED, REQUIRES_REVISION, APPROVED (+ INACTIVE pendiente — ver `cascada.md`)
- `InstrumentStatus` — ACTIVE, IN_CALIBRATION, IN_REPAIR, DECOMMISSIONED
- `DocumentStatus` — DRAFT, ACTIVE, SUPERSEDED
- `RecordStatus` — DRAFT, ACTIVE, SUPERSEDED (para plantillas con circuito de aprobación)
- `ApprovalStatus`, `ApprovableEntity` — circuito ISO de aprobación
- `BatchStatus`, `SampleStatus`, `CalibrationStatus`, `NonConformityStatus`

## field-types.ts

Tipos auxiliares para campos OWN serializables en JSON (`RecordField.comparisonConfig`, `RecordField.formulaConfig`, `Entry.data`, `Entry.comparisonResults`, `Entry.formulaResults`).

```typescript
interface ComparisonConfig {
  operator: ComparisonOperator
  compareAgainst: 'CONSTANT' | 'FIELD'
  constantValue?: number
  fieldId?: string
  secondValue?: number  // solo BETWEEN
}

interface FormulaConfig {
  expression: string  // ej: "fieldId_a + fieldId_b / fieldId_c"
}

interface RelatedEntryConfig {
  relatedRecordId: string
  relatedFieldIds: string[]
}
```

## Cuando agregar un tipo nuevo

1. Si modela un campo en Prisma → agregar el tipo equivalente en `entities.ts` (no importarlo de Prisma).
2. Si es un payload de API → agregar `*Dto` o `*Response` en `dtos.ts`.
3. Si es config para un nuevo `FieldType` → agregar en `field-types.ts`.
4. Si es un enum → agregar en `enums.ts` + verificar que esté en `schema.prisma`.
5. Re-exportar desde `index.ts`.
