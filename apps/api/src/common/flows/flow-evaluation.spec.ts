import { describe, it, expect } from 'vitest'
import {
  matchesCondition,
  resolveSource,
  type CompanionsBag,
  type FlowEventContext,
} from './flow-evaluation'

/**
 * Estas funciones deciden dos cosas cuando un flujo se dispara: si la condición
 * se cumple, y qué valor concreto se copia al registro destino. Un error acá no
 * rompe nada visible — simplemente escribe el dato equivocado en otra entrada,
 * que es la peor forma de fallar en un sistema que después se audita.
 */

const evento: FlowEventContext = {
  entryId: 'entry-1',
  fieldId: 'f-estado',
  fromValue: 'ABIERTA',
  toValue: 'CERRADA',
}

const sourceData: Record<string, unknown> = {
  'f-estado': 'CERRADA',
  'f-lote': 'L-001',
  'f-cantidad': 42,
}

const companions: CompanionsBag = {
  batch: { lotNumber: 'L-001', status: 'COMPLETED', producedQuantity: 10, unit: 'kg' },
  sample: { sampleCode: 'M-99', status: 'RECEIVED', client: 'ACME' },
  instrument: { status: 'ACTIVE', nextCalibrationAt: null },
}

const sinCompanions: CompanionsBag = { batch: null, sample: null, instrument: null }

describe('resolveSource', () => {
  it('$entry.id devuelve el id de la entry que disparó el evento', () => {
    expect(resolveSource('$entry.id', evento, sourceData, companions)).toBe('entry-1')
  })

  it('$entry.<fieldId> lee del data de la entry origen', () => {
    expect(resolveSource('$entry.f-lote', evento, sourceData, companions)).toBe('L-001')
  })

  it('un fieldId pelado se comporta igual que $entry.<fieldId>', () => {
    // Es el caso historico: los flujos viejos guardaron el id sin prefijo.
    expect(resolveSource('f-lote', evento, sourceData, companions)).toBe('L-001')
  })

  it('lee los campos del evento', () => {
    expect(resolveSource('$event.toValue', evento, sourceData, companions)).toBe('CERRADA')
    expect(resolveSource('$event.fromValue', evento, sourceData, companions)).toBe('ABIERTA')
    expect(resolveSource('$event.fieldId', evento, sourceData, companions)).toBe('f-estado')
  })

  it('lee los companions de lote, muestra e instrumento', () => {
    expect(resolveSource('$batch.lotNumber', evento, sourceData, companions)).toBe('L-001')
    expect(resolveSource('$sample.client', evento, sourceData, companions)).toBe('ACME')
    expect(resolveSource('$instrument.status', evento, sourceData, companions)).toBe('ACTIVE')
  })

  it('$batch.quantity combina cantidad y unidad en un objeto', () => {
    // El destino espera la forma de un field QUANTITY, no dos valores sueltos.
    expect(resolveSource('$batch.quantity', evento, sourceData, companions)).toEqual({
      value: 10,
      unit: 'kg',
    })
  })

  it('$batch.quantity devuelve undefined si el lote no tiene ni cantidad ni unidad', () => {
    const vacio: CompanionsBag = { batch: { producedQuantity: null, unit: null } }
    expect(resolveSource('$batch.quantity', evento, sourceData, vacio)).toBeUndefined()
  })

  it('devuelve undefined cuando el companion no existe', () => {
    // Pasa cuando el flujo referencia $batch.* desde un registro que no es de
    // tipo lote. No debe romper: el mapeo simplemente omite ese campo.
    expect(resolveSource('$batch.lotNumber', evento, sourceData, sinCompanions)).toBeUndefined()
    expect(resolveSource('$sample.client', evento, sourceData, sinCompanions)).toBeUndefined()
  })

  it('devuelve undefined para un field que no existe en la entry', () => {
    expect(resolveSource('f-inventado', evento, sourceData, companions)).toBeUndefined()
  })
})

describe('matchesCondition', () => {
  it('sin condición el flujo se dispara siempre', () => {
    // Es lo que mantiene andando a los flujos creados antes del motor de
    // condiciones.
    expect(matchesCondition(null, evento, sourceData, companions)).toBe(true)
    expect(matchesCondition(undefined, evento, sourceData, companions)).toBe(true)
  })

  it('EQUALS contra un campo del evento', () => {
    const cond = { type: 'EQUALS', field: 'toValue', value: 'CERRADA' }
    expect(matchesCondition(cond, evento, sourceData, companions)).toBe(true)

    const otra = { type: 'EQUALS', field: 'toValue', value: 'ABIERTA' }
    expect(matchesCondition(otra, evento, sourceData, companions)).toBe(false)
  })

  it('compara como texto, así que 42 y "42" son iguales', () => {
    // Los valores llegan de un JSONB y de inputs HTML: el tipo no es confiable.
    const cond = { type: 'EQUALS', field: 'f-cantidad', value: '42' }
    expect(matchesCondition(cond, evento, sourceData, companions)).toBe(true)
  })

  it('IN y NOT_IN', () => {
    const dentro = { type: 'IN', field: 'toValue', value: ['CERRADA', 'ANULADA'] }
    expect(matchesCondition(dentro, evento, sourceData, companions)).toBe(true)

    const fuera = { type: 'NOT_IN', field: 'toValue', value: ['ABIERTA'] }
    expect(matchesCondition(fuera, evento, sourceData, companions)).toBe(true)
  })

  it('IN exige una lista: con un valor suelto no matchea', () => {
    const cond = { type: 'IN', field: 'toValue', value: 'CERRADA' }
    expect(matchesCondition(cond, evento, sourceData, companions)).toBe(false)
  })

  it('comparadores numéricos', () => {
    const base = { field: 'f-cantidad' }
    expect(matchesCondition({ ...base, type: 'GT', value: 40 }, evento, sourceData, companions)).toBe(true)
    expect(matchesCondition({ ...base, type: 'GTE', value: 42 }, evento, sourceData, companions)).toBe(true)
    expect(matchesCondition({ ...base, type: 'LT', value: 40 }, evento, sourceData, companions)).toBe(false)
    expect(matchesCondition({ ...base, type: 'LTE', value: 42 }, evento, sourceData, companions)).toBe(true)
  })

  it('BETWEEN incluye los extremos', () => {
    const dentro = { type: 'BETWEEN', field: 'f-cantidad', value: [42, 50] }
    expect(matchesCondition(dentro, evento, sourceData, companions)).toBe(true)

    const fuera = { type: 'BETWEEN', field: 'f-cantidad', value: [10, 41] }
    expect(matchesCondition(fuera, evento, sourceData, companions)).toBe(false)
  })

  it('BETWEEN necesita exactamente dos valores', () => {
    const cond = { type: 'BETWEEN', field: 'f-cantidad', value: [10] }
    expect(matchesCondition(cond, evento, sourceData, companions)).toBe(false)
  })

  it('AND exige que se cumplan todas', () => {
    const cond = {
      type: 'AND',
      conditions: [
        { type: 'EQUALS', field: 'toValue', value: 'CERRADA' },
        { type: 'GT', field: 'f-cantidad', value: 40 },
      ],
    }
    expect(matchesCondition(cond, evento, sourceData, companions)).toBe(true)

    const falla = {
      type: 'AND',
      conditions: [
        { type: 'EQUALS', field: 'toValue', value: 'CERRADA' },
        { type: 'GT', field: 'f-cantidad', value: 100 },
      ],
    }
    expect(matchesCondition(falla, evento, sourceData, companions)).toBe(false)
  })

  it('OR alcanza con una', () => {
    const cond = {
      type: 'OR',
      conditions: [
        { type: 'EQUALS', field: 'toValue', value: 'ANULADA' },
        { type: 'EQUALS', field: 'toValue', value: 'CERRADA' },
      ],
    }
    expect(matchesCondition(cond, evento, sourceData, companions)).toBe(true)
  })

  it('anida AND dentro de OR', () => {
    const cond = {
      type: 'OR',
      conditions: [
        { type: 'EQUALS', field: 'toValue', value: 'ANULADA' },
        {
          type: 'AND',
          conditions: [
            { type: 'EQUALS', field: '$batch.status', value: 'COMPLETED' },
            { type: 'GTE', field: 'f-cantidad', value: 42 },
          ],
        },
      ],
    }
    expect(matchesCondition(cond, evento, sourceData, companions)).toBe(true)
  })

  it('evalúa condiciones sobre companions', () => {
    const cond = { type: 'EQUALS', field: '$instrument.status', value: 'ACTIVE' }
    expect(matchesCondition(cond, evento, sourceData, companions)).toBe(true)
  })

  it('fail-closed: si el path no resuelve, no dispara', () => {
    // Un flujo que apunta a un campo inexistente no debe ejecutarse "por las
    // dudas": es preferible que no corra a que corra con datos equivocados.
    const cond = { type: 'EQUALS', field: 'f-inventado', value: 'lo que sea' }
    expect(matchesCondition(cond, evento, sourceData, companions)).toBe(false)
  })

  it('fail-closed: NOT_EQUALS tampoco matchea si el path no resuelve', () => {
    // Sin el corte previo, NOT_EQUALS contra undefined daria true y el flujo
    // se dispararia justo cuando menos informacion hay.
    const cond = { type: 'NOT_EQUALS', field: 'f-inventado', value: 'X' }
    expect(matchesCondition(cond, evento, sourceData, companions)).toBe(false)
  })

  it('una condición malformada no dispara', () => {
    expect(matchesCondition({ type: 'EQUALS' }, evento, sourceData, companions)).toBe(false)
    expect(matchesCondition({ field: 'toValue' }, evento, sourceData, companions)).toBe(false)
    expect(
      matchesCondition({ type: 'INVENTADO', field: 'toValue', value: 'x' }, evento, sourceData, companions),
    ).toBe(false)
  })
})
