import {
  UserRole,
  RecordType,
  RecordStatus,
  FieldType,
  InstrumentStatus,
  NonConformityStatus,
  EntryStatus,
  DocumentStatus,
  QualityRoleType,
  ApprovalStatus,
  ApprovableEntity,
  BatchStatus,
  SampleStatus,
} from './enums'
import { ComparisonConfig, FormulaConfig } from './field-types'

export interface Organization {
  id: string
  name: string
  slug: string
  logoUrl: string | null
  createdAt: string
  updatedAt: string
}

export interface Area {
  id: string
  name: string
  organizationId: string
  parentId: string | null
  leaderId: string | null
  createdAt: string
  children?: Area[]
  leader?: OrganizationUser
}

export interface User {
  id: string
  email: string
  name: string
  avatarUrl: string | null
  createdAt: string
}

export interface Position {
  id: string
  organizationId: string
  name: string
  createdAt: string
}

export interface OrganizationUser {
  id: string
  userId: string
  organizationId: string
  areaId: string | null
  positionId: string | null
  role: UserRole
  phone: string | null
  signature: string | null
  isActive: boolean
  createdAt: string
  user?: User
  area?: Area
  position?: Position
  trainings?: Training[]
}

export interface Training {
  id: string
  organizationId: string
  organizationUserId: string
  name: string
  description: string | null
  provider: string | null
  completedAt: string
  expiresAt: string | null
  certificateUrl: string | null
  createdAt: string
}

export interface EmailWhitelistItem {
  id: string
  email: string
  organizationId: string
  role: UserRole
  areaId: string | null
  invitedAt: string
  usedAt: string | null
}

export interface Document {
  id: string
  organizationId: string
  title: string
  code: string | null
  version: string
  status: DocumentStatus
  fileUrl: string | null
  content: string | null
  createdAt: string
  updatedAt: string
  createdById: string
}

export interface RecordField {
  id: string
  recordId: string
  label: string
  fieldType: FieldType
  order: number
  isIdentifier: boolean
  isRequired: boolean
  relatedRecordId: string | null
  relatedFieldIds: string[]
  comparisonConfig: ComparisonConfig | null
  formulaConfig: FormulaConfig | null
}

export interface QRecord {
  id: string
  organizationId: string
  areaId: string | null
  documentId: string | null
  recipeId: string | null
  name: string
  type: RecordType
  status: RecordStatus
  periodicity: number | null
  notifyDaysBefore: number | null
  isActive: boolean
  createdAt: string
  updatedAt: string
  createdById: string
  fields?: RecordField[]
}

export interface Entry {
  id: string
  recordId: string
  status: EntryStatus
  dueDate: string | null
  revisionDate: string | null
  completedAt: string | null
  createdAt: string
  updatedAt: string
  createdById: string
  data: Record<string, unknown>
  comparisonResults: Record<string, unknown> | null
  formulaResults: Record<string, number> | null
  triggeredById: string | null
}

export interface Instrument {
  id: string
  organizationId: string
  name: string
  code: string | null
  brand: string | null
  model: string | null
  status: InstrumentStatus
  notes: string | null
  createdAt: string
  updatedAt: string
}

export interface NonConformity {
  id: string
  organizationId: string
  entryId: string | null
  fieldId: string | null
  title: string
  description: string
  status: NonConformityStatus
  detectedAt: string
  resolvedAt: string | null
  createdById: string
  assignedToId: string | null
}

export interface QualityRole {
  id: string
  organizationId: string
  organizationUserId: string
  role: QualityRoleType
  createdAt: string
  organizationUser?: OrganizationUser
}

export interface ApprovalRequest {
  id: string
  organizationId: string
  entityType: ApprovableEntity
  entityId: string
  status: ApprovalStatus
  submittedById: string
  submittedAt: string
  completedAt: string | null
  submittedBy?: OrganizationUser
  decisions?: ApprovalDecision[]
}

export interface ApprovalDecision {
  id: string
  approvalRequestId: string
  stage: QualityRoleType
  decision: string
  comments: string | null
  decidedById: string
  decidedAt: string
  decidedBy?: OrganizationUser
}

export interface Recipe {
  id: string
  organizationId: string
  name: string
  code: string | null
  version: number
  status: RecordStatus
  createdById: string
  createdAt: string
  updatedAt: string
  ingredients?: RecipeIngredient[]
  steps?: RecipeStep[]
}

export interface RecipeIngredient {
  id: string
  recipeId: string
  name: string
  quantity: number
  unit: string
  order: number
}

export interface RecipeStep {
  id: string
  recipeId: string
  order: number
  name: string
  description: string | null
  duration: number | null
  controls: string | null
}

export interface Batch {
  id: string
  organizationId: string
  entryId: string
  recordId: string
  recipeId: string | null
  lotNumber: string
  status: BatchStatus
  startedAt: string | null
  completedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface Sample {
  id: string
  organizationId: string
  entryId: string
  recordId: string
  sampleCode: string
  client: string | null
  matrix: string | null
  status: SampleStatus
  receivedAt: string
  completedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface AuditLogEntry {
  id: string
  organizationId: string
  userId: string
  action: string
  entityType: string
  entityId: string
  before: unknown
  after: unknown
  ip: string | null
  createdAt: string
}
