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
  INSTRUMENTAL = 'INSTRUMENTAL',
  BATCH = 'BATCH',
  SAMPLE = 'SAMPLE',
}

export enum FieldType {
  NUMBER = 'NUMBER',
  TEXT = 'TEXT',
  DATE = 'DATE',
  DROPDOWN = 'DROPDOWN',
  MATRIX_METHOD = 'MATRIX_METHOD',
  RECIPE_SELECT = 'RECIPE_SELECT',
  QUANTITY = 'QUANTITY',
  CALIBRATION_TEMPLATE = 'CALIBRATION_TEMPLATE',
  RELATED_ENTRY = 'RELATED_ENTRY',
  MULTIPLE_RELATED_ENTRY = 'MULTIPLE_RELATED_ENTRY',
  COMPARISON = 'COMPARISON',
  FORMULA = 'FORMULA',
  FILE_PDF = 'FILE_PDF',
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
}

export enum DocumentStatus {
  DRAFT = 'DRAFT',
  IN_REVIEW = 'IN_REVIEW',
  ACTIVE = 'ACTIVE',
  SUPERSEDED = 'SUPERSEDED',
}

export enum RecordStatus {
  DRAFT = 'DRAFT',
  IN_REVIEW = 'IN_REVIEW',
  ACTIVE = 'ACTIVE',
}

export enum QualityRoleType {
  REVIEWER = 'REVIEWER',
  APPROVER = 'APPROVER',
}

export enum ApprovalStatus {
  PENDING_REVIEW = 'PENDING_REVIEW',
  PENDING_APPROVAL = 'PENDING_APPROVAL',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

export enum ApprovableEntity {
  DOCUMENT = 'DOCUMENT',
  RECORD = 'RECORD',
  RECIPE = 'RECIPE',
}

export enum BatchStatus {
  PLANNED = 'PLANNED',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

export enum SampleStatus {
  RECEIVED = 'RECEIVED',
  IN_TESTING = 'IN_TESTING',
  COMPLETED = 'COMPLETED',
}

// Trigger que dispara una RecordAction. ENTRY_COMPLETED es el comportamiento
// histórico (default para back-compat); los demás se introducen con el motor
// de workflows configurable. Sincronizado con apps/api/prisma/schema.prisma.
// Pivot v2: FIELD_VALUE_CHANGED reemplaza al ENTRY_STATE_CHANGED del spec
// original — el estado vive como DROPDOWN OWN field.
export enum TriggerType {
  ENTRY_CREATED = 'ENTRY_CREATED',
  ENTRY_COMPLETED = 'ENTRY_COMPLETED',
  FIELD_VALUE_CHANGED = 'FIELD_VALUE_CHANGED',
  COMPARISON_FAILED = 'COMPARISON_FAILED',
}

// Tipo de acción ejecutada por una RecordAction cuando matchea trigger+condition.
// CREATE_ENTRY es el comportamiento histórico (crear entry en target record).
// Los demás se dispatchean por RecordActionListener.execute<Type>(action, event)
// y leen su config de RecordAction.actionConfig (ver field-types.ts para shapes).
export enum RecordActionType {
  CREATE_ENTRY = 'CREATE_ENTRY',
  UPDATE_FIELD = 'UPDATE_FIELD',
  NOTIFY = 'NOTIFY',
  EMAIL = 'EMAIL',
  WEBHOOK = 'WEBHOOK',
}
