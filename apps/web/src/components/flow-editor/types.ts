/**
 * Tipos compartidos del Visual Flow Editor.
 *
 * El editor visualiza y edita una `RecordAction` row del backend. Cada flow
 * en el canvas se compone de hasta 3 nodos (en v1, lineales):
 *   TriggerNode → [ConditionNode] → ActionNode
 *
 * El grafo serializa a una `RecordAction` con la siguiente correspondencia:
 *   - TriggerNode.data.trigger        → RecordAction.trigger
 *   - ConditionNode.data.condition    → RecordAction.condition
 *   - ActionNode.data.actionType      → RecordAction.actionType
 *   - ActionNode.data.targetRecordId  → RecordAction.targetRecordId
 *   - ActionNode.data.fieldMapping    → RecordAction.fieldMapping
 *   - ActionNode.data.actionConfig    → RecordAction.actionConfig
 *   - ActionNode.data.allowCascade    → RecordAction.allowCascade
 */

export type TriggerType =
  | 'ENTRY_CREATED'
  | 'ENTRY_COMPLETED'
  | 'FIELD_VALUE_CHANGED'
  | 'COMPARISON_FAILED'

export type ActionType = 'CREATE_ENTRY' | 'UPDATE_FIELD' | 'NOTIFY' | 'EMAIL' | 'WEBHOOK'

export type ConditionOperator =
  | 'EQUALS'
  | 'NOT_EQUALS'
  | 'IN'
  | 'NOT_IN'
  | 'LT'
  | 'LTE'
  | 'GT'
  | 'GTE'
  | 'BETWEEN'

export interface PrimitiveCondition {
  type: ConditionOperator
  field: string
  value: string | number | boolean | string[] | number[]
}

export interface CompositeCondition {
  type: 'AND' | 'OR'
  conditions: ConditionExpression[]
}

export type ConditionExpression = PrimitiveCondition | CompositeCondition

export interface FieldMappingRow {
  sourceFieldId: string
  targetFieldId: string
}

export interface UpdateFieldActionConfig {
  entryIdSource: string
  fieldId: string
  value: string | number | boolean | null
}

export interface RecordSummary {
  id: string
  name: string
  type: string
}

export interface RecordFieldSummary {
  id: string
  label: string
  fieldType: string
  isIdentifier: boolean
  comparisonConfig?: unknown
}

/** Shape de una RecordAction tal como la devuelve el backend. */
export interface RecordActionRow {
  id: string
  sourceRecordId: string
  targetRecordId: string
  fieldMapping: FieldMappingRow[]
  trigger: TriggerType
  condition: ConditionExpression | null
  allowCascade: boolean
  actionType: ActionType
  actionConfig: unknown
  createdAt: string
  targetRecord: RecordSummary
  /**
   * Faltantes de configuracion calculados por el backend. Si tiene elementos,
   * el flujo NO se ejecuta hasta completarlo: el listener usa exactamente la
   * misma funcion para decidirlo, asi que lo que la UI marca con "!" y lo que
   * el motor omite son el mismo conjunto.
   */
  configWarnings?: string[]
}

/** Estado interno del editor mientras edita o crea un flow. */
export interface FlowDraft {
  id?: string
  trigger: TriggerType
  condition: ConditionExpression | null
  actionType: ActionType
  targetRecordId: string
  fieldMapping: FieldMappingRow[]
  actionConfig: unknown
  allowCascade: boolean
}
