export type FieldType =
  | 'NUMBER'
  | 'TEXT'
  | 'DATE'
  | 'DROPDOWN'
  | 'MATRIX_METHOD'
  | 'RECIPE_SELECT'
  | 'QUANTITY'
  | 'RELATED_ENTRY'
  | 'MULTIPLE_RELATED_ENTRY'
  | 'COMPARISON'
  | 'FORMULA'
  | 'CALIBRATION_TEMPLATE'

export type RecordType =
  | 'PERIODIC'
  | 'NOT_PERIODIC'
  | 'NOT_PERIODIC_WITH_REVISION'
  | 'INSTRUMENTAL'
  | 'BATCH'
  | 'SAMPLE'
  | 'STOCK'

export interface FieldDef {
  id: string
  label: string
  fieldType: FieldType | string
  isIdentifier: boolean
  isRequired: boolean
  comparisonConfig?:
    | {
        operator?: string
        compareAgainst?: 'CONSTANT' | 'FIELD'
        constantValue?: number
        fieldId?: string
        compareFieldId?: string
        secondValue?: number
        failMessage?: string
        options?: string[]
        units?: string[]
      }
    | null
  formulaConfig?: { expression: string } | null
  relatedRecordId?: string | null
  relatedFieldIds?: string[] | null
}

export interface RecordForForm {
  id: string
  name: string
  type: RecordType | string
  version?: number
  fields: FieldDef[]
}

export type FormMode = 'preview' | 'create' | 'edit' | 'view'

export interface EntryMeta {
  lotNumber?: string
  sampleCode?: string
  client?: string
}
