import type { ActionCondition, ActionConditionPrimitive } from '@synapse/types'

/**
 * Evaluación de condiciones y resolución de valores de un flujo.
 *
 * Vivía como métodos privados de RecordActionListener, pero no toca la base ni
 * el estado del listener: son funciones puras sobre sus argumentos. Extraerlas
 * permite probarlas de verdad, que es lo que decide qué valor termina copiado
 * de un registro a otro cuando un flujo se dispara.
 *
 * El tipo del evento se declara estructuralmente y no importando
 * EntryFieldValueChangedEvent, para que este módulo no dependa de la capa de
 * eventos. La clase real satisface la forma.
 */

export interface FlowEventContext {
  entryId: string
  fieldId?: string
  fromValue?: unknown
  toValue?: unknown
}

export interface CompanionsBag {
  batch?: Record<string, unknown> | null
  sample?: Record<string, unknown> | null
  instrument?: Record<string, unknown> | null
}

/**
 * Resuelve un `sourceFieldId` del fieldMapping a su valor actual. Soporta:
 *   - `$entry.id` → id de la entry que disparó el evento.
 *   - `$entry.<fieldId>` → valor de un field específico de la entry padre.
 *   - `$batch.<key>` → campo del Batch companion (lotNumber, status,
 *     producedQuantity, unit). Solo aplica si el record es type BATCH.
 *   - `$sample.<key>` → campo del Sample companion (sampleCode, status,
 *     client, matrixId). Solo aplica si el record es type SAMPLE.
 *   - `$instrument.<key>` → campo del Instrument companion (status,
 *     nextCalibrationAt). Solo aplica si el record es type INSTRUMENTAL.
 *   - `$event.toValue` / `$event.fromValue` / `$event.fieldId` → del evento.
 *   - `<fieldId>` (default) → valor del field en la entry padre. Caso histórico.
 */
export function resolveSource(
  sourceFieldId: string,
  event: FlowEventContext,
  sourceData: Record<string, unknown>,
  companions?: CompanionsBag,
): unknown {
  if (sourceFieldId === '$entry.id') return event.entryId
  if (sourceFieldId.startsWith('$entry.')) {
    return sourceData[sourceFieldId.slice('$entry.'.length)]
  }
  if (sourceFieldId.startsWith('$batch.')) {
    const key = sourceFieldId.slice('$batch.'.length)
    // Caso especial: `$batch.quantity` combina producedQuantity + unit
    // en un objeto compatible con fields tipo QUANTITY del target.
    if (key === 'quantity' && companions?.batch) {
      const value = companions.batch.producedQuantity
      const unit = companions.batch.unit
      if (value == null && unit == null) return undefined
      return { value: value ?? null, unit: unit ?? null }
    }
    return companions?.batch?.[key] ?? undefined
  }
  if (sourceFieldId.startsWith('$sample.')) {
    const key = sourceFieldId.slice('$sample.'.length)
    return companions?.sample?.[key] ?? undefined
  }
  if (sourceFieldId.startsWith('$instrument.')) {
    const key = sourceFieldId.slice('$instrument.'.length)
    return companions?.instrument?.[key] ?? undefined
  }
  if (sourceFieldId === '$event.toValue') return event.toValue
  if (sourceFieldId === '$event.fromValue') return event.fromValue
  if (sourceFieldId === '$event.fieldId') return event.fieldId
  return sourceData[sourceFieldId]
}

/**
 * Una condición ausente significa "sin filtro": el flujo se dispara siempre.
 * Es lo que hace que los flujos creados antes del motor de condiciones sigan
 * funcionando.
 */
export function matchesCondition(
  condition: unknown,
  event: FlowEventContext,
  sourceData: Record<string, unknown>,
  companions: CompanionsBag,
): boolean {
  if (!condition) return true
  return evalCondition(condition as ActionCondition, event, sourceData, companions)
}

export function evalCondition(
  cond: ActionCondition,
  event: FlowEventContext,
  sourceData: Record<string, unknown>,
  companions: CompanionsBag,
): boolean {
  if (cond.type === 'AND') {
    return cond.conditions.every((c) => evalCondition(c, event, sourceData, companions))
  }
  if (cond.type === 'OR') {
    return cond.conditions.some((c) => evalCondition(c, event, sourceData, companions))
  }
  // Tras los checks AND/OR el resto matchea la forma primitiva; TS no estrecha
  // el union por nombres de propiedad, de ahí el cast.
  return evalPrimitive(cond as ActionConditionPrimitive, event, sourceData, companions)
}

function evalPrimitive(
  cond: ActionConditionPrimitive,
  event: FlowEventContext,
  sourceData: Record<string, unknown>,
  companions: CompanionsBag,
): boolean {
  if (!cond.type || !cond.field) return false

  let actual: unknown
  switch (cond.field) {
    case 'fieldId':
      actual = event.fieldId
      break
    case 'toValue':
      actual = event.toValue
      break
    case 'fromValue':
      actual = event.fromValue
      break
    default:
      // Cualquier otro path se delega en resolveSource. Si no resuelve a nada,
      // fail-closed: una condición que no se puede evaluar no dispara el flujo.
      actual = resolveSource(cond.field, event, sourceData, companions)
      if (actual === undefined) return false
  }

  const expected = cond.value

  switch (cond.type) {
    case 'EQUALS':
      return String(actual) === String(expected)
    case 'NOT_EQUALS':
      return String(actual) !== String(expected)
    case 'IN':
      return Array.isArray(expected) && expected.map(String).includes(String(actual))
    case 'NOT_IN':
      return Array.isArray(expected) && !expected.map(String).includes(String(actual))
    case 'LT':
      return Number(actual) < Number(expected)
    case 'LTE':
      return Number(actual) <= Number(expected)
    case 'GT':
      return Number(actual) > Number(expected)
    case 'GTE':
      return Number(actual) >= Number(expected)
    case 'BETWEEN':
      return (
        Array.isArray(expected) &&
        expected.length === 2 &&
        Number(actual) >= Number(expected[0]) &&
        Number(actual) <= Number(expected[1])
      )
    default:
      return false
  }
}
