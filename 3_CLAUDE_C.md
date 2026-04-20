# QualitTab Types — packages/types/CLAUDE.md

## Propósito
Tipos TypeScript y enums compartidos entre `apps/api` y `apps/web`.
Nada de lógica de negocio aquí — solo tipos, interfaces y enums.

## Estructura
```
packages/types/src/
  index.ts          ← re-exporta todo
  enums.ts          ← todos los enums
  entities.ts       ← interfaces de entidades base
  dtos.ts           ← DTOs de request/response
  field-types.ts    ← tipos específicos de OWN fields
```

## enums.ts
```typescript
export enum UserRole {
  ADMIN = 'ADMIN',
  QUALITY_MANAGER = 'QUALITY_MANAGER',
  TECHNICIAN = 'TECHNICIAN',
  AUDITOR = 'AUDITOR',
}

export enum RecordType {
  PERIODIC = 'PERIODIC',
  NOT_PERIODIC = 'NOT_PERIODIC',
  NOT_PERIODIC_WITH_REVISION = 'NOT_PERIODIC_WITH_REVISION',
}

export enum FieldType {
  NUMBER = 'NUMBER',
  TEXT = 'TEXT',
  DATE = 'DATE',
  RELATED_ENTRY = 'RELATED_ENTRY',
  MULTIPLE_RELATED_ENTRY = 'MULTIPLE_RELATED_ENTRY',
  COMPARISON = 'COMPARISON',
  FORMULA = 'FORMULA',
}

export enum ComparisonOperator {
  LT = 'LT',
  LTE = 'LTE',
  GT = 'GT',
  GTE = 'GTE',
  EQ = 'EQ',
  BETWEEN = 'BETWEEN',
}

export enum InstrumentStatus {
  ACTIVE = 'ACTIVE',
  IN_CALIBRATION = 'IN_CALIBRATION',
  IN_REPAIR = 'IN_REPAIR',
  DECOMMISSIONED = 'DECOMMISSIONED',
}

export enum NonConformityStatus {
  OPEN = 'OPEN',
  IN_PROGRESS = 'IN_PROGRESS',
  RESOLVED = 'RESOLVED',
  CLOSED = 'CLOSED',
}

export enum EntryStatus {
  DRAFT = 'DRAFT',
  COMPLETED = 'COMPLETED',
  REQUIRES_REVISION = 'REQUIRES_REVISION',
  APPROVED = 'APPROVED',
}

export enum DocumentStatus {
  DRAFT = 'DRAFT',
  ACTIVE = 'ACTIVE',
  SUPERSEDED = 'SUPERSEDED',
}
```

## field-types.ts
```typescript
// Configuración de campo COMPARISON guardada en RecordField.comparisonConfig
export interface ComparisonConfig {
  operator: ComparisonOperator
  compareAgainst: 'CONSTANT' | 'FIELD'
  constantValue?: number
  fieldId?: string        // RecordField.id si compareAgainst === 'FIELD'
  secondValue?: number    // solo para BETWEEN
}

// Resultado de evaluación de una comparación en Entry
export interface ComparisonResult {
  passed: boolean
  value: number | string
  description: string   // ej: "98.5 debe ser > 95" → "✓ cumple"
}

// Configuración de campo FORMULA
export interface FormulaConfig {
  expression: string    // ej: "fieldId_abc * 100 / fieldId_xyz"
}

// Configuración de campo RELATED_ENTRY / MULTIPLE_RELATED_ENTRY
export interface RelatedEntryConfig {
  relatedRecordId: string
  relatedFieldIds: string[]
}

// Tipo del dato en Entry.data según FieldType
export type FieldValue =
  | number          // NUMBER
  | string          // TEXT, DATE (ISO string)
  | RelatedValue    // RELATED_ENTRY
  | RelatedValue[]  // MULTIPLE_RELATED_ENTRY
  // COMPARISON y FORMULA no van en Entry.data (son calculados)

export interface RelatedValue {
  entryId: string
  fields: Record<string, string | number> // fieldId → valor
}
```

## Reglas
- Siempre que se agregue un enum en Prisma, agregarlo aquí también
- Los DTOs de request deben tener el sufijo `Dto` (ej: `CreateRecordDto`)
- Los tipos de response tienen el sufijo `Response` (ej: `RecordResponse`)
- No importar desde `@prisma/client` en este package — son tipos independientes
