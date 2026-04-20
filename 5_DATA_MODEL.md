# QualitTab — Data Model

## Prisma Schema Completo

```prisma
// ─────────────────────────────────────────────
// ENUMS
// ─────────────────────────────────────────────

enum UserRole {
  ADMIN           // ve y hace todo dentro de su org
  QUALITY_MANAGER // ve su área y hacia abajo, crea registros/documentos
  TECHNICIAN      // ve solo su área, crea entradas
  AUDITOR         // ve todo (solo lectura)
}

enum RecordType {
  PERIODIC                    // se repite cada N días automáticamente
  NOT_PERIODIC                // se crea manualmente, sin repetición
  NOT_PERIODIC_WITH_REVISION  // se crea manualmente, requiere revisión/aprobación
}

enum FieldType {
  NUMBER
  TEXT
  DATE
  RELATED_ENTRY           // trae un campo de otra Entry de otro Record
  MULTIPLE_RELATED_ENTRY  // trae múltiples campos de otra Entry
  COMPARISON              // compara valor contra constante o campo OWN
  FORMULA                 // fórmula con campos numéricos de OWN
}

enum ComparisonOperator {
  LT   // <
  LTE  // <=
  GT   // >
  GTE  // >=
  EQ   // =
  BETWEEN
}

enum InstrumentStatus {
  ACTIVE
  IN_CALIBRATION
  IN_REPAIR
  DECOMMISSIONED
}

enum NonConformityStatus {
  OPEN
  IN_PROGRESS
  RESOLVED
  CLOSED
}

enum EntryStatus {
  DRAFT
  COMPLETED
  REQUIRES_REVISION
  APPROVED
}

enum DocumentStatus {
  DRAFT
  ACTIVE
  SUPERSEDED  // reemplazado por versión nueva
}

// ─────────────────────────────────────────────
// ORGANIZACIÓN Y USUARIOS
// ─────────────────────────────────────────────

model Organization {
  id          String   @id @default(cuid())
  name        String
  slug        String   @unique // para URLs amigables
  logoUrl     String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  areas        Area[]
  users        OrganizationUser[]
  whitelist    EmailWhitelist[]
  documents    Document[]
  records      Record[]
  instruments  Instrument[]
  auditLogs    AuditLog[]
}

// Árbol de áreas (recursivo)
model Area {
  id             String   @id @default(cuid())
  name           String
  organizationId String
  parentId       String?  // null = área raíz
  createdAt      DateTime @default(now())

  organization Organization   @relation(fields: [organizationId], references: [id])
  parent       Area?          @relation("AreaTree", fields: [parentId], references: [id])
  children     Area[]         @relation("AreaTree")
  users        OrganizationUser[]
  records      Record[]

  @@index([organizationId])
  @@index([parentId])
}

model User {
  id        String   @id @default(cuid())
  email     String   @unique
  name      String
  avatarUrl String?
  createdAt DateTime @default(now())

  organizations OrganizationUser[]
}

// Relación User <-> Organization con rol y área
model OrganizationUser {
  id             String   @id @default(cuid())
  userId         String
  organizationId String
  areaId         String?
  role           UserRole @default(TECHNICIAN)
  isActive       Boolean  @default(true)
  createdAt      DateTime @default(now())

  user         User         @relation(fields: [userId], references: [id])
  organization Organization @relation(fields: [organizationId], references: [id])
  area         Area?        @relation(fields: [areaId], references: [id])

  @@unique([userId, organizationId])
  @@index([organizationId])
}

// Whitelist de emails permitidos por organización
model EmailWhitelist {
  id             String    @id @default(cuid())
  email          String
  organizationId String
  role           UserRole  @default(TECHNICIAN)
  areaId         String?
  invitedAt      DateTime  @default(now())
  usedAt         DateTime? // cuando el usuario hizo login por primera vez

  organization Organization @relation(fields: [organizationId], references: [id])

  @@unique([email, organizationId])
  @@index([organizationId])
}

// ─────────────────────────────────────────────
// DOCUMENTOS (marco teórico ISO)
// ─────────────────────────────────────────────

model Document {
  id             String         @id @default(cuid())
  organizationId String
  title          String
  code           String?        // ej: ISO-9001, SOP-LAB-001
  version        String         @default("1.0")
  status         DocumentStatus @default(DRAFT)
  fileUrl        String?        // R2 URL si se subió PDF
  content        String?        // texto si se cargó inline
  createdAt      DateTime       @default(now())
  updatedAt      DateTime       @updatedAt
  createdById    String

  organization Organization @relation(fields: [organizationId], references: [id])
  records      Record[]     // registros basados en este documento

  @@index([organizationId])
}

// ─────────────────────────────────────────────
// REGISTROS (templates)
// ─────────────────────────────────────────────

model Record {
  id             String     @id @default(cuid())
  organizationId String
  areaId         String?
  documentId     String?    // documento base (opcional)
  name           String
  type           RecordType
  periodicity    Int?       // días entre entradas (solo PERIODIC)
  notifyDaysBefore Int?     // días antes del due_date para notificar
  isActive       Boolean    @default(true)
  createdAt      DateTime   @default(now())
  updatedAt      DateTime   @updatedAt
  createdById    String

  organization Organization  @relation(fields: [organizationId], references: [id])
  area         Area?         @relation(fields: [areaId], references: [id])
  document     Document?     @relation(fields: [documentId], references: [id])
  fields       RecordField[] // definición de campos OWN
  entries      Entry[]
  // acciones que este registro dispara en otros
  actionsAsSource RecordAction[] @relation("SourceRecord")
  // acciones que otros registros disparan en este
  actionsAsTarget RecordAction[] @relation("TargetRecord")

  @@index([organizationId])
}

// Definición de campos OWN del registro
model RecordField {
  id          String    @id @default(cuid())
  recordId    String
  label       String    // nombre visible del campo
  fieldType   FieldType
  order       Int       // orden en el formulario
  isIdentifier Boolean  @default(false) // es parte de la key del registro
  isRequired   Boolean  @default(true)
  
  // Para RELATED_ENTRY / MULTIPLE_RELATED_ENTRY
  relatedRecordId    String? // qué record referencia
  relatedFieldIds    String[] // qué campos trae (array de RecordField.id)
  
  // Para COMPARISON — guardado como JSON
  // {
  //   operator: ComparisonOperator,
  //   compareAgainst: "CONSTANT" | "FIELD",
  //   constantValue: number | null,
  //   fieldId: string | null,         // RecordField.id del campo OWN
  //   secondValue: number | null      // para BETWEEN
  // }
  comparisonConfig Json?
  
  // Para FORMULA
  // { expression: "field_id_1 + field_id_2 / field_id_3" }
  formulaConfig Json?

  record Record @relation(fields: [recordId], references: [id])

  @@index([recordId])
}

// Acción: cuando se crea/actualiza una Entry en SourceRecord,
// crea automáticamente una Entry en TargetRecord
model RecordAction {
  id             String @id @default(cuid())
  sourceRecordId String
  targetRecordId String
  // mapeo de campos: qué campo del source va a qué campo del target
  // [{ sourceFieldId: string, targetFieldId: string }]
  fieldMapping   Json
  createdAt      DateTime @default(now())

  sourceRecord Record @relation("SourceRecord", fields: [sourceRecordId], references: [id])
  targetRecord Record @relation("TargetRecord", fields: [targetRecordId], references: [id])
}

// ─────────────────────────────────────────────
// ENTRADAS (instancias de registros)
// ─────────────────────────────────────────────

model Entry {
  id          String      @id @default(cuid())
  recordId    String
  status      EntryStatus @default(DRAFT)
  dueDate     DateTime?   // fecha límite (calculada para PERIODIC)
  completedAt DateTime?
  createdAt   DateTime    @default(now())
  updatedAt   DateTime    @updatedAt
  createdById String
  
  // Valores de los campos OWN guardados como JSON
  // { "field_id_abc": 98.5, "field_id_xyz": "Juan", ... }
  data        Json        @default("{}")
  
  // Resultados de comparaciones (calculados al guardar)
  // { "field_id_comp": { passed: true, value: 98.5, expected: ">95" } }
  comparisonResults Json? 
  
  // Valores calculados de fórmulas (calculados al guardar)
  // { "field_id_formula": 123.45 }
  formulaResults Json?

  record          Record           @relation(fields: [recordId], references: [id])
  nonConformities NonConformity[]
  // entrada que disparó la creación de esta (via RecordAction)
  triggeredById   String?

  @@index([recordId])
  @@index([createdById])
}

// ─────────────────────────────────────────────
// INSTRUMENTAL
// ─────────────────────────────────────────────

model Instrument {
  id             String           @id @default(cuid())
  organizationId String
  name           String
  code           String?          // código interno / N° de serie
  brand          String?
  model          String?
  status         InstrumentStatus @default(ACTIVE)
  notes          String?
  createdAt      DateTime         @default(now())
  updatedAt      DateTime         @updatedAt

  organization Organization @relation(fields: [organizationId], references: [id])
  statusLogs   InstrumentStatusLog[]

  @@index([organizationId])
}

// Log de cambios de estado del instrumento (trazabilidad)
model InstrumentStatusLog {
  id           String           @id @default(cuid())
  instrumentId String
  fromStatus   InstrumentStatus
  toStatus     InstrumentStatus
  reason       String?
  changedById  String
  changedAt    DateTime         @default(now())

  instrument Instrument @relation(fields: [instrumentId], references: [id])
}

// ─────────────────────────────────────────────
// NO CONFORMIDADES
// ─────────────────────────────────────────────

model NonConformity {
  id             String              @id @default(cuid())
  organizationId String
  entryId        String?             // entry que la originó (puede ser manual)
  fieldId        String?             // campo comparison que falló
  title          String
  description    String
  status         NonConformityStatus @default(OPEN)
  detectedAt     DateTime            @default(now())
  resolvedAt     DateTime?
  createdById    String
  assignedToId   String?             // OrganizationUser.id

  entry          Entry?              @relation(fields: [entryId], references: [id])
  correctiveActions CorrectiveAction[]

  @@index([organizationId])
  @@index([entryId])
}

model CorrectiveAction {
  id               String    @id @default(cuid())
  nonConformityId  String
  description      String
  dueDate          DateTime?
  completedAt      DateTime?
  createdById      String
  createdAt        DateTime  @default(now())

  nonConformity NonConformity @relation(fields: [nonConformityId], references: [id])
}

// ─────────────────────────────────────────────
// AUDIT LOG (inmutable, append-only)
// ─────────────────────────────────────────────

model AuditLog {
  id             String   @id @default(cuid())
  organizationId String
  userId         String
  action         String   // ej: "entry.created", "instrument.status_changed"
  entityType     String   // ej: "Entry", "Instrument", "Record"
  entityId       String
  before         Json?    // estado anterior
  after          Json?    // estado nuevo
  ip             String?
  createdAt      DateTime @default(now())

  organization Organization @relation(fields: [organizationId], references: [id])

  @@index([organizationId])
  @@index([entityType, entityId])
  @@index([userId])
}
```

---

## Notas clave del modelo

### Multitenant
- **Todas** las queries deben filtrar por `organizationId`
- Nunca exponer datos cross-tenant
- El `organizationId` viene siempre del JWT, nunca del body del request

### OWN Fields dinámicos
- Los valores se guardan en `Entry.data` como JSON: `{ "fieldId": value }`
- Los IDs de `RecordField` son las keys del JSON
- Al guardar una Entry, el backend calcula `comparisonResults` y `formulaResults`
- Los campos `isIdentifier` no pueden modificarse una vez que la entry está `COMPLETED`

### Seguridad por jerarquía
- Un usuario ve entradas de su área + todas las sub-áreas recursivamente
- `AUDITOR` ve todo pero no puede crear/editar nada
- `ADMIN` puede todo dentro de su organización
- Implementar con un Guard de NestJS que resuelva el árbol de áreas permitidas

### Campos COMPARISON
El `comparisonConfig` en JSON tiene esta forma:
```json
{
  "operator": "BETWEEN",
  "compareAgainst": "CONSTANT",
  "constantValue": 95,
  "secondValue": 105,
  "fieldId": null
}
```
Si `compareAgainst` es `"FIELD"`, se usa el valor de otro campo OWN de la misma entry.

### Campos FORMULA
El `formulaConfig` usa los IDs de campos como variables:
```json
{
  "expression": "clx1abc + clx2def / clx3ghi"
}
```
Evaluar con `mathjs` en el backend. Nunca `eval()`.

### RecordAction
Cuando se crea/completa una Entry en el `sourceRecord`, el sistema crea automáticamente
una Entry en el `targetRecord` con los campos mapeados en `fieldMapping`.
Esto es la automatización del ejemplo termómetro → calibración.
