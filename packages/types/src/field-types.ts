import { ComparisonOperator } from './enums'

export interface ComparisonConfig {
  operator: ComparisonOperator
  compareAgainst: 'CONSTANT' | 'FIELD'
  constantValue?: number
  fieldId?: string
  secondValue?: number
}

export interface ComparisonResult {
  passed: boolean
  value: number | string
  description: string
}

export interface FormulaConfig {
  expression: string
}

export interface RelatedEntryConfig {
  relatedRecordId: string
  relatedFieldIds: string[]
}

export interface RelatedValue {
  entryId: string
  fields: Record<string, string | number>
}

export type FieldValue =
  | number
  | string
  | RelatedValue
  | RelatedValue[]
