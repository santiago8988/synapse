import { ComparisonOperator, UserRole } from './enums'

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

export interface ActionCondition {
  type: 'EQUALS' | 'NOT_EQUALS' | 'IN' | 'NOT_IN'
  /** path del campo en el payload del evento, ej. "fieldId" o "toValue" */
  field: string
  value: string | number | boolean | string[] | number[]
}

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
