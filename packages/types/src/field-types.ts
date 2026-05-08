import { ComparisonOperator, RecordActionType, UserRole } from './enums'

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

// ─────────────────────────────────────────────
// Workflow engine — condiciones de RecordAction
// ─────────────────────────────────────────────

/**
 * Condición primitiva — compara un campo del payload del evento contra un valor.
 *
 * Operadores soportados:
 *   - EQUALS / NOT_EQUALS: comparación de igualdad (string-coerced).
 *   - IN / NOT_IN: pertenencia a array (`value` debe ser array).
 *   - LT / LTE / GT / GTE: comparación numérica (`value` escalar number).
 *   - BETWEEN: rango inclusivo (`value` debe ser `[min, max]`).
 */
export interface ActionConditionPrimitive {
  type:
    | 'EQUALS' | 'NOT_EQUALS'
    | 'IN' | 'NOT_IN'
    | 'LT' | 'LTE' | 'GT' | 'GTE'
    | 'BETWEEN'
  /** path del campo en el payload del evento, ej. "fieldId", "toValue", "fromValue" */
  field: string
  value: string | number | boolean | string[] | number[]
}

/**
 * Condición compuesta — combina múltiples condiciones (recursivo, sin límite
 * de profundidad). La evaluación es eager — se cortocircuita en el primer fail
 * para AND y en el primer match para OR.
 */
export interface ActionConditionComposite {
  type: 'AND' | 'OR'
  conditions: ActionCondition[]
}

/**
 * Condición de una RecordAction — primitiva u operador booleano recursivo.
 * Si el campo `condition` de la RecordAction es null/undefined, la action
 * dispara siempre que su trigger+actionType matcheen.
 */
export type ActionCondition = ActionConditionPrimitive | ActionConditionComposite

/** @deprecated usar ActionConditionPrimitive cuando se necesite la forma plana */
export type ActionConditionLeaf = ActionConditionPrimitive

// ─────────────────────────────────────────────
// Workflow engine — config de RecordAction según actionType
// ─────────────────────────────────────────────
//
// Cada actionType (ver `RecordActionType`) tiene una shape específica para
// `RecordAction.actionConfig`. CREATE_ENTRY ignora actionConfig: usa las
// columnas dedicadas `targetRecordId` + `fieldMapping` (back-compat).

/** Patcha un field de una entry. La entry destino puede ser la misma del payload
 *  ('self') o una relacionada (a definir cuando haya casos de uso). */
export interface UpdateFieldActionConfig {
  entryIdSource: 'self' | 'related'
  fieldId: string
  /** valor literal — para casos avanzados con expresiones se evolucionará */
  value: string | number | boolean | null
}

/** Notifica a un destinatario derivable. Implementación real con BullMQ + email
 *  queda diferida; en esta iteración el handler loguea. */
export interface NotifyActionConfig {
  /** 'area_owner' = leader del area del Record fuente; 'role:<R>' = todos los
   *  usuarios con ese rol en la org; 'user:<id>' = un OrganizationUser puntual */
  recipients: string
  message: string
}

/** Envía un email. Implementación diferida. */
export interface EmailActionConfig {
  to: string[]
  subject: string
  body: string
}

/** POST/PATCH a un webhook externo. Implementación diferida. */
export interface WebhookActionConfig {
  url: string
  method: 'POST' | 'PATCH'
  headers?: Record<string, string>
}

/** Type discriminado de actionConfig según actionType. */
export type RecordActionConfig =
  | { type: RecordActionType.CREATE_ENTRY }
  | ({ type: RecordActionType.UPDATE_FIELD } & UpdateFieldActionConfig)
  | ({ type: RecordActionType.NOTIFY } & NotifyActionConfig)
  | ({ type: RecordActionType.EMAIL } & EmailActionConfig)
  | ({ type: RecordActionType.WEBHOOK } & WebhookActionConfig)

// ─────────────────────────────────────────────
// Workflow engine — DROPDOWN-as-status
// ─────────────────────────────────────────────
//
// Un campo DROPDOWN puede declarar semántica de status: identifica el field
// como "el estado" de la Entry para el agrupamiento Kanban y aplica reglas
// opcionales de transición. Toda la configuración vive en
// `RecordField.comparisonConfig` (Json), interpretado al runtime con la
// forma `DropdownStatusConfig`.

export type StateColor = 'gray' | 'slate' | 'blue' | 'green' | 'amber' | 'red'

/**
 * Una opción de un DROPDOWN. La forma legacy es `string[]`; la forma rica
 * permite declarar color para Kanban y flags de inicial/final.
 */
export interface DropdownStateOption {
  /** identificador, convención MAYÚSCULAS */
  value: string
  /** label visible en UI (si falta, se usa value) */
  label?: string
  color?: StateColor
  /** exactamente uno por config debe ser true cuando isStatus = true */
  isInitial?: boolean
  /** múltiples permitidos; bloquea transiciones desde este valor cuando hay reglas */
  isFinal?: boolean
  description?: string
}

/**
 * Regla de transición permitida entre dos valores del DROPDOWN.
 * Si el array `transitions` está vacío o ausente, el field permite movimiento
 * libre entre cualquier opción.
 */
export interface FieldTransition {
  /** option.value origen, o "*" para cualquier valor */
  from: string
  /** option.value destino */
  to: string
  /** roles autorizados a ejecutar la transición; vacío = cualquier rol con edit */
  requiredRoles?: UserRole[]
  /** si true, el endpoint de update exige `transitionReason` no vacío */
  requireReason?: boolean
}

/**
 * Estructura del `RecordField.comparisonConfig` cuando el field es DROPDOWN.
 * El array `options` admite las dos formas para retrocompat:
 *   - `string[]` (legacy: solo valores)
 *   - `DropdownStateOption[]` (rico: con color, isInitial, isFinal)
 *
 * Cuando `isStatus = true` el field se trata como el estado canónico de la
 * Entry: el frontend lo usa para Kanban y el backend valida transitions.
 */
export interface DropdownStatusConfig {
  options: string[] | DropdownStateOption[]
  isStatus?: boolean
  transitions?: FieldTransition[]
  /** unidades configurables (legacy — algunos DROPDOWNs ya lo usan) */
  units?: string[]
}

/**
 * Type guard para detectar si las options están en forma rica (objetos)
 * vs legacy (strings).
 */
export function isRichOptions(
  options: string[] | DropdownStateOption[],
): options is DropdownStateOption[] {
  return options.length > 0 && typeof options[0] === 'object'
}
