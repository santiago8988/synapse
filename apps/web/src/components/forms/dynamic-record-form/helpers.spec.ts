import { describe, it, expect } from 'vitest'
import { computeFormulaResults, evalComparison, resolveFieldValue } from './helpers'
import type { FieldDef, RecordForForm } from './types'

/**
 * Estos helpers calculan lo que el usuario ve **mientras carga** una entrada:
 * el resultado de las fórmulas y si una comparación pasa. El valor que se
 * guarda lo calcula el backend, así que el riesgo acá no es guardar mal, es
 * mostrar un número distinto del que se va a persistir. Alguien decide en base
 * a lo que ve en pantalla.
 *
 * Por eso buena parte de estos casos existe para fijar que el preview coincida
 * con el evaluador del backend, que son dos implementaciones separadas
 * (`TO_DO.md` §19).
 */

const campo = (over: Partial<FieldDef> & { id: string; label: string }): FieldDef => ({
  fieldType: 'NUMBER',
  isIdentifier: false,
  isRequired: false,
  ...over,
})

const registro = (fields: FieldDef[]): RecordForForm => ({
  id: 'rec-1',
  name: 'REGISTRO',
  type: 'PERIODIC',
  fields,
})

describe('computeFormulaResults', () => {
  it('resuelve referencias entre llaves por label', () => {
    const r = registro([
      campo({ id: 'f-a', label: 'PESO' }),
      campo({ id: 'f-b', label: 'CANTIDAD' }),
      campo({
        id: 'f-t',
        label: 'TOTAL',
        fieldType: 'FORMULA',
        formulaConfig: { expression: '{PESO} * {CANTIDAD}' },
      }),
    ])
    expect(computeFormulaResults(r, { 'f-a': 10, 'f-b': 5 })['f-t']).toBe(50)
  })

  it('los espacios no rompen la fórmula', () => {
    const r = registro([
      campo({ id: 'f-a', label: 'A' }),
      campo({ id: 'f-b', label: 'B' }),
      campo({
        id: 'f-r',
        label: 'R',
        fieldType: 'FORMULA',
        formulaConfig: { expression: '( {A} - {B} ) * 2' },
      }),
    ])
    expect(computeFormulaResults(r, { 'f-a': 10, 'f-b': 2 })['f-r']).toBe(16)
  })

  it('encadena fórmulas que dependen de otras', () => {
    const r = registro([
      campo({ id: 'f-a', label: 'A' }),
      campo({
        id: 'f-d',
        label: 'DOBLE',
        fieldType: 'FORMULA',
        formulaConfig: { expression: '{A} * 2' },
      }),
      campo({
        id: 'f-f',
        label: 'FINAL',
        fieldType: 'FORMULA',
        formulaConfig: { expression: '{DOBLE} + 1' },
      }),
    ])
    const out = computeFormulaResults(r, { 'f-a': 5 })
    expect(out['f-d']).toBe(10)
    expect(out['f-f']).toBe(11)
  })

  it('`^` es potencia, igual que en el backend', () => {
    // En JavaScript `^` es XOR: sin traducirlo a `**`, 2^3 mostraba 1 en
    // pantalla y el backend guardaba 8. Este test fija que no vuelva a pasar.
    const r = registro([
      campo({ id: 'f-a', label: 'A' }),
      campo({
        id: 'f-r',
        label: 'R',
        fieldType: 'FORMULA',
        formulaConfig: { expression: '{A} ^ 3' },
      }),
    ])
    expect(computeFormulaResults(r, { 'f-a': 2 })['f-r']).toBe(8)
  })

  it('acepta las funciones de la lista blanca', () => {
    const r = registro([
      campo({ id: 'f-a', label: 'A' }),
      campo({
        id: 'f-r',
        label: 'R',
        fieldType: 'FORMULA',
        formulaConfig: { expression: 'round({A})' },
      }),
    ])
    expect(computeFormulaResults(r, { 'f-a': 2.6 })['f-r']).toBe(3)
  })

  it('rechaza identificadores que no están en la lista blanca', () => {
    // Las fórmulas las escribe un ADMIN y se evalúan en el navegador de quien
    // carga la entrada. Antes el filtro aceptaba cualquier letra, así que
    // `fetch(...)` pasaba y se ejecutaba con acceso a los globales.
    for (const expr of ['fetch', 'constructor', 'alert(1)', 'globalThis']) {
      const r = registro([
        campo({
          id: 'f-r',
          label: 'R',
          fieldType: 'FORMULA',
          formulaConfig: { expression: expr },
        }),
      ])
      expect(computeFormulaResults(r, {})['f-r'], expr).toBeUndefined()
    }
  })

  it('una referencia sin valor deja la fórmula sin resultado', () => {
    const r = registro([
      campo({ id: 'f-a', label: 'A' }),
      campo({ id: 'f-b', label: 'B' }),
      campo({
        id: 'f-r',
        label: 'R',
        fieldType: 'FORMULA',
        formulaConfig: { expression: '{A} + {B}' },
      }),
    ])
    // A diferencia del backend, que persiste 0, el preview no muestra nada:
    // mejor un campo vacío que un número inventado mientras se carga.
    expect(computeFormulaResults(r, { 'f-a': 10 })['f-r']).toBeUndefined()
  })

  it('una dependencia circular no cuelga el navegador', () => {
    const r = registro([
      campo({ id: 'f-x', label: 'X', fieldType: 'FORMULA', formulaConfig: { expression: '{Y} + 1' } }),
      campo({ id: 'f-y', label: 'Y', fieldType: 'FORMULA', formulaConfig: { expression: '{X} + 1' } }),
    ])
    const out = computeFormulaResults(r, {})
    expect(out['f-x']).toBeUndefined()
    expect(out['f-y']).toBeUndefined()
  })
})

describe('resolveFieldValue', () => {
  const r = registro([
    campo({ id: 'f-a', label: 'PESO' }),
    campo({ id: 'f-t', label: 'TOTAL', fieldType: 'FORMULA' }),
  ])

  it('resuelve por id y por label', () => {
    expect(resolveFieldValue('f-a', r, { 'f-a': 7 }, {})).toBe(7)
    expect(resolveFieldValue('PESO', r, { 'f-a': 7 }, {})).toBe(7)
  })

  it('el label no distingue mayúsculas', () => {
    expect(resolveFieldValue('peso', r, { 'f-a': 7 }, {})).toBe(7)
  })

  it('una FORMULA toma su valor de los resultados calculados', () => {
    expect(resolveFieldValue('TOTAL', r, {}, { 'f-t': 42 })).toBe(42)
  })

  it('un campo vacío o no numérico devuelve undefined', () => {
    expect(resolveFieldValue('f-a', r, { 'f-a': '' }, {})).toBeUndefined()
    expect(resolveFieldValue('f-a', r, { 'f-a': 'abc' }, {})).toBeUndefined()
    expect(resolveFieldValue('f-inexistente', r, {}, {})).toBeUndefined()
  })
})

describe('evalComparison', () => {
  const comparacion = (
    config: Record<string, unknown>,
    extra: FieldDef[] = [],
  ): { field: FieldDef; record: RecordForForm } => {
    const field = campo({
      id: 'f-c',
      label: 'CONTROL',
      fieldType: 'COMPARISON',
      comparisonConfig: config,
    })
    return { field, record: registro([field, ...extra]) }
  }

  it('compara contra una constante', () => {
    const { field, record } = comparacion({
      operator: 'GT',
      compareAgainst: 'CONSTANT',
      constantValue: 10,
    })
    expect(evalComparison(field, record, { 'f-c': 15 }, {}).passed).toBe(true)
    expect(evalComparison(field, record, { 'f-c': 5 }, {}).passed).toBe(false)
  })

  it('los bordes de GT y GTE se distinguen', () => {
    const gt = comparacion({ operator: 'GT', compareAgainst: 'CONSTANT', constantValue: 10 })
    const gte = comparacion({ operator: 'GTE', compareAgainst: 'CONSTANT', constantValue: 10 })
    expect(evalComparison(gt.field, gt.record, { 'f-c': 10 }, {}).passed).toBe(false)
    expect(evalComparison(gte.field, gte.record, { 'f-c': 10 }, {}).passed).toBe(true)
  })

  it('compara contra otro campo', () => {
    const otro = campo({ id: 'f-min', label: 'MINIMO' })
    const { field, record } = comparacion(
      { operator: 'GTE', compareAgainst: 'FIELD', compareFieldId: 'MINIMO' },
      [otro],
    )
    expect(evalComparison(field, record, { 'f-c': 12, 'f-min': 10 }, {}).passed).toBe(true)
    expect(evalComparison(field, record, { 'f-c': 8, 'f-min': 10 }, {}).passed).toBe(false)
  })

  it('sin valor cargado no se pronuncia', () => {
    // `null` y no `false`: mientras el técnico no cargó el dato, la comparación
    // no falló, todavía no se puede evaluar. Mostrarla en rojo seria mentir.
    const { field, record } = comparacion({
      operator: 'GT',
      compareAgainst: 'CONSTANT',
      constantValue: 10,
    })
    expect(evalComparison(field, record, {}, {}).passed).toBeNull()
    expect(evalComparison(field, record, { 'f-c': '' }, {}).passed).toBeNull()
  })

  it('sin configuración no se pronuncia', () => {
    const field = campo({ id: 'f-c', label: 'CONTROL', fieldType: 'COMPARISON' })
    const record = registro([field])
    expect(evalComparison(field, record, { 'f-c': 1 }, {}).passed).toBeNull()
  })
})
